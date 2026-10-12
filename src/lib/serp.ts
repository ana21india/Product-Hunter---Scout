import { verifyLinkedIn } from "./gemini";

// LinkedIn profile lookup through a real search service (SerpAPI). It returns Google's actual results, including the
// LinkedIn page title and headline, which Gemini's built-in search could not see. Same strict rules as before:
// the profile address must contain the founder's first and last name, the result text must mention the product or company,
// and if two or more different profiles carry the founder's name, nothing is kept.

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type SerpResult = { title: string; link: string; snippet: string };

export const hasSerpKey = () => !!process.env.SERPAPI_KEY;

export async function searchLinkedInResults(founder: string, product: string): Promise<SerpResult[]> {
  const params = new URLSearchParams({
    engine: "google",
    q: `site:linkedin.com/in "${founder}" ${product}`,
    num: "10",
    api_key: process.env.SERPAPI_KEY as string,
  });
  const r = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Search service HTTP ${r.status}`);
  const j: any = await r.json();
  if (j.error && !/hasn't returned any results/i.test(String(j.error))) throw new Error("Search service: " + String(j.error).slice(0, 80));
  return (j.organic_results ?? []).map((o: any) => ({ title: String(o.title ?? ""), link: String(o.link ?? ""), snippet: String(o.snippet ?? "") }));
}

// Pure decision logic (unit tested): which result, if any, may be shown as a suggestion for this founder.
export function pickProfile(results: SerpResult[], founder: string, product: string, website: string | null): { url: string | null; evidence: string } {
  const parts = norm(founder).split(" ").filter((t) => t.length >= 2);
  if (parts.length < 2) return { url: null, evidence: "serp: single-word name" };
  const sameName = new Map<string, SerpResult>();
  for (const r of results) {
    const h = r.link.match(/linkedin\.com\/in\/([A-Za-z0-9%_-]+)/i)?.[1];
    if (!h) continue;
    const flat = norm(decodeURIComponent(h).replace(/-/g, " ")).replace(/ /g, "");
    if (flat.includes(parts[0]) && flat.includes(parts[parts.length - 1])) sameName.set(flat, r);
  }
  if (sameName.size === 0) return { url: null, evidence: "serp: no matching profile" };
  if (sameName.size > 1) return { url: null, evidence: "serp: ambiguous, more than one profile with this name" };
  const only = [...sameName.values()][0];
  const text = `${only.title}. ${only.snippet}`;
  const ok = verifyLinkedIn(only.link, text, founder, product, website);
  return { url: ok, evidence: `serp: ${text.slice(0, 240)}` };
}

export async function findLinkedInSerp(p: { founder: string; product: string; website: string | null }) {
  const results = await searchLinkedInResults(p.founder, p.product);
  return pickProfile(results, p.founder, p.product, p.website);
}
