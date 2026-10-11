import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const statements = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split(";").map(s => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
for (const s of statements) await sql.query(s);
const settings = {
  product_description: "A B2B SaaS product that helps remote teams run async standups.",
  topic_mapping: {
    "Project management": ["task-management"],
    "HR tech": ["human-resources", "hiring"],
    "Developer productivity": ["developer-tools", "software-engineering"],
    "Team communication": ["messaging", "meetings", "remote-work", "slack"],
    "Broad (relevance-filtered)": ["productivity"],
  },
  shortlist_default: 15,
};
for (const [k, v] of Object.entries(settings))
  await sql.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, JSON.stringify(v)]);
const t = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
console.log("Tables:", t.map(r => r.table_name).join(", "));
