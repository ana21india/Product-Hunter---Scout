import fs from "node:fs";

const file = "src/app/globals.css";
let s = fs.readFileSync(file, "utf8");
function rep(from, to) {
  if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 60));
  s = s.replace(from, to);
}
rep("  .app { grid-template-columns: 1fr; }", "  .app { grid-template-columns: minmax(0, 1fr); }\n  .side, .content { min-width: 0; }");
fs.writeFileSync(file, s, "utf8");
console.log("css patched");
