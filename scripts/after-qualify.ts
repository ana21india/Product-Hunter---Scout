import { getDashboard } from "../src/lib/data";
const d = await getDashboard();
console.log(`qualified (ranked): ${d.items.length} | watchlist: ${d.watchlist.length} | tracked: ${d.tracked.length} | thresholds: ${JSON.stringify(d.thresholds)}`);
console.log("shortlist (top 15):");
for (const i of d.items.slice(0, 15)) console.log(`  #${i.rank} ${i.name.padEnd(26)} ${String(i.votes).padStart(4)} upvotes, ${String(i.makerComments).padStart(2)} maker comments | ${i.tier} | ${i.daysLeft}d left`);
console.log("watchlist, first 5:");
for (const w of d.watchlist.slice(0, 5)) console.log(`  ${w.name.padEnd(26)} ${String(w.votes).padStart(4)} upvotes, ${w.makerComments} maker comments | ${w.reasons.join("; ")}`);
