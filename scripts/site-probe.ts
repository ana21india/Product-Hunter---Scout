import { q } from "../src/lib/db";

// Fetch a product's own website and pull out any linkedin.com links, so we can see whether founders link themselves there.
async function grab(url: string) {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; PartnershipScout/1.0)" }, signal: AbortSignal.timeout(12000) });
    const html = await r.text();
    const links = [...html.matchAll(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|company)\/[A-Za-z0-9%_\-.]+/gi)].map((m) => m[0]);
    return { finalUrl: r.url, status: r.status, links: [...new Set(links)] };
  } catch (e: any) {
    return { finalUrl: url, status: 0, links: [] as string[], error: String(e.message).slice(0, 60) };
  }
}

const rows = await q(
  `SELECT l.name, l.website FROM launches l JOIN relevance r USING(post_id)
   WHERE r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 12`,
);
for (const r of rows) {
  if (!r.website) { console.log(r.name, "-> no website stored"); continue; }
  const home = await grab(r.website);
  const base = home.finalUrl.replace(/\/$/, "");
  let links = home.links;
  for (const path of ["/about", "/team", "/about-us"]) {
    if (links.some((l: string) => /\/in\//.test(l))) break;
    const p = await grab(base + path);
    if (p.status === 200) links = [...new Set([...links, ...p.links])];
  }
  console.log(`${r.name} | ${home.finalUrl.slice(0, 40)} | status ${home.status} | linkedin: ${links.length ? links.join("  ") : "none found"}`);
}
