import fs from "node:fs";

const file = "src/lib/run.ts";
let src = fs.readFileSync(file, "utf8");
const start = src.indexOf("    // Phase B:");
const end = src.indexOf("    // Phase D:");
if (start < 0 || end < 0) throw new Error("markers not found");
const block = `    // Phase B: two-step relevance check (Product Hunt text first, then the product's own website) for launches without a verdict yet.
    const rel = await judgeLaunches({ deadline: opts.deadlineMs ? runStartMs + opts.deadlineMs : undefined, log });
    if (rel.failed) notes.push(\`Relevance check unavailable for \${rel.failed} launches (will retry next run)\`);

`;
src = src.slice(0, start) + block + src.slice(end);
src = src.replace('import { generateAngles } from "./angles";', 'import { generateAngles } from "./angles";\nimport { judgeLaunches } from "./relevance";');
src = src.replace("judgeRelevance, GEMINI_MODEL", "GEMINI_MODEL");
fs.writeFileSync(file, src, "utf8");
console.log("run.ts patched");
