export const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CATEGORIES = ["Project management", "HR tech", "Developer productivity", "Team communication"] as const;

export const KAVYA_PRODUCT = "A B2B SaaS product that helps remote teams run async standups.";

// One Gemini Flash call that must return JSON matching `schema`. Low temperature, retries on rate limits.
// `thinking` keeps Gemini's built-in reasoning short: these are simple tasks and the default made every call 2-3x slower.
async function callJson(prompt: string, schema: unknown, thinking: unknown = { thinkingLevel: "low" }): Promise<any> {
  let lastErr = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: thinking },
      }),
    });
    if (r.status === 429 || r.status >= 500) {
      lastErr = `Gemini HTTP ${r.status}`;
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
    const j: any = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    try { return JSON.parse(text); } catch { lastErr = "Gemini returned invalid JSON"; }
  }
  throw new Error(lastErr || "Gemini failed");
}

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").slice(0, n);

export type LaunchIn = { id: string; name: string; tagline: string | null; description: string | null; siteText?: string | null };

export type Verdict = { id: string; relevant: boolean; category: string; audience: string; serves: string; reason: string };

// The two-step relevance rule. Kavya looks for distribution partners: products whose customers are the same kind of people who would
// buy async standups. Step 1: does it fit one of the four areas? Step 2: who uses it day to day (A one person, B individual professionals
// inside a team workflow, C teams or managers)? Kept unless clearly personal or clearly outside the four areas.
export async function judgeRelevance(items: LaunchIn[]): Promise<Verdict[]> {
  const list = items
    .map((i) => {
      const site = i.siteText && i.siteText.length >= 300 ? i.siteText.replace(/\n/g, " ") : "";
      return `- id ${i.id} | ${i.name} | Product Hunt: ${clip(i.tagline, 160)} ${clip(i.description, 400)}\n  Website: ${site || "not available or too short, so judge from the Product Hunt text and keep it if unclear"}`;
    })
    .join("\n\n");
  const prompt = `You screen new Product Hunt launches for a partnerships manager at a B2B SaaS company that sells async standups to remote teams. She looks for distribution partners: products whose CUSTOMERS are the same kind of people who would buy async standups, so the two products can integrate, bundle or promote each other. She is NOT selling standups to the launch's own staff.

Our customers are managers and team leads who run recurring check-ins for remote or distributed teams: engineering managers, product managers, scrum masters, project and program managers, founders and CTOs of remote-first companies, agency owners, people-ops leaders.

Step 1. Which area does the product fit? Project management (planning, tracking, coordinating team work); HR tech (hiring, onboarding, performance, engagement); Developer productivity (code review, git, testing, CI/CD, coding assistants, engineering analytics); Team communication (chat, meetings, async updates, shared knowledge). If none, category = "None".
Step 2. Who uses it day to day? audience = "A" one person for personal use (consumers, solo operators, students, job seekers, creators); "B" individual professionals working inside a team's workflow (for example developers reviewing teammates' code, recruiters in a hiring team); "C" teams or managers directly.
relevant = true when category is not "None" AND audience is B or C. relevant = false ONLY when the product is clearly personal (A), or clearly outside the four areas, or is a model, API or infrastructure bought by an individual developer to build something else. If the evidence is unclear, keep it (relevant = true).
Use the website text as the main evidence for who the customers are; the Product Hunt text may be short. Use only facts in the text given.
Return one entry per launch with the same id: relevant, category, audience, serves (who buys and uses it, at most six words), reason (one sentence, say what in the text shows it).

Launches:
${list}`;
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        relevant: { type: "BOOLEAN" },
        category: { type: "STRING", enum: [...CATEGORIES, "None"] },
        audience: { type: "STRING", enum: ["A", "B", "C"] },
        serves: { type: "STRING" },
        reason: { type: "STRING" },
      },
      required: ["id", "relevant", "category", "audience", "serves", "reason"],
    },
  };
  return (await callJson(prompt, schema, { thinkingLevel: "low" })) as Verdict[];
}

// One-line description and outreach angle, grounded only in the supplied facts.
export async function writeAngles(items: LaunchIn[]) {
  const list = items.map((i) => `- id ${i.id} | ${i.name} | tagline: ${clip(i.tagline, 200)} | description: ${clip(i.description, 500)}`).join("\n");
  const prompt = `Our company sells this product: ${KAVYA_PRODUCT}
For each launch below write:
- "one_liner": one plain line saying what the product does, based only on its tagline and description.
- "angle": a short story of two to three sentences, in this order: (1) what the launch's team does, taken from its description; (2) the standup problem a team like that typically faces; (3) how async standup reports would fit in. Plain words, no bullet points.
  Example of the shape (do not copy its facts): "Velozity gives remote teams a shared virtual office with chat, tasks and AI agents. When people work across time zones, live standups are hard to schedule and updates get lost in chat. Async standup reports would give each person a short daily update the whole team can read when it suits them."
Rules for "angle": mention remote or distributed work ONLY if the launch's own text says so. Never include statistics, percentages, results, team sizes or customer claims, because none are supplied. Never mention a person's name, never write "Kavya", and never start with the word "angle". Use only facts given in this prompt. Do not invent features, customers or numbers.
Set "angle" to exactly "angle unavailable" ONLY when the tagline and description together say almost nothing about what the product does (fewer than about 15 words of real information). Do NOT use it just because the product is for developers, individuals or AI agents: in that case write the story about the team of people who build with or use it.
Keep it short, plain and specific. Return one entry per launch with the same id.

Launches:
${list}`;
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: { id: { type: "STRING" }, one_liner: { type: "STRING" }, angle: { type: "STRING" } },
      required: ["id", "one_liner", "angle"],
    },
  };
  return (await callJson(prompt, schema)) as { id: string; one_liner: string; angle: string }[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// A found profile is kept only if the address is a real linkedin.com/in/ profile whose handle contains the founder's first and last
// name, and the evidence text mentions the product. Anything weaker is thrown away, so the card simply shows nothing.
export function verifyLinkedIn(url: string, evidence: string, founder: string, product: string, website: string | null): string | null {
  const m = url.trim().match(/^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9%_-]{3,100})\/?(?:[?#].*)?$/);
  if (!m) return null;
  const handle = norm(decodeURIComponent(m[1]).replace(/-/g, " ")).replace(/ /g, "");
  const parts = norm(founder).split(" ").filter((t) => t.length >= 2);
  if (parts.length < 2) return null;
  if (!handle.includes(parts[0]) || !handle.includes(parts[parts.length - 1])) return null;
  const ev = norm(evidence);
  const prod = norm(product);
  let host = "";
  try { host = norm(new URL(website ?? "").hostname.replace(/^www\./, "").split(".")[0]); } catch {}
  if (!(prod.length >= 3 && ev.includes(prod)) && !(host.length >= 4 && ev.includes(host))) return null;
  return `https://www.linkedin.com/in/${m[1]}`;
}

// Ask Gemini (with Google Search) for a founder's LinkedIn profile. Returns a verified URL or null.
export async function findLinkedIn(p: { founder: string; product: string; tagline: string | null; website: string | null }) {
  const prompt = `Use Google Search to find the LinkedIn profile of ${p.founder}, a founder or maker of the product "${p.product}"${p.tagline ? ` (${p.tagline})` : ""}${p.website ? `, website ${p.website}` : ""}.
List every linkedin.com/in/ profile you find that could belong to a person with this name, even if you are not sure it is the right one. Do not guess or invent addresses.
Reply with one line per profile, in exactly this form:
PROFILE: <the linkedin.com/in/ address> | <the headline or company shown in the result, quoted>
If you found no such profile, reply with the single word NONE.`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1, thinkingConfig: { thinkingLevel: "low" } } }),
    });
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * 2 ** attempt); continue; }
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
    const j: any = await r.json();
    const text: string = j.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "";
    const cands = [...text.matchAll(/PROFILE:\s*(\S+)\s*\|\s*(.*)/gi)].map((m) => ({ url: m[1].replace(/[)>.,;*]+$/, ""), evidence: m[2].trim() }));
    // Several profiles with this person's name: we cannot tell which is right, so we keep none.
    const sameName = new Map<string, { url: string; evidence: string }>();
    for (const c of cands) {
      const h = c.url.match(/linkedin\.com\/in\/([A-Za-z0-9%_-]+)/i)?.[1]?.toLowerCase();
      if (!h) continue;
      const flat = norm(decodeURIComponent(h).replace(/-/g, " ")).replace(/ /g, "");
      const parts = norm(p.founder).split(" ").filter((t) => t.length >= 2);
      if (parts.length >= 2 && flat.includes(parts[0]) && flat.includes(parts[parts.length - 1])) sameName.set(flat, c);
    }
    if (sameName.size > 1) return { url: null, evidence: "ambiguous: more than one profile with this name" };
    const only = [...sameName.values()][0];
    if (!only) return { url: null, evidence: cands[0]?.evidence.slice(0, 300) ?? "" };
    return { url: verifyLinkedIn(only.url, only.evidence, p.founder, p.product, p.website), evidence: only.evidence.slice(0, 300) };
  }
  throw new Error("Gemini search failed");
}

