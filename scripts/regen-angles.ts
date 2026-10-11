import { q } from "../src/lib/db";
import { generateAngles } from "../src/lib/angles";

// Clears the saved angles so they are rewritten with the current wording, then regenerates them (Gemini only).
await q("DELETE FROM angles");
const failed = await generateAngles({ log: (s) => console.log(s) });
const sample = await q(`SELECT l.name, a.angle FROM angles a JOIN launches l USING(post_id) ORDER BY l.votes_count DESC LIMIT 4`);
for (const s of sample) console.log(`${s.name}: ${s.angle}`);
console.log("RESULT failed:", failed);
