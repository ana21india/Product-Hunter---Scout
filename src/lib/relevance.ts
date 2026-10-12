import { q } from "./db";
import { judgeRelevance, GEMINI_MODEL, CATEGORIES, type LaunchIn, type Verdict } from "./gemini";
import { readSitesFor } from "./site";

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  const worker = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

async function save(verdicts: Verdict[]) {
  if (!verdicts.length) return;
  const json = JSON.stringify(verdicts);
  await q(
    `INSERT INTO relevance (post_id, relevant, reason, model, audience, serves)
     SELECT x.id, x.relevant, x.reason, $2, x.audience, x.serves
     FROM jsonb_to_recordset($1::jsonb) AS x(id text, relevant boolean, reason text, audience text, serves text)
     ON CONFLICT (post_id) DO UPDATE SET relevant=EXCLUDED.relevant, reason=EXCLUDED.reason, model=EXCLUDED.model,
       audience=EXCLUDED.audience, serves=EXCLUDED.serves, created_at=now()`,
    [json, GEMINI_MODEL],
  );
  const cats = verdicts.filter((v) => v.relevant && (CATEGORIES as readonly string[]).includes(v.category));
  if (cats.length)
    await q(`UPDATE launches l SET category=x.category FROM jsonb_to_recordset($1::jsonb) AS x(id text, category text) WHERE l.post_id=x.id`, [JSON.stringify(cats)]);
}

// Stage 2: read the product's own website and judge again, because the website says who the product is for.
async function judgeWithWebsites(ids: string[], opts: { deadline?: number; log: (s: string) => void }) {
  if (!ids.length) return;
  await readSitesFor(ids, { deadline: opts.deadline });
  const withSite: any[] = await q(
    `SELECT post_id AS id, name, tagline, description, site_text AS "siteText" FROM launches WHERE post_id = ANY($1::text[]) AND length(coalesce(site_text,'')) >= 300`,
    [ids],
  );
  opts.log(`  websites read: ${withSite.length} of ${ids.length} usable`);
  await pool(chunks(withSite as LaunchIn[], 10), 4, async (batch) => {
    try {
      const out = await judgeRelevance(batch);
      const known = new Set(batch.map((b) => b.id));
      await save(out.filter((o) => known.has(o.id)));
    } catch { /* keeps its earlier verdict */ }
  });
}

// The two-step relevance check. Stage 1 judges from the Product Hunt text and removes the clear misses. Stage 2 reads the product's own
// website for the rest and judges again. Launches whose website cannot be read keep their stage 1 verdict.
export async function judgeLaunches(opts: { all?: boolean; deadline?: number; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const todo: any[] = await q(
    `SELECT l.post_id AS id, l.name, l.tagline, l.description FROM launches l LEFT JOIN relevance r ON r.post_id = l.post_id
     WHERE l.created_at > now() - interval '7 days' ${opts.all ? "" : "AND (r.post_id IS NULL OR r.audience IS NULL)"}`,
  );
  log(`Relevance check: ${todo.length} launches`);
  let failed = 0;
  const survivors: string[] = [];
  await pool(chunks(todo as LaunchIn[], 15), 4, async (batch) => {
    try {
      const out = await judgeRelevance(batch);
      const known = new Set(batch.map((b) => b.id));
      const ok = out.filter((o) => known.has(o.id));
      await save(ok);
      for (const o of ok) if (o.relevant) survivors.push(o.id);
      failed += batch.length - ok.length;
    } catch { failed += batch.length; }
  });
  log(`  stage 1 done: ${survivors.length} to check against their own websites`);
  if (survivors.length && !(opts.deadline && Date.now() > opts.deadline)) await judgeWithWebsites(survivors, { deadline: opts.deadline, log });
  return { judged: todo.length, failed };
}

// Repair pass: relevant launches whose website text is missing (for example it was throttled) are read again and judged against it.
export async function judgeUnreadSites(opts: { deadline?: number; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const ids: string[] = (await q(
    `SELECT l.post_id AS id FROM launches l JOIN relevance r ON r.post_id = l.post_id
     WHERE r.relevant AND l.created_at > now() - interval '7 days' AND length(coalesce(l.site_text,'')) < 300 AND coalesce(l.site_status,'') <> 'no website'`,
  )).map((r: any) => r.id);
  log(`Repair: ${ids.length} relevant launches without usable website text`);
  await judgeWithWebsites(ids, { deadline: opts.deadline, log });
  return ids.length;
}
