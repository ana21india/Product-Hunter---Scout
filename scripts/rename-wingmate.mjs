import fs from "node:fs";

function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`not found in ${file}: ${from.slice(0, 60)}`);
    s = s.split(from).join(to);
  }
  fs.writeFileSync(file, s, "utf8");
  console.log("renamed in", file);
}
patch("src/app/layout.tsx", [['title: "Partnership Scout",', 'title: "Wingmate",'], ['description: "Ranked outreach list of Product Hunt launches from the last 7 days.",', 'description: "Your companion for finding better partnerships: Product Hunt launches from the last 7 days, ranked for outreach.",']]);
patch("README.md", [
  ["# Partnership Scout", "# Wingmate"],
  ["Partnership Scout replaces that scan.", "Wingmate, a companion that helps her find better partnerships, replaces that scan."],
]);
