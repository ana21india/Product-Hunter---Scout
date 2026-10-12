import fs from "node:fs";

const file = "src/app/globals.css";
let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
function rep(from, to) {
  if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 60));
  s = s.replace(from, to);
}
rep(".app { display: grid; grid-template-columns: 232px minmax(0, 1fr);", ".app { display: grid; grid-template-columns: 208px minmax(0, 1fr);");
rep(".content { padding: 22px 28px 40px;", ".content { padding: 22px 24px 40px;");
rep(
  ".thead, .row { display: grid; grid-template-columns: 40px 34px minmax(220px, 1fr) 92px 92px 108px 100px 244px 108px; gap: 0 12px; align-items: center; }",
  ".thead, .row { display: grid; grid-template-columns: 40px 30px minmax(180px, 1fr) 78px 88px 94px 92px 222px 96px; gap: 0 10px; align-items: center; }",
);
rep("@media (max-width: 1180px) {", "@media (max-width: 1300px) {");
fs.writeFileSync(file, s, "utf8");
console.log("css patched", eol === "\r\n" ? "(CRLF)" : "(LF)");
