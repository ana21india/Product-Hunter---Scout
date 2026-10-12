import fs from "node:fs";

function patch(file, fn) {
  const s = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, fn(s), "utf8");
  console.log("patched", file);
}
const must = (s, from) => { if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 90)); };

patch("src/app/globals.css", (s) => {
  return s + `
/* Urgency uses a crimson range: soft crimson for "soon", solid crimson for "last day" */
:root { --urgent-bg: #f6d9db; --urgent-text: #6a0f18; --urgent-solid: #8b1118; --urgent-ink: #8b1118; --soon-bg: #fbe7e8; --soon-text: #8b1118; }
@media (prefers-color-scheme: dark) {
  :root { --urgent-bg: #4b0a12; --urgent-text: #ffd9db; --urgent-solid: #ab2a32; --urgent-ink: #ff8c92; --soon-bg: #3a0510; --soon-text: #ffb8bc; }
}
.ticon.urgent { background: var(--urgent-solid); color: #fff; }
.tile.hot { border-color: var(--urgent-solid); }
.tile.hot .tnum { color: var(--urgent-ink); }
.chip.urgent { background: var(--urgent-bg); color: var(--urgent-text); box-shadow: inset 0 0 0 1px var(--urgent-solid); }
.chip.urgent.last { background: var(--urgent-solid); color: #fff; box-shadow: none; }
.window.soon { background: var(--urgent-bg); color: var(--urgent-text); }
.window.urgent { background: var(--urgent-solid); color: #fff; }
.row.hot { box-shadow: inset 4px 0 0 var(--urgent-solid), var(--shadow); }

/* Home bar on every page except Today */
.homebar { position: sticky; top: 0; z-index: 6; display: flex; align-items: center; gap: 12px; margin: -28px -32px 18px; padding: 10px 32px; background: var(--bg); border-bottom: 1px solid var(--line); }
.brand { background: none; border: 0; color: inherit; cursor: pointer; text-align: left; font-family: var(--font-head); }
.brand:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; border-radius: 10px; }
@media (max-width: 860px) { .homebar { margin: -18px -14px 14px; padding: 8px 14px; } }
`;
});

patch("src/app/page.tsx", (s) => {
  // chips: "Last day" gets the solid crimson look
  must(s, 'const reasons: { text: string; kind: "urgent" | "trend" | "fresh" }[] = [];');
  s = s.replace('const reasons: { text: string; kind: "urgent" | "trend" | "fresh" }[] = [];', "const reasons: { text: string; kind: string }[] = [];");
  must(s, 'reasons.push({ text: i.daysLeft <= 1 ? "Last day to reach out" : `${i.daysLeft} days left in the window`, kind: "urgent" });');
  s = s.replace(
    'reasons.push({ text: i.daysLeft <= 1 ? "Last day to reach out" : `${i.daysLeft} days left in the window`, kind: "urgent" });',
    'reasons.push({ text: i.daysLeft <= 1 ? "Last day to reach out" : `${i.daysLeft} days left in the window`, kind: i.daysLeft <= 1 ? "urgent last" : "urgent" });',
  );
  // the Close today tile glows crimson when something is due
  must(s, 'className="tile" onClick={() => openList("closing")}');
  s = s.replace('className="tile" onClick={() => openList("closing")}', 'className={`tile ${closingCount > 0 ? "hot" : ""}`} onClick={() => openList("closing")}');
  // rows due within a day get a crimson edge
  must(s, 'className={`row ${it.rank > size ? "below" : ""} ${it.status ? "done" : ""}`}');
  s = s.replace('className={`row ${it.rank > size ? "below" : ""} ${it.status ? "done" : ""}`}', 'className={`row ${it.rank > size ? "below" : ""} ${it.status ? "done" : ""} ${!it.status && it.daysLeft <= 1 ? "hot" : ""}`}');
  // the brand is a button that goes home
  must(s, '<div className="brand"><span className="logo" aria-hidden="true">W</span> Wingmate</div>');
  s = s.replace('<div className="brand"><span className="logo" aria-hidden="true">W</span> Wingmate</div>', '<button type="button" className="brand" onClick={() => go("today")} aria-label="Wingmate home"><span className="logo" aria-hidden="true">W</span> Wingmate</button>');
  // Home bar on every page except Today
  must(s, '        <header className="top">');
  s = s.replace(
    '        <header className="top">',
    `        {view !== "today" && (
          <div className="homebar">
            <button type="button" className="btn" onClick={() => go("today")}>← Home</button>
            <span className="muted small">{titles[view]}</span>
          </div>
        )}
        <header className="top">`,
  );
  return s;
});
