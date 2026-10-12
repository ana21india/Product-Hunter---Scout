import { q } from "./db";
import { scoreLaunches, rationale, WINDOW_DAYS, qualifies, MIN_MAKER_COMMENTS, MIN_UPVOTES } from "./scoring";

export type Item = {
  postId: string; slug: string; name: string; tagline: string | null; url: string | null;
  oneLiner: string | null; angle: string | null; serves: string | null; angleState: "ok" | "thin" | "missing";
  category: string; founders: string; founderNames: string[]; votes: number; makerComments: number; createdAt: string;
  rank: number; tier: string; finalScore: number; upvoteScore: number; makerScore: number;
  upvotePoints: number; makerPoints: number; daysSince: number; daysLeft: number; closing: boolean;
  rationale: string; firstSeenAt: string; links: { label: string; url: string }[];
  // From a web search, not from Product Hunt. Only present when exactly one matching profile was found.
  suggestedPeople: { name: string; url: string }[];
  // Kavya's own tracking (she records what she did; the app never sends anything) and Product Hunt trending signals.
  status: "contacted" | "replied" | "skipped" | null; statusAt: string | null;
  dailyRank: number | null; weeklyRank: number | null; votesGain: number;
};

type Maker = { id: string; name: string; websiteUrl?: string | null; twitterUsername?: string | null; url?: string | null };

// Product Hunt display names are free text ("Krish | Chargebee", "Akash Sharma 💭"). For display and search we keep just the name.
export function cleanName(raw: string): string {
  return raw
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .split("|")[0]
    .replace(/\s+/g, " ")
    .trim();
}

const httpUrl = (u: string | null | undefined) => {
  if (!u) return null;
  try { const p = new URL(u.trim()); return p.protocol === "http:" || p.protocol === "https:" ? p.toString() : null; } catch { return null; }
};

// Links shown on a card: the product's own website, and LinkedIn pages that come from real data
// (the company page found on the product's website, or a LinkedIn address a founder listed on Product Hunt).
// Anything missing is simply left out. Nothing is guessed or searched for.
export function buildLinks(website: string | null, makers: Maker[], companyLinkedIn: string | null = null) {
  const links: { label: string; url: string }[] = [];
  const site = httpUrl(website);
  if (site) links.push({ label: "Product website", url: /(^|\.)producthunt\.com$/i.test(new URL(site).hostname) ? site.split("?")[0] : site });
  const co = httpUrl(companyLinkedIn);
  if (co) links.push({ label: "Company on LinkedIn", url: co });
  const solo = makers.length === 1;
  for (const m of makers) {
    const w = httpUrl(m.websiteUrl);
    if (w && /(^|\.)linkedin\.com$/i.test(new URL(w).hostname)) links.push({ label: `${solo ? "Founder" : m.name} on LinkedIn`, url: w });
  }
  return links;
}
export type FilteredOut = { postId: string; name: string; tagline: string | null; url: string | null; reason: string | null; serves: string | null; votes: number; createdAt: string };
export type RunInfo = {
  lastGoodAt: string | null; lastGoodWasSnapshot: boolean; latestStatus: string | null; latestAt: string | null;
  latestStartedAt: string | null; latestNote: string | null; latestError: string | null; newLaunches: number | null; refreshed: number | null; running: boolean;
};
// A relevant launch that does not qualify for the ranking yet (makers not active enough, or too few upvotes). Re-checked on every run.
export type WatchItem = {
  postId: string; name: string; url: string | null; oneLiner: string | null; serves: string | null; category: string;
  votes: number; makerComments: number; daysSince: number; daysLeft: number; reasons: string[];
  status: "contacted" | "replied" | "skipped" | null; statusAt: string | null;
};
// Anything Kavya has marked (contacted, replied or skipped), even after the launch has left the 7-day window.
export type TrackedItem = {
  postId: string; name: string; url: string | null; status: "contacted" | "replied" | "skipped"; statusAt: string;
  votes: number; inWindow: boolean; daysLeft: number; rank: number | null; tier: string | null;
};
export type Dashboard = { items: Item[]; watchlist: WatchItem[]; tracked: TrackedItem[]; thresholds: { minMaker: number; minVotes: number }; filteredOut: FilteredOut[]; filteredCount: number; pending: number; run: RunInfo; windowDays: number; serverTime: string };

// Reads only from the database. Scores and ranks are computed here, from the current eligible set, on every read.
export async function getDashboard(includeFiltered = false): Promise<Dashboard> {
  const rows = await q(
    `SELECT l.post_id, l.slug, l.name, l.tagline, l.url, l.website, l.votes_count, l.created_at, l.first_seen_at, l.makers, l.category,
            r.relevant, r.reason, r.serves, m.maker_comment_count, a.one_liner, a.angle, a.status AS angle_status, l.daily_rank, l.weekly_rank, l.votes_prev, l.votes_prev_at, act.status AS action_status, act.updated_at AS action_at
     FROM launches l JOIN relevance r ON r.post_id = l.post_id
     LEFT JOIN maker_comments m ON m.post_id = l.post_id
     LEFT JOIN angles a ON a.post_id = l.post_id
     LEFT JOIN actions act ON act.post_id = l.post_id
     WHERE l.created_at > now() - interval '${WINDOW_DAYS} days'`,
  );
  const readyAll = rows.filter((r) => r.relevant && r.maker_comment_count !== null);
  const ready = readyAll.filter((r) => qualifies({ votes: r.votes_count, makerComments: r.maker_comment_count }));
  const waiting = readyAll.filter((r) => !qualifies({ votes: r.votes_count, makerComments: r.maker_comment_count }));
  const pending = rows.filter((r) => r.relevant && r.maker_comment_count === null).length;
  const filteredOut: FilteredOut[] = rows.filter((r) => !r.relevant).map((r) => ({
    postId: r.post_id, name: r.name, tagline: r.tagline, url: r.url, reason: r.reason, serves: r.serves ?? null, votes: r.votes_count,
    createdAt: new Date(r.created_at).toISOString(),
  })).sort((a, b) => b.votes - a.votes);

  const byId = new Map(ready.map((r) => [r.post_id, r]));
  const foundRows = ready.length
    ? await q(`SELECT post_id, maker_name, url FROM founder_links WHERE url IS NOT NULL AND post_id = ANY($1::text[])`, [ready.map((r) => r.post_id)])
    : [];
  const siteRows = ready.length
    ? await q(`SELECT post_id, linkedin_company FROM site_links WHERE linkedin_company IS NOT NULL AND post_id = ANY($1::text[])`, [ready.map((r) => r.post_id)])
    : [];
  const siteBy = new Map<string, string>(siteRows.map((r: any) => [r.post_id, r.linkedin_company]));
  const foundBy = new Map<string, { name: string; url: string }[]>();
  for (const f of foundRows) foundBy.set(f.post_id, [...(foundBy.get(f.post_id) ?? []), { name: f.maker_name, url: f.url }]);
  const scored = scoreLaunches(ready.map((r) => ({
    postId: r.post_id as string, votes: r.votes_count as number, makerComments: r.maker_comment_count as number, createdAt: new Date(r.created_at).toISOString(),
  })));
  const items: Item[] = scored.map((s) => {
    const r = byId.get(s.postId)!;
    const makers = (r.makers as Maker[]).filter((m) => m.id !== "0" && m.name && m.name !== "[REDACTED]");
    const founderNames = [...new Set(makers.map((m) => cleanName(m.name)).filter(Boolean))];
    return {
      postId: s.postId, slug: r.slug, name: r.name, tagline: r.tagline, url: r.url,
      oneLiner: r.one_liner ?? null, angle: r.angle ?? null, serves: r.serves ?? null,
      angleState: r.angle_status === "ok" ? "ok" : r.angle_status === "thin" ? "thin" : "missing",
      category: r.category, founders: founderNames.join(", ") || "Not listed", founderNames,
      votes: s.votes, makerComments: s.makerComments, createdAt: s.createdAt as string,
      rank: s.rank, tier: s.tier, finalScore: s.finalScore, upvoteScore: s.upvoteScore, makerScore: s.makerScore,
      upvotePoints: s.upvotePoints, makerPoints: s.makerPoints, daysSince: s.daysSince, daysLeft: s.daysLeft, closing: s.closing,
      rationale: rationale(s), firstSeenAt: new Date(r.first_seen_at).toISOString(),
      links: buildLinks(r.website, makers, siteBy.get(s.postId) ?? null),
      suggestedPeople: (foundBy.get(s.postId) ?? []),
      status: (r.action_status ?? null) as Item["status"], statusAt: r.action_at ? new Date(r.action_at).toISOString() : null,
      dailyRank: r.daily_rank ?? null, weeklyRank: r.weekly_rank ?? null,
      votesGain: r.votes_prev_at && Date.now() - new Date(r.votes_prev_at).getTime() < 24 * 3600e3 && r.votes_prev != null ? Math.max(0, s.votes - r.votes_prev) : 0,
    };
  });

  const dayMs = 864e5;
  const watchlist: WatchItem[] = waiting.map((r) => {
    const daysSince = Math.floor((Date.now() - new Date(r.created_at).getTime()) / dayMs);
    const reasons: string[] = [];
    if (r.maker_comment_count === 0) reasons.push("Makers have not commented yet");
    else if (r.maker_comment_count < MIN_MAKER_COMMENTS) reasons.push("Only an intro comment from the makers so far");
    if (r.votes_count < MIN_UPVOTES) reasons.push(`Under ${MIN_UPVOTES} upvotes so far`);
    return {
      postId: r.post_id, name: r.name, url: r.url, oneLiner: r.one_liner ?? null, serves: r.serves ?? null, category: r.category,
      votes: r.votes_count, makerComments: r.maker_comment_count, daysSince, daysLeft: WINDOW_DAYS - daysSince, reasons,
      status: (r.action_status ?? null) as WatchItem["status"], statusAt: r.action_at ? new Date(r.action_at).toISOString() : null,
    };
  }).sort((a, b) => b.votes - a.votes || b.makerComments - a.makerComments);

  const trackedRows = await q(
    `SELECT a.post_id, a.status, a.updated_at, l.name, l.url, l.votes_count, l.created_at FROM actions a JOIN launches l ON l.post_id = a.post_id ORDER BY a.updated_at DESC`,
  );
  const rankById = new Map(items.map((i) => [i.postId, i]));
  const tracked: TrackedItem[] = trackedRows.map((t) => {
    const daysSince = Math.floor((Date.now() - new Date(t.created_at).getTime()) / dayMs);
    const ranked = rankById.get(t.post_id);
    return {
      postId: t.post_id, name: t.name, url: t.url, status: t.status, statusAt: new Date(t.updated_at).toISOString(), votes: t.votes_count,
      inWindow: daysSince < WINDOW_DAYS, daysLeft: Math.max(0, WINDOW_DAYS - daysSince), rank: ranked?.rank ?? null, tier: ranked?.tier ?? null,
    };
  });

  const runs = await q(`SELECT status, started_at, finished_at, note, error, new_launches, refreshed FROM run_log ORDER BY id DESC LIMIT 30`);
  const latest = runs[0];
  const good = runs.find((r) => r.status === "live" || r.status === "partial");
  const run: RunInfo = {
    lastGoodAt: good?.finished_at ? new Date(good.finished_at).toISOString() : null,
    lastGoodWasSnapshot: !!good?.note?.includes("Starting snapshot"),
    latestStatus: latest?.status ?? null,
    latestAt: latest?.finished_at ? new Date(latest.finished_at).toISOString() : null,
    latestStartedAt: latest?.started_at ? new Date(latest.started_at).toISOString() : null,
    latestNote: latest?.note ?? null,
    latestError: latest?.error ?? null,
    newLaunches: latest?.new_launches ?? null,
    refreshed: latest?.refreshed ?? null,
    running: latest?.status === "running" && Date.now() - new Date(latest.started_at).getTime() < 10 * 60e3,
  };
  return { items, watchlist, tracked, thresholds: { minMaker: MIN_MAKER_COMMENTS, minVotes: MIN_UPVOTES }, filteredOut: includeFiltered ? filteredOut : [], filteredCount: filteredOut.length, pending, run, windowDays: WINDOW_DAYS, serverTime: new Date().toISOString() };
}
