// Scoring rubric, implemented exactly as agreed. Pure functions: no database, no network.
// Scores and ranks are never stored. They are computed from the raw signals whenever the page is read.

export const WINDOW_DAYS = 7;
export const W_UPVOTES = 0.6;
export const W_MAKER = 0.4;
const DAY_MS = 864e5;
const TIE_EPS = 1e-9;

// Qualification: a launch is ranked only when its makers are visibly active and it has some traction.
// Makers must have written at least MIN_MAKER_COMMENTS comments or replies (more than the usual single intro post),
// and the launch needs at least MIN_UPVOTES upvotes (roughly the top 10% of launches in a typical week).
// Launches that do not qualify yet stay visible on the Watchlist and are re-checked on every run.
export const MIN_MAKER_COMMENTS = 2;
export const MIN_UPVOTES = 10;
export const qualifies = (r: { votes: number; makerComments: number }) => r.makerComments >= MIN_MAKER_COMMENTS && r.votes >= MIN_UPVOTES;

export type Tier = "Priority" | "Strong fit" | "Consider" | "Lower priority";

export type RawLaunch = {
  postId: string;
  votes: number;
  makerComments: number;
  createdAt: string | Date;
};

export type Scored<T extends RawLaunch> = T & {
  rank: number;
  tier: Tier;
  upvoteScore: number; // 0-100
  makerScore: number; // 0-100
  upvotePoints: number; // 60% share of the final score
  makerPoints: number; // 40% share of the final score
  finalScore: number; // 0-100, full precision
  upvotePct: number; // same as upvoteScore, for the rationale text
  makerPct: number;
  daysSince: number; // whole days since launch (0 = launched today)
  daysLeft: number; // days left in the 7-day window
  closing: boolean; // day 6 to 7
};

export function tierForRank(rank: number): Tier {
  if (rank <= 4) return "Priority";
  if (rank <= 8) return "Strong fit";
  if (rank <= 12) return "Consider";
  return "Lower priority";
}

const elapsedDays = (createdAt: string | Date, now: Date) => (now.getTime() - new Date(createdAt).getTime()) / DAY_MS;

// The eligible set: launches inside the last 7 days, duplicates removed by post id.
export function eligibleSet<T extends RawLaunch>(rows: T[], now: Date = new Date()): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const d = elapsedDays(r.createdAt, now);
    if (d < 0 || d >= WINDOW_DAYS) continue;
    if (seen.has(r.postId)) continue;
    seen.add(r.postId);
    out.push(r);
  }
  return out;
}

// Order by final score (descending). Ties: more maker comments, then more upvotes, then the older post id.
function compare<T extends RawLaunch & { finalScore: number }>(a: T, b: T) {
  if (Math.abs(a.finalScore - b.finalScore) > TIE_EPS) return b.finalScore - a.finalScore;
  if (a.makerComments !== b.makerComments) return b.makerComments - a.makerComments;
  if (a.votes !== b.votes) return b.votes - a.votes;
  const ai = BigInt(a.postId), bi = BigInt(b.postId);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}

export function scoreLaunches<T extends RawLaunch>(rows: T[], now: Date = new Date()): Scored<T>[] {
  const set = eligibleSet(rows, now);
  const maxVotes = Math.max(0, ...set.map((r) => r.votes));
  const maxMaker = Math.max(0, ...set.map((r) => r.makerComments));
  const scored = set.map((r) => {
    const upvoteScore = maxVotes > 0 ? (r.votes / maxVotes) * 100 : 0;
    const makerScore = maxMaker > 0 ? (r.makerComments / maxMaker) * 100 : 0;
    const upvotePoints = W_UPVOTES * upvoteScore;
    const makerPoints = W_MAKER * makerScore;
    const daysSince = Math.floor(elapsedDays(r.createdAt, now));
    return {
      ...r,
      upvoteScore,
      makerScore,
      upvotePoints,
      makerPoints,
      finalScore: upvotePoints + makerPoints,
      upvotePct: upvoteScore,
      makerPct: makerScore,
      daysSince,
      daysLeft: WINDOW_DAYS - daysSince,
      closing: daysSince >= 6,
      rank: 0,
      tier: "Lower priority" as Tier,
    };
  });
  scored.sort(compare);
  scored.forEach((s, i) => {
    s.rank = i + 1;
    s.tier = tierForRank(s.rank);
  });
  return scored;
}

// Rationale text built from the real numbers, so it is always true to the score.
export function rationale(s: Pick<Scored<RawLaunch>, "upvotePct" | "makerPct">): string {
  return `Upvotes ${Math.round(s.upvotePct)}% of the highest; maker comments ${Math.round(s.makerPct)}% of the highest`;
}
