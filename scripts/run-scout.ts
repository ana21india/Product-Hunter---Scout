import { runScout } from "../src/lib/run";
const args = process.argv.slice(2);
const topicArg = args.find((a) => !a.startsWith("--"));
const topics = topicArg ? topicArg.split(",") : undefined;
const snapshot = args.includes("--snapshot");
const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`;
const res = await runScout({ mode: "script", topics, snapshot, log: (s) => console.log(stamp(), s) });
console.log(stamp(), "RESULT", JSON.stringify(res));
