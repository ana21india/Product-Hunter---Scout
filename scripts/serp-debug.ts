const key = process.env.SERPAPI_KEY as string;
async function get(params: Record<string, string>) {
  const r = await fetch(`https://serpapi.com/search.json?${new URLSearchParams({ api_key: key, ...params })}`, { signal: AbortSignal.timeout(90000) });
  return { status: r.status, j: (await r.json()) as any };
}
for (const q of ["ishu darshan velozity", "dylan field figma"]) {
  const first = await get({ engine: "google", q, gl: "in", hl: "en", google_domain: "google.co.in" });
  const token = first.j.ai_overview?.page_token;
  console.log(`\n"${q}": first search HTTP ${first.status}, AI Overview token present: ${!!token}`);
  if (!token) continue;
  const ov = await get({ engine: "google_ai_overview", page_token: token });
  console.log(`  AI Overview fetch HTTP ${ov.status}${ov.j.error ? " ERROR " + ov.j.error : ""}`);
  const text = JSON.stringify(ov.j);
  const hits = [...new Set([...text.matchAll(/https?:\/\/[a-z.]*linkedin\.com\/in\/[A-Za-z0-9%_\-]+/gi)].map((m) => m[0]))];
  console.log(`  LinkedIn profile addresses in the AI Overview: ${hits.length}`);
  hits.slice(0, 5).forEach((h) => console.log("     " + h));
  const refs = (ov.j.ai_overview?.references ?? ov.j.references ?? []) as any[];
  console.log(`  references: ${refs.length}`, refs.slice(0, 4).map((r) => `${String(r.title).slice(0, 40)} | ${String(r.link).slice(0, 60)}`));
  const firstText = (ov.j.ai_overview?.text_blocks ?? ov.j.text_blocks ?? [])[0];
  if (firstText) console.log("  overview text:", String(firstText.snippet ?? JSON.stringify(firstText)).slice(0, 200));
}
