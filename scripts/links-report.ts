import { getDashboard } from "../src/lib/data";
const d = await getDashboard();
const top = d.items.slice(0, 15);
let company = 0, suggested = 0;
for (const i of top) {
  const co = i.links.find((l) => l.label === "Company on LinkedIn");
  if (co) company++;
  if (i.suggestedPeople.length) suggested++;
  console.log(`#${i.rank} ${i.name} | links: ${i.links.map((l) => l.label).join(", ") || "-"} | suggested person: ${i.suggestedPeople.map((p) => p.name + " " + p.url).join("; ") || "-"}`);
}
console.log(`\nTop 15: company LinkedIn on ${company}, suggested person on ${suggested}`);
