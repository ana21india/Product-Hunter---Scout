import fs from "node:fs";
import path from "node:path";

// Repairs text that was re-saved with the wrong encoding (UTF-8 read as Windows-1252), e.g. "Â·" -> "·".
const fixes = [
  ["â€¦", "…"], // …
  ["â€“", "–"], // –
  ["â€”", "—"], // —
  ["â€™", "’"], // ’
  ["Â·", "·"], // ·
  ["Ã—", "×"], // ×
  ["Ã·", "÷"], // ÷
  ["Â ", " "], // non-breaking space
];
const roots = ["src", "scripts", "db", "README.md"];
let changed = 0;
function visit(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).forEach((f) => visit(path.join(p, f)));
  if (!/\.(tsx?|mjs|css|md|sql|json)$/.test(p) || p.endsWith("fix-encoding.mjs")) return;
  let t = fs.readFileSync(p, "utf8");
  const before = t;
  for (const [bad, good] of fixes) t = t.split(bad).join(good);
  if (t !== before) { fs.writeFileSync(p, t, "utf8"); changed++; console.log("fixed", p); }
}
for (const r of roots) if (fs.existsSync(r)) visit(r);
console.log("files repaired:", changed);
