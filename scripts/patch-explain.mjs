import fs from "node:fs";

const file = "src/lib/explain.ts";
const raw = fs.readFileSync(file, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);
const start = lines.findIndex((l) => l.includes("export function explainBelow"));
if (start < 0) throw new Error("explainBelow not found");
let end = start;
while (end < lines.length && lines[end] !== "}") end++;
const replacement = [
  "export function explainBelow(item: Item, cutoff: Item): string {",
  "  // Plain wording without score numbers: what the launch has less of than the last one on the shortlist.",
  "  const bits: string[] = [];",
  "  if (item.votes < cutoff.votes) bits.push(`fewer upvotes (${item.votes} vs ${cutoff.votes})`);",
  "  if (item.makerComments < cutoff.makerComments) bits.push(`fewer maker comments (${item.makerComments} vs ${cutoff.makerComments})`);",
  "  if (!bits.length) bits.push(\"a slightly lower combined result\");",
  "  return `Ranked just below #${cutoff.rank}: ${bits.join(\" and \")}`;",
  "}",
];
lines.splice(start, end - start + 1, ...replacement);
fs.writeFileSync(file, lines.join(eol), "utf8");
console.log("explain.ts patched");
