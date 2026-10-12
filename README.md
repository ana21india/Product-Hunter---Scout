# Wingmate

A small web app that gives a partnerships lead a **ranked outreach list of Product Hunt launches from the last 7 days**, on demand.

**Live app:** https://product-hunter-scout-8pnx.vercel.app/

## The problem it solves

Kavya leads partnerships at a B2B SaaS company that helps remote teams run async standups. She contacts founders of newly launched tools in the first seven days after launch, because after day seven the conversation gets much harder. Until now she checked Product Hunt by hand every morning (30 to 40 minutes), and still missed launches that appeared after her check or gained traction later in the day.

Wingmate, a companion that helps her find better partnerships, replaces that scan. When she clicks **Run scout**, the app pulls fresh data from Product Hunt, ranks every relevant launch from the last 7 days, and shows her enough to decide whom to approach. **She decides whom to contact. The app never sends anything to anyone.**

## What she sees

- **Tabs:** Today, Shortlist, All launches, Watchlist, Outreach, Results and Filtered out.
- **A 10-second "Today" view.** Four summary tiles (launches to close today, trending on Product Hunt, contacted, replies) and a "Do this today" list of the shortlisted launches that need action first: windows ending in 2 days or less, launches ranked high on Product Hunt's own leaderboard, and fresh launches near the top. Each has a "Mark contacted" button.
- **Shortlist** tab: the top 10 to 15 launches (she picks the size, default 15), with a clear "shortlist ends here" band and a button to see all launches. If fewer launches qualify than the size she chose, it is shorter.
- **Watchlist** tab: relevant launches that do not qualify yet (see below). They are re-checked on every run, so nothing relevant goes unseen.
- **Outreach** tab: everything she has marked Contacted, Replied or Skipped, kept even after a launch leaves the 7-day window, with a way to change or undo each one.
- **All launches** view with every ranked launch, plus search (name, founder, one-liner), filters (category, tier, days since launch) and sorting (score, upvotes, maker comments, days since launch).
- **Compact rows.** Each launch is one row: rank, name and one-line description, who it serves, upvotes and maker comments, days left in the 7-day window and tier. Score numbers are not shown on the rows; they are in each launch's details and in Compare. The longer details (the suggested angle, why it scored this way, founders, links) open with "View angle".
- **Outreach tracking.** Each row has Contacted, Replied and Skip buttons. They save Kavya's own notes only; the app never sends anything. A **Results** view then shows contacted, replied and reply rate by tier and by category, so she can see what is working.
- **Compare** up to four launches side by side, with a plain explanation of why one is ranked above the others.
- **Filtered out** view: launches judged not relevant for B2B teams, with the reason. They are never ranked.
- The time of the last run, and a notice banner whenever the data is not fully fresh.

## How scores are made

```
Final score = 0.60 x Upvote score + 0.40 x Maker-comment score      (0 to 100)

Upvote score         = product's upvotes        / highest upvotes in the current set        x 100
Maker-comment score  = product's maker comments / highest maker comments in the current set x 100
```

- **Maker comments** are comments and replies written by the product's own makers on its launch page. They are never all community comments. A comment is attributed to a maker by matching the comment's user id with the launch's maker ids (never by display name).
- **The set** is every relevant launch posted in the last 7 days, without duplicates, **that qualifies**. A launch qualifies when its makers have written at least 2 comments or replies (more than the usual single intro post) and it has at least 10 upvotes (roughly the top 10% of launches in a typical week). This is an addition to the written rubric: in testing, 41 of 310 relevant launches had no maker comments at all (mostly large companies whose makers do not reply), 248 had only the intro comment, and the median launch had 1 upvote. Launches that do not qualify yet stay on the Watchlist and are re-checked every run. The two thresholds are constants in `src/lib/scoring.ts`.
- If the highest value of a metric is 0, that metric scores 0 for everyone (no division by zero).
- **Ties:** more maker comments first, then more upvotes, then the older post.
- **Tiers by rank:** 1 to 4 Priority, 5 to 8 Strong fit, 9 to 12 Consider, 13 and below Lower priority.
- Category only decides which launches are fetched. It never changes the score.
- Scores and ranks are **never stored**. They are computed from the raw numbers every time the page is read.

The formulas have unit tests, including a hand-checked example and the zero-maximum case: `npm test`.

## What happens when she clicks "Run scout"

Everything below runs live against Product Hunt on every click.

1. **Fetch new launches.** For each mapped Product Hunt topic, page through launches posted since the last scan (cursor pagination, 20 per page) and save them.
2. **Relevance check (Gemini Flash).** Each new launch is judged: is it a B2B tool for teams or companies in project management, HR tech, developer productivity or team communication? Consumer apps and unrelated tools go to the "Filtered out" list.
3. **Refresh live numbers.** Current upvotes and comment totals for every relevant launch in the window are re-read in large batched requests.
4. **Count maker comments.** For launches that are new or whose comment total changed, makers and every comment and reply are read, and maker comments are counted strictly.
5. **Write angles (Gemini Flash).** A short story for each new relevant launch: what the team does, a standup problem teams like that face, and how async standup reports fit. Angles use only facts from the launch text and never include statistics.
6. **After the answer is on screen:** company LinkedIn pages and optional founder suggestions for the current top 15.

The database exists so that each click only asks Product Hunt about what is new or changed, and does not redo work that cannot change (descriptions, relevance verdicts, angles). Browsing, searching, filtering and comparing read from the database only.

## Failure behaviour

| Situation | What the app does |
|---|---|
| Product Hunt fails | Shows the last saved list with the banner "Could not fetch new launches; showing last run (time)". Days since launch are recalculated from saved timestamps, and anything past day 7 drops out. |
| Product Hunt's request limit is reached | Stops cleanly with a plain notice and keeps the list. The next run continues from where it stopped. |
| Product Hunt works but returns nothing | "No new launches in the last 7 days in your topics." |
| No saved list yet and Product Hunt fails | A plain error message. |
| Gemini fails | The ranked list still shows. Missing angles say "Angle unavailable, retry (press Run scout)". |

## Topics fetched

Product Hunt has no topics named exactly like the four categories, so each category maps to the closest real topics. The mapping is stored in the `settings` table.

| Category | Product Hunt topics |
|---|---|
| Project management | `task-management` |
| HR tech | `human-resources`, `hiring` |
| Developer productivity | `developer-tools`, `software-engineering` |
| Team communication | `messaging`, `meetings`, `remote-work`, `slack` |
| Broad, then relevance-filtered | `productivity` |

## Tech stack and the five layers

| Layer | What | Where |
|---|---|---|
| Frontend | Next.js (React, TypeScript) dashboard | `src/app/page.tsx`, `src/app/globals.css` |
| Backend | Next.js server routes: `/api/run` (live scout) and `/api/launches` (read and rank) | `src/app/api`, `src/lib/run.ts`, `src/lib/data.ts` |
| Database | Neon (Postgres): settings, launches, maker comment counts, relevance verdicts, angles, run log | `db/schema.sql` |
| API | Product Hunt GraphQL API v2 and Gemini Flash (`gemini-3.8-flash`), both called server-side only | `src/lib/ph.ts`, `src/lib/gemini.ts` |
| Version control and hosting | GitHub, deployed on Vercel | this repository |

Gemini Flash is the only AI model used.

## Run it yourself

Requirements: Node.js 20 or later, a Neon database, a Product Hunt API token and a Gemini API key.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in the three values:
   - `DATABASE_URL` is your Neon connection string.
   - `PH_TOKEN` is a Product Hunt developer token.
   - `GEMINI_API_KEY` is your Gemini API key.
   - `SERPAPI_KEY` (optional) is a SerpAPI key. With it, founders' LinkedIn profiles are looked up through a real search service; without it, Gemini's own search is used, which rarely finds LinkedIn pages.
3. Create the tables and default settings: `npx tsx --env-file=.env scripts/create-tables.mjs`
4. Load the starting snapshot (one-time, takes a while because it waits for Product Hunt's request limit to reset): `npx tsx --env-file=.env scripts/run-scout.ts --snapshot`
5. Start the app: `npm run dev`, then open http://localhost:3000

Deploying to Vercel: import the repository, add the same three environment variables, and deploy.

Other scripts in `scripts/`: `angles-only.ts` and `regen-angles.ts` (Gemini only), `linkedin-top.ts` (company and founder LinkedIn suggestions), `stats.ts` (counts), `allowance.ts` (Product Hunt allowance left), `live-check.ts` (checks a deployed site), `repo-secret-check.ts` (confirms no key is in git history).

## Secrets

All keys live in `.env`, which is git-ignored, and in Vercel's environment settings. Product Hunt and Gemini are called from the server only. No key is sent to the browser, and none appears in the repository history.

## Known limits

- **Product Hunt's request limit** is about 6,250 points per 15 minutes, and every request costs a flat 100 points. A normal click uses roughly 25 to 30 requests, so many clicks in a row can reach the limit. The app then shows the plain notice and keeps the saved list.
- **Maker comments** can only be attributed when Product Hunt returns the commenter's user id and the maker's id. In testing both were available. Product Hunt sometimes redacts a maker's id inside very large requests, so such launches are re-read on their own.
- **Upvotes and comments change only when someone clicks Run scout.** The page shows the time of the last run. There is no scheduler.
- **Founder LinkedIn suggestions** use Gemini's built-in search with strict checks (the profile address must contain the founder's name, the quoted text must mention the product, and two profiles with the same name mean nothing is shown). They appear rarely, are labelled as a suggestion to confirm, and are not part of the ranking. A "Company on LinkedIn" link appears when the product's own website links its LinkedIn page.
- **Relevance filtering** is a two-step Gemini check. It first asks which of the four areas a launch fits, then who uses it day to day (one person, individual professionals inside a team workflow, or teams and managers directly), using the Product Hunt text and the product's own website. It keeps a launch unless it is clearly personal or clearly outside the four areas. Filtered launches stay visible in the Filtered out view.
- **No login.** Anyone with the link can press the Contacted, Replied and Skip buttons, and they share one set of notes. This was a deliberate choice for a single-user coursework tool.

## Product Hunt API terms

This project was built as coursework. Product Hunt's API terms say the API must not be used for commercial purposes without their permission. Anyone wanting to use this tool commercially should contact Product Hunt (hello@producthunt.com) first.

## Nothing is ever sent

The app only reads and ranks. It does not send, schedule or draft messages to founders. Kavya alone decides whom to contact and how.
