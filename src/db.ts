import Database from "better-sqlite3";

export const SCHEMA_SQL = `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  support_level TEXT NOT NULL DEFAULT '',
  since TEXT NOT NULL DEFAULT '',
  deprecated INTEGER NOT NULL DEFAULT 0,
  group_id TEXT NOT NULL DEFAULT '',
  artifact_id TEXT NOT NULL DEFAULT '',
  java_type TEXT NOT NULL DEFAULT '',
  scheme TEXT NOT NULL DEFAULT '',
  syntax TEXT NOT NULL DEFAULT '',
  aliases TEXT NOT NULL DEFAULT '',
  doc_file TEXT NOT NULL DEFAULT '',
  doc_text TEXT NOT NULL DEFAULT '',
  doc_text_raw TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  UNIQUE(kind, name)
);

CREATE TABLE options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  default_value TEXT NOT NULL DEFAULT '',
  required INTEGER NOT NULL DEFAULT 0,
  deprecated INTEGER NOT NULL DEFAULT 0,
  secret INTEGER NOT NULL DEFAULT 0,
  enum_values TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  idx INTEGER NOT NULL DEFAULT 0
);

CREATE VIRTUAL TABLE items_fts USING fts5(
  name,
  title,
  label,
  search_text,
  content='items',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, name, title, label, search_text)
  VALUES (new.id, new.name, new.title, new.label, new.search_text);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, name, title, label, search_text)
  VALUES ('delete', old.id, old.name, old.title, old.label, old.search_text);
END;

CREATE INDEX idx_items_kind ON items(kind);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_label ON items(label);
CREATE INDEX idx_options_item ON options(item_id, scope);
`;

export type ItemRow = {
  id: number;
  kind: string;
  name: string;
  title: string;
  description: string;
  label: string;
  support_level: string;
  since: string;
  deprecated: number;
  group_id: string;
  artifact_id: string;
  java_type: string;
  scheme: string;
  syntax: string;
  aliases: string;
  doc_file: string;
  doc_text: string;
  doc_text_raw: string;
};

export type Hit = ItemRow & {
  snippet: string;
  score: number;
};

export type OptionRow = {
  scope: string;
  name: string;
  display_name: string;
  group_name: string;
  kind: string;
  type: string;
  default_value: string;
  required: number;
  deprecated: number;
  secret: number;
  enum_values: string;
  description: string;
  idx: number;
};

export type SearchOptions = {
  query: string;
  kind?: string;
  label?: string;
  limit?: number;
};

export type ListOptions = {
  kind: string;
  label?: string;
  supportLevel?: string;
  search?: string;
  limit?: number;
};

export type OptionQuery = {
  name: string;
  kind?: string;
  scope?: string;
  group?: string;
  requiredOnly?: boolean;
  limit?: number;
  offset?: number;
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
  "how", "i", "in", "is", "it", "of", "on", "or", "should", "that", "the", "this",
  "to", "use", "using", "was", "what", "when", "where", "which", "who", "why", "with"
]);

function buildMatch(query: string, operator: "AND" | "OR"): string | null {
  const terms = [...new Set(
    (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((term) => term.length > 1 && !STOPWORDS.has(term))
  )];
  if (!terms.length) return null;
  return terms.map((term) => `${term}*`).join(` ${operator} `);
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isTransient(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? "";
  const message = String((error as Error)?.message ?? "");
  return (
    /SQLITE_BUSY|SQLITE_LOCKED|SQLITE_SCHEMA/.test(code) ||
    /database is locked|database schema has changed/i.test(message)
  );
}

export function withRetry<T>(fn: () => T, attempts = 3): T {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return fn();
    } catch (error) {
      last = error;
      if (!isTransient(error) || attempt === attempts - 1) throw error;
      sleep(50 * (attempt + 1));
    }
  }
  throw last;
}

export function openDb(file: string, readonly = true): Database.Database {
  const db = new Database(file, { readonly, fileMustExist: true });
  db.pragma("busy_timeout = 10000");
  return db;
}

export function createDb(file: string): Database.Database {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 10000");
  db.exec(SCHEMA_SQL);
  return db;
}

export function resetSchema(db: Database.Database): void {
  db.exec(`
    DROP TRIGGER IF EXISTS items_ai;
    DROP TRIGGER IF EXISTS items_ad;
    DROP TABLE IF EXISTS items_fts;
    DROP TABLE IF EXISTS options;
    DROP TABLE IF EXISTS items;
    DROP TABLE IF EXISTS meta;
  `);
  db.exec(SCHEMA_SQL);
}

export function insertItem(db: Database.Database, item: Record<string, unknown>): number {
  const result = db.prepare(`
    INSERT INTO items (
      kind, name, title, description, label, support_level, since, deprecated,
      group_id, artifact_id, java_type, scheme, syntax, aliases,
      doc_file, doc_text, doc_text_raw, search_text
    ) VALUES (
      @kind, @name, @title, @description, @label, @support_level, @since, @deprecated,
      @group_id, @artifact_id, @java_type, @scheme, @syntax, @aliases,
      @doc_file, @doc_text, @doc_text_raw, @search_text
    )
  `).run(item);
  return Number(result.lastInsertRowid);
}

export function insertOption(db: Database.Database, itemId: number, option: Record<string, unknown>): void {
  db.prepare(`
    INSERT INTO options (
      item_id, scope, name, display_name, group_name, kind, type,
      default_value, required, deprecated, secret, enum_values, description, idx
    ) VALUES (
      @item_id, @scope, @name, @display_name, @group_name, @kind, @type,
      @default_value, @required, @deprecated, @secret, @enum_values, @description, @idx
    )
  `).run({ item_id: itemId, ...option });
}

export function search(db: Database.Database, options: SearchOptions): Hit[] {
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 20);
  const kind = options.kind?.trim() || null;
  const label = options.label?.trim() || null;

  const run = (match: string): Hit[] =>
    withRetry(() =>
      db.prepare(`
        SELECT i.*,
               snippet(items_fts, 3, '>>>', '<<<', ' ... ', 32) AS snippet,
               bm25(items_fts, 8.0, 4.0, 2.0, 1.0) AS score
        FROM items_fts
        JOIN items i ON i.id = items_fts.rowid
        WHERE items_fts MATCH @match
          AND (@kind IS NULL OR i.kind = @kind)
          AND (@label IS NULL OR lower(i.label) LIKE '%' || lower(@label) || '%')
        ORDER BY score
        LIMIT @limit
      `).all({ match, kind, label, limit }) as Hit[]
    );

  const andMatch = buildMatch(options.query, "AND");
  if (!andMatch) return [];

  const hits = run(andMatch);
  if (hits.length < limit) {
    const orMatch = buildMatch(options.query, "OR");
    if (orMatch && orMatch !== andMatch) {
      const seen = new Set(hits.map((hit) => hit.id));
      for (const hit of run(orMatch)) {
        if (!seen.has(hit.id)) {
          hits.push(hit);
          seen.add(hit.id);
        }
      }
    }
  }

  return hits.slice(0, limit);
}

export function getItem(db: Database.Database, name: string, kind?: string): ItemRow | undefined {
  return withRetry(() =>
    db.prepare(`
      SELECT * FROM items
      WHERE (lower(name) = lower(@name)
             OR lower(scheme) = lower(@name)
             OR instr(',' || lower(aliases) || ',', ',' || lower(@name) || ',') > 0)
        AND (@kind IS NULL OR kind = @kind)
      ORDER BY CASE WHEN lower(name) = lower(@name) THEN 0 ELSE 1 END, length(name)
      LIMIT 1
    `).get({ name, kind: kind?.trim() || null }) as ItemRow | undefined
  );
}

export function listItems(db: Database.Database, options: ListOptions): ItemRow[] {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  return withRetry(() =>
    db.prepare(`
      SELECT * FROM items
      WHERE kind = @kind
        AND (@label IS NULL OR lower(label) LIKE '%' || lower(@label) || '%')
        AND (@support IS NULL OR lower(support_level) = lower(@support))
        AND (@search IS NULL OR lower(name) LIKE '%' || lower(@search) || '%'
             OR lower(title) LIKE '%' || lower(@search) || '%'
             OR lower(scheme) LIKE '%' || lower(@search) || '%')
      ORDER BY name
      LIMIT @limit
    `).all({
      kind: options.kind,
      label: options.label?.trim() || null,
      support: options.supportLevel?.trim() || null,
      search: options.search?.trim() || null,
      limit
    }) as ItemRow[]
  );
}

export function getOptions(
  db: Database.Database,
  query: OptionQuery
): { item: ItemRow; options: OptionRow[]; total: number } | undefined {
  const item = getItem(db, query.name, query.kind);
  if (!item) return undefined;

  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);
  const params = {
    item_id: item.id,
    scope: query.scope?.trim() || null,
    group: query.group?.trim() || null,
    requiredOnly: query.requiredOnly ? 1 : 0
  };

  const where = `
    item_id = @item_id
    AND (@scope IS NULL OR scope = @scope)
    AND (@group IS NULL OR lower(group_name) = lower(@group))
    AND (@requiredOnly = 0 OR required = 1)
  `;

  const total = withRetry(() =>
    (db.prepare(`SELECT count(*) AS n FROM options WHERE ${where}`).get(params) as { n: number }).n
  );
  const options = withRetry(() =>
    db.prepare(`
      SELECT scope, name, display_name, group_name, kind, type, default_value,
             required, deprecated, secret, enum_values, description, idx
      FROM options
      WHERE ${where}
      ORDER BY scope, idx
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset }) as OptionRow[]
  );

  return { item, options, total };
}

export function meta(db: Database.Database): Record<string, string> {
  const rows = withRetry(() =>
    db.prepare("SELECT key, value FROM meta").all() as { key: string; value: string }[]
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export function counts(db: Database.Database): Record<string, number> {
  const rows = withRetry(() =>
    db.prepare("SELECT kind, count(*) AS n FROM items GROUP BY kind").all() as { kind: string; n: number }[]
  );
  return Object.fromEntries(rows.map((row) => [row.kind, row.n]));
}
