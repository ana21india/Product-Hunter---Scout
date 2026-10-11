import { runScout } from "../src/lib/run";
const topics = process.argv[2] ? process.argv[2].split(",") : undefined;
const snapshot = process.argv.includes("--snapshot");
const res = await runScout({ mode: "script", topics, snapshot, log: (s) => console.log(s) });
console.log("RESULT", JSON.stringify(res));
