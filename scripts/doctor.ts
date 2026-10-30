import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { counts, meta, openDb } from "../src/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.CAMEL_KB_DB || path.join(root, "data", "camel-kb.sqlite");

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`PASS ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

check("database exists", existsSync(dbPath), dbPath);
if (!existsSync(dbPath)) {
  console.error('Run "npm run ingest" first.');
  process.exit(1);
}

const db = openDb(dbPath, true);
const info = meta(db);
const summary = counts(db);
db.close();

check("Camel version", Boolean(info.camel_version), info.camel_version || "missing");
check("built_at", Boolean(info.built_at), info.built_at || "missing");
check("components indexed", (summary.component ?? 0) > 300, String(summary.component ?? 0));
check("EIPs indexed", (summary.eip ?? 0) > 50, String(summary.eip ?? 0));
check("concepts indexed", (summary.concept ?? 0) > 0, String(summary.concept ?? 0));

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(root, "dist", "server.js")],
  env: { ...process.env, CAMEL_KB_DB: dbPath } as Record<string, string>
});

const client = new Client({ name: "camel-kb-doctor", version: "1.0.0" });
await client.connect(transport);

function textOf(result: Awaited<ReturnType<typeof client.callTool>>): string {
  return (result.content as { type: string; text?: string }[])
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n");
}

const expectedTools = [
  "search_camel",
  "list_components",
  "list_eips",
  "get_component",
  "get_eip",
  "get_options",
  "get_doc"
];
const tools = (await client.listTools()).tools.map((tool) => tool.name);
check("tool surface", expectedTools.every((name) => tools.includes(name)), tools.join(", "));

const calls: { name: string; args: Record<string, unknown>; expect: string }[] = [
  { name: "search_camel", args: { query: "kafka", limit: 3 }, expect: "kafka" },
  { name: "list_components", args: { label: "messaging", search: "kafka", limit: 5 }, expect: "kafka" },
  { name: "list_eips", args: { search: "aggregate" }, expect: "aggregate" },
  { name: "get_component", args: { name: "direct" }, expect: "component:direct" },
  { name: "get_eip", args: { name: "aggregate", includeOptions: false }, expect: "eip:aggregate" },
  { name: "get_options", args: { name: "kafka", group: "producer", limit: 3 }, expect: "Options:" },
  { name: "get_doc", args: { name: "yaml-dsl", kind: "guide" }, expect: "YAML" }
];

for (const call of calls) {
  try {
    const text = textOf(await client.callTool({ name: call.name, arguments: call.args }));
    check(call.name, text.toLowerCase().includes(call.expect.toLowerCase()), `${text.length} chars`);
  } catch (error) {
    check(call.name, false, (error as Error).message);
  }
}

await client.close();

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exitCode = failures ? 1 : 0;
