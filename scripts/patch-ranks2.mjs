import fs from "node:fs";

const file = "src/lib/run.ts";
const raw = fs.readFileSync(file, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);
const i = lines.findIndex((l) => l.includes("UPDATE launches l SET votes_count=x.votes"));
if (i < 0 || !lines[i + 1].includes("FROM jsonb_to_recordset") || !lines[i + 2].includes("votes: c.votesCount")) throw new Error("expected lines not found");
const indent = lines[i].match(/^\s*/)[0];
const replacement = [
  indent + "`UPDATE launches l SET",
  indent + "   votes_prev = CASE WHEN l.votes_count <> x.votes THEN l.votes_count ELSE l.votes_prev END,",
  indent + "   votes_prev_at = CASE WHEN l.votes_count <> x.votes THEN now() ELSE l.votes_prev_at END,",
  indent + "   votes_count=x.votes, comments_count=x.comments, daily_rank=x.daily, weekly_rank=x.weekly, last_refreshed=now()",
  indent + " FROM jsonb_to_recordset($1::jsonb) AS x(id text, votes int, comments int, daily int, weekly int) WHERE l.post_id=x.id`,",
  lines[i + 2].replace("commentsCount })))]", "commentsCount, daily: c.dailyRank, weekly: c.weeklyRank })))]"),
];
lines.splice(i, 3, ...replacement);
fs.writeFileSync(file, lines.join(eol), "utf8");
console.log("run.ts patched");
