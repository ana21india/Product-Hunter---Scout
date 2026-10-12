import fs from "node:fs";

const f = "scripts/repo-secret-check.ts";
let s = fs.readFileSync(f, "utf8");
if (!s.includes("SERPAPI_KEY")) {
  s = s.replace('  ["DATABASE_URL", process.env.DATABASE_URL],', '  ["DATABASE_URL", process.env.DATABASE_URL],\n  ["SERPAPI_KEY", process.env.SERPAPI_KEY],');
  fs.writeFileSync(f, s, "utf8");
}
console.log("secret check covers SERPAPI_KEY");
