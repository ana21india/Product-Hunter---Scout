import { q } from "../src/lib/db";
const rows = await q(`SELECT id, status, started_at, finished_at, new_launches, refreshed, left(coalesce(note,''),70) note, left(coalesce(error,''),70) error FROM run_log ORDER BY id DESC LIMIT 6`);
for (const r of rows) console.log(r.id, r.status, r.started_at.toISOString(), r.finished_at ? r.finished_at.toISOString() : "—", r.new_launches, r.refreshed, r.note, r.error);
console.log("now", new Date().toISOString());
