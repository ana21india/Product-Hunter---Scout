import fs from "node:fs";

const file = "src/app/page.tsx";
let s = fs.readFileSync(file, "utf8");
const from = '{filteredList === null ? " Loading…" : ""}</p>';
if (!s.includes(from)) throw new Error("not found");
s = s.replace(from, '{filteredList === null ? " Loading…" : filteredList.length > 300 ? ` Showing the 300 most upvoted of ${filteredList.length}.` : ""}</p>');
fs.writeFileSync(file, s, "utf8");
console.log("patched");
