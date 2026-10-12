import { judgeLaunches, judgeUnreadSites } from "../src/lib/relevance";

const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, s);
await judgeLaunches({ log }); // anything without an audience verdict yet
await judgeUnreadSites({ log });
log("done");
