"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dashboard, Item } from "../lib/data";
import { explainBelow, explainCompare } from "../lib/explain";

type SortKey = "score" | "votes" | "makers" | "newest" | "oldest";
type DaysFilter = "" | "0-2" | "3-5" | "6-7";

const SIZES = [10, 11, 12, 13, 14, 15];
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "never");
const fmtShort = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const score = (n: number) => n.toFixed(1);

function tierClass(t: string) {
  return t === "Priority" ? "t-pri" : t === "Strong fit" ? "t-str" : t === "Consider" ? "t-con" : "t-low";
}

export default function Page() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<"shortlist" | "all">("shortlist");
  const [size, setSize] = useState(15);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("");
  const [days, setDays] = useState<DaysFilter>("");
  const [sort, setSort] = useState<SortKey>("score");
  const [picked, setPicked] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [ruleOpen, setRuleOpen] = useState(true);

  useEffect(() => { if (window.innerWidth < 860) setRuleOpen(false); }, []);
  useEffect(() => {
    try { const s = Number(localStorage.getItem("shortlistSize")); if (SIZES.includes(s)) setSize(s); } catch {}
  }, []);
  const changeSize = (n: number) => { setSize(n); try { localStorage.setItem("shortlistSize", String(n)); } catch {} };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/launches", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData(await r.json());
      setLoadError("");
    } catch { setLoadError("Could not load the list. Please refresh the page."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runScout() {
    setRunning(true);
    setRunMsg("Asking Product Hunt for the latest launches…");
    try {
      let res: any = null;
      for (let step = 1; step <= 8; step++) {
        const r = await fetch("/api/run", { method: "POST" });
        res = await r.json();
        if (res.status === "busy") { setRunMsg("A run is already in progress. Please wait a moment and try again."); break; }
        if (res.status !== "partial") break;
        setRunMsg(`Still fetching (step ${step + 1})… this can take a few minutes the first time.`);
        await load();
      }
      await load();
      if (res?.status === "live") setRunMsg(`Fetched from Product Hunt at ${fmtShort(new Date().toISOString())}: ${res.newLaunches} new launches found, upvotes and comments refreshed for ${res.refreshed} launches. ${res.note ?? ""}`);
      else if (res?.status === "partial") setRunMsg(`Partly refreshed: ${res.note} Press Run scout again to continue.`);
      else if (res?.status === "failed") setRunMsg("");
    } catch {
      setRunMsg("");
    } finally { setRunning(false); }
  }

  const items = data?.items ?? [];
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const controlsActive = !!(search || category || tier || days || sort !== "score");
  const effView = controlsActive ? "all" : view;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = items.filter((i) => {
      if (s && !`${i.name} ${i.founders} ${i.oneLiner ?? ""} ${i.tagline ?? ""}`.toLowerCase().includes(s)) return false;
      if (category && i.category !== category) return false;
      if (tier && i.tier !== tier) return false;
      if (days === "0-2" && i.daysSince > 2) return false;
      if (days === "3-5" && (i.daysSince < 3 || i.daysSince > 5)) return false;
      if (days === "6-7" && i.daysSince < 6) return false;
      return true;
    });
    const by: Record<SortKey, (a: Item, b: Item) => number> = {
      score: (a, b) => a.rank - b.rank,
      votes: (a, b) => b.votes - a.votes || a.rank - b.rank,
      makers: (a, b) => b.makerComments - a.makerComments || a.rank - b.rank,
      newest: (a, b) => a.daysSince - b.daysSince || a.rank - b.rank,
      oldest: (a, b) => b.daysSince - a.daysSince || a.rank - b.rank,
    };
    return [...list].sort(by[sort]);
  }, [items, search, category, tier, days, sort]);

  const shown = effView === "shortlist" ? items.slice(0, size) : filtered;
  const below = items.slice(size, size + 3);
  const cutoffItem = items[size - 1];
  const hiddenBelow = Math.max(0, items.length - size);

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1], id] : [...p, id]));
  const pickedItems = picked.map((id) => items.find((i) => i.postId === id)).filter(Boolean) as Item[];

  const run = data?.run;
  const failed = run?.latestStatus === "failed";
  const partial = run?.latestStatus === "partial";
  const showSnapshot = run?.lastGoodWasSnapshot && !failed;

  function clearControls() { setSearch(""); setCategory(""); setTier(""); setDays(""); setSort("score"); }

  return (
    <div className="shell">
      <header className="top">
        <div>
          <h1>Partnership Scout</h1>
          <p className="sub">Product Hunt launches from the last 7 days, ranked for outreach. You decide whom to contact; nothing is ever sent.</p>
          <p className="sub"><strong>Score = 60% upvotes + 40% maker comments</strong>, each measured against the highest in the current set.</p>
        </div>
        <div className="runbox">
          <button className="btn primary" onClick={runScout} disabled={running} aria-busy={running}>
            {running ? "Running…" : "Run scout"}
          </button>
          <div className="lastrun" aria-live="polite">Last run: {fmtTime(run?.lastGoodAt ?? null)}</div>
        </div>
      </header>

      <div className="layout">
        <aside className="side" aria-label="Menu">
          <nav className="card">
            <button className={`navbtn ${effView === "shortlist" ? "on" : ""}`} onClick={() => { clearControls(); setView("shortlist"); }}>
              Shortlist <span className="count">{Math.min(size, items.length)}</span>
            </button>
            <button className={`navbtn ${effView === "all" ? "on" : ""}`} onClick={() => setView("all")}>
              All apps <span className="count">{items.length}</span>
            </button>
          </nav>
          <details className="card filtered">
            <summary>Filtered out ({data?.filteredOut.length ?? 0})</summary>
            <p className="muted">Launches Gemini judged not relevant for B2B teams. They are never ranked.</p>
            <ul>
              {(data?.filteredOut ?? []).slice(0, 200).map((f) => (
                <li key={f.postId}>
                  <a href={f.url ?? "#"} target="_blank" rel="noreferrer">{f.name}</a>
                  <span className="muted"> · {f.votes} upvotes</span>
                  <div className="muted small">{f.reason}</div>
                </li>
              ))}
            </ul>
          </details>
        </aside>

        <main className="main">
          {loadError && <div className="banner err" role="alert">{loadError}</div>}
          {failed && <div className="banner warn" role="status">Could not fetch new launches; showing last run ({fmtTime(run?.lastGoodAt ?? null)}).{run?.latestError ? "" : ""}</div>}
          {partial && <div className="banner warn" role="status">Partly refreshed. {run?.latestNote} Press Run scout again to continue.</div>}
          {showSnapshot && <div className="banner info" role="status">Showing the starting snapshot taken from Product Hunt at {fmtTime(run?.lastGoodAt ?? null)}. Press Run scout for fresh data.</div>}
          {!!data?.pending && <div className="banner info" role="status">{data.pending} launches are still being processed and will appear after the next run.</div>}
          {runMsg && <div className="banner ok" role="status">{runMsg}</div>}

          {data && !items.length && !failed && (
            <div className="banner info">No new launches in the last 7 days in your topics.</div>
          )}
          {data && !items.length && failed && !run?.lastGoodAt && (
            <div className="banner err" role="alert">Product Hunt could not be reached and there is no saved list yet. Please try again shortly.</div>
          )}

          <details className="card rule" open={ruleOpen} onToggle={(e) => setRuleOpen((e.target as HTMLDetailsElement).open)}>
            <summary>How scores are made</summary>
            <p><strong>Final score = 60% upvotes + 40% maker comments.</strong></p>
            <p>Each is measured against the highest in the current 7-day set (highest = 100). Maker comments are comments and replies written by the product&apos;s own makers, never all community comments.</p>
            <p>Ties: more maker comments first, then more upvotes. Tiers by rank: 1–4 Priority, 5–8 Strong fit, 9–12 Consider, 13+ Lower priority.</p>
          </details>

          <section className="card controls" aria-label="Search, filter and sort">
            <div className="field grow">
              <label htmlFor="q">Search by name, founder or one-liner</label>
              <input id="q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. standup, Jane, payroll" />
            </div>
            <div className="field">
              <label htmlFor="cat">Category</label>
              <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tier">Tier</label>
              <select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">All tiers</option>
                {["Priority", "Strong fit", "Consider", "Lower priority"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="days">Days since launch</label>
              <select id="days" value={days} onChange={(e) => setDays(e.target.value as DaysFilter)}>
                <option value="">Any</option>
                <option value="0-2">0–2 days</option>
                <option value="3-5">3–5 days</option>
                <option value="6-7">6–7 days (closing)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sort">Sort by</label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="score">Final score</option>
                <option value="votes">Upvotes</option>
                <option value="makers">Maker comments</option>
                <option value="newest">Days since launch (newest first)</option>
                <option value="oldest">Days since launch (oldest first)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="size">Shortlist size</label>
              <select id="size" value={size} onChange={(e) => changeSize(Number(e.target.value))}>
                {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {controlsActive && <button className="btn" onClick={clearControls}>Clear search and filters</button>}
          </section>

          <h2 className="viewtitle">
            {effView === "shortlist" ? `Shortlist: top ${Math.min(size, items.length)}` : `All apps (${filtered.length}${filtered.length !== items.length ? ` of ${items.length}` : ""})`}
          </h2>
          {effView === "all" && controlsActive && <p className="muted">Searching and filtering cover every launch, so a low rank never hides a product.</p>}

          <ol className="list">
            {shown.map((it, idx) => {
              const prev = shown[idx - 1];
              const showBand = effView === "all" && sort === "score" && prev && prev.rank <= size && it.rank > size;
              return (
                <li key={it.postId}>
                  {showBand && <div className="band" role="separator">The shortlist ends here (top {size}). Launches below are ranked lower.</div>}
                  <Row it={it} size={size} picked={picked.includes(it.postId)} onPick={() => togglePick(it.postId)} newRun={run?.latestStartedAt ?? null} />
                </li>
              );
            })}
          </ol>

          {effView === "shortlist" && items.length > 0 && (
            <>
              <div className="band strong" role="separator">
                The shortlist ends here. {hiddenBelow} more launches are ranked below.
              </div>
              <button className="btn primary wide" onClick={() => setView("all")}>See all apps ({items.length})</button>
              {cutoffItem && below.length > 0 && (
                <section className="peek card" aria-labelledby="peek-h">
                  <h3 id="peek-h">Just below the cutoff</h3>
                  <ul>
                    {below.map((b) => (
                      <li key={b.postId}>
                        <strong>#{b.rank} {b.name}</strong> · score {score(b.finalScore)}
                        <div className="muted small">{explainBelow(b as any, cutoffItem as any)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {picked.length > 0 && (
            <section className="compare card" aria-labelledby="cmp-h">
              <div className="cmphead">
                <h2 id="cmp-h">Compare</h2>
                <button className="btn" onClick={() => setPicked([])}>Clear comparison</button>
              </div>
              {pickedItems.length < 2 ? (
                <p className="muted">Select one more product to compare side by side.</p>
              ) : (
                <CompareTable a={pickedItems[0]} b={pickedItems[1]} />
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Row({ it, size, picked, onPick, newRun }: { it: Item; size: number; picked: boolean; onPick: () => void; newRun: string | null }) {
  const isNew = !!newRun && it.firstSeenAt >= newRun;
  return (
    <article className={`row ${it.rank > size ? "below" : ""}`}>
      <div className="rowtop">
        <span className="rank" aria-label={`Rank ${it.rank}`}>#{it.rank}</span>
        <h3 className="name">
          <a href={it.url ?? "#"} target="_blank" rel="noreferrer">{it.name}</a>
        </h3>
        <span className={`tier ${tierClass(it.tier)}`}>{it.tier}</span>
        {it.closing && <span className="tag closing">Closing</span>}
        {isNew && <span className="tag new">New</span>}
        {it.rank > size && <span className="tag">Below shortlist</span>}
        <label className="pick">
          <input type="checkbox" checked={picked} onChange={onPick} />
          <span>Compare</span>
        </label>
      </div>
      <p className="oneliner">{it.oneLiner ?? it.tagline ?? ""}</p>
      <dl className="meta">
        <div><dt>Category</dt><dd>{it.category}</dd></div>
        <div><dt>Founder</dt><dd>{it.founders}</dd></div>
        <div><dt>Upvotes</dt><dd>{it.votes}</dd></div>
        <div><dt>Maker comments</dt><dd>{it.makerComments}</dd></div>
        <div><dt>Days since launch</dt><dd>{it.daysSince}{it.closing ? " (day 6–7)" : ""}</dd></div>
      </dl>
      <div className="scorewrap">
        <div className="scoretxt"><strong>{score(it.finalScore)}</strong> / 100</div>
        <div className="bar" role="img" aria-label={`Final score ${score(it.finalScore)} out of 100`}>
          <span style={{ width: `${Math.max(1, Math.min(100, it.finalScore))}%` }} />
        </div>
      </div>
      <p className="why muted">{it.rationale}</p>
      <p className="angle"><strong>Suggested angle:</strong>{" "}
        {it.angleState === "ok" && it.angle}
        {it.angleState === "thin" && "Angle unavailable"}
        {it.angleState === "missing" && "Unavailable, retry (press Run scout)"}
      </p>
    </article>
  );
}

function CompareTable({ a, b }: { a: Item; b: Item }) {
  const [hi, lo] = a.rank <= b.rank ? [a, b] : [b, a];
  const rows: [string, (i: Item) => string][] = [
    ["Rank", (i) => `#${i.rank}`],
    ["Tier", (i) => i.tier],
    ["Final score", (i) => score(i.finalScore)],
    ["Upvote score (0–100)", (i) => score(i.upvoteScore)],
    ["Maker-comment score (0–100)", (i) => score(i.makerScore)],
    ["Points from upvotes (60%)", (i) => score(i.upvotePoints)],
    ["Points from maker comments (40%)", (i) => score(i.makerPoints)],
    ["Upvotes", (i) => String(i.votes)],
    ["Maker comments", (i) => String(i.makerComments)],
    ["Days since launch", (i) => String(i.daysSince)],
    ["Days left in window", (i) => String(i.daysLeft)],
    ["Category", (i) => i.category],
  ];
  return (
    <>
      <div className="tablewrap">
        <table>
          <thead><tr><th scope="col"> </th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label}><th scope="row">{label}</th><td>{f(a)}</td><td>{f(b)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="explain">{explainCompare(hi as any, lo as any)}</p>
    </>
  );
}
