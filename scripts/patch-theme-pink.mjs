import fs from "node:fs";

const file = "src/app/globals.css";
let s = fs.readFileSync(file, "utf8");

// 1) Replace the colour variables (light and dark) with a pastel pink and gray palette.
const start = s.indexOf(":root {");
const end = s.indexOf("* { box-sizing");
if (start < 0 || end < 0) throw new Error("root block not found");
const root = `:root {
  --bg: #f7f4f5;
  --card: #ffffff;
  --text: #2e2a2d;
  --muted: #6f6a6d;
  --line: #e7dfe3;
  --accent: #f3bccd;
  --accent-text: #43182c;
  --ink: #9c3b62;
  --accent-soft: #fbe9ef;
  --pink-strong: #e7a1b7;
  --bar: #ece6e9;
  --bar-fill: #e9a6bb;
  --tile: #f1ecee;
  --ok-bg: #eeeaec; --ok-text: #3a3438;
  --warn-bg: #fdece4; --warn-text: #6b3a22;
  --err-bg: #fbdde4; --err-text: #7a1f3d;
  --info-bg: #f6e8ee; --info-text: #5a2a44;
  --urgent-bg: #f9d9e2; --urgent-text: #7a1f3d;
  --soon-bg: #fdeadf; --soon-text: #6b3a22;
  --trend-bg: #efe7ec; --trend-text: #4d3a45;
  --fresh-bg: #f1ecf2; --fresh-text: #4d3f55;
  --t-pri: #9c3b62; --t-str: #7a5a75; --t-con: #7d6a72; --t-low: #6f6a6d;
  --shadow: 0 1px 2px rgba(60, 40, 50, 0.05), 0 4px 14px rgba(60, 40, 50, 0.04);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1f1b1e; --card: #2a2428; --text: #f3edf0; --muted: #c0b6bb; --line: #403840;
    --accent: #f3bccd; --accent-text: #3a1424; --ink: #f2a9c0; --accent-soft: #3a2a32; --pink-strong: #e7a1b7;
    --bar: #3a3238; --bar-fill: #e7a1b7; --tile: #32292e;
    --ok-bg: #332d31; --ok-text: #e8dfe3; --warn-bg: #43302a; --warn-text: #f5d9c8;
    --err-bg: #4a2431; --err-text: #f7c9d6; --info-bg: #3d2a35; --info-text: #f3d3e0;
    --urgent-bg: #4a2431; --urgent-text: #f7c9d6; --soon-bg: #43302a; --soon-text: #f5d9c8;
    --trend-bg: #382e35; --trend-text: #e8d9e1; --fresh-bg: #342d3a; --fresh-text: #e3d8ea;
    --t-pri: #f2a9c0; --t-str: #cdb0c9; --t-con: #d2c0c8; --t-low: #c0b6bb;
    --shadow: none;
  }
}
`;
s = s.slice(0, start) + root + s.slice(end);

// 2) Use the deeper rose "ink" for text accents, and soften hard-coded colours.
const failures = [];
function rep(from, to) {
  if (!s.includes(from)) { failures.push(from.slice(0, 70)); return; }
  s = s.split(from).join(to);
}
rep("a { color: var(--accent); }", "a { color: var(--ink); }");
rep(".navbtn.on { background: var(--accent-soft); color: var(--accent); font-weight: 600; }", ".navbtn.on { background: var(--accent-soft); color: var(--ink); font-weight: 600; }");
rep("background: var(--card); color: var(--accent); flex: none; }", "background: var(--card); color: var(--ink); flex: none; }");
rep(".ticon.urgent { color: #c0392b; }", ".ticon.urgent { color: var(--urgent-text); }");
rep("border: 2px solid var(--accent); color: var(--accent); font-weight: 700;", "border: 2px solid var(--pink-strong); color: var(--ink); font-weight: 700;");
rep("color: var(--accent); font: inherit; text-align: left; text-decoration: underline;", "color: var(--ink); font: inherit; text-align: left; text-decoration: underline;");
rep("background: none; border: 0; color: var(--accent); font: inherit; font-weight: 600;", "background: none; border: 0; color: var(--ink); font: inherit; font-weight: 600;");
rep(" box-shadow: 0 2px 8px rgba(91, 63, 228, 0.25); }", " box-shadow: 0 2px 8px rgba(231, 161, 183, 0.35); }");
rep(".bar span { display: block; height: 100%; background: var(--accent);", ".bar span { display: block; height: 100%; background: var(--bar-fill);");
rep(".seg.on.replied { background: #1d8a5b; border-color: #1d8a5b; color: #fff; font-weight: 600; }", ".seg.on.replied { background: var(--pink-strong); border-color: var(--pink-strong); color: #3b1226; font-weight: 600; }");
rep("accent-color: var(--accent);", "accent-color: var(--ink);");
rep("outline: 3px solid var(--accent);", "outline: 3px solid var(--ink);");
rep(".btn:hover { border-color: var(--accent); }", ".btn:hover { border-color: var(--pink-strong); }");
rep(".seg:hover { border-color: var(--accent); }", ".seg:hover { border-color: var(--pink-strong); }");
rep(".btn.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 600;", ".btn.primary { background: var(--accent); color: var(--accent-text); border-color: var(--pink-strong); font-weight: 600;");

fs.writeFileSync(file, s, "utf8");
console.log("theme patched. replacements not found:", failures.length ? failures : "none");
