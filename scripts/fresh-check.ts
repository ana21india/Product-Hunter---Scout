import { getDashboard } from "../src/lib/data";

// How does the current rule treat launches by age? (hours since launch)
const d = await getDashboard();
const hrs = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5;
console.log(`ranked now: ${d.items.length}, watchlist: ${d.watchlist.length}`);
const fresh = d.watchlist.filter((w) => w.daysSince === 0);
console.log(`\nlaunched in the last day or so and sitting on the Watchlist: ${fresh.length}`);
for (const w of fresh.slice(0, 12)) console.log(`  ${w.name.padEnd(30)} ${String(w.votes).padStart(3)} upvotes, ${w.makerComments} maker comments | ${w.reasons.join("; ")}`);
console.log("\nnewest ranked launches:");
for (const i of d.items.filter((x) => x.daysSince === 0).slice(0, 6)) console.log(`  #${i.rank} ${i.name} (${i.votes} upvotes, ${i.makerComments} maker comments)`);
console.log("\nall relevant launches with makerComments = 0 by age:");
const zero = d.watchlist.filter((w) => w.makerComments === 0);
const byDay: Record<number, number> = {};
for (const w of zero) byDay[w.daysSince] = (byDay[w.daysSince] ?? 0) + 1;
console.log(JSON.stringify(byDay), "(day 0 = launched today)");
