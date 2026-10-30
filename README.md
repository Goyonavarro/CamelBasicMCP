# camel-kb MCP

A small, offline MCP server that documents Apache Camel core functionality, components, EIPs, languages, and data formats.

It builds a SQLite FTS5 knowledge base from the official `camel-catalog` jar and exposes Camel-native tools over stdio. It is intentionally smaller than `camel-jbang-mcp`: no running Camel context, no Java service, only catalog facts and curated concept notes.

## Prerequisites

- Node.js 22+
- The `camel-catalog` jar for the target Camel version, normally already in `~/.m2` after a Camel or JBang build

## Setup

```bash
npm install
npm run ingest
npm run build
```

`ingest` resolves the catalog in this order:

1. `CAMEL_CATALOG_JAR`
2. `~/.m2/repository/org/apache/camel/camel-catalog/<version>/camel-catalog-<version>.jar`
3. `.cache/camel-catalog-<version>.jar`
4. Maven Central download into `.cache/`

Default version: `4.23.0`. Override with `CAMEL_VERSION`.

```bash
CAMEL_VERSION=4.8.8 npm run ingest
```

## MCP tools

| Tool | Purpose |
| --- | --- |
| `search_camel` | Full-text search with kind and label filters |
| `list_components` | Browse components by label, support level, or name |
| `list_eips` | Browse EIPs and aliases |
| `get_component` | Metadata, URI syntax, docs, optional options |
| `get_eip` | Metadata, docs, EIP and exchange options |
| `get_options` | Paginated, filterable option table |
| `get_doc` | Full cleaned doc or raw AsciiDoc/Markdown |

## Register with opencode

```json
"camel-kb": {
  "type": "local",
  "command": ["node", "D:/Proyectos/LM/CamelMCP/dist/server.js"],
  "environment": {
    "CAMEL_KB_DB": "D:/Proyectos/LM/CamelMCP/data/camel-kb.sqlite"
  },
  "enabled": true,
  "timeout": 60000
}
```

## Verification

```bash
npm run query -- "send message to sqs"
npm run test:mcp
npm run doctor
```

## Layout

```
content/concepts/      curated core-concept notes
src/adoc.ts            AsciiDoc to plain text
src/catalog.ts         catalog jar reader and item builder
src/db.ts              SQLite schema and queries
src/render.ts          compact output formatting
src/server.ts          MCP server
scripts/ingest.ts      catalog jar to SQLite
scripts/query.ts       CLI search
scripts/doctor.ts      DB and tool health check
scripts/test-mcp.ts    end-to-end smoke test
data/camel-kb.sqlite   generated index (gitignored)
```

## Troubleshooting

### `Model tried to call unavailable tool 'error'`

This is not a `camel-kb` failure. It means the model invented a tool name, usually after following stale instructions that referenced the official
`camel-jbang-mcp` tools (`camel_route_context`, `camel_catalog_doc`). Those tools are not provided by `camel-kb`.

- Use `camel-kb_search_camel`, `camel-kb_get_component`, `camel-kb_get_eip`, `camel-kb_get_options`, and `camel-kb_get_doc`.
- Runtime route context is not available through this MCP; inspect route sources and configuration directly.
- If you see this again, check the available-tools list and update the agent instructions rather than retrying the invented tool.

### Re-ingesting while OpenCode is running

`ingest` rebuilds the schema in place inside a transaction, so it no longer deletes the SQLite file and does not fail on Windows file locks.
Readers continue to use the old schema until the transaction commits. A query that overlaps the commit may see `database schema has changed`
once; the server retries transient `SQLITE_BUSY`, `SQLITE_LOCKED`, and `SQLITE_SCHEMA` errors automatically.

## Notes

- The catalog is the source of truth for component and option names. Concept notes are curated and cite official manual pages.
- Some components have JSON metadata but no catalog AsciiDoc. They are indexed as JSON-only and `get_component` reports that no prose doc is stored.
- Re-run `npm run ingest` after changing `CAMEL_VERSION` or the concept notes. Rows are rebuilt, so the previous index is replaced atomically.
- The official `camel-jbang-mcp` is no longer required. If runtime route inspection is needed later, add it back with a Windows-safe launcher
  (for example `["cmd", "/c", "jbang", ...]`), because plain `jbang` cannot be spawned directly on Windows.
