import { getDashboard } from "../src/lib/data";
const d = await getDashboard();
console.log(`ranked: ${d.items.length} | filtered out: ${d.filteredOut.length} | pending: ${d.pending}`);
const cats: Record<string, number> = {};
for (const i of d.items) cats[i.category] = (cats[i.category] ?? 0) + 1;
console.log("by category:", JSON.stringify(cats));
for (const i of d.items.slice(0, 15))
  console.log(`#${String(i.rank).padStart(2)} ${i.name.padEnd(30)} score ${i.finalScore.toFixed(1).padStart(5)} | ${String(i.votes).padStart(3)} upvotes, ${String(i.makerComments).padStart(2)} maker comments | ${i.category} | serves: ${i.serves}`);
for (const n of ["CodeCrab", "GitGlow", "Rill Browser", "IrisGo", "Velozity", "Busabase", "Onepin"]) {
  const hit = d.items.find((i) => i.name.startsWith(n));
  const out = d.filteredOut.find((f) => f.name.startsWith(n));
  console.log(`${n}: ${hit ? `ranked #${hit.rank}` : out ? `filtered out (${out.serves ?? "-"}: ${out.reason})` : "not in window"}`);
}
