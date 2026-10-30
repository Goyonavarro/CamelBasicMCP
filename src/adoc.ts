const ATTRIBUTE_RE = /^:([A-Za-z0-9_-]+):\s*(.*)$/;
const DROP_LINE_RE = /^(include::|image::|image:|toc::|\/\/)/;
const ROLE_RE = /^\[(source|cols|options|#|[A-Z]+)[^\]]*\]$/;
const BLOCK_TITLE_RE = /^\.[A-Z][^.]*$/;
const DELIMITER_RE = /^(={4,}|-{4,}|\.{4,}|_{4,}|\*{4,}|--)$/;

export type AdocDocument = {
  attributes: Record<string, string>;
  title: string;
  text: string;
};

export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(ATTRIBUTE_RE);
    if (match) attributes[match[1]] = match[2].trim();
  }
  return attributes;
}

function substitute(text: string, attributes: Record<string, string>): string {
  return text.replace(/\{([A-Za-z0-9_-]+)\}/g, (whole, name: string) => attributes[name] ?? "");
}

function cleanLinks(line: string): string {
  let result = line
    .replace(/xref:([^\s\[]+)\[([^\]]*)\]/g, (_m, target: string, label: string) => label || target)
    .replace(/xref:([^\s\[]+)/g, (_m, target: string) => target.replace(/^.*::/, "").replace(/\.adoc$/, ""))
    .replace(/link:(\S+)\[([^\]]*)\]/g, (_m, url: string, label: string) => (label ? `${label} (${url})` : url))
    .replace(/(https?:\/\/[^\s\[]+)\[([^\]]*)\]/g, (_m, url: string, label: string) => (label ? `${label} (${url})` : url));

  result = result.replace(/pass:\[([^\]]*)\]/g, "$1");
  return result;
}

function cleanTableLine(line: string): string {
  if (!line.startsWith("|")) return line;
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
    .join(" | ");
}

export function cleanAdoc(source: string, extraAttributes: Record<string, string> = {}): AdocDocument {
  const attributes = { ...parseAttributes(source), ...extraAttributes };
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let title = "";
  let inTable = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\|={3,}$/.test(line.trim())) {
      inTable = !inTable;
      continue;
    }

    if (!inTable) {
      if (!line.trim()) {
        output.push("");
        continue;
      }
      if (ATTRIBUTE_RE.test(line.trim())) continue;
      if (DROP_LINE_RE.test(line.trim())) continue;
      if (ROLE_RE.test(line.trim())) continue;
      if (DELIMITER_RE.test(line.trim())) continue;
      if (BLOCK_TITLE_RE.test(line.trim()) && output.length > 0) continue;
      if (/^= /.test(line) && !title) {
        title = line.replace(/^=\s+/, "").trim();
        output.push(`# ${title}`);
        continue;
      }
    }

    const cleaned = cleanLinks(inTable ? cleanTableLine(line) : line);
    const substituted = substitute(cleaned, attributes).replace(/[ \t]+$/g, "");
    output.push(substituted);
  }

  const text = output
    .join("\n")
    .replace(/^\*Since Camel .*\*$/gm, "")
    .replace(/^\*\{?component-header\}?\*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    attributes,
    title: title || attributes.doctitle || attributes.title || "",
    text,
  };
}
