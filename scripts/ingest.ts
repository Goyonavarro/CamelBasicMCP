import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { conceptsToItems, readCatalog, readConcepts, resolveCatalogJar } from "../src/catalog.js";
import { counts, insertItem, insertOption, resetSchema } from "../src/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const dbPath = path.join(dataDir, "camel-kb.sqlite");
const conceptsDir = path.join(root, "content", "concepts");
const version = process.env.CAMEL_VERSION || "4.23.0";

mkdirSync(dataDir, { recursive: true });

const started = Date.now();
const jar = await resolveCatalogJar(version, process.env.CAMEL_CATALOG_JAR);
console.log(`Catalog: ${jar.path} (${jar.source})`);

const catalog = readCatalog(jar.path, version, jar.source);
const concepts = readConcepts(conceptsDir);
const items = [...catalog.items, ...conceptsToItems(concepts)];

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 10000");

const save = db.transaction(() => {
  resetSchema(db);

  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("camel_version", catalog.version);
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("catalog_jar", catalog.jarPath);
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("catalog_jar_source", catalog.jarSource);
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("doc_files", String(catalog.docFiles));
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)").run("built_at", new Date().toISOString());

  for (const item of items) {
    const itemId = insertItem(db, {
      kind: item.kind,
      name: item.name,
      title: item.title,
      description: item.description,
      label: item.label,
      support_level: item.supportLevel,
      since: item.since,
      deprecated: item.deprecated ? 1 : 0,
      group_id: item.groupId,
      artifact_id: item.artifactId,
      java_type: item.javaType,
      scheme: item.scheme,
      syntax: item.syntax,
      aliases: item.aliases,
      doc_file: item.docFile,
      doc_text: item.docText,
      doc_text_raw: item.docTextRaw,
      search_text: item.searchText
    });

    for (const option of item.options) {
      insertOption(db, itemId, {
        scope: option.scope,
        name: option.name,
        display_name: option.displayName,
        group_name: option.groupName,
        kind: option.kind,
        type: option.type,
        default_value: option.defaultValue,
        required: option.required ? 1 : 0,
        deprecated: option.deprecated ? 1 : 0,
        secret: option.secret ? 1 : 0,
        enum_values: option.enumValues,
        description: option.description,
        idx: option.idx
      });
    }
  }
});

save();
db.exec("INSERT INTO items_fts(items_fts) VALUES('rebuild')");
db.exec("INSERT INTO items_fts(items_fts) VALUES('optimize')");
db.pragma("wal_checkpoint(TRUNCATE)");

const summary = counts(db);
const optionTotal = (db.prepare("SELECT count(*) AS n FROM options").get() as { n: number }).n;
db.close();

const docsMissing = (summary.component ?? 0) - catalog.componentsWithDoc;
console.log(
  `Indexed ${items.length} items, ${optionTotal} options, ${catalog.docFiles} catalog docs ` +
  `in ${((Date.now() - started) / 1000).toFixed(1)}s`
);
console.log(`Components: ${summary.component ?? 0} (${catalog.componentsWithDoc} with doc, ${docsMissing} JSON-only)`);
console.log(`EIPs: ${summary.eip ?? 0}, languages: ${summary.language ?? 0}, dataformats: ${summary.dataformat ?? 0}`);
console.log(`Guides: ${summary.guide ?? 0}, concepts: ${summary.concept ?? 0}`);
console.log(`Database: ${dbPath}`);

if (!existsSync(conceptsDir)) {
  console.warn(`Concepts directory missing: ${conceptsDir}`);
}
