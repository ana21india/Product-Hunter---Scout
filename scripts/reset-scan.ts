import { q } from "../src/lib/db";
await q("DELETE FROM settings WHERE key IN ('fetch_watermark','scan_state')");
await q("UPDATE run_log SET status='failed', error='stopped', finished_at=now() WHERE status='running'");
console.log("scan state cleared; launches stored:", (await q("SELECT count(*)::int AS n FROM launches"))[0].n);
