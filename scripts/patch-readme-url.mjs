import fs from "node:fs";

const f = "README.md";
let s = fs.readFileSync(f, "utf8");
const from = "https://product-hunter-scout-8pnx.vercel.app/";
if (!s.includes(from)) throw new Error("old link not found");
s = s.split(from).join("https://wingmate-scout.vercel.app/");
fs.writeFileSync(f, s, "utf8");
console.log("README link updated");
