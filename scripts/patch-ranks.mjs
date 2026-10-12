import fs from "node:fs";

function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`not found in ${file}: ${from.slice(0, 70)}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(file, s, "utf8");
  console.log("patched", file);
}

patch("src/lib/ph.ts", [
  [
    'p${i}: post(id:"${id}"){ id votesCount commentsCount }`',
    'p${i}: post(id:"${id}"){ id votesCount commentsCount dailyRank weeklyRank }`',
  ],
  [
    "return Object.values(d).filter(Boolean) as { id: string; votesCount: number; commentsCount: number }[];",
    "return Object.values(d).filter(Boolean) as { id: string; votesCount: number; commentsCount: number; dailyRank: number | null; weeklyRank: number | null }[];",
  ],
]);

patch("src/lib/run.ts", [
  [
    "`UPDATE launches l SET votes_count=x.votes, comments_count=x.comments, last_refreshed=now()\n         FROM jsonb_to_recordset($1::jsonb) AS x(id text, votes int, comments int) WHERE l.post_id=x.id`,",
    "`UPDATE launches l SET\n           votes_prev = CASE WHEN l.votes_count <> x.votes THEN l.votes_count ELSE l.votes_prev END,\n           votes_prev_at = CASE WHEN l.votes_count <> x.votes THEN now() ELSE l.votes_prev_at END,\n           votes_count=x.votes, comments_count=x.comments, daily_rank=x.daily, weekly_rank=x.weekly, last_refreshed=now()\n         FROM jsonb_to_recordset($1::jsonb) AS x(id text, votes int, comments int, daily int, weekly int) WHERE l.post_id=x.id`,",
  ],
  [
    "[JSON.stringify(cur.map((c) => ({ id: c.id, votes: c.votesCount, comments: c.commentsCount })))],",
    "[JSON.stringify(cur.map((c) => ({ id: c.id, votes: c.votesCount, comments: c.commentsCount, daily: c.dailyRank, weekly: c.weeklyRank })))],",
  ],
]);
