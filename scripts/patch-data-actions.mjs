import fs from "node:fs";

const file = "src/lib/data.ts";
const raw = fs.readFileSync(file, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
let lines = raw.split(/\r?\n/);

function after(marker, add) {
  const i = lines.findIndex((l) => l.includes(marker));
  if (i < 0) throw new Error("marker not found: " + marker);
  lines.splice(i + 1, 0, ...add);
}
function replaceIn(marker, from, to) {
  const i = lines.findIndex((l) => l.includes(marker));
  if (i < 0) throw new Error("marker not found: " + marker);
  if (!lines[i].includes(from)) throw new Error("text not found on line: " + from);
  lines[i] = lines[i].replace(from, to);
}

after("suggestedPeople: { name: string; url: string }[];", [
  "  // Kavya's own tracking (she records what she did; the app never sends anything) and Product Hunt trending signals.",
  '  status: "contacted" | "replied" | "skipped" | null; statusAt: string | null;',
  "  dailyRank: number | null; weeklyRank: number | null; votesGain: number;",
]);
replaceIn("a.status AS angle_status", "a.status AS angle_status", "a.status AS angle_status, l.daily_rank, l.weekly_rank, l.votes_prev, l.votes_prev_at, act.status AS action_status, act.updated_at AS action_at");
after("LEFT JOIN angles a ON a.post_id = l.post_id", ["     LEFT JOIN actions act ON act.post_id = l.post_id"]);
after("suggestedPeople: (foundBy.get(s.postId) ?? []),", [
  '      status: (r.action_status ?? null) as Item["status"], statusAt: r.action_at ? new Date(r.action_at).toISOString() : null,',
  "      dailyRank: r.daily_rank ?? null, weeklyRank: r.weekly_rank ?? null,",
  "      votesGain: r.votes_prev_at && Date.now() - new Date(r.votes_prev_at).getTime() < 24 * 3600e3 && r.votes_prev != null ? Math.max(0, s.votes - r.votes_prev) : 0,",
]);
fs.writeFileSync(file, lines.join(eol), "utf8");
console.log("data.ts patched");
