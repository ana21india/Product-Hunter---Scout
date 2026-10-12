import { spawnSync } from "node:child_process";

const secrets: [string, string | undefined][] = [
  ["PH_TOKEN", process.env.PH_TOKEN],
  ["GEMINI_API_KEY", process.env.GEMINI_API_KEY],
  ["DATABASE_URL", process.env.DATABASE_URL],
  ["SERPAPI_KEY", process.env.SERPAPI_KEY],
];
const revs = spawnSync("git", ["rev-list", "--all"], { encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean);
console.log(`commits checked: ${revs.length}`);
for (const [name, v] of secrets) {
  if (!v) { console.log(name, "not set locally"); continue; }
  // search every commit for the whole value and for its first 16 characters
  const full = spawnSync("git", ["grep", "-F", "-l", "--", v, ...revs], { encoding: "utf8" }).stdout.trim();
  const part = spawnSync("git", ["grep", "-F", "-l", "--", v.slice(0, 16), ...revs], { encoding: "utf8" }).stdout.trim();
  console.log(`${name}: found in repo history: ${full || part ? "YES" : "no"}`);
}
const tracked = spawnSync("git", ["ls-files"], { encoding: "utf8" }).stdout.split("\n");
console.log(".env tracked by git:", tracked.some((f) => f === ".env") ? "YES" : "no");
