"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dashboard, FilteredOut, Item, TrackedItem, WatchItem } from "../lib/data";
import { explainBelow, explainCompare } from "../lib/explain";

type SortKey = "score" | "votes" | "makers" | "newest" | "oldest";
type DaysFilter = "" | "0-2" | "3-5" | "6-7";
type View = "today" | "shortlist" | "all" | "watch" | "outreach" | "results" | "filtered";
type Status = "contacted" | "replied" | "skipped";

const SIZES = [10, 11, 12, 13, 14, 15];
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "never");
const fmtShort = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
const score = (n: number) => n.toFixed(1);
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
const statusWord: Record<Status, string> = { contacted: "Contacted", replied: "Replied", skipped: "Skipped" };

function tierClass(t: string) {
  return t === "Priority" ? "t-pri" : t === "Strong fit" ? "t-str" : t === "Consider" ? "t-con" : "t-low";
}

// What makes a launch worth acting on today, built only from Product Hunt numbers and the launch date.
function trendLabel(it: Item): string | null {
  if (it.weeklyRank && it.weeklyRank <= 25) return `#${it.weeklyRank} on Product Hunt this week`;
  if (it.dailyRank && it.dailyRank <= 5) return `#${it.dailyRank} on its launch day`;
  if (it.votesGain >= 5) return `+${it.votesGain} upvotes today`;
  return null;
}
const daysLeftText = (n: number) => (n <= 1 ? "Last day" : `${n} days left`);

function Icon({ name }: { name: "clock" | "trend" | "send" | "reply" | "check" | "chevron" }) {
  const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "clock") return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "trend") return <svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>;
  if (name === "send") return <svg {...p}><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></svg>;
  if (name === "reply") return <svg {...p}><path d="M4 5h16v11H9l-5 4z" /></svg>;
  if (name === "check") return <svg {...p}><path d="M5 12l5 5 9-10" /></svg>;
  return <svg {...p}><path d="M6 9l6 6 6-6" /></svg>;
}

export default function Page() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("today");
  const [size, setSize] = useState(15);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("");
  const [days, setDays] = useState<DaysFilter>("");
  const [sort, setSort] = useState<SortKey>("score");
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [filteredList, setFilteredList] = useState<FilteredOut[] | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [trackTab, setTrackTab] = useState<Status>("contacted");
  const [listFilter, setListFilter] = useState<"closing" | "trending" | null>(null);
  const ruleRef = useRef<HTMLDialogElement>(null);
  const cmpRef = useRef<HTMLDialogElement>(null);

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
        if (res.status !== "partial" || !/continue on the next click/.test(res.note ?? "")) break;
        setRunMsg(`Still fetching (step ${step + 1})…`);
        await load();
      }
      await load();
      if (res?.status === "live") setRunMsg(`Fetched from Product Hunt at ${fmtShort(new Date().toISOString())}: ${res.newLaunches} new launches found, numbers refreshed for ${res.refreshed} launches. ${res.note ?? ""}`);
      else setRunMsg("");
    } catch {
      setRunMsg("");
    } finally { setRunning(false); }
  }

  // Kavya records what she did. Saved to the database and kept even after a launch leaves the 7-day window. The app never sends anything.
  async function updateStatus(postId: string, next: Status | null) {
    setSaveError("");
    const now = new Date().toISOString();
    setData((d) => d && {
      ...d,
      items: d.items.map((x) => (x.postId === postId ? { ...x, status: next, statusAt: next ? now : null } : x)),
      watchlist: d.watchlist.map((x) => (x.postId === postId ? { ...x, status: next, statusAt: next ? now : null } : x)),
      tracked: next
        ? d.tracked.some((t) => t.postId === postId)
          ? d.tracked.map((t) => (t.postId === postId ? { ...t, status: next, statusAt: now } : t))
          : d.tracked
        : d.tracked.filter((t) => t.postId !== postId),
    });
    try {
      const r = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, status: next }) });
      if (!r.ok) throw new Error();
      load();
    } catch {
      setSaveError("Could not save that. Please try again.");
      load();
    }
  }
  const setStatus = (it: { postId: string }, next: Status | null) => updateStatus(it.postId, next);

  // From the "Do this today" list: show the item ticked off for a moment, then it leaves the list.
  function markFromTodo(it: Item) {
    setFlash((f) => [...f, it.postId]);
    updateStatus(it.postId, "contacted");
    setTimeout(() => setFlash((f) => f.filter((x) => x !== it.postId)), 1100);
  }

  const items = data?.items ?? [];
  const watchlist = data?.watchlist ?? [];
  const tracked = data?.tracked ?? [];
  const th = data?.thresholds ?? { minMaker: 2, minVotes: 10 };
  const shortlist = useMemo(() => items.slice(0, size), [items, size]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const controlsActive = !!(search || category || tier || days || sort !== "score");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = items.filter((i) => {
      if (s && !`${i.name} ${i.founders} ${i.oneLiner ?? ""} ${i.tagline ?? ""} ${i.serves ?? ""}`.toLowerCase().includes(s)) return false;
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

  // The 10-second view: what to act on today, from the shortlist, for launches not yet contacted.
  const todo = useMemo(() => {
    const list = shortlist
      .filter((i) => !i.status || flash.includes(i.postId))
      .map((i) => {
        const reasons: { text: string; kind: string }[] = [];
        let urgency = 0;
        if (i.daysLeft <= 2) { reasons.push({ text: i.daysLeft <= 1 ? "Last day to reach out" : `${i.daysLeft} days left in the window`, kind: i.daysLeft <= 1 ? "urgent last" : "urgent" }); urgency += 100 - i.daysLeft * 10; }
        const t = trendLabel(i);
        if (t) { reasons.push({ text: t, kind: "trend" }); urgency += 40; }
        if (i.daysSince <= 1 && i.rank <= 8) { reasons.push({ text: "Just launched, reach out while it is fresh", kind: "fresh" }); urgency += 25; }
        if (i.tier === "Priority") urgency += 15;
        return { it: i, reasons, urgency: urgency - i.rank * 0.1 };
      })
      .filter((x) => x.reasons.length > 0)
      .sort((a, b) => b.urgency - a.urgency);
    return list.slice(0, 6);
  }, [shortlist, flash]);

  const shortlistShown = listFilter === "closing"
    ? shortlist.filter((i) => !i.status && i.daysLeft <= 2)
    : listFilter === "trending"
      ? shortlist.filter((i) => !i.status && trendLabel(i))
      : shortlist;
  const closingCount = shortlist.filter((i) => !i.status && i.daysLeft <= 2).length;
  const trendingCount = shortlist.filter((i) => !i.status && trendLabel(i)).length;
  const contactedAll = tracked.filter((t) => t.status === "contacted" || t.status === "replied");
  const repliedAll = tracked.filter((t) => t.status === "replied");
  const replyRate = contactedAll.length ? Math.round((repliedAll.length / contactedAll.length) * 100) : null;
  const shortlistDone = shortlist.filter((i) => i.status && i.status !== "skipped").length;

  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? [...p.slice(1), id] : [...p, id]));
  const pickedItems = picked.map((id) => items.find((i) => i.postId === id)).filter(Boolean) as Item[];
  const toggleOpen = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const openAndScroll = (id: string) => {
    setView("shortlist");
    setOpen((o) => (o.includes(id) ? o : [...o, id]));
    setTimeout(() => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 160);
  };

  const run = data?.run;
  const failed = run?.latestStatus === "failed";
  const partial = run?.latestStatus === "partial";
  const showSnapshot = run?.lastGoodWasSnapshot && !failed;
  function clearControls() { setSearch(""); setCategory(""); setTier(""); setDays(""); setSort("score"); }
  const go = (v: View) => { if (v !== "all") clearControls(); setListFilter(null); setView(v); };
  // The summary tiles are shortcuts: they open the matching list or the matching outreach tab.
  const openList = (f: "closing" | "trending") => { clearControls(); setListFilter(f); setView("shortlist"); };
  const openOutreach = (t: Status) => { clearControls(); setListFilter(null); setTrackTab(t); setView("outreach"); };

  useEffect(() => {
    if (view !== "filtered" || filteredList) return;
    fetch("/api/launches?filtered=1", { cache: "no-store" }).then((r) => r.json()).then((j) => setFilteredList(j.filteredOut ?? [])).catch(() => setFilteredList([]));
  }, [view, filteredList]);

  const titles: Record<View, string> = {
    today: "Today's priorities", shortlist: "Shortlist", all: "All launches", watch: "Watchlist", outreach: "Outreach", results: "Results", filtered: "Filtered out",
  };
  const subs: Record<View, string> = {
    today: "What to act on first, from this week's launches on Product Hunt.",
    shortlist: "The best launches this week to reach out to, ranked.",
    all: "Every launch that qualifies this week, with search and filters.",
    watch: "Relevant launches that do not qualify yet. They are re-checked on every run.",
    outreach: "Everything you have marked, kept even after a launch leaves the 7-day window.",
    results: "What you have done and what is getting replies.",
    filtered: "Launches judged not relevant for B2B teams that run standups.",
  };

  const rowProps = (it: Item) => ({
    it, size, open: open.includes(it.postId), picked: picked.includes(it.postId), onPick: () => togglePick(it.postId),
    onToggle: () => toggleOpen(it.postId), onStatus: (s: Status | null) => setStatus(it, s), newRun: run?.latestStartedAt ?? null,
  });

  const table = (rows: Item[], banding: boolean) => (
    <div className="table" role="list">
      <div className="thead" aria-hidden="true">
        <span /><span>#</span><span>Launch</span><span>Signals</span><span>Window</span><span>Tier</span><span>Outreach</span><span />
      </div>
      {rows.map((it, idx) => {
        const prev = rows[idx - 1];
        const showBand = banding && sort === "score" && prev && prev.rank <= size && it.rank > size;
        return (
          <div key={it.postId} role="listitem" className="rowwrap">
            {showBand && <div className="band" role="separator">The shortlist ends here (top {size}). Launches below are ranked lower.</div>}
            <Row {...rowProps(it)} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="app">
      <aside className="side" aria-label="Menu">
        <button type="button" className="brand" onClick={() => go("today")} aria-label="Wingmate home"><span className="logo" aria-hidden="true">W</span> Wingmate</button>
        <nav className="nav" aria-label="Views">
          <button className={`navbtn ${view === "today" ? "on" : ""}`} onClick={() => go("today")}>Today <span className="count">{todo.length}</span></button>
          <button className={`navbtn ${view === "shortlist" ? "on" : ""}`} onClick={() => go("shortlist")}>Shortlist <span className="count">{shortlist.length}</span></button>
          <button className={`navbtn ${view === "all" ? "on" : ""}`} onClick={() => go("all")}>All launches <span className="count">{items.length}</span></button>
          <button className={`navbtn ${view === "watch" ? "on" : ""}`} onClick={() => go("watch")}>Watchlist <span className="count">{watchlist.length}</span></button>
          <button className={`navbtn ${view === "outreach" ? "on" : ""}`} onClick={() => go("outreach")}>Outreach <span className="count">{tracked.length}</span></button>
          <button className={`navbtn ${view === "results" ? "on" : ""}`} onClick={() => go("results")}>Results</button>
          <button className={`navbtn ${view === "filtered" ? "on" : ""}`} onClick={() => go("filtered")}>Filtered out <span className="count">{data?.filteredCount ?? 0}</span></button>
        </nav>
        <div className="sidefoot">
          <button type="button" className="linkbtn" onClick={() => ruleRef.current?.showModal()}>How are launches ranked?</button>
          <p className="muted small">You decide whom to contact. Nothing is ever sent from here.</p>
        </div>
      </aside>

      <div className="content">
        {view !== "today" && (
          <div className="homebar">
            <button type="button" className="btn" onClick={() => go("today")}>← Home</button>
            <span className="muted small">{titles[view]}</span>
          </div>
        )}
        <header className="top">
          <div>
            <h1>{titles[view]}</h1>
            <p className="sub">{subs[view]}</p>
          </div>
          <div className="runbox">
            <div className="lastrun" aria-live="polite">Last run: {fmtTime(run?.lastGoodAt ?? null)}</div>
            <button className="btn primary" onClick={runScout} disabled={running} aria-busy={running}>{running ? "Running…" : "Run scout"}</button>
          </div>
        </header>

        {loadError && <div className="banner err" role="alert">{loadError}</div>}
        {saveError && <div className="banner err" role="alert">{saveError}</div>}
        {failed && run?.lastGoodAt && <div className="banner warn" role="status">Could not fetch new launches; showing last run ({fmtTime(run.lastGoodAt)}).</div>}
        {partial && <div className="banner warn" role="status">Partly refreshed. {run?.latestNote}</div>}
        {showSnapshot && <div className="banner info" role="status">Showing the starting snapshot taken from Product Hunt at {fmtTime(run?.lastGoodAt ?? null)}. Press Run scout for fresh data.</div>}
        {!!data?.pending && <div className="banner info" role="status">{data.pending} launches are still being processed and will appear after the next run.</div>}
        {runMsg && <div className="banner ok" role="status">{runMsg}</div>}
        {data && !items.length && !watchlist.length && !failed && <div className="banner info">No new launches in the last 7 days in your topics.</div>}
        {data && !items.length && failed && !run?.lastGoodAt && <div className="banner err" role="alert">Product Hunt could not be reached and there is no saved list yet. Please try again shortly.</div>}

        {view === "today" && (
          <>
            <section className="tiles" aria-label="Summary">
              <button type="button" className={`tile ${closingCount > 0 ? "hot" : ""}`} onClick={() => openList("closing")} aria-label={`Close today: ${closingCount}. Show these launches`}><span className="ticon urgent"><Icon name="clock" /></span><div><div className="tlabel">Close today</div><div className="tnum">{closingCount}</div><div className="tsub">window ends in 2 days or less</div></div></button>
              <button type="button" className="tile" onClick={() => openList("trending")} aria-label={`Trending on Product Hunt: ${trendingCount}. Show these launches`}><span className="ticon"><Icon name="trend" /></span><div><div className="tlabel">Trending on Product Hunt</div><div className="tnum">{trendingCount}</div><div className="tsub">top of the leaderboard</div></div></button>
              <button type="button" className="tile" onClick={() => openOutreach("contacted")} aria-label={`Contacted: ${contactedAll.length}. Open the Outreach tab`}><span className="ticon"><Icon name="send" /></span><div><div className="tlabel">Contacted</div><div className="tnum">{contactedAll.length}</div><div className="tsub">{shortlistDone} of {shortlist.length} shortlisted done</div></div></button>
              <button type="button" className="tile" onClick={() => openOutreach("replied")} aria-label={`Replies: ${repliedAll.length}. Open the Outreach tab`}><span className="ticon"><Icon name="reply" /></span><div><div className="tlabel">Replies</div><div className="tnum">{repliedAll.length}</div><div className="tsub">{replyRate === null ? "no outreach yet" : `${replyRate}% reply rate`}</div></div></button>
            </section>

            <section className="card todo" aria-labelledby="todo-h">
              <div className="todohead">
                <h2 id="todo-h">Do this today</h2>
                <span className="muted small">From your shortlist, not yet contacted</span>
              </div>
              {todo.length === 0 ? (
                <p className="muted todoempty">Nothing urgent right now. Every shortlisted launch is either contacted or has time left.</p>
              ) : (
                <ol className="todolist">
                  {todo.map(({ it, reasons }) => (
                    <li key={it.postId} className={`todoitem ${flash.includes(it.postId) ? "flashed" : ""}`}>
                      <span className={`step ${flash.includes(it.postId) ? "done" : ""}`} aria-hidden="true">{flash.includes(it.postId) ? <Icon name="check" /> : it.rank}</span>
                      <div className="todomain">
                        <a href={it.url ?? "#"} target="_blank" rel="noreferrer" className="todoname">{it.name}</a>
                        <div className="chips">
                          {reasons.map((r) => <span key={r.text} className={`chip ${r.kind}`}>{r.text}</span>)}
                          <span className={`chip ${tierClass(it.tier)} outline`}>{it.tier}</span>
                        </div>
                      </div>
                      <div className="todoactions">
                        <button className="btn" onClick={() => openAndScroll(it.postId)}>View angle</button>
                        <button className="btn primary" onClick={() => markFromTodo(it)}>Mark contacted</button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="todofoot"><button type="button" className="linkbtn" onClick={() => go("shortlist")}>See the full shortlist</button></div>
            </section>
          </>
        )}

        {view === "shortlist" && (
          <>
            <section className="card controls" aria-label="Shortlist size">
              <div className="field">
                <label htmlFor="size">Shortlist size</label>
                <select id="size" value={size} onChange={(e) => changeSize(Number(e.target.value))}>
                  {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <p className="muted small grow">
                A launch qualifies when its makers have written at least {th.minMaker} comments and it has at least {th.minVotes} upvotes.
                {items.length < size ? ` Only ${items.length} qualify right now, so the shortlist is shorter than ${size}. The rest are on the Watchlist.` : ""}
              </p>
            </section>
            {listFilter && (
              <div className="filterbar" role="status">
                <span>
                  Showing {shortlistShown.length} {listFilter === "closing" ? "launches whose window ends in 2 days or less" : "launches trending on Product Hunt"}, not yet contacted.
                </span>
                <button type="button" className="btn" onClick={() => setListFilter(null)}>Show the full shortlist</button>
              </div>
            )}
            {table(shortlistShown, false)}
            {!listFilter && items.length > size && (
              <>
                <div className="band strong" role="separator">The shortlist ends here. {items.length - size} more launches are ranked below.</div>
                <button className="btn primary wide" onClick={() => go("all")}>See all launches ({items.length})</button>
                <section className="peek card" aria-labelledby="peek-h">
                  <h3 id="peek-h">Just below the cutoff</h3>
                  <ul>
                    {items.slice(size, size + 3).map((b) => (
                      <li key={b.postId}>
                        <strong>#{b.rank} {b.name}</strong>
                        <div className="muted small">{explainBelow(b as any, items[size - 1] as any)}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}

        {view === "all" && (
          <>
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
                  <option value="score">Rank</option>
                  <option value="votes">Upvotes</option>
                  <option value="makers">Maker comments</option>
                  <option value="newest">Days since launch (newest first)</option>
                  <option value="oldest">Days since launch (oldest first)</option>
                </select>
              </div>
              {controlsActive && <button className="btn" onClick={clearControls}>Clear</button>}
            </section>
            <h2 className="viewtitle">{filtered.length}{filtered.length !== items.length ? ` of ${items.length}` : ""} launches</h2>
            {table(filtered, true)}
          </>
        )}

        {view === "watch" && (
          <>
            <section className="card note">
              <p>These launches fit your four areas, but they do not qualify for the ranking yet: makers need at least {th.minMaker} comments and the launch needs at least {th.minVotes} upvotes. Each run checks them again, and a launch moves up as soon as it qualifies. Nothing here is hidden from you.</p>
            </section>
            <div className="table" role="list">
              {watchlist.length === 0 && <p className="muted">Nothing waiting. Every relevant launch this week already qualifies.</p>}
              {watchlist.slice(0, 200).map((w) => (
                <div key={w.postId} role="listitem" className="rowwrap"><WatchRow w={w} onStatus={(s) => setStatus(w, s)} /></div>
              ))}
              {watchlist.length > 200 && <p className="muted small">Showing the 200 with the most upvotes of {watchlist.length}.</p>}
            </div>
          </>
        )}

        {view === "outreach" && (
          <Outreach tracked={tracked} tab={trackTab} setTab={setTrackTab} onStatus={updateStatus} />
        )}

        {view === "results" && <Results items={items} tracked={tracked} size={size} />}

        {view === "filtered" && (
          <section className="card" aria-label="Filtered out launches">
            <p className="muted">They are never ranked.{filteredList === null ? " Loading…" : filteredList.length > 300 ? ` Showing the 300 most upvoted of ${filteredList.length}.` : ""}</p>
            <ul className="filteredlist">
              {(filteredList ?? []).slice(0, 300).map((f) => (
                <li key={f.postId}>
                  <a href={f.url ?? "#"} target="_blank" rel="noreferrer">{f.name}</a>
                  <span className="muted"> · {f.votes} upvotes</span>
                  <div className="muted small">{f.serves ? `Serves: ${f.serves}. ` : ""}{f.reason}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {picked.length > 0 && (
        <div className="cmpbar" role="region" aria-label="Compare selection">
          <span>
            {pickedItems.length < 2 ? `Compare: ${pickedItems[0]?.name ?? "1 selected"}. Select at least one more (up to 4).` : `Comparing ${pickedItems.length} of up to 4: ${pickedItems.map((p) => p.name).join(", ")}`}
          </span>
          <span className="cmpactions">
            {pickedItems.length >= 2 && <button className="btn primary" onClick={() => cmpRef.current?.showModal()}>View comparison</button>}
            <button className="btn" onClick={() => setPicked([])}>Clear</button>
          </span>
        </div>
      )}

      <dialog ref={cmpRef} className="modal wide" aria-labelledby="cmp-h" onClick={(e) => { if (e.target === cmpRef.current) cmpRef.current?.close(); }}>
        <div className="modalbody">
          <div className="cmphead"><h2 id="cmp-h">Compare</h2><button className="btn" onClick={() => cmpRef.current?.close()}>Close</button></div>
          {pickedItems.length >= 2 && <CompareTable items={pickedItems} />}
        </div>
      </dialog>

      <dialog ref={ruleRef} className="modal" aria-labelledby="rule-h" onClick={(e) => { if (e.target === ruleRef.current) ruleRef.current?.close(); }}>
        <div className="modalbody">
          <h2 id="rule-h">How launches are ranked</h2>
          <ul>
            <li><strong>Relevant:</strong> the product&apos;s customers are the kind of people who run team standups, in project management, HR tech, developer productivity or team communication.</li>
            <li><strong>Qualifies:</strong> the makers have written at least {th.minMaker} comments or replies (more than the usual intro post) and the launch has at least {th.minVotes} upvotes. Others wait on the Watchlist and are re-checked on every run.</li>
            <li><strong>Ranking score</strong> = 60% × Upvote score + 40% × Maker-comment score, from 0 to 100.</li>
            <li><strong>Upvote score</strong> = the launch&apos;s upvotes ÷ the highest upvote count among qualifying launches × 100.</li>
            <li><strong>Maker-comment score</strong> = its maker comments ÷ the highest maker-comment count among qualifying launches × 100. Maker comments are comments and replies written by the product&apos;s own makers, never all community comments.</li>
            <li>One very popular launch sets the benchmark, so most scores look small next to it. That is why the lists show rank and tier. The score itself is in each launch&apos;s details and in Compare.</li>
            <li><strong>Ties:</strong> more maker comments first, then more upvotes.</li>
            <li><strong>Tiers by rank:</strong> 1–4 Priority, 5–8 Strong fit, 9–12 Consider, 13 and below Lower priority.</li>
            <li>&quot;Window&quot; shows how many days of the 7-day outreach window are left. &quot;Trending&quot; uses Product Hunt&apos;s own leaderboard ranks and recent upvote gains.</li>
            <li>The Contacted, Replied and Skip buttons only save your own notes.</li>
          </ul>
          <button type="button" className="btn primary" onClick={() => ruleRef.current?.close()}>Close</button>
        </div>
      </dialog>
    </div>
  );
}

function StatusButtons({ name, status, onStatus }: { name: string; status: Status | null; onStatus: (s: Status | null) => void }) {
  const btn = (s: Status, label: string) => (
    <button type="button" className={`seg ${status === s ? "on " + s : ""}`} aria-pressed={status === s} onClick={() => onStatus(status === s ? null : s)}>
      {label}
    </button>
  );
  return (
    <div className="outreach" role="group" aria-label={`Outreach status for ${name}`}>
      {btn("contacted", "Contacted")}
      {btn("replied", "Replied")}
      {btn("skipped", "Skip")}
    </div>
  );
}

function Row({ it, size, open, picked, onPick, onToggle, onStatus, newRun }: {
  it: Item; size: number; open: boolean; picked: boolean; onPick: () => void; onToggle: () => void; onStatus: (s: Status | null) => void; newRun: string | null;
}) {
  const isNew = !!newRun && it.firstSeenAt >= newRun;
  const trend = trendLabel(it);
  const urgentDays = it.daysLeft <= 1 ? "urgent" : it.daysLeft <= 2 ? "soon" : "";
  return (
    <article id={`row-${it.postId}`} className={`row ${it.rank > size ? "below" : ""} ${it.status ? "done" : ""} ${!it.status && it.daysLeft <= 1 ? "hot" : ""}`}>
      <label className="pick" title="Select to compare">
        <input type="checkbox" checked={picked} onChange={onPick} aria-label={`Compare ${it.name}`} />
      </label>
      <span className="rank" aria-label={`Rank ${it.rank}`}>{it.rank}</span>
      <div className="launch">
        <div className="lname">
          <a href={it.url ?? "#"} target="_blank" rel="noreferrer">{it.name}</a>
          {isNew && <span className="chip fresh">New</span>}
          {trend && <span className="chip trend" title="From Product Hunt">{trend}</span>}
        </div>
        <div className="lline">{it.oneLiner ?? it.tagline ?? ""}</div>
        {it.serves && <div className="lserves">Serves: {it.serves}</div>}
      </div>
      <div className="metawrap">
        <div className="signals" title="Upvotes and maker comments"><span>▲ {it.votes}</span><span>💬 {it.makerComments}</span></div>
        <div className={`window ${urgentDays}`}>{daysLeftText(it.daysLeft)}</div>
        <div><span className={`chip tier ${tierClass(it.tier)}`}>{it.tier}</span></div>
      </div>
      <StatusButtons name={it.name} status={it.status} onStatus={onStatus} />
      <button type="button" className="more" aria-expanded={open} onClick={onToggle}>
        {open ? "Hide" : "View angle"} <span className={`chev ${open ? "up" : ""}`}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="details">
          <div className="dcol">
            <h4>Outreach angle</h4>
            <p>
              {it.angleState === "ok" && it.angle}
              {it.angleState === "thin" && "Angle unavailable"}
              {it.angleState === "missing" && "Angle unavailable, retry (press Run scout)"}
            </p>
            <h4>How it ranked</h4>
            <p className="muted">Score {score(it.finalScore)} of 100, where the most popular launch this week is the benchmark. {it.rationale}. Upvotes add {score(it.upvotePoints)} points and maker comments add {score(it.makerPoints)}.</p>
          </div>
          <div className="dcol">
            <h4>{it.founderNames.length > 1 ? "Founders" : "Founder"} <span className="muted small" title="Makers listed on this launch on Product Hunt">(as listed on Product Hunt)</span></h4>
            <p>{it.founderNames.length === 0 ? "Not listed" : it.founderNames.slice(0, 4).join(", ")}{it.founderNames.length > 4 && <span className="muted"> +{it.founderNames.length - 4} more</span>}</p>
            <h4>Category</h4>
            <p>{it.category}</p>
            {it.links.length > 0 && (
              <>
                <h4>Links</h4>
                <p className="links">{it.links.map((l, i) => <span key={l.url + l.label}>{i > 0 && " · "}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)}</p>
              </>
            )}
            {it.suggestedPeople.length > 0 && (
              <div className="suggest">
                <p><strong>Suggested person to speak to:</strong>{" "}
                  {it.suggestedPeople.map((p, i) => <span key={p.url}>{i > 0 && " · "}{p.name} (<a href={p.url} target="_blank" rel="noreferrer">LinkedIn profile</a>)</span>)}
                </p>
                <p className="muted small">A suggestion from a web search, not part of the Product Hunt data or the ranking. Please confirm it is the right person.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function WatchRow({ w, onStatus }: { w: WatchItem; onStatus: (s: Status | null) => void }) {
  return (
    <article className={`row watch ${w.status ? "done" : ""}`}>
      <div className="launch wlaunch">
        <div className="lname"><a href={w.url ?? "#"} target="_blank" rel="noreferrer">{w.name}</a></div>
        <div className="lline">{w.oneLiner ?? ""}</div>
        {w.serves && <div className="lserves">Serves: {w.serves}</div>}
        <div className="chips">{w.reasons.map((r) => <span key={r} className="chip">{r}</span>)}</div>
      </div>
      <div className="metawrap wmeta">
        <div className="signals"><span>▲ {w.votes}</span><span>💬 {w.makerComments}</span></div>
        <div className={`window ${w.daysLeft <= 1 ? "urgent" : w.daysLeft <= 2 ? "soon" : ""}`}>{w.daysLeft <= 0 ? "Window ending" : daysLeftText(w.daysLeft)}</div>
      </div>
      <StatusButtons name={w.name} status={w.status} onStatus={onStatus} />
    </article>
  );
}

function Outreach({ tracked, tab, setTab, onStatus }: { tracked: TrackedItem[]; tab: Status; setTab: (s: Status) => void; onStatus: (id: string, s: Status | null) => void }) {
  const tabs: Status[] = ["contacted", "replied", "skipped"];
  const count = (s: Status) => tracked.filter((t) => t.status === s).length;
  const list = tracked.filter((t) => t.status === tab);
  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Outreach status">
        {tabs.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={`subtab ${tab === s ? "on" : ""}`} onClick={() => setTab(s)}>
            {statusWord[s]} <span className="count">{count(s)}</span>
          </button>
        ))}
      </div>
      {tracked.length === 0 && <div className="banner info">Nothing marked yet. Use the Contacted, Replied and Skip buttons on a launch and it will be kept here, even after the launch leaves the 7-day window.</div>}
      {tracked.length > 0 && list.length === 0 && <p className="muted">Nothing marked as {statusWord[tab].toLowerCase()} yet.</p>}
      <div className="table" role="list">
        {list.map((t) => (
          <div key={t.postId} role="listitem" className="rowwrap">
            <article className="row tracked">
              <div className="launch">
                <div className="lname"><a href={t.url ?? "#"} target="_blank" rel="noreferrer">{t.name}</a></div>
                <div className="lserves">
                  {statusWord[t.status]} {ago(t.statusAt)} · ▲ {t.votes} · {t.inWindow ? daysLeftText(t.daysLeft) : "launch window ended"}
                  {t.rank ? ` · ranked #${t.rank}, ${t.tier}` : t.inWindow ? " · not in this week's ranking" : ""}
                </div>
              </div>
              <div className="trackactions">
                {t.status !== "contacted" && <button className="btn" onClick={() => onStatus(t.postId, "contacted")}>Mark contacted</button>}
                {t.status !== "replied" && <button className="btn" onClick={() => onStatus(t.postId, "replied")}>Mark replied</button>}
                {t.status !== "skipped" && <button className="btn" onClick={() => onStatus(t.postId, "skipped")}>Skip</button>}
                <button className="btn" onClick={() => onStatus(t.postId, null)}>Put back to to-do</button>
              </div>
            </article>
          </div>
        ))}
      </div>
    </>
  );
}

function Results({ items, tracked, size }: { items: Item[]; tracked: TrackedItem[]; size: number }) {
  const group = (keyOf: (i: Item) => string, keys: string[]) =>
    keys.map((k) => {
      const inGroup = items.filter((i) => keyOf(i) === k);
      const short = inGroup.filter((i) => i.rank <= size).length;
      const contacted = inGroup.filter((i) => i.status === "contacted" || i.status === "replied").length;
      const replied = inGroup.filter((i) => i.status === "replied").length;
      const skipped = inGroup.filter((i) => i.status === "skipped").length;
      return { k, short, contacted, replied, skipped, rate: contacted ? Math.round((replied / contacted) * 100) : null };
    });
  const tiers = group((i) => i.tier, ["Priority", "Strong fit", "Consider", "Lower priority"]);
  const cats = group((i) => i.category, [...new Set(items.map((i) => i.category))].sort());
  const table = (title: string, rows: ReturnType<typeof group>) => (
    <section className="card">
      <h2 className="rtitle">{title}</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th scope="col">{title.replace("By ", "")}</th><th scope="col">On shortlist</th><th scope="col">Contacted</th><th scope="col">Replied</th><th scope="col">Skipped</th><th scope="col">Reply rate</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}><th scope="row">{r.k}</th><td>{r.short}</td><td>{r.contacted}</td><td>{r.replied}</td><td>{r.skipped}</td><td>{r.rate === null ? "–" : `${r.rate}%`}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
  const all = tracked.length;
  const contacted = tracked.filter((t) => t.status === "contacted" || t.status === "replied").length;
  const replied = tracked.filter((t) => t.status === "replied").length;
  return (
    <>
      <p className="muted">These numbers come only from the Contacted, Replied and Skip buttons you press. Overall so far: {contacted} contacted, {replied} replied{contacted ? ` (${Math.round((replied / contacted) * 100)}% reply rate)` : ""}, {tracked.filter((t) => t.status === "skipped").length} skipped.</p>
      {all === 0 && <div className="banner info">Nothing recorded yet. Use the buttons on each launch and the picture will build up here.</div>}
      {table("By tier", tiers)}
      {table("By category", cats)}
    </>
  );
}

function CompareTable({ items }: { items: Item[] }) {
  const sorted = [...items].sort((x, y) => x.rank - y.rank);
  const best = sorted[0];
  const rows: [string, (i: Item) => string][] = [
    ["Rank", (i) => `#${i.rank}`],
    ["Tier", (i) => i.tier],
    ["Score (0–100)", (i) => score(i.finalScore)],
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
          <thead><tr><th scope="col"> </th>{items.map((i) => <th scope="col" key={i.postId}>{i.name}</th>)}</tr></thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label}><th scope="row">{label}</th>{items.map((i) => <td key={i.postId}>{f(i)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="explain">
        {sorted.slice(1).map((lo) => (
          <p key={lo.postId}>{explainCompare(best as any, lo as any)}</p>
        ))}
      </div>
    </>
  );
}
