export const GEMINI_MODEL = "gemini-3.8-flash";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CATEGORIES = ["Project management", "HR tech", "Developer productivity", "Team communication"] as const;

export const KAVYA_PRODUCT = "A B2B SaaS product that helps remote teams run async standups.";

// One Gemini Flash call that must return JSON matching `schema`. Low temperature, retries on rate limits.
async function callJson(prompt: string, schema: unknown): Promise<any> {
  let lastErr = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY as string },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema },
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

export type LaunchIn = { id: string; name: string; tagline: string | null; description: string | null };

// Decide, for each launch, whether it is a B2B tool for teams/companies in one of the four areas.
export async function judgeRelevance(items: LaunchIn[]) {
  const list = items.map((i) => `- id ${i.id} | ${i.name} | ${clip(i.tagline, 160)} | ${clip(i.description, 400)}`).join("\n");
  const prompt = `You screen new Product Hunt launches for a partnerships manager at a B2B SaaS company (${KAVYA_PRODUCT}).
She wants tools sold to teams or companies in one of these four areas: ${CATEGORIES.join("; ")}.
For each launch decide "relevant" = true if it is a B2B / work tool for teams or companies in one of those areas.
Mark false for consumer apps, personal or family messaging, games, entertainment, hardware, crypto, or tools with no team or work use.
If the information is unclear but it could plausibly be a work tool for teams, mark true.
"category" must be the single best fit of the four areas, or "None" when relevant is false.
"reason" is one short plain sentence based only on the text given. Do not invent facts.
Return one entry per launch, using the same id.

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
        reason: { type: "STRING" },
      },
      required: ["id", "relevant", "category", "reason"],
    },
  };
  return (await callJson(prompt, schema)) as { id: string; relevant: boolean; category: string; reason: string }[];
}

// One-line description and outreach angle, grounded only in the supplied facts.
export async function writeAngles(items: LaunchIn[]) {
  const list = items.map((i) => `- id ${i.id} | ${i.name} | tagline: ${clip(i.tagline, 200)} | description: ${clip(i.description, 500)}`).join("\n");
  const prompt = `Kavya leads partnerships at: ${KAVYA_PRODUCT}
For each launch below write:
- "one_liner": one plain line saying what the product does, based only on its tagline and description.
- "angle": one or two short sentences on how Kavya's product could complement theirs for a partnership.
Use only facts given in this prompt. Do not invent features, customers or numbers.
If the information is too thin to suggest a real angle, set "angle" to exactly "angle unavailable".
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
