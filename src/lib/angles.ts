import { q } from "./db";
import { writeAngles, GEMINI_MODEL } from "./gemini";

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Gemini one-liner and angle for relevant launches in the window that have none yet. Only needs Gemini, never Product Hunt.
// Returns how many launches could not be done (Gemini unavailable), so the next run can retry them.
export async function generateAngles(opts: { log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const todo = await q(
    `SELECT l.post_id AS id, l.name, l.tagline, l.description FROM launches l
     JOIN relevance r ON r.post_id=l.post_id AND r.relevant LEFT JOIN angles a ON a.post_id=l.post_id
     WHERE l.created_at > now() - interval '7 days' AND a.post_id IS NULL`,
  );
  log(`Angles: ${todo.length} launches`);
  let failed = 0;
  const batches = chunks(todo, 10);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const out = await writeAngles(batch);
        const ids = new Set(batch.map((b: any) => b.id));
        const ok = out.filter((o) => ids.has(o.id) && o.one_liner);
        if (!ok.length) continue;
        await q(
          `INSERT INTO angles (post_id, one_liner, angle, status, model)
           SELECT x.id, x.one_liner, x.angle, CASE WHEN lower(x.angle) LIKE 'angle unavailable%' THEN 'thin' ELSE 'ok' END, $2
           FROM jsonb_to_recordset($1::jsonb) AS x(id text, one_liner text, angle text)
           ON CONFLICT (post_id) DO NOTHING`,
          [JSON.stringify(ok), GEMINI_MODEL],
        );
      } catch { failed += batch.length; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, batches.length) }, worker));
  return failed;
}
