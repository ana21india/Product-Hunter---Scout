import fs from "node:fs";

const f = "src/lib/serp.ts";
let s = fs.readFileSync(f, "utf8");
if (!s.includes("AbortSignal.timeout(20000)")) throw new Error("timeout line not found");
s = s.replace("AbortSignal.timeout(20000)", "AbortSignal.timeout(45000)");
fs.writeFileSync(f, s, "utf8");
console.log("timeout raised to 45s");
