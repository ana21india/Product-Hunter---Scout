import fs from "node:fs";

// ---- page.tsx: founders list with a "Find on LinkedIn" link each ----
{
  const file = "src/app/page.tsx";
  let s = fs.readFileSync(file, "utf8");
  function rep(from, to) {
    if (!s.includes(from)) throw new Error("not found: " + from.slice(0, 90));
    s = s.replace(from, to);
  }
  rep(
    "const daysLeftText = (n: number) =>",
    '// Opens a Google search in Kavya\'s own browser, which finds the profile where an automated search cannot. It claims nothing.\nconst linkedinSearch = (name: string, product: string) => `https://www.google.com/search?q=${encodeURIComponent(`${name} ${product} LinkedIn`)}`;\nconst daysLeftText = (n: number) =>',
  );
  rep(
    '<p>{it.founderNames.length === 0 ? "Not listed" : it.founderNames.slice(0, 4).join(", ")}{it.founderNames.length > 4 && <span className="muted"> +{it.founderNames.length - 4} more</span>}</p>',
    `<ul className="founders">
              {it.founderNames.length === 0 && <li>Not listed</li>}
              {it.founderNames.slice(0, 4).map((n) => {
                const direct = it.suggestedPeople.find((p) => p.name === n);
                return (
                  <li key={n}>
                    <span className="fname">{n}</span>
                    {direct ? (
                      <>
                        <a href={direct.url} target="_blank" rel="noreferrer">LinkedIn profile</a>
                        <span className="muted small">(found by search, please confirm)</span>
                      </>
                    ) : (
                      <a href={linkedinSearch(n, it.name)} target="_blank" rel="noreferrer">Find on LinkedIn</a>
                    )}
                  </li>
                );
              })}
            </ul>
            {it.founderNames.length > 4 && <p className="muted small">+{it.founderNames.length - 4} more makers listed on Product Hunt</p>}`,
  );
  // the separate "suggested person" box is replaced by the per-founder links above
  const a = s.indexOf("{it.suggestedPeople.length > 0 && (");
  const endMarker = "Please confirm it is the right person.</p>";
  const b = s.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error("suggest block not found");
  const closeIdx = s.indexOf(")}", b);
  s = s.slice(0, a) + s.slice(closeIdx + 2);
  fs.writeFileSync(file, s, "utf8");
  console.log("page patched");
}

// ---- css ----
{
  const file = "src/app/globals.css";
  let s = fs.readFileSync(file, "utf8");
  s += `
/* Founders list with LinkedIn links */
.founders { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.founders li { display: flex; gap: 6px 12px; align-items: center; flex-wrap: wrap; }
.founders .fname { font-weight: 600; }
.founders a { display: inline-block; padding: 10px 2px; }
`;
  fs.writeFileSync(file, s, "utf8");
  console.log("css patched");
}

// ---- README ----
{
  const file = "README.md";
  let s = fs.readFileSync(file, "utf8");
  const marker = "- **Founder LinkedIn suggestions**";
  if (!s.includes(marker)) throw new Error("README marker not found");
  s = s.replace(
    marker,
    "- **Find on LinkedIn.** Each founder in a launch's details has a \"Find on LinkedIn\" link that opens a Google search for the founder's name, the product and LinkedIn in the user's own browser. In testing, automated searches (Gemini's built-in search and a search service) could not find profiles that a signed-in browser shows at once, so this link leaves the finding to the person. It claims no profile is the right one.\n" + marker,
  );
  fs.writeFileSync(file, s, "utf8");
  console.log("README patched");
}
