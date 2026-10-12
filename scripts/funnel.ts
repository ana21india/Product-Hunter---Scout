import { getDashboard } from "../src/lib/data";
import { q } from "../src/lib/db";

const d = await getDashboard();
const all = [
  ...d.items.map((i) => ({ name: i.name, votes: i.votes, mc: i.makerComments })),
  ...d.watchlist.map((w) => ({ name: w.name, votes: w.votes, mc: w.makerComments })),
];
const total = (await q(`SELECT count(*)::int n FROM launches WHERE created_at > now() - interval '7 days'`))[0].n;
console.log(`launches fetched this week: ${total}`);
console.log(`judged relevant (team products in the four areas): ${all.length}`);
console.log(`  of which makers wrote 0 comments: ${all.filter((x) => x.mc === 0).length}`);
console.log(`  of which makers wrote exactly 1 (the intro post): ${all.filter((x) => x.mc === 1).length}`);
console.log(`  of which makers wrote 2 or more: ${all.filter((x) => x.mc >= 2).length}`);
console.log(`  of those, with 10+ upvotes: ${all.filter((x) => x.mc >= 2 && x.votes >= 10).length}  <- qualify today`);
const variants: [string, (x: { votes: number; mc: number }) => boolean][] = [
  ["2+ maker comments and 10+ upvotes (today)", (x) => x.mc >= 2 && x.votes >= 10],
  ["2+ maker comments and 5+ upvotes", (x) => x.mc >= 2 && x.votes >= 5],
  ["2+ maker comments, any upvotes", (x) => x.mc >= 2],
  ["1+ maker comment and 50+ upvotes", (x) => x.mc >= 1 && x.votes >= 50],
  ["1+ maker comment and 30+ upvotes", (x) => x.mc >= 1 && x.votes >= 30],
  ["2+ maker comments and 10+ upvotes, OR 1+ comment and 50+ upvotes", (x) => (x.mc >= 2 && x.votes >= 10) || (x.mc >= 1 && x.votes >= 50)],
];
const today = new Set(all.filter(variants[0][1]).map((x) => x.name));
for (const [label, f] of variants) {
  const set = all.filter(f);
  const extra = set.filter((x) => !today.has(x.name)).sort((a, b) => b.votes - a.votes).slice(0, 8).map((x) => `${x.name} (${x.votes} upvotes, ${x.mc} maker comments)`);
  console.log(`\n${label}: ${set.length} launches${extra.length ? "\n   adds: " + extra.join("; ") : ""}`);
}
