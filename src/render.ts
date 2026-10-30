import type { ItemRow, OptionRow } from "./db.js";
import { sourceUrl, type CatalogItem, type ItemKind } from "./catalog.js";

export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function compact(value: string, max = 240): string {
  const text = oneLine(value);
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

export function itemKindLabel(kind: string): string {
  return kind;
}

export function header(item: ItemRow, version: string): string {
  const flags = [
    item.scheme ? `scheme: ${item.scheme}` : "",
    item.syntax ? `syntax: ${item.syntax}` : "",
    item.since ? `since: ${item.since}` : "",
    item.support_level ? `support: ${item.support_level}` : "",
    item.deprecated ? "DEPRECATED" : ""
  ].filter(Boolean);

  const lines = [
    `${item.kind}:${item.name} — ${item.title}`,
    item.description ? compact(item.description, 400) : "",
    flags.join(" | "),
    item.label ? `labels: ${item.label}` : "",
    item.artifact_id ? `artifact: ${item.group_id}:${item.artifact_id}` : "",
    item.java_type ? `javaType: ${item.java_type}` : "",
    item.aliases ? `aliases: ${item.aliases}` : ""
  ];

  const url = sourceUrl({ kind: item.kind as ItemKind, name: item.name, scheme: item.scheme }, version);
  if (url) lines.push(`source: ${url}`);
  if (item.doc_file) lines.push(`catalogDoc: ${item.doc_file}`);

  return lines.filter(Boolean).join("\n");
}

export function renderOption(option: OptionRow): string {
  const meta = [
    option.type || "string",
    option.default_value ? `default=${option.default_value}` : "",
    option.required ? "required" : "",
    option.secret ? "secret" : "",
    option.deprecated ? "deprecated" : "",
    option.group_name ? `group=${option.group_name}` : ""
  ].filter(Boolean);

  const enums = option.enum_values
    ? `\nenum: ${option.enum_values.length > 300 ? `${option.enum_values.slice(0, 297)}...` : option.enum_values}`
    : "";

  return `[${option.scope}] ${option.name} (${meta.join(", ")})\n${option.description}${enums}`;
}

export function renderOptions(options: OptionRow[], total: number, offset: number): string {
  if (!options.length) return "No matching options.";
  const lines = options.map(renderOption);
  const end = offset + options.length;
  lines.push(`\nShowing ${offset + 1}-${end} of ${total} options.`);
  return lines.join("\n\n");
}

export function renderCatalogItem(item: CatalogItem): string {
  return [
    `${item.kind}:${item.name} — ${item.title}`,
    compact(item.description, 400),
    item.label ? `labels: ${item.label}` : "",
    item.options.length ? `options: ${item.options.length}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}
