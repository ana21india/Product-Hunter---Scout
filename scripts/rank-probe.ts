import { q } from "../src/lib/db";
import * as PH from "../src/lib/ph";
PH.budget.mode = "wait";
const rows = await q(`SELECT l.post_id AS id, l.name FROM launches l JOIN relevance r USING(post_id) WHERE r.relevant AND l.created_at > now() - interval '7 days' ORDER BY l.votes_count DESC LIMIT 14`);
const body = rows.map((r: any, i: number) => `p${i}: post(id:"${r.id}"){ id dailyRank weeklyRank monthlyRank featuredAt votesCount }`).join(" ");
const d: any = await PH.ph(`{ ${body} }`);
rows.forEach((r: any, i: number) => { const p = d[`p${i}`]; console.log(`${r.name.padEnd(28)} daily ${p.dailyRank} | weekly ${p.weeklyRank} | featuredAt ${p.featuredAt} | votes ${p.votesCount}`); });
