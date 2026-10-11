import { q } from "../src/lib/db";
const rows = await q(`SELECT l.name, a.angle, a.status FROM angles a JOIN launches l USING(post_id) JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days'`);
const withDigits = rows.filter((r: any) => /\d/.test(r.angle ?? ""));
const withKavya = rows.filter((r: any) => /kavya/i.test(r.angle ?? ""));
const startsAngle = rows.filter((r: any) => /^\s*angle\b/i.test(r.angle ?? "") && !/^angle unavailable/i.test(r.angle));
const pct = rows.filter((r: any) => /%|percent/i.test(r.angle ?? ""));
const thin = rows.filter((r: any) => r.status === "thin");
console.log(`angles: ${rows.length} | thin (angle unavailable): ${thin.length} | contain digits: ${withDigits.length} | contain % : ${pct.length} | mention Kavya: ${withKavya.length} | start with "angle": ${startsAngle.length}`);
for (const r of withDigits.slice(0, 5)) console.log("  digits ->", r.name, ":", r.angle);
