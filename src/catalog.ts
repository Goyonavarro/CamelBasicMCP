import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { cleanAdoc } from "./adoc.js";

export type ItemKind = "component" | "eip" | "language" | "dataformat" | "guide" | "concept";

export const ITEM_KINDS: ItemKind[] = ["component", "eip", "language", "dataformat", "guide", "concept"];

export type CatalogOption = {
  scope: "component" | "endpoint" | "eip" | "exchange";
  name: string;
  displayName: string;
  groupName: string;
  kind: string;
  type: string;
  defaultValue: string;
  required: boolean;
  deprecated: boolean;
  secret: boolean;
  enumValues: string;
  description: string;
  idx: number;
};

export type CatalogItem = {
  kind: ItemKind;
  name: string;
  title: string;
  description: string;
  label: string;
  supportLevel: string;
  since: string;
  deprecated: boolean;
  groupId: string;
  artifactId: string;
  javaType: string;
  scheme: string;
  syntax: string;
  aliases: string;
  docFile: string;
  docText: string;
  docTextRaw: string;
  searchText: string;
  options: CatalogOption[];
};

export type Catalog = {
  version: string;
  jarPath: string;
  jarSource: string;
  items: CatalogItem[];
  docFiles: number;
  componentsWithDoc: number;
};

type JsonObject = Record<string, unknown>;

const CATALOG_PREFIX = "org/apache/camel/catalog/";

export const GUIDE_FILES = [
  "message.adoc",
  "message-endpoint.adoc",
  "message-router.adoc",
  "message-translator.adoc",
  "message-channel.adoc",
  "message-broker.adoc",
  "message-bus.adoc",
  "message-dispatcher.adoc",
  "message-expiration.adoc",
  "message-history.adoc",
  "polling-consumer.adoc",
  "point-to-point-channel.adoc",
  "publish-subscribe-channel.adoc",
  "dead-letter-channel.adoc",
  "correlation-identifier.adoc",
  "content-enricher.adoc",
  "scatter-gather.adoc",
  "composed-message-processor.adoc",
  "competing-consumers.adoc",
  "event-message.adoc",
  "return-address.adoc",
  "guaranteed-delivery.adoc",
  "normalizer.adoc",
  "selective-consumer.adoc",
  "service-activator.adoc",
  "process-manager.adoc",
  "enterprise-integration-patterns.adoc",
  "yaml-dsl.adoc",
  "dsl-modeline.adoc",
  "test-junit5.adoc",
  "test-main-junit5.adoc",
  "debug.adoc",
  "diagram.adoc",
  "mcp-server.adoc",
  "openapi-validator.adoc",
  "resilience4j.adoc",
  "micrometer-observability.adoc",
  "observability-services.adoc",
  "intercept.adoc",
  "simple-functions.adoc",
  "simple-operators.adoc",
  "simple-advanced.adoc",
  "jfr.adoc",
  "wal.adoc",
  "change-data-capture.adoc",
  "resourceresolver-github.adoc",
  "attachments.adoc",
  "cloudevents.adoc"
];

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asString).join(", ");
  return "";
}

function enumValues(value: unknown): string {
  if (Array.isArray(value)) return value.map(asString).join(", ");
  if (value && typeof value === "object") return Object.keys(value as JsonObject).join(", ");
  return "";
}

function normalizeOption(name: string, value: unknown, scope: CatalogOption["scope"], index: number): CatalogOption {
  const option = (value ?? {}) as JsonObject;
  return {
    scope,
    name,
    displayName: asString(option.displayName),
    groupName: asString(option.group),
    kind: asString(option.kind),
    type: asString(option.type),
    defaultValue: asString(option.defaultValue),
    required: option.required === true,
    deprecated: option.deprecated === true,
    secret: option.secret === true,
    enumValues: enumValues(option.enum),
    description: asString(option.description),
    idx: typeof option.index === "number" ? option.index : index
  };
}

function collectOptions(
  properties: unknown,
  scope: CatalogOption["scope"],
  startIndex: number
): CatalogOption[] {
  if (!properties || typeof properties !== "object") return [];
  return Object.entries(properties as JsonObject).map(([name, value], index) =>
    normalizeOption(name, value, scope, startIndex + index)
  );
}

function buildSearchText(item: Omit<CatalogItem, "searchText">): string {
  const optionText = item.options
    .map((option) => `${option.name} ${option.displayName} ${option.groupName} ${option.description}`)
    .join("\n");
  return [
    item.name,
    item.title,
    item.description,
    item.label,
    item.scheme,
    item.syntax,
    item.aliases,
    optionText,
    item.docText
  ]
    .filter(Boolean)
    .join("\n");
}

function docKey(name: string, kind: ItemKind): string {
  const suffix =
    kind === "component" ? "component" : kind === "eip" ? "eip" : kind === "language" ? "language" : "dataformat";
  return `${name}-${suffix}.adoc`;
}

function findDoc(docs: Map<string, string>, name: string, kind: ItemKind): { file: string; raw: string } | undefined {
  const exactFile = docKey(name, kind);
  const exact = docs.get(exactFile);
  if (exact !== undefined) return { file: exactFile, raw: exact };

  const suffix =
    kind === "component" ? "-component.adoc" : kind === "eip" ? "-eip.adoc" : kind === "language" ? "-language.adoc" : "-dataformat.adoc";
  const lower = name.toLowerCase();
  const candidates = [...docs.keys()]
    .filter((file) => file.endsWith(suffix) && file.toLowerCase().startsWith(lower))
    .sort((a, b) => a.length - b.length);
  const file = candidates[0];
  return file ? { file, raw: docs.get(file) as string } : undefined;
}

function itemFromMeta(
  kind: ItemKind,
  meta: JsonObject,
  properties: CatalogOption[],
  doc: { file: string; raw: string; text: string; attributes: Record<string, string> } | undefined
): CatalogItem {
  const base = {
    kind,
    name: asString(meta.name) || asString(meta.scheme),
    title: asString(meta.title) || asString(meta.name),
    description: asString(meta.description) || asString(doc?.attributes.description),
    label: asString(meta.label) || asString(doc?.attributes.group),
    supportLevel: asString(meta.supportLevel) || asString(doc?.attributes.supportlevel),
    since: asString(meta.firstVersion) || asString(doc?.attributes.since),
    deprecated: meta.deprecated === true,
    groupId: asString(meta.groupId),
    artifactId: asString(meta.artifactId) || asString(doc?.attributes.artifactid),
    javaType: asString(meta.javaType),
    scheme: asString(meta.scheme),
    syntax: asString(meta.syntax),
    aliases: asString(meta.aliases),
    docFile: doc?.file ?? "",
    docText: doc?.text ?? "",
    docTextRaw: doc?.raw ?? "",
    options: properties
  };
  return { ...base, searchText: buildSearchText(base) };
}

export function readCatalog(jarPath: string, version: string, jarSource: string): Catalog {
  const zip = new AdmZip(jarPath);
  const entries = zip.getEntries();

  const json = new Map<string, JsonObject>();
  const docs = new Map<string, string>();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    if (!name.startsWith(CATALOG_PREFIX)) continue;

    const relative = name.slice(CATALOG_PREFIX.length);
    if (relative.startsWith("components/") && relative.endsWith(".json")) {
      json.set(`components/${path.basename(relative)}`, JSON.parse(entry.getData().toString("utf8")) as JsonObject);
    } else if (relative.startsWith("models/") && relative.endsWith(".json")) {
      json.set(`models/${path.basename(relative)}`, JSON.parse(entry.getData().toString("utf8")) as JsonObject);
    } else if (relative.startsWith("languages/") && relative.endsWith(".json")) {
      json.set(`languages/${path.basename(relative)}`, JSON.parse(entry.getData().toString("utf8")) as JsonObject);
    } else if (relative.startsWith("dataformats/") && relative.endsWith(".json")) {
      json.set(`dataformats/${path.basename(relative)}`, JSON.parse(entry.getData().toString("utf8")) as JsonObject);
    } else if (relative.startsWith("docs/") && relative.endsWith(".adoc")) {
      docs.set(path.basename(relative), entry.getData().toString("utf8"));
    }
  }

  const items: CatalogItem[] = [];
  let componentsWithDoc = 0;

  for (const [key, value] of json) {
    if (!key.startsWith("components/")) continue;
    const meta = (value.component ?? {}) as JsonObject;
    if (!asString(meta.name)) continue;
    const name = asString(meta.name);
    const found = findDoc(docs, name, "component");
    const cleaned = found ? cleanAdoc(found.raw) : undefined;
    const doc = found && cleaned ? { file: found.file, raw: found.raw, text: cleaned.text, attributes: cleaned.attributes } : undefined;
    if (doc) componentsWithDoc++;
    const options = [
      ...collectOptions(value.componentProperties, "component", 0),
      ...collectOptions(value.properties, "endpoint", 10000)
    ];
    items.push(itemFromMeta("component", meta, options, doc));
  }

  for (const [key, value] of json) {
    if (!key.startsWith("models/")) continue;
    const meta = (value.model ?? {}) as JsonObject;
    const label = asString(meta.label);
    if (!label.split(",").map((part) => part.trim()).includes("eip")) continue;
    const name = asString(meta.name);
    if (!name) continue;
    const found = findDoc(docs, name, "eip");
    const cleaned = found ? cleanAdoc(found.raw) : undefined;
    const doc = found && cleaned ? { file: found.file, raw: found.raw, text: cleaned.text, attributes: cleaned.attributes } : undefined;
    const options = [
      ...collectOptions(value.properties, "eip", 0),
      ...collectOptions(value.exchangeProperties, "exchange", 10000)
    ];
    items.push(itemFromMeta("eip", meta, options, doc));
  }

  for (const [key, value] of json) {
    if (!key.startsWith("languages/")) continue;
    const meta = (value.language ?? {}) as JsonObject;
    const name = asString(meta.name);
    if (!name) continue;
    const found = findDoc(docs, name, "language");
    const cleaned = found ? cleanAdoc(found.raw) : undefined;
    const doc = found && cleaned ? { file: found.file, raw: found.raw, text: cleaned.text, attributes: cleaned.attributes } : undefined;
    const options = collectOptions(value.properties, "endpoint", 0);
    items.push(itemFromMeta("language", meta, options, doc));
  }

  for (const [key, value] of json) {
    if (!key.startsWith("dataformats/")) continue;
    const meta = (value.dataformat ?? {}) as JsonObject;
    const name = asString(meta.name);
    if (!name) continue;
    const found = findDoc(docs, name, "dataformat");
    const cleaned = found ? cleanAdoc(found.raw) : undefined;
    const doc = found && cleaned ? { file: found.file, raw: found.raw, text: cleaned.text, attributes: cleaned.attributes } : undefined;
    const options = collectOptions(value.properties, "endpoint", 0);
    items.push(itemFromMeta("dataformat", meta, options, doc));
  }

  for (const file of GUIDE_FILES) {
    const raw = docs.get(file);
    if (!raw) continue;
    const cleaned = cleanAdoc(raw);
    const name = file.replace(/\.adoc$/, "");
    const meta: JsonObject = {
      name,
      title: cleaned.attributes.doctitle || cleaned.title || name,
      description: cleaned.attributes.description,
      label: cleaned.attributes.group || "guide",
      supportLevel: cleaned.attributes.supportlevel,
      firstVersion: cleaned.attributes.since,
      artifactId: cleaned.attributes.artifactid
    };
    items.push(
      itemFromMeta("guide", meta, [], { file, raw, text: cleaned.text, attributes: cleaned.attributes })
    );
  }

  return {
    version,
    jarPath,
    jarSource,
    items,
    docFiles: docs.size,
    componentsWithDoc
  };
}

export type ConceptFile = {
  name: string;
  title: string;
  description: string;
  label: string;
  source: string;
  text: string;
  raw: string;
};

function parseFrontmatter(source: string): { meta: Record<string, string>; body: string } {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { meta: {}, body: normalized };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { meta: {}, body: normalized };

  const meta: Record<string, string> = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) meta[match[1]] = match[2].trim();
  }
  const body = normalized.slice(end + 4).replace(/^\n+/, "");
  return { meta, body };
}

export function readConcepts(directory: string): ConceptFile[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.toLowerCase().endsWith(".md"))
    .sort()
    .map((file) => {
      const raw = readFileSync(path.join(directory, file), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const name = meta.name || file.replace(/\.md$/i, "");
      return {
        name,
        title: meta.title || name,
        description: meta.description || "",
        label: meta.labels || meta.label || "concept",
        source: meta.source || "",
        text: body.trim(),
        raw
      };
    });
}

export function conceptsToItems(concepts: ConceptFile[]): CatalogItem[] {
  return concepts.map((concept) => {
    const base = {
      kind: "concept" as const,
      name: concept.name,
      title: concept.title,
      description: concept.description,
      label: concept.label,
      supportLevel: "",
      since: "",
      deprecated: false,
      groupId: "",
      artifactId: "",
      javaType: "",
      scheme: "",
      syntax: "",
      aliases: "",
      docFile: `${concept.name}.md`,
      docText: concept.source ? `${concept.text}\n\nSource: ${concept.source}` : concept.text,
      docTextRaw: concept.raw,
      options: []
    };
    return { ...base, searchText: buildSearchText(base) };
  });
}

export function catalogJarCandidates(version: string): { path: string; source: string }[] {
  const fileName = `camel-catalog-${version}.jar`;
  const m2 = path.join(os.homedir(), ".m2", "repository", "org", "apache", "camel", "camel-catalog", version, fileName);
  const cache = path.join(process.cwd(), ".cache", fileName);
  return [
    { path: m2, source: "m2" },
    { path: cache, source: "cache" }
  ];
}

export async function resolveCatalogJar(
  version: string,
  explicit?: string
): Promise<{ path: string; source: string }> {
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`CAMEL_CATALOG_JAR not found: ${explicit}`);
    return { path: explicit, source: "env" };
  }

  const candidates = catalogJarCandidates(version);
  for (const candidate of candidates) {
    if (existsSync(candidate.path)) return candidate;
  }

  const url = `https://repo1.maven.org/maven2/org/apache/camel/camel-catalog/${version}/camel-catalog-${version}.jar`;
  const target = candidates[candidates.length - 1].path;
  mkdirSync(path.dirname(target), { recursive: true });

  console.error(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download catalog jar: HTTP ${response.status}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  return { path: target, source: "download" };
}

export function sourceUrl(item: Pick<CatalogItem, "kind" | "name" | "scheme">, version: string): string {
  const base = `https://camel.apache.org/components/${version}`;
  switch (item.kind) {
    case "component":
      return `${base}/${item.scheme || item.name}-component.html`;
    case "eip":
      return `${base}/eips/${item.name}-eip.html`;
    case "language":
      return `${base}/languages/${item.name}-language.html`;
    case "dataformat":
      return `${base}/dataformats/${item.name}-dataformat.html`;
    default:
      return "";
  }
}
