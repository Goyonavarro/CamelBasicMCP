import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sourceUrl } from "./catalog.js";
import { getItem, getOptions, listItems, meta, openDb, search } from "./db.js";
import { compact, header, renderOptions } from "./render.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.CAMEL_KB_DB || path.join(root, "data", "camel-kb.sqlite");

if (!existsSync(dbPath)) {
  console.error(`Camel knowledge base not found at ${dbPath}. Run "npm run ingest" first.`);
  process.exit(1);
}

const db = openDb(dbPath, true);

function camelVersion(): string {
  return meta(db).camel_version || "latest";
}

const KINDS = ["component", "eip", "language", "dataformat", "guide", "concept"] as const;
const kindSchema = z.enum(KINDS);

const server = new McpServer({
  name: "camel-kb",
  version: "1.0.0"
});

function sourceLine(item: { kind: string; name: string; scheme: string }): string {
  const url = sourceUrl({ kind: item.kind as (typeof KINDS)[number], name: item.name, scheme: item.scheme }, camelVersion());
  return url ? `Source: ${url}` : "";
}

function trimDoc(text: string, maxChars: number): string {
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars; use get_doc for the full document]`;
}

server.registerTool(
  "search_camel",
  {
    title: "Search Apache Camel components, EIPs, and guides",
    description:
      "Full-text search across a local Apache Camel catalog (components, EIPs, languages, dataformats) " +
      "plus curated core-concept guides. Returns ranked items with snippets. " +
      "Use get_component, get_eip, get_options, or get_doc for full detail.",
    inputSchema: {
      query: z.string().min(2).describe("Keywords, component name, or natural-language question"),
      kind: kindSchema.optional().describe("Optional item kind filter"),
      label: z.string().optional().describe("Optional label filter, e.g. cloud, messaging, file, rest, ai, core"),
      limit: z.number().int().min(1).max(20).default(6)
    }
  },
  async ({ query, kind, label, limit }) => {
    const hits = search(db, { query, kind, label, limit });
    if (!hits.length) {
      return {
        content: [{ type: "text", text: `No matches for "${query}". Try broader keywords or remove filters.` }]
      };
    }
    return {
      content: hits.map((hit) => ({
        type: "text" as const,
        text: [
          `[${hit.id}] ${hit.kind}:${hit.name} — ${hit.title}`,
          [hit.label, hit.support_level, hit.since ? `since ${hit.since}` : ""].filter(Boolean).join(" | "),
          hit.snippet,
          sourceLine(hit)
        ]
          .filter(Boolean)
          .join("\n")
      }))
    };
  }
);

server.registerTool(
  "list_components",
  {
    title: "List Apache Camel components",
    description:
      "Browse the catalog of Camel components. Filter by label (e.g. cloud, messaging, file, rest, ai), " +
      "support level, or a name/scheme substring.",
    inputSchema: {
      label: z.string().optional().describe("Label filter such as cloud, messaging, file, rest, ai"),
      supportLevel: z.string().optional().describe("Exact support level, e.g. Stable, Preview, Experimental, Deprecated"),
      search: z.string().optional().describe("Name, title, or scheme substring"),
      limit: z.number().int().min(1).max(100).default(30)
    }
  },
  async ({ label, supportLevel, search, limit }) => {
    const items = listItems(db, { kind: "component", label, supportLevel, search, limit });
    if (!items.length) {
      return { content: [{ type: "text", text: "No components matched. Try a different label or search term." }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: items
          .map((item) =>
            [
              `${item.name} | ${item.title}`,
              item.label,
              item.support_level,
              item.since ? `since ${item.since}` : "",
              item.syntax
            ]
              .filter(Boolean)
              .join(" | ")
          )
          .join("\n")
      }]
    };
  }
);

server.registerTool(
  "list_eips",
  {
    title: "List Camel Enterprise Integration Patterns",
    description: "Browse the Camel EIP catalog, including aliases such as fan-in, reduce, join, and merge.",
    inputSchema: {
      label: z.string().optional().describe("Optional label filter, e.g. routing, transformation, messaging"),
      search: z.string().optional().describe("Name or title substring"),
      limit: z.number().int().min(1).max(100).default(40)
    }
  },
  async ({ label, search, limit }) => {
    const items = listItems(db, { kind: "eip", label, search, limit });
    if (!items.length) {
      return { content: [{ type: "text", text: "No EIPs matched." }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: items
          .map((item) =>
            [
              `${item.name} | ${item.title}`,
              item.label,
              item.aliases ? `aliases: ${item.aliases}` : ""
            ]
              .filter(Boolean)
              .join(" | ")
          )
          .join("\n")
      }]
    };
  }
);

server.registerTool(
  "get_component",
  {
    title: "Read an Apache Camel component",
    description:
      "Return component metadata (scheme, URI syntax, Maven artifact, support level, labels) and its catalog documentation. " +
      "Set includeOptions=true to also include the endpoint option table; or use get_options for filtering and pagination.",
    inputSchema: {
      name: z.string().describe("Component name or scheme, e.g. direct, kafka, aws2-sqs"),
      includeOptions: z.boolean().default(false).describe("Include the full component/endpoint option table"),
      maxChars: z.number().int().min(0).default(8000).describe("Documentation character limit; 0 returns the full text")
    }
  },
  async ({ name, includeOptions, maxChars }) => {
    const item = getItem(db, name, "component");
    if (!item) {
      return { content: [{ type: "text", text: `Component "${name}" not found. Use list_components to browse.` }] };
    }

    const count = (db.prepare("SELECT count(*) AS n FROM options WHERE item_id = ?").get(item.id) as { n: number }).n;
    const parts = [header(item, camelVersion()), count ? `Options: ${count} (use get_options for filtering)` : ""];

    if (includeOptions) {
      const result = getOptions(db, { name, kind: "component", limit: 500 });
      if (result) parts.push("", "## Options", "", renderOptions(result.options, result.total, 0));
    }

    parts.push(
      "",
      "## Documentation",
      "",
      item.doc_text
        ? trimDoc(item.doc_text, maxChars)
        : "No prose documentation in the catalog; use the options and description above."
    );

    return { content: [{ type: "text" as const, text: parts.filter((part) => part !== undefined).join("\n") }] };
  }
);

server.registerTool(
  "get_eip",
  {
    title: "Read a Camel Enterprise Integration Pattern",
    description:
      "Return EIP metadata, aliases, model flags, documentation, and (by default) its options plus exchange properties.",
    inputSchema: {
      name: z.string().describe("EIP name or alias, e.g. aggregate, choice, split, fan-in"),
      includeOptions: z.boolean().default(true).describe("Include EIP and exchange-property option tables"),
      maxChars: z.number().int().min(0).default(12000).describe("Documentation character limit; 0 returns the full text")
    }
  },
  async ({ name, includeOptions, maxChars }) => {
    const item = getItem(db, name, "eip");
    if (!item) {
      return { content: [{ type: "text", text: `EIP "${name}" not found. Use list_eips to browse.` }] };
    }

    const count = (db.prepare("SELECT count(*) AS n FROM options WHERE item_id = ?").get(item.id) as { n: number }).n;
    const parts = [header(item, camelVersion()), count ? `Options: ${count}` : ""];

    if (includeOptions) {
      const result = getOptions(db, { name, kind: "eip", limit: 500 });
      if (result) parts.push("", "## Options", "", renderOptions(result.options, result.total, 0));
    }

    parts.push(
      "",
      "## Documentation",
      "",
      item.doc_text
        ? trimDoc(item.doc_text, maxChars)
        : "No prose documentation in the catalog; use the options and description above."
    );

    return { content: [{ type: "text" as const, text: parts.filter((part) => part !== undefined).join("\n") }] };
  }
);

server.registerTool(
  "get_options",
  {
    title: "Read component or EIP options",
    description:
      "Return a paginated, filterable option table for a component or EIP. " +
      "Scopes are component (component-level), endpoint (URI parameters), eip, and exchange (exchange properties).",
    inputSchema: {
      name: z.string().describe("Component or EIP name"),
      kind: z.enum(["component", "eip"]).default("component").describe("Item kind"),
      scope: z.enum(["component", "endpoint", "eip", "exchange"]).optional().describe("Option scope filter"),
      group: z.string().optional().describe("Option group, e.g. common, producer, consumer, security, advanced"),
      requiredOnly: z.boolean().default(false).describe("Only return required options"),
      limit: z.number().int().min(1).max(500).default(50),
      offset: z.number().int().min(0).default(0)
    }
  },
  async ({ name, kind, scope, group, requiredOnly, limit, offset }) => {
    const result = getOptions(db, { name, kind, scope, group, requiredOnly, limit, offset });
    if (!result) {
      return { content: [{ type: "text", text: `${kind} "${name}" not found.` }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: [
          `${result.item.kind}:${result.item.name} — ${result.item.title}`,
          `Options: ${result.total}`,
          "",
          renderOptions(result.options, result.total, offset)
        ].join("\n")
      }]
    };
  }
);

server.registerTool(
  "get_doc",
  {
    title: "Read a Camel catalog document",
    description:
      "Return the full text of a component, EIP, language, dataformat, guide, or concept. " +
      "Set raw=true to return the original AsciiDoc instead of cleaned text.",
    inputSchema: {
      name: z.string().describe("Item name, e.g. direct, aggregate, simple, jackson, yaml-dsl, routes-and-endpoints"),
      kind: kindSchema.optional().describe("Optional item kind disambiguation"),
      raw: z.boolean().default(false).describe("Return the original AsciiDoc/Markdown source")
    }
  },
  async ({ name, kind, raw }) => {
    const item = getItem(db, name, kind);
    if (!item) {
      return { content: [{ type: "text", text: `Document "${name}" not found. Use search_camel to locate it.` }] };
    }

    const body = raw ? item.doc_text_raw : item.doc_text;
    if (!body) {
      return {
        content: [{
          type: "text" as const,
          text: `${item.kind}:${item.name} has no stored document. Description: ${compact(item.description, 500)}`
        }]
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: [header(item, camelVersion()), "", raw ? "## Raw source" : "## Documentation", "", body].join("\n")
      }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`camel-kb ready (${dbPath}, Camel ${camelVersion()})`);
