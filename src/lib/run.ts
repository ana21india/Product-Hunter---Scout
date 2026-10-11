import { q } from "./db";
import * as PH from "./ph";
import { judgeRelevance, GEMINI_MODEL, CATEGORIES } from "./gemini";
import { generateAngles } from "./angles";

const DAY = 864e5;
const WINDOW = "interval '7 days'";

export type RunOpts = { mode: "script" | "api"; deadlineMs?: number; topics?: string[]; snapshot?: boolean; log?: (s: string) => void };
export type RunResult = { status: "live" | "partial" | "failed" | "busy"; newLaunches: number; refreshed: number; note: string; error?: string };

async function getSetting<T = any>(key: string): Promise<T | null> {
  const r = await q("SELECT value FROM settings WHERE key=$1", [key]);
  return r.length ? (r[0].value as T) : null;
}
const setSetting = (key: string, value: unknown) =>
  q("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [key, JSON.stringify(value)]);

// Run `fn` over `items` with at most `n` in flight.
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  const worker = async () => { while (i < items.length) { const x = items[i++]; await fn(x); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function upsertLaunches(rows: PH.RawLaunch[], category: string, snapshot: boolean) {
  if (!rows.length) return 0;
  const payload = rows.map((r) => ({
    post_id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, description: r.description, url: r.url, website: r.website,
    votes_count: r.votesCount, comments_count: r.commentsCount, created_at: r.createdAt, topics: r.topics,
  }));
  const res = await q(
    `INSERT INTO launches (post_id,slug,name,tagline,description,url,website,votes_count,comments_count,created_at,makers,topics,category,is_snapshot)
     SELECT x.post_id,x.slug,x.name,x.tagline,x.description,x.url,x.website,x.votes_count,x.comments_count,x.created_at,'[]'::jsonb,x.topics,$2,$3
     FROM jsonb_to_recordset($1::jsonb) AS x(post_id text, slug text, name text, tagline text, description text, url text, website text,
       votes_count int, comments_count int, created_at timestamptz, topics text[])
     ON CONFLICT (post_id) DO UPDATE SET votes_count=EXCLUDED.votes_count, comments_count=EXCLUDED.comments_count,
       tagline=EXCLUDED.tagline, description=EXCLUDED.description,
       topics=(SELECT array_agg(DISTINCT t) FROM unnest(launches.topics || EXCLUDED.topics) t), last_refreshed=now()
     RETURNING (xmax = 0) AS inserted`,
    [JSON.stringify(payload), category, snapshot],
  );
  return res.filter((r) => r.inserted).length;
}

export async function runScout(opts: RunOpts): Promise<RunResult> {
  const log = opts.log ?? (() => {});
  const busy = await q("SELECT id FROM run_log WHERE status='running' AND started_at > now() - interval '10 minutes'");
  if (busy.length) return { status: "busy", newLaunches: 0, refreshed: 0, note: "A run is already in progress" };

  const runStartMs = Date.now();
  const runStart = new Date(runStartMs).toISOString();
  const [{ id: runId }] = await q("INSERT INTO run_log (status) VALUES ('running') RETURNING id");
  PH.budget.mode = opts.mode === "api" ? "stop" : "wait";
  PH.budget.deadline = opts.deadlineMs ? runStartMs + opts.deadlineMs : Infinity;
  PH.budget.remaining = null;

  let newLaunches = 0, refreshed = 0;
  const notes: string[] = opts.snapshot ? ["Starting snapshot"] : [];
  let status: RunResult["status"] = "live";
  let error: string | undefined;

  try {
    // Phase A: fetch launches posted since the last scan, per topic, and store them.
    const mapping = (await getSetting<Record<string, string[]>>("topic_mapping")) ?? {};
    const topicCategory = new Map<string, string>();
    for (const [cat, slugs] of Object.entries(mapping)) for (const s of slugs) if (!topicCategory.has(s)) topicCategory.set(s, (CATEGORIES as readonly string[]).includes(cat) ? cat : "Unclassified");
    const topics = opts.topics ?? [...topicCategory.keys()];

    let state = await getSetting<{ since: string; started: string; done: string[] }>("scan_state");
    if (!state) {
      const wm = await getSetting<string>("fetch_watermark");
      const floor = runStartMs - 7 * DAY;
      const since = new Date(Math.max(floor, wm ? new Date(wm).getTime() - 6 * 3600e3 : floor)).toISOString();
      state = { since, started: runStart, done: [] };
      await setSetting("scan_state", state);
    }
    log(`Fetching launches posted since ${state.since}`);
    for (const t of topics) {
      if (state.done.includes(t)) continue;
      const n = await PH.fetchTopicLaunches(t, state.since, async (rows) => {
        newLaunches += await upsertLaunches(rows, topicCategory.get(t) ?? "Unclassified", !!opts.snapshot);
      });
      state.done.push(t);
      await setSetting("scan_state", state);
      log(`  ${t}: ${n} launches`);
    }
    if (!opts.topics) {
      await setSetting("fetch_watermark", state.started);
      await q("DELETE FROM settings WHERE key='scan_state'");
    }

    // Phase B: Gemini relevance check on launches in the window that have no verdict yet.
    const unjudged = await q(
      `SELECT l.post_id AS id, l.name, l.tagline, l.description FROM launches l LEFT JOIN relevance r ON r.post_id=l.post_id
       WHERE r.post_id IS NULL AND l.created_at > now() - ${WINDOW}`,
    );
    log(`Relevance check: ${unjudged.length} launches`);
    let geminiFailed = 0;
    await pool(chunks(unjudged, 15), 4, async (batch) => {
      try {
        const out = await judgeRelevance(batch);
        const byId = new Map(batch.map((b: any) => [b.id, b]));
        const ok = out.filter((o) => byId.has(o.id));
        if (!ok.length) return;
        await q(
          `INSERT INTO relevance (post_id, relevant, reason, model)
           SELECT x.id, x.relevant, x.reason, $2 FROM jsonb_to_recordset($1::jsonb) AS x(id text, relevant boolean, reason text)
           ON CONFLICT (post_id) DO UPDATE SET relevant=EXCLUDED.relevant, reason=EXCLUDED.reason, model=EXCLUDED.model`,
          [JSON.stringify(ok), GEMINI_MODEL],
        );
        const cats = ok.filter((o) => o.relevant && (CATEGORIES as readonly string[]).includes(o.category));
        if (cats.length)
          await q(`UPDATE launches l SET category=x.category FROM jsonb_to_recordset($1::jsonb) AS x(id text, category text) WHERE l.post_id=x.id`, [JSON.stringify(cats)]);
      } catch (e) { geminiFailed += batch.length; }
    });
    if (geminiFailed) notes.push(`Relevance check unavailable for ${geminiFailed} launches (will retry next run)`);

    // Phase D: refresh live upvotes and comment totals for relevant launches in the window not refreshed this run.
    const stale = await q(
      `SELECT l.post_id AS id FROM launches l JOIN relevance r ON r.post_id=l.post_id AND r.relevant
       WHERE l.created_at > now() - ${WINDOW} AND l.last_refreshed < $1`, [runStart],
    );
    log(`Refreshing live numbers for ${stale.length} launches`);
    await pool(chunks(stale.map((s: any) => s.id as string), 100), 2, async (ids) => {
      const cur = await PH.fetchCurrent(ids);
      if (!cur.length) return;
      await q(
        `UPDATE launches l SET votes_count=x.votes, comments_count=x.comments, last_refreshed=now()
         FROM jsonb_to_recordset($1::jsonb) AS x(id text, votes int, comments int) WHERE l.post_id=x.id`,
        [JSON.stringify(cur.map((c) => ({ id: c.id, votes: c.votesCount, comments: c.commentsCount })))],
      );
      refreshed += cur.length;
    });

    // Phase C: maker comments for relevant launches that are new or whose comment total changed.
    const need = await q(
      `SELECT l.post_id AS id, l.slug, l.comments_count AS cc FROM launches l
       JOIN relevance r ON r.post_id=l.post_id AND r.relevant
       LEFT JOIN maker_comments m ON m.post_id=l.post_id
       WHERE l.created_at > now() - ${WINDOW} AND (m.post_id IS NULL OR m.comments_total_seen <> l.comments_count OR l.makers::text NOT LIKE '%"url"%')`,
    );
    log(`Maker comments: ${need.length} launches to (re)count`);
    await pool(chunks(need, 15), 3, async (batch: any[]) => {
      const res = await PH.fetchMakersAndCountsBatch(batch.map((l) => ({ id: l.id, slug: l.slug, cc: l.cc })));
      for (const l of batch) {
        const c = res.get(l.id);
        if (!c) continue;
        await q("UPDATE launches SET makers=$2::jsonb WHERE post_id=$1", [l.id, JSON.stringify(c.makers)]);
        await q(
          `INSERT INTO maker_comments (post_id, maker_comment_count, unattributed_count, comments_total_seen, fetched_at)
           VALUES ($1,$2,$3,$4,now())
           ON CONFLICT (post_id) DO UPDATE SET maker_comment_count=EXCLUDED.maker_comment_count, unattributed_count=EXCLUDED.unattributed_count,
             comments_total_seen=EXCLUDED.comments_total_seen, fetched_at=now()`,
          [l.id, c.maker, c.unattributed, l.cc],
        );
      }
    });
    // Phase E: Gemini one-liner and angle for relevant launches without one.
    const angleFailed = await generateAngles({ log });
    if (angleFailed) notes.push(`Angles unavailable for ${angleFailed} launches (retry next run)`);
  } catch (e: any) {
    if (e instanceof PH.BudgetError) {
      status = "partial";
      notes.push(
        /time limit/.test(e.message)
          ? "The run needed more time and will continue on the next click."
          : "Product Hunt's request limit (a fixed allowance per 15 minutes) was reached, so some numbers may be slightly behind. Try again in about 2 minutes.",
      );
    } else { status = "failed"; error = String(e?.message ?? e); }
  }

  const note = notes.join(" | ");
  await q("UPDATE run_log SET finished_at=now(), status=$2, error=$3, new_launches=$4, refreshed=$5, note=$6 WHERE id=$1",
    [runId, status, error ?? null, newLaunches, refreshed, note || null]);
  return { status, newLaunches, refreshed, note, error };
}





