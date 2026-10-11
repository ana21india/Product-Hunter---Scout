import { suggestLinkedIn } from "../src/lib/linkedin";
const res = await suggestLinkedIn({ log: (s) => console.log(s) });
console.log("RESULT", JSON.stringify(res));
