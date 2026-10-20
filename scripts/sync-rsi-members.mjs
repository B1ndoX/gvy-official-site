import { fileURLToPath } from "node:url";
import { syncMembers } from "./lib/rsi-members.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await syncMembers({ root });
console.log(JSON.stringify(result));
