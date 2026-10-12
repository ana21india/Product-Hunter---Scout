import fs from "node:fs";

function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`not found in ${file}: ${from.slice(0, 60)}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(file, s, "utf8");
  console.log("patched", file);
}

patch("src/lib/data.ts", [
  ["reason: string | null; votes: number; createdAt: string };", "reason: string | null; serves: string | null; votes: number; createdAt: string };"],
  ["r.relevant, r.reason, m.maker_comment_count,", "r.relevant, r.reason, r.serves, m.maker_comment_count,"],
  ["url: r.url, reason: r.reason, votes: r.votes_count,", "url: r.url, reason: r.reason, serves: r.serves ?? null, votes: r.votes_count,"],
  ["oneLiner: r.one_liner ?? null, angle: r.angle ?? null,", "oneLiner: r.one_liner ?? null, angle: r.angle ?? null, serves: r.serves ?? null,"],
  ["oneLiner: string | null; angle: string | null;", "oneLiner: string | null; angle: string | null; serves: string | null;"],
]);

patch("src/app/page.tsx", [
  [`<p className="oneliner">{it.oneLiner ?? it.tagline ?? ""}</p>`, `<p className="oneliner">{it.oneLiner ?? it.tagline ?? ""}</p>\n      {it.serves && <p className="serves"><strong>Serves:</strong> {it.serves}</p>}`],
  [`<div className="muted small">{f.reason}</div>`, `<div className="muted small">{f.serves ? \`Serves: \${f.serves}. \` : ""}{f.reason}</div>`],
]);

patch("src/app/globals.css", [[".oneliner { margin: 4px 0 8px; }", ".oneliner { margin: 4px 0 4px; }\n.serves { margin: 0 0 8px; color: var(--muted); font-size: 0.92rem; }"]]);
