import fs from "node:fs";

function patch(file, fn) {
  let s = fs.readFileSync(file, "utf8");
  s = fn(s);
  fs.writeFileSync(file, s, "utf8");
  console.log("patched", file);
}
const must = (s, from) => { if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 80)); };

patch("src/app/page.tsx", (s) => {
  // 1) state for the shortlist filter
  must(s, '  const [trackTab, setTrackTab] = useState<Status>("contacted");');
  s = s.replace('  const [trackTab, setTrackTab] = useState<Status>("contacted");', '  const [trackTab, setTrackTab] = useState<Status>("contacted");\n  const [listFilter, setListFilter] = useState<"closing" | "trending" | null>(null);');

  // 2) navigation helpers; going to a tab from the menu clears the tile filter
  must(s, '  const go = (v: View) => { if (v !== "all") clearControls(); setView(v); };');
  s = s.replace(
    '  const go = (v: View) => { if (v !== "all") clearControls(); setView(v); };',
    `  const go = (v: View) => { if (v !== "all") clearControls(); setListFilter(null); setView(v); };
  // The summary tiles are shortcuts: they open the matching list or the matching outreach tab.
  const openList = (f: "closing" | "trending") => { clearControls(); setListFilter(f); setView("shortlist"); };
  const openOutreach = (t: Status) => { clearControls(); setListFilter(null); setTrackTab(t); setView("outreach"); };`,
  );

  // 3) the rows shown on the Shortlist tab
  must(s, "{table(shortlist, false)}");
  s = s.replace(
    "{table(shortlist, false)}",
    `{listFilter && (
              <div className="filterbar" role="status">
                <span>
                  Showing {shortlistShown.length} {listFilter === "closing" ? "launches whose window ends in 2 days or less" : "launches trending on Product Hunt"}, not yet contacted.
                </span>
                <button type="button" className="btn" onClick={() => setListFilter(null)}>Show the full shortlist</button>
              </div>
            )}
            {table(shortlistShown, false)}`,
  );
  must(s, "{items.length > size && (");
  s = s.replace("{items.length > size && (", "{!listFilter && items.length > size && (");

  // 4) compute the filtered rows
  must(s, "  const closingCount = shortlist.filter");
  s = s.replace(
    "  const closingCount = shortlist.filter",
    `  const shortlistShown = listFilter === "closing"
    ? shortlist.filter((i) => !i.status && i.daysLeft <= 2)
    : listFilter === "trending"
      ? shortlist.filter((i) => !i.status && trendLabel(i))
      : shortlist;
  const closingCount = shortlist.filter`,
  );

  // 5) the tiles become buttons
  const a = s.indexOf('<section className="tiles" aria-label="Summary">');
  const b = s.indexOf("</section>", a);
  if (a < 0 || b < 0) throw new Error("tiles section not found");
  const tiles = `<section className="tiles" aria-label="Summary">
              <button type="button" className="tile" onClick={() => openList("closing")} aria-label={\`Close today: \${closingCount}. Show these launches\`}><span className="ticon urgent"><Icon name="clock" /></span><div><div className="tlabel">Close today</div><div className="tnum">{closingCount}</div><div className="tsub">window ends in 2 days or less</div></div></button>
              <button type="button" className="tile" onClick={() => openList("trending")} aria-label={\`Trending on Product Hunt: \${trendingCount}. Show these launches\`}><span className="ticon"><Icon name="trend" /></span><div><div className="tlabel">Trending on Product Hunt</div><div className="tnum">{trendingCount}</div><div className="tsub">top of the leaderboard</div></div></button>
              <button type="button" className="tile" onClick={() => openOutreach("contacted")} aria-label={\`Contacted: \${contactedAll.length}. Open the Outreach tab\`}><span className="ticon"><Icon name="send" /></span><div><div className="tlabel">Contacted</div><div className="tnum">{contactedAll.length}</div><div className="tsub">{shortlistDone} of {shortlist.length} shortlisted done</div></div></button>
              <button type="button" className="tile" onClick={() => openOutreach("replied")} aria-label={\`Replies: \${repliedAll.length}. Open the Outreach tab\`}><span className="ticon"><Icon name="reply" /></span><div><div className="tlabel">Replies</div><div className="tnum">{repliedAll.length}</div><div className="tsub">{replyRate === null ? "no outreach yet" : \`\${replyRate}% reply rate\`}</div></div></button>
            `;
  return s.slice(0, a) + tiles + s.slice(b);
});

patch("src/app/globals.css", (s) => {
  must(s, ".tile { display: flex;");
  s += `
/* Summary tiles are buttons */
button.tile { text-align: left; font: inherit; color: inherit; cursor: pointer; width: 100%; transition: transform 0.12s, border-color 0.12s; }
button.tile::after { content: "→"; margin-left: auto; color: var(--muted); font-size: 1.1rem; align-self: center; }
button.tile:hover { border-color: var(--line-strong); transform: translateY(-1px); }
button.tile:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
.filterbar { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 12px 14px; background: var(--soft-2); border: 1px solid var(--line); border-radius: 12px; }
`;
  return s;
});
