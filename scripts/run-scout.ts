import { runScout } from "../src/lib/run";
const args = process.argv.slice(2);
const topicArg = args.find((a) => !a.startsWith("--"));
const topics = topicArg ? topicArg.split(",") : undefined;
const snapshot = args.includes("--snapshot");
const res = await runScout({ mode: "script", topics, snapshot, log: (s) => console.log(s) });
console.log("RESULT", JSON.stringify(res));
