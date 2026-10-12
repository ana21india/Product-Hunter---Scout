import fs from "node:fs";

// 1) test for the qualification rule
{
  const file = "src/lib/scoring.test.ts";
  let s = fs.readFileSync(file, "utf8");
  s = s.replace('import { scoreLaunches, eligibleSet, tierForRank } from "./scoring";', 'import { scoreLaunches, eligibleSet, tierForRank, qualifies, MIN_MAKER_COMMENTS, MIN_UPVOTES } from "./scoring";');
  s += `
test("qualification: makers must be active and the launch needs some traction", () => {
  assert.equal(MIN_MAKER_COMMENTS, 2);
  assert.equal(MIN_UPVOTES, 10);
  assert.equal(qualifies({ votes: 478, makerComments: 68 }), true);
  assert.equal(qualifies({ votes: 186, makerComments: 0 }), false); // big launch, makers silent
  assert.equal(qualifies({ votes: 150, makerComments: 1 }), false); // only the intro comment
  assert.equal(qualifies({ votes: 3, makerComments: 5 }), false); // active makers but no traction yet
  assert.equal(qualifies({ votes: 10, makerComments: 2 }), true); // exactly at both thresholds
});
`;
  fs.writeFileSync(file, s, "utf8");
  console.log("tests patched");
}

// 2) README
{
  const file = "README.md";
  let s = fs.readFileSync(file, "utf8");
  function rep(from, to) {
    if (!s.includes(from)) throw new Error("not found in README: " + from.slice(0, 70));
    s = s.replace(from, to);
  }
  rep(
    "- **A 10-second \"Today\" view.**",
    "- **Tabs:** Today, Shortlist, All launches, Watchlist, Outreach, Results and Filtered out.\n- **A 10-second \"Today\" view.**",
  );
  rep(
    "- **Shortlist** of the top 10 to 15 launches (she picks the size, default 15), with a clear \"shortlist ends here\" band and a button to see all launches.",
    "- **Shortlist** tab: the top 10 to 15 launches (she picks the size, default 15), with a clear \"shortlist ends here\" band and a button to see all launches. If fewer launches qualify than the size she chose, it is shorter.\n- **Watchlist** tab: relevant launches that do not qualify yet (see below). They are re-checked on every run, so nothing relevant goes unseen.\n- **Outreach** tab: everything she has marked Contacted, Replied or Skipped, kept even after a launch leaves the 7-day window, with a way to change or undo each one.",
  );
  rep(
    "- **Compact rows.** Each launch is one row: rank, name and one-line description, who it serves, upvotes and maker comments, days left in the 7-day window, score bar and tier.",
    "- **Compact rows.** Each launch is one row: rank, name and one-line description, who it serves, upvotes and maker comments, days left in the 7-day window and tier. Score numbers are not shown on the rows; they are in each launch's details and in Compare.",
  );
  rep(
    "- **The set** is every relevant launch posted in the last 7 days, without duplicates.",
    "- **The set** is every relevant launch posted in the last 7 days, without duplicates, **that qualifies**. A launch qualifies when its makers have written at least 2 comments or replies (more than the usual single intro post) and it has at least 10 upvotes (roughly the top 10% of launches in a typical week). This is an addition to the written rubric: in testing, 41 of 310 relevant launches had no maker comments at all (mostly large companies whose makers do not reply), 248 had only the intro comment, and the median launch had 1 upvote. Launches that do not qualify yet stay on the Watchlist and are re-checked every run. The two thresholds are constants in `src/lib/scoring.ts`.",
  );
  fs.writeFileSync(file, s, "utf8");
  console.log("README patched");
}
