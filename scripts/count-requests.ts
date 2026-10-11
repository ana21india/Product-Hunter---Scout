import * as PH from "../src/lib/ph";
import { runScout } from "../src/lib/run";

// Runs one normal scout and reports how many Product Hunt requests it needed, phase by phase.
const marks: [string, number][] = [];
const res = await runScout({
  mode: "script",
  log: (s) => marks.push([s.trim().slice(0, 60), PH.budget.requests]),
});
marks.push(["end", PH.budget.requests]);
let prev = 0;
for (const [label, n] of marks) { console.log(`${String(n - prev).padStart(3)} requests since previous | at: ${label}`); prev = n; }
console.log(`TOTAL Product Hunt requests in this run: ${PH.budget.requests}  (points: ${PH.budget.requests * 100})`);
console.log("RESULT", JSON.stringify(res));
