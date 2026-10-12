import { q } from "./db";

const strip = (s: string) =>
  s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The text on a product's own website that says what it is and who it is for: title, description, headings and first paragraphs.
// A product's address on Product Hunt is a redirect link, and Product Hunt answers "429 too many requests" if it is hit too fast,
// so a throttled or failed attempt is retried after a pause.
export async function readSite(url: string | null): Promise<{ text: string; status: string }> {
  if (!url) return { text: "", status: "no website" };
  let status = "fetch failed";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; PartnershipScout/1.0)" }, signal: AbortSignal.timeout(10000) });
      if (r.status === 429 || r.status >= 500) { status = `HTTP ${r.status}`; await sleep(2000 * (attempt + 1)); continue; }
      if (!r.ok) return { text: "", status: `HTTP ${r.status}` };
      const html = (await r.text()).slice(0, 600_000);
      const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const meta = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
      const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 3).slice(0, 14);
      const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => strip(m[1])).filter((t) => t.length > 40).slice(0, 5);
      const text = [`Title: ${title}`, meta && `Description: ${meta}`, heads.length && `Headings: ${heads.join(" | ")}`, paras.length && `Text: ${paras.join(" ")}`]
        .filter(Boolean).join("\n").slice(0, 1800);
      return { text, status: "ok" };
    } catch {
      status = "fetch failed";
      await sleep(1500 * (attempt + 1));
    }
  }
  return { text: "", status };
}

// Reads and saves the website text for launches that do not have it yet, or whose last attempt was throttled or failed.
// Goes gently (3 at a time with a short pause) so Product Hunt's redirect links are not throttled. Returns how many were read.
export async function readSitesFor(ids: string[], opts: { deadline?: number } = {}) {
  if (!ids.length) return 0;
  const rows = await q(
    `SELECT post_id AS id, website FROM launches WHERE post_id = ANY($1::text[]) AND (site_status IS NULL OR site_status NOT IN ('ok','no website') OR length(coalesce(site_text,'')) < 300)`,
    [ids],
  );
  let i = 0, done = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      if (opts.deadline && Date.now() > opts.deadline) return;
      const s = await readSite(r.website);
      await q(`UPDATE launches SET site_text=$2, site_status=$3 WHERE post_id=$1`, [r.id, s.text, s.status]);
      done++;
      await sleep(250);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, worker));
  return done;
}
