import { q } from "./db";
import { findLinkedIn } from "./gemini";
import { getDashboard } from "./data";

// LinkedIn suggestions for the founders of the top 15 ranked launches. Gemini search plus strict checks; each founder is searched once.
// Returns how many founders were skipped (out of time, or Gemini unavailable) so the next run can continue.
// The company's LinkedIn page, read from links on the product's own website (real data, nothing guessed).
async function companyLinks(top: string[], log: (s: string) => void) {
  const todo = await q(
    `SELECT l.post_id AS id, l.website FROM launches l LEFT JOIN site_links s ON s.post_id = l.post_id
     WHERE l.post_id = ANY($1::text[]) AND s.post_id IS NULL`, [top],
  );
  log(`Company pages: ${todo.length} websites`);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const t = todo[i++];
      let found: string | null = null;
      try {
        if (t.website) {
          const r = await fetch(t.website, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; PartnershipScout/1.0)" }, signal: AbortSignal.timeout(10000) });
          const html = await r.text();
          const hit = html.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[A-Za-z0-9%_\-.]+/i);
          found = hit ? hit[0].replace(/[.]+$/, "") : null;
        }
      } catch { /* leave empty */ }
      await q(`INSERT INTO site_links (post_id, linkedin_company) VALUES ($1,$2) ON CONFLICT (post_id) DO NOTHING`, [t.id, found]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));
}

export async function suggestLinkedIn(opts: { deadline?: number; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const top = (await getDashboard()).items.slice(0, 15).map((i) => i.postId);
  if (!top.length) return { searched: 0, kept: 0, skipped: 0 };
  await companyLinks(top, log);
  const ls = await q(`SELECT l.post_id AS id, l.name, l.tagline, l.website, l.makers FROM launches l WHERE l.post_id = ANY($1::text[])`, [top]);
  const done = new Set((await q(`SELECT post_id || ':' || maker_id AS k FROM founder_links WHERE post_id = ANY($1::text[])`, [top])).map((r: any) => r.k));
  const jobs: { id: string; makerId: string; founder: string; product: string; tagline: string | null; website: string | null }[] = [];
  for (const l of ls) {
    const makers = (l.makers as any[]).filter((m) => m.id !== "0" && m.name && m.name !== "[REDACTED]" && !/linkedin\.com/i.test(m.websiteUrl ?? "")).slice(0, 3);
    for (const m of makers) if (!done.has(`${l.id}:${m.id}`)) jobs.push({ id: l.id, makerId: m.id, founder: m.name, product: l.name, tagline: l.tagline, website: l.website });
  }
  log(`LinkedIn search: ${jobs.length} founders`);
  let skipped = 0, kept = 0, i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      if (opts.deadline && Date.now() > opts.deadline) { skipped++; continue; }
      try {
        const r = await findLinkedIn(j);
        await q(
          `INSERT INTO founder_links (post_id, maker_id, maker_name, url, evidence) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (post_id, maker_id) DO NOTHING`,
          [j.id, j.makerId, j.founder, r.url, r.evidence],
        );
        if (r.url) { kept++; log(`  ${j.founder} (${j.product}): ${r.url}`); }
      } catch { skipped++; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
  return { searched: jobs.length - skipped, kept, skipped };
}
