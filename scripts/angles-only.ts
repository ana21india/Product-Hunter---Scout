import { generateAngles } from "../src/lib/angles";
const failed = await generateAngles({ log: (s) => console.log(s) });
console.log("RESULT failed:", failed);
