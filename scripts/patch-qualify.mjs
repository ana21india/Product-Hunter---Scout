import fs from "node:fs";

function load(file) {
  const raw = fs.readFileSync(file, "utf8");
  return { eol: raw.includes("\r\n") ? "\r\n" : "\n", lines: raw.split(/\r?\n/) };
}
function save(file, { eol, lines }) { fs.writeFileSync(file, lines.join(eol), "utf8"); console.log("patched", file); }
function idx(lines, marker) {
  const i = lines.findIndex((l) => l.includes(marker));
  if (i < 0) throw new Error("marker not found: " + marker);
  return i;
}

// ---- scoring.ts: the qualification rule ----
{
  const f = load("src/lib/scoring.ts");
  const i = idx(f.lines, "const TIE_EPS = 1e-9;");
  f.lines.splice(i + 1, 0,
    "",
    "// Qualification: a launch is ranked only when its makers are visibly active and it has some traction.",
    "// Makers must have written at least MIN_MAKER_COMMENTS comments or replies (more than the usual single intro post),",
    "// and the launch needs at least MIN_UPVOTES upvotes (roughly the top 10% of launches in a typical week).",
    "// Launches that do not qualify yet stay visible on the Watchlist and are re-checked on every run.",
    "export const MIN_MAKER_COMMENTS = 2;",
    "export const MIN_UPVOTES = 10;",
    "export const qualifies = (r: { votes: number; makerComments: number }) => r.makerComments >= MIN_MAKER_COMMENTS && r.votes >= MIN_UPVOTES;",
  );
  save("src/lib/scoring.ts", f);
}

// ---- data.ts: split ranked vs watchlist, and list tracked actions ----
{
  const file = "src/lib/data.ts";
  const f = load(file);
  let s = f.lines.join(f.eol);
  function rep(from, to) {
    if (!s.includes(from)) throw new Error("not found in data.ts: " + from.slice(0, 80));
    s = s.replace(from, to);
  }
  rep('import { scoreLaunches, rationale, WINDOW_DAYS } from "./scoring";', 'import { scoreLaunches, rationale, WINDOW_DAYS, qualifies, MIN_MAKER_COMMENTS, MIN_UPVOTES } from "./scoring";');
  rep(
    "export type Dashboard = { items: Item[]; filteredOut: FilteredOut[]; filteredCount: number;",
    `// A relevant launch that does not qualify for the ranking yet (makers not active enough, or too few upvotes). Re-checked on every run.
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
export type Dashboard = { items: Item[]; watchlist: WatchItem[]; tracked: TrackedItem[]; thresholds: { minMaker: number; minVotes: number }; filteredOut: FilteredOut[]; filteredCount: number;`,
  );
  rep(
    "  const ready = rows.filter((r) => r.relevant && r.maker_comment_count !== null);",
    `  const readyAll = rows.filter((r) => r.relevant && r.maker_comment_count !== null);
  const ready = readyAll.filter((r) => qualifies({ votes: r.votes_count, makerComments: r.maker_comment_count }));
  const waiting = readyAll.filter((r) => !qualifies({ votes: r.votes_count, makerComments: r.maker_comment_count }));`,
  );
  rep(
    "  const runs = await q(`SELECT status, started_at",
    `  const dayMs = 864e5;
  const watchlist: WatchItem[] = waiting.map((r) => {
    const daysSince = Math.floor((Date.now() - new Date(r.created_at).getTime()) / dayMs);
    const reasons: string[] = [];
    if (r.maker_comment_count === 0) reasons.push("Makers have not commented yet");
    else if (r.maker_comment_count < MIN_MAKER_COMMENTS) reasons.push("Only an intro comment from the makers so far");
    if (r.votes_count < MIN_UPVOTES) reasons.push(\`Under \${MIN_UPVOTES} upvotes so far\`);
    return {
      postId: r.post_id, name: r.name, url: r.url, oneLiner: r.one_liner ?? null, serves: r.serves ?? null, category: r.category,
      votes: r.votes_count, makerComments: r.maker_comment_count, daysSince, daysLeft: WINDOW_DAYS - daysSince, reasons,
      status: (r.action_status ?? null) as WatchItem["status"], statusAt: r.action_at ? new Date(r.action_at).toISOString() : null,
    };
  }).sort((a, b) => b.votes - a.votes || b.makerComments - a.makerComments);

  const trackedRows = await q(
    \`SELECT a.post_id, a.status, a.updated_at, l.name, l.url, l.votes_count, l.created_at FROM actions a JOIN launches l ON l.post_id = a.post_id ORDER BY a.updated_at DESC\`,
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

  const runs = await q(\`SELECT status, started_at`,
  );
  rep(
    "return { items, filteredOut: includeFiltered ? filteredOut : [],",
    "return { items, watchlist, tracked, thresholds: { minMaker: MIN_MAKER_COMMENTS, minVotes: MIN_UPVOTES }, filteredOut: includeFiltered ? filteredOut : [],",
  );
  f.lines = s.split(/\r?\n/);
  save(file, f);
}
