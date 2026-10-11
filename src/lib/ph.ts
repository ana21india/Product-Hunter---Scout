const ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
const LOW = 350;

export class BudgetError extends Error {}

// Shared state for the current run: how much Product Hunt allowance is left and how to react when it is low.
export const budget = {
  remaining: null as number | null,
  resetSec: 900,
  mode: "wait" as "wait" | "stop",
  deadline: Infinity,
  requests: 0, // Product Hunt requests sent during this process, for usage reporting
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ph<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (Date.now() > budget.deadline) throw new BudgetError("time limit reached");
    if (budget.remaining !== null && budget.remaining < LOW) {
      if (budget.mode === "stop") throw new BudgetError("Product Hunt allowance nearly used up");
      console.log(`  low allowance (${budget.remaining}), waiting ${budget.resetSec + 5}s for reset`);
      await sleep((budget.resetSec + 5) * 1000);
      budget.remaining = null;
    }
    budget.requests++;
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PH_TOKEN}` },
      body: JSON.stringify({ query, variables }),
    });
    const rem = Number(r.headers.get("x-rate-limit-remaining"));
    const reset = Number(r.headers.get("x-rate-limit-reset"));
    if (r.status === 429) {
      const j: any = await r.json().catch(() => null);
      const w = (j?.errors?.[0]?.details?.reset_in ?? 120) + 5;
      if (budget.mode === "stop") throw new BudgetError(`rate limited, resets in ${w}s`);
      console.log(`  rate limited, waiting ${w}s`);
      await sleep(w * 1000);
      budget.remaining = null;
      continue;
    }
    if (!r.ok) throw new Error(`Product Hunt HTTP ${r.status}`);
    if (Number.isFinite(rem)) budget.remaining = rem;
    if (Number.isFinite(reset) && reset > 0) budget.resetSec = reset;
    const j: any = await r.json();
    if (j.errors) throw new Error("Product Hunt: " + JSON.stringify(j.errors).slice(0, 200));
    return j.data as T;
  }
  throw new Error("Product Hunt: too many retries");
}

export type RawLaunch = {
  id: string; slug: string; name: string; tagline: string | null; description: string | null;
  url: string | null; website: string | null; votesCount: number; commentsCount: number; createdAt: string;
  topics: string[];
};

// All launches in one topic posted after `after`, newest first, every page.
export async function fetchTopicLaunches(topic: string, after: string, onPage?: (rows: RawLaunch[]) => Promise<void>) {
  const Q = `query($t:String,$a:DateTime,$c:String){ posts(first:20, topic:$t, postedAfter:$a, after:$c, order:NEWEST){
    pageInfo{hasNextPage endCursor}
    edges{ node{ id slug name tagline description url website votesCount commentsCount createdAt topics(first:10){ edges{ node{ slug } } } } } } }`;
  let cursor: string | null = null;
  let n = 0;
  do {
    const d: any = await ph(Q, { t: topic, a: after, c: cursor });
    const rows: RawLaunch[] = d.posts.edges.map(({ node }: any) => ({
      ...node, topics: node.topics.edges.map((e: any) => e.node.slug),
    }));
    n += rows.length;
    if (onPage) await onPage(rows);
    cursor = d.posts.pageInfo.hasNextPage ? d.posts.pageInfo.endCursor : null;
  } while (cursor);
  return n;
}

// Makers (real ids only come from the single-post query, not from lists) plus a strict count of comments and replies
// written by those makers, matched on user id. Page sizes follow the launch's comment total, which keeps the cost small.
export async function fetchMakersAndCounts(slug: string, commentsCount: number) {
  let total = 0, maker = 0, unattributed = 0;
  let makers: { id: string; name: string; username: string }[] = [];
  let makerIds = new Set<string>();
  const tally = (uid: string | null) => {
    total++;
    if (!uid || uid === "0") unattributed++;
    else if (makerIds.has(uid)) maker++;
  };
  if (commentsCount <= 0) {
    const d: any = await ph(`query($s:String){ post(slug:$s){ makers{ id name username websiteUrl twitterUsername url } } }`, { s: slug });
    return { makers: (d.post?.makers ?? []) as typeof makers, total, maker, unattributed };
  }
  const pageSize = Math.min(15, commentsCount);
  const replySize = Math.min(10, commentsCount);
  let after: string | null = null;
  let first = true;
  do {
    const d: any = await ph(
      `query($s:String,$a:String){ post(slug:$s){ ${first ? "makers{ id name username websiteUrl twitterUsername url }" : ""} comments(first:${pageSize}, after:$a){ pageInfo{hasNextPage endCursor}
        edges{ node{ id userId replies(first:${replySize}){ pageInfo{hasNextPage endCursor} edges{ node{ userId } } } } } } } }`,
      { s: slug, a: after },
    );
    if (first) { makers = d.post.makers ?? []; makerIds = new Set(makers.map((m) => m.id)); first = false; }
    const c = d.post.comments;
    for (const { node } of c.edges) {
      tally(node.userId);
      for (const r of node.replies.edges) tally(r.node.userId);
      let rp = node.replies.pageInfo;
      while (rp.hasNextPage) {
        const e: any = await ph(
          `query($id:ID!,$a:String){ comment(id:$id){ replies(first:20, after:$a){ pageInfo{hasNextPage endCursor} edges{ node{ userId } } } } }`,
          { id: node.id, a: rp.endCursor },
        );
        for (const r of e.comment.replies.edges) tally(r.node.userId);
        rp = e.comment.replies.pageInfo;
      }
    }
    after = c.pageInfo.hasNextPage ? c.pageInfo.endCursor : null;
  } while (after);
  return { makers, total, maker, unattributed };
}

// Current upvotes and total comment count for up to ~20 posts in one request.
export async function fetchCurrent(ids: string[]) {
  const body = ids.map((id, i) => `p${i}: post(id:"${id}"){ id votesCount commentsCount }`).join(" ");
  const d: any = await ph(`{ ${body} }`);
  return Object.values(d).filter(Boolean) as { id: string; votesCount: number; commentsCount: number }[];
}

export type MakerCounts = { makers: { id: string; name: string; username: string }[]; total: number; maker: number; unattributed: number };

// Makers and strict maker-comment counts for many launches in ONE request (a request costs the same however many launches it holds).
// Product Hunt sometimes redacts a maker's id inside a big request, so any launch with a redacted maker is re-read on its own.
// Launches whose comments don't fit in the first page also fall back to the page-by-page version.
export async function fetchMakersAndCountsBatch(items: { id: string; slug: string; cc: number }[]) {
  const out = new Map<string, MakerCounts>();
  const body = items.map((it, i) =>
    `p${i}: post(id:"${it.id}"){ makers{ id name username websiteUrl twitterUsername url } comments(first:10){ pageInfo{hasNextPage} edges{ node{ userId replies(first:5){ pageInfo{hasNextPage} edges{ node{ userId } } } } } } }`,
  ).join(" ");
  const d: any = await ph(`{ ${body} }`);
  for (let i = 0; i < items.length; i++) {
    const p = d[`p${i}`];
    const it = items[i];
    if (!p) continue;
    let overflow = p.comments.pageInfo.hasNextPage;
    const uids: (string | null)[] = [];
    for (const { node } of p.comments.edges) {
      uids.push(node.userId);
      if (node.replies.pageInfo.hasNextPage) overflow = true;
      for (const r of node.replies.edges) uids.push(r.node.userId);
    }
    let makers = p.makers ?? [];
    if (overflow) { out.set(it.id, await fetchMakersAndCounts(it.slug, it.cc)); continue; }
    if (makers.some((m: any) => m.id === "0")) {
      const s: any = await ph(`query($s:String){ post(slug:$s){ makers{ id name username websiteUrl twitterUsername url } } }`, { s: it.slug });
      makers = s.post?.makers ?? makers;
    }
    const ids = new Set<string>(makers.map((m: any) => m.id));
    let maker = 0, unattributed = 0;
    for (const u of uids) { if (!u || u === "0") unattributed++; else if (ids.has(u)) maker++; }
    out.set(it.id, { makers, total: uids.length, maker, unattributed });
  }
  return out;
}

