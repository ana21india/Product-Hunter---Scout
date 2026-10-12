import { getDashboard } from "../src/lib/data";
const d = await getDashboard();
const top = d.items.slice(0, 12);
for (const i of top)
  console.log(`#${i.rank} ${i.name.padEnd(30)} day ${i.daysSince} (${i.daysLeft} left) | PH daily #${i.dailyRank} weekly #${i.weeklyRank} | gain ${i.votesGain} | status ${i.status}`);
console.log("items with weekly rank:", d.items.filter((i) => i.weeklyRank).length, "of", d.items.length);
console.log("closing (<=2 days left) among top 15:", d.items.slice(0, 15).filter((i) => i.daysLeft <= 2).map((i) => `${i.name} (${i.daysLeft})`).join(", "));
