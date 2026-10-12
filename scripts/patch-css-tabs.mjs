import fs from "node:fs";

const file = "src/app/globals.css";
let s = fs.readFileSync(file, "utf8");
function rep(from, to) {
  if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 80));
  s = s.replace(from, to);
}
// Eight columns now: the score column is gone from the rows.
rep(
  ".thead, .row { display: grid; grid-template-columns: 40px 30px minmax(180px, 1fr) 78px 88px 94px 96px 222px 96px;",
  ".thead, .row { display: grid; grid-template-columns: 40px 30px minmax(180px, 1fr) 78px 88px 96px 222px 96px;",
);
s += `
/* Wingmate additions: watchlist rows, outreach tracker rows, sub tabs, notes */
.row.watch { grid-template-columns: minmax(0, 1fr) 160px 222px; gap: 0 14px; }
.row.watch .chips { margin-top: 6px; }
.wmeta { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.row.tracked { grid-template-columns: minmax(0, 1fr) auto; gap: 0 14px; }
.trackactions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.subtabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.subtab { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--line-strong); border-radius: 10px; background: transparent; color: var(--muted); font: inherit; font-weight: 500; cursor: pointer; }
.subtab:hover { background: var(--soft); color: var(--text); }
.subtab.on { background: var(--ink); border-color: var(--ink); color: var(--ink-text); font-weight: 600; }
.subtab.on .count { background: rgba(255, 255, 255, 0.18); color: var(--ink-text); }
.note { margin-bottom: 14px; }
.note p { line-height: 1.6; }
.todofoot { border-top: 1px solid var(--line); margin-top: 4px; padding: 4px 0; }
.todoempty { padding: 10px 0 14px; }
.controls p.grow { flex: 1 1 260px; align-self: center; }

@media (max-width: 1300px) {
  .row.watch, .row.tracked { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .row.watch .wmeta { flex-direction: row; flex-wrap: wrap; gap: 8px 14px; align-items: center; grid-column: auto; }
  .row.watch .outreach { grid-column: auto; }
  .trackactions { justify-content: flex-start; }
}
`;
fs.writeFileSync(file, s, "utf8");
console.log("css patched");
