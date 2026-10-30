import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, search } from "../src/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.CAMEL_KB_DB || path.join(root, "data", "camel-kb.sqlite");
const args = process.argv.slice(2);

const kindIndex = args.indexOf("--kind");
const kind = kindIndex >= 0 ? args[kindIndex + 1] : undefined;
if (kindIndex >= 0) args.splice(kindIndex, 2);

const labelIndex = args.indexOf("--label");
const label = labelIndex >= 0 ? args[labelIndex + 1] : undefined;
if (labelIndex >= 0) args.splice(labelIndex, 2);

const query = args.join(" ");
if (!query) {
  console.error("Usage: npm run query -- \"search terms\" [--kind component] [--label messaging]");
  process.exit(1);
}

const db = openDb(dbPath, true);
const hits = search(db, { query, kind, label, limit: 10 });
db.close();

for (const hit of hits) {
  console.log(`\n[${hit.id}] ${hit.kind}:${hit.name} — ${hit.title}`);
  console.log([hit.label, hit.support_level, hit.since ? `since ${hit.since}` : ""].filter(Boolean).join(" | "));
  console.log(hit.snippet.replace(/\s+/g, " "));
}
