import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(root, "dist", "server.js")],
  env: { ...process.env, CAMEL_KB_DB: path.join(root, "data", "camel-kb.sqlite") } as Record<string, string>
});

const client = new Client({ name: "camel-kb-test", version: "1.0.0" });
await client.connect(transport);

function textOf(result: Awaited<ReturnType<typeof client.callTool>>): string {
  return (result.content as { type: string; text?: string }[])
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n");
}

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    console.error(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
    process.exitCode = 1;
  }
}

const tools = await client.listTools();
const toolNames = tools.tools.map((tool) => tool.name);
console.log(`TOOLS: ${toolNames.join(", ")}`);
check("tool count", toolNames.length === 7, String(toolNames.length));

const search = await client.callTool({
  name: "search_camel",
  arguments: { query: "send message to sqs queue", limit: 5 }
});
const searchText = textOf(search);
check("search_camel", searchText.includes("aws2-sqs"), `${searchText.length} chars`);

const component = await client.callTool({
  name: "get_component",
  arguments: { name: "direct", includeOptions: true }
});
const componentText = textOf(component);
check("get_component direct", componentText.includes("direct:") && componentText.includes("## Options"), `${componentText.length} chars`);

const eip = await client.callTool({ name: "get_eip", arguments: { name: "aggregate" } });
const eipText = textOf(eip);
check("get_eip aggregate", eipText.includes("correlationExpression"), `${eipText.length} chars`);

const options = await client.callTool({
  name: "get_options",
  arguments: { name: "aws2-sqs", kind: "component", group: "producer", limit: 5 }
});
const optionsText = textOf(options);
check(
  "get_options aws2-sqs",
  optionsText.includes("aws2-sqs") && optionsText.includes("[component]"),
  `${optionsText.length} chars`
);

const components = await client.callTool({
  name: "list_components",
  arguments: { label: "messaging", limit: 10 }
});
const componentsText = textOf(components);
check("list_components messaging", componentsText.split("\n").length > 3, `${componentsText.split("\n").length} lines`);

const concept = await client.callTool({
  name: "get_doc",
  arguments: { name: "routes-and-endpoints", kind: "concept" }
});
const conceptText = textOf(concept);
check("get_doc concept", conceptText.includes("Route"), `${conceptText.length} chars`);

const guide = await client.callTool({ name: "get_doc", arguments: { name: "yaml-dsl", kind: "guide" } });
check("get_doc guide", textOf(guide).length > 500, `${textOf(guide).length} chars`);

await client.close();
console.log(process.exitCode ? "\nFAILED" : "\nOK");
