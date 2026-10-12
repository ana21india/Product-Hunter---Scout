import fs from "node:fs";

const file = "src/app/globals.css";
let s = fs.readFileSync(file, "utf8");
function rep(from, to) {
  if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 70));
  s = s.replace(from, to);
}
rep("  --font-hand: var(--font-hand), Caveat, cursive;", "  --f-hand: var(--font-hand), Caveat, cursive;");
rep(".todohead h2 { font-family: var(--font-hand);", ".todohead h2 { font-family: var(--f-hand);");
fs.writeFileSync(file, s, "utf8");
console.log("patched");
