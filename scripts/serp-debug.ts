const key = process.env.SERPAPI_KEY as string;
async function run(label: string, q: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ engine: "google", q, num: "20", api_key: key, ...extra });
  try {
    const r = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(90000) });
    const j: any = await r.json();
    const all = (j.organic_results ?? []) as any[];
    const profiles = all.filter((o) => /linkedin\.com\/in\//i.test(String(o.link)));
    console.log(`${label.padEnd(34)} ${String(all.length).padStart(2)} results, ${profiles.length} profile pages${j.error ? " ERROR " + j.error : ""}`);
    for (const o of profiles.slice(0, 3)) console.log(`      ${String(o.title).slice(0, 60)} | ${o.link}`);
  } catch (e: any) { console.log(`${label}: ${e.message}`); }
}
for (const [name, product] of [["Ishu Darshan", "Velozity"], ["Dylan Field", "Figma"]]) {
  console.log(`\n=== ${name} (${product})`);
  await run("A  site:linkedin.com/in", `site:linkedin.com/in "${name}"`);
  await run("B  name + product + linkedin", `"${name}" ${product} linkedin`);
  await run("C  name linkedin profile", `${name} LinkedIn profile ${product} founder`);
  await run("D  site:linkedin.com", `site:linkedin.com "${name}" ${product}`);
  await run("E  Google, India", `site:linkedin.com/in "${name}"`, { gl: "in", google_domain: "google.co.in" });
}
