import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {
  allAsync,
  deriveBookShort,
  executeTransaction,
  getAsync,
  initializeDatabase,
  insertScriptureBatch,
  normalizeBookName,
  normalizeWhitespace,
  runAsync,
  readScripturesFromSourceDatabase,
  type ScriptureInsertRecord,
  type SQLiteDatabase
} from "./db";

interface ImportResult {
  success: boolean;
  count: number;
}

interface ImportOptions {
  stripMetadataOnImport?: boolean;
  autoCorrectEncoding?: boolean;
}

interface JsonContext {
  bookFull?: string;
  bookShort?: string;
  chapter?: number;
}

interface ColumnInfoRow {
  name: string;
}

interface SourceCountRow {
  total: number;
}

interface SqlInsertStatement {
  columns: string[];
  valuesSql: string;
}

const VERSE_LINE_PATTERN =
  /^(?<book>(?:[1-3]\s+)?[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?<chapter>\d+):(?<verse>\d+)(?:\s+|-+\s*)(?<text>.+)$/;

const COLUMN_ALIASES = {
  bookFull: ["bookfull", "book_full", "book", "bookname", "book_name", "name"],
  bookShort: ["bookshort", "book_short", "abbr", "abbreviation", "short"],
  chapter: ["chapter", "chapter_no", "chapter_number", "chapternumber"],
  verse: ["verse", "verse_no", "verse_number", "versenumber"],
  text: ["text", "verse_text", "versetext", "content", "scripture", "body"],
  translation: ["translation", "version", "translation_name", "translationname"]
} as const;

function normalizeTranslationTag(value: string): string {
  return normalizeWhitespace(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function normalizeChapterVerse(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function createReferenceLabel(record: ScriptureInsertRecord): string {
  return `${record.bookFull} ${record.chapter}:${record.verse}`;
}

function toScriptureRecord(
  partial: {
    bookFull?: unknown;
    bookShort?: unknown;
    chapter?: unknown;
    verse?: unknown;
    text?: unknown;
  },
  translation: string
): ScriptureInsertRecord | null {
  const bookFull = normalizeBookName(String(partial.bookFull ?? ""));
  const chapter = normalizeChapterVerse(partial.chapter);
  const verse = normalizeChapterVerse(partial.verse);
  const text = normalizeWhitespace(String(partial.text ?? ""));

  if (!bookFull || chapter === null || verse === null || !text) {
    return null;
  }

  const normalizedTranslation = normalizeTranslationTag(translation);

  if (!normalizedTranslation) {
    return null;
  }

  const bookShortSource = normalizeWhitespace(String(partial.bookShort ?? ""));

  return {
    bookFull,
    bookShort: bookShortSource || deriveBookShort(bookFull),
    chapter,
    verse,
    text,
    translation: normalizedTranslation
  };
}

function getObjectValue(
  value: Record<string, unknown>,
  keys: readonly string[]
): unknown {
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (keys.includes(entryKey.toLowerCase())) {
      return entryValue;
    }
  }

  return undefined;
}

function parseReferenceLabel(
  reference: string
): Pick<ScriptureInsertRecord, "bookFull" | "chapter" | "verse"> | null {
  const matched = normalizeWhitespace(reference).match(VERSE_LINE_PATTERN);

  if (!matched?.groups) {
    return null;
  }

  const chapter = normalizeChapterVerse(matched.groups.chapter);
  const verse = normalizeChapterVerse(matched.groups.verse);

  if (chapter === null || verse === null) {
    return null;
  }

  return {
    bookFull: normalizeBookName(matched.groups.book),
    chapter,
    verse
  };
}

function collectJsonRecords(
  node: unknown,
  translation: string,
  records: ScriptureInsertRecord[],
  context: JsonContext = {}
): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      if (
        typeof item === "string" &&
        context.bookFull &&
        context.chapter !== undefined
      ) {
        const record = toScriptureRecord(
          {
            bookFull: context.bookFull,
            bookShort: context.bookShort,
            chapter: context.chapter,
            verse: index + 1,
            text: item
          },
          translation
        );

        if (record) {
          records.push(record);
        }

        return;
      }

      collectJsonRecords(item, translation, records, context);
    });

    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  const objectNode = node as Record<string, unknown>;
  const directText =
    getObjectValue(objectNode, COLUMN_ALIASES.text) ??
    getObjectValue(objectNode, ["value"]);
  const directBook =
    getObjectValue(objectNode, COLUMN_ALIASES.bookFull) ??
    context.bookFull ??
    getObjectValue(objectNode, ["booktitle"]);
  const directBookShort =
    getObjectValue(objectNode, COLUMN_ALIASES.bookShort) ?? context.bookShort;
  const directChapter =
    getObjectValue(objectNode, COLUMN_ALIASES.chapter) ?? context.chapter;
  const directVerse = getObjectValue(objectNode, COLUMN_ALIASES.verse);
  const directReference = getObjectValue(objectNode, ["reference"]);

  if (directReference && directText) {
    const parsedReference = parseReferenceLabel(String(directReference));

    if (parsedReference) {
      const record = toScriptureRecord(
        {
          ...parsedReference,
          bookShort: directBookShort,
          text: directText
        },
        translation
      );

      if (record) {
        records.push(record);
        return;
      }
    }
  }

  if (directText) {
    const record = toScriptureRecord(
      {
        bookFull: directBook,
        bookShort: directBookShort,
        chapter: directChapter,
        verse: directVerse,
        text: directText
      },
      translation
    );

    if (record) {
      records.push(record);
      return;
    }
  }

  const nextContext: JsonContext = {
    bookFull:
      typeof directBook === "string"
        ? normalizeBookName(directBook)
        : context.bookFull,
    bookShort:
      typeof directBookShort === "string"
        ? normalizeWhitespace(directBookShort)
        : context.bookShort,
    chapter:
      normalizeChapterVerse(directChapter) ??
      (typeof context.chapter === "number" ? context.chapter : undefined)
  };

  const nestedChapters = getObjectValue(objectNode, ["chapters", "chapter"]);
  const nestedVerses = getObjectValue(objectNode, ["verses", "lines"]);

  if (nestedChapters) {
    collectJsonRecords(nestedChapters, translation, records, nextContext);
  }

  if (nestedVerses) {
    collectJsonRecords(nestedVerses, translation, records, nextContext);
  }

  for (const [key, value] of Object.entries(objectNode)) {
    const normalizedKey = key.toLowerCase();

    if (
      [
        ...COLUMN_ALIASES.bookFull,
        ...COLUMN_ALIASES.bookShort,
        ...COLUMN_ALIASES.chapter,
        ...COLUMN_ALIASES.verse,
        ...COLUMN_ALIASES.text,
        "reference",
        "chapters",
        "chapter",
        "verses",
        "lines",
        "value"
      ].includes(normalizedKey)
    ) {
      continue;
    }

    if (/^\d+$/.test(key)) {
      const numericKey = Number.parseInt(key, 10);

      if (nextContext.bookFull && nextContext.chapter === undefined) {
        collectJsonRecords(value, translation, records, {
          ...nextContext,
          chapter: numericKey
        });
        continue;
      }

      if (nextContext.bookFull && nextContext.chapter !== undefined) {
        if (typeof value === "string") {
          const record = toScriptureRecord(
            {
              bookFull: nextContext.bookFull,
              bookShort: nextContext.bookShort,
              chapter: nextContext.chapter,
              verse: numericKey,
              text: value
            },
            translation
          );

          if (record) {
            records.push(record);
          }
        } else {
          collectJsonRecords(value, translation, records, nextContext);
        }
        continue;
      }
    }

    if (!nextContext.bookFull) {
      collectJsonRecords(value, translation, records, {
        bookFull: normalizeBookName(key),
        bookShort: deriveBookShort(key)
      });
      continue;
    }

    collectJsonRecords(value, translation, records, nextContext);
  }
}

async function parseJsonImport(
  filePath: string,
  translation: string
): Promise<ScriptureInsertRecord[]> {
  const rawText = await readFile(filePath, "utf8");
  const parsed = JSON.parse(rawText) as unknown;
  const records: ScriptureInsertRecord[] = [];

  collectJsonRecords(parsed, translation, records);

  return records;
}

async function parseStructuredText(
  filePath: string,
  translation: string,
  options: ImportOptions
): Promise<ScriptureInsertRecord[]> {
  const lineReader = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  const lines: string[] = [];

  for await (const rawLine of lineReader) {
    lines.push(rawLine);
  }

  return parseStructuredTextLines(lines, translation, options);
}

function parseStructuredTextLines(
  lines: string[],
  translation: string,
  options: ImportOptions
): ScriptureInsertRecord[] {
  const records: ScriptureInsertRecord[] = [];
  let currentRecord: ScriptureInsertRecord | null = null;
  const stripMetadataOnImport = options.stripMetadataOnImport ?? true;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (
      stripMetadataOnImport &&
      !currentRecord &&
      !VERSE_LINE_PATTERN.test(line) &&
      /^(copyright|preface|introduction|contents|table of contents|foreword|acknowledg)/i.test(
        line
      )
    ) {
      continue;
    }

    const matched = line.match(VERSE_LINE_PATTERN);

    if (matched?.groups) {
      if (currentRecord) {
        records.push(currentRecord);
      }

      currentRecord = toScriptureRecord(
        {
          bookFull: matched.groups.book,
          chapter: matched.groups.chapter,
          verse: matched.groups.verse,
          text: matched.groups.text
        },
        translation
      );

      continue;
    }

    if (currentRecord) {
      currentRecord = {
        ...currentRecord,
        text: normalizeWhitespace(`${currentRecord.text} ${line}`)
      };
    }
  }

  if (currentRecord) {
    records.push(currentRecord);
  }

  return records;
}

function decodePdfTextBlock(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

async function parsePdfImport(
  filePath: string,
  translation: string,
  options: ImportOptions
): Promise<ScriptureInsertRecord[]> {
  const buffer = await readFile(filePath);
  const pdfSource = buffer.toString("latin1");
  const extractedBlocks = Array.from(
    pdfSource.matchAll(/\((?:\\.|[^\\()])*\)/g),
    (match) => decodePdfTextBlock(match[0].slice(1, -1))
  );

  const extractedText = extractedBlocks.join("\n");

  if (!extractedText.trim()) {
    return [];
  }

  return parseStructuredTextLines(
    extractedText.split(/\r?\n/),
    translation,
    options
  );
}

function normalizeSqlValue(rawValue: string): string | null {
  const trimmed = rawValue.trim();

  if (!trimmed || /^null$/i.test(trimmed)) {
    return null;
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/''/g, "'")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }

  return trimmed.replace(/^`|`$/g, "");
}

function splitSqlTuples(valuesSql: string): string[] {
  const tuples: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let previousCharacter = "";

  for (const character of valuesSql) {
    if (!inString && depth === 0 && (character === "," || /\s/.test(character))) {
      previousCharacter = character;
      continue;
    }

    if (character === "'" && previousCharacter !== "\\") {
      inString = !inString;
    }

    current += character;

    if (!inString) {
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;

        if (depth === 0) {
          tuples.push(current.trim());
          current = "";
        }
      }
    }

    previousCharacter = character;
  }

  return tuples;
}

function splitSqlFields(tupleSql: string): Array<string | null> {
  const innerSql = tupleSql.trim().replace(/^\(/, "").replace(/\)$/, "");
  const fields: Array<string | null> = [];
  let current = "";
  let inString = false;
  let previousCharacter = "";

  for (const character of innerSql) {
    if (character === "'" && previousCharacter !== "\\") {
      inString = !inString;
      current += character;
      previousCharacter = character;
      continue;
    }

    if (character === "," && !inString) {
      fields.push(normalizeSqlValue(current));
      current = "";
      previousCharacter = character;
      continue;
    }

    current += character;
    previousCharacter = character;
  }

  if (current.length > 0) {
    fields.push(normalizeSqlValue(current));
  }

  return fields;
}

function parseInsertStatement(statement: string): SqlInsertStatement | null {
  const matched = statement.match(
    /INSERT\s+INTO\s+[`"]?[\w.]+[`"]?\s*(?:\((?<columns>[^)]+)\))?\s*VALUES\s*(?<values>[\s\S]+);?$/i
  );

  if (!matched?.groups?.values) {
    return null;
  }

  const columns = matched.groups.columns
    ? matched.groups.columns
        .split(",")
        .map((column) => column.trim().replace(/[`"]/g, ""))
    : [];

  return {
    columns,
    valuesSql: matched.groups.values
  };
}

function mapSqlRowToRecord(
  fields: Array<string | null>,
  columns: string[],
  translation: string
): ScriptureInsertRecord | null {
  if (fields.length === 0) {
    return null;
  }

  if (columns.length > 0) {
    const lookup = new Map<string, string | null>();

    columns.forEach((column, index) => {
      lookup.set(column.toLowerCase(), fields[index] ?? null);
    });

    return toScriptureRecord(
      {
        bookFull: getObjectValue(
          Object.fromEntries(lookup),
          COLUMN_ALIASES.bookFull
        ),
        bookShort: getObjectValue(
          Object.fromEntries(lookup),
          COLUMN_ALIASES.bookShort
        ),
        chapter: getObjectValue(
          Object.fromEntries(lookup),
          COLUMN_ALIASES.chapter
        ),
        verse: getObjectValue(
          Object.fromEntries(lookup),
          COLUMN_ALIASES.verse
        ),
        text: getObjectValue(
          Object.fromEntries(lookup),
          COLUMN_ALIASES.text
        )
      },
      translation
    );
  }

  if (fields.length >= 7) {
    return toScriptureRecord(
      {
        bookFull: fields[1],
        bookShort: fields[2],
        chapter: fields[3],
        verse: fields[4],
        text: fields[5]
      },
      translation
    );
  }

  if (fields.length >= 5) {
    return toScriptureRecord(
      {
        bookFull: fields[0],
        bookShort: fields.length >= 6 ? fields[1] : undefined,
        chapter: fields.length >= 6 ? fields[2] : fields[1],
        verse: fields.length >= 6 ? fields[3] : fields[2],
        text: fields.length >= 6 ? fields[4] : fields[3]
      },
      translation
    );
  }

  return null;
}

async function parseSqlDumpImport(
  filePath: string,
  translation: string
): Promise<ScriptureInsertRecord[]> {
  const records: ScriptureInsertRecord[] = [];
  const lineReader = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let currentInsert = "";

  for await (const rawLine of lineReader) {
    const line = rawLine.trim();

    if (!currentInsert && !/^INSERT\s+INTO/i.test(line)) {
      continue;
    }

    currentInsert += `${line} `;

    if (!line.endsWith(";")) {
      continue;
    }

    const parsedStatement = parseInsertStatement(currentInsert);

    if (parsedStatement) {
      const tuples = splitSqlTuples(parsedStatement.valuesSql);

      for (const tuple of tuples) {
        const record = mapSqlRowToRecord(
          splitSqlFields(tuple),
          parsedStatement.columns,
          translation
        );

        if (record) {
          records.push(record);
        }
      }
    }

    currentInsert = "";
  }

  return records;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function findImportSourceTable(database: SQLiteDatabase): Promise<{
  tableName: string;
  columnMap: Record<string, string>;
} | null> {
  const tables = await allAsync<{ name: string }>(
    database,
    `
      SELECT name
      FROM import_source.sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%';
    `
  );

  for (const table of tables) {
    const tableName = table.name;
    const columnRows = await allAsync<ColumnInfoRow>(
      database,
      `PRAGMA import_source.table_info(${quoteIdentifier(tableName)});`
    );

    const columnLookup = new Map(
      columnRows.map((row) => [row.name.toLowerCase(), row.name])
    );

    const columnMap: Record<string, string> = {};

    for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
      const matchedAlias = aliases.find((alias) => columnLookup.has(alias));

      if (matchedAlias) {
        columnMap[target] = columnLookup.get(matchedAlias) as string;
      }
    }

    if (
      columnMap.bookFull &&
      columnMap.chapter &&
      columnMap.verse &&
      columnMap.text
    ) {
      if (!columnMap.bookShort) {
        columnMap.bookShort = columnMap.bookFull;
      }

      return {
        tableName,
        columnMap
      };
    }
  }

  return null;
}

async function importFromAttachedDatabase(
  database: SQLiteDatabase,
  filePath: string,
  translation: string
): Promise<number> {
  await runAsync(database, "ATTACH DATABASE ? AS import_source;", [filePath]);

  try {
    const source = await findImportSourceTable(database);

    if (!source) {
      throw new Error("Could not find a compatible scripture table in the import database.");
    }

    const { tableName, columnMap } = source;
    const fullColumn = quoteIdentifier(columnMap.bookFull);
    const shortColumn = quoteIdentifier(columnMap.bookShort);
    const chapterColumn = quoteIdentifier(columnMap.chapter);
    const verseColumn = quoteIdentifier(columnMap.verse);
    const textColumn = quoteIdentifier(columnMap.text);
    const sourceTable = `import_source.${quoteIdentifier(tableName)}`;

    const countRow = await getAsync<SourceCountRow>(
      database,
      `
        SELECT COUNT(*) AS total
        FROM ${sourceTable}
        WHERE COALESCE(${textColumn}, '') <> '';
      `
    );

    await runAsync(
      database,
      `
        INSERT INTO scriptures (
          bookFull,
          bookShort,
          chapter,
          verse,
          text,
          translation
        )
        SELECT
          TRIM(${fullColumn}) AS bookFull,
          COALESCE(NULLIF(TRIM(${shortColumn}), ''), TRIM(${fullColumn})) AS bookShort,
          CAST(${chapterColumn} AS INTEGER) AS chapter,
          CAST(${verseColumn} AS INTEGER) AS verse,
          TRIM(${textColumn}) AS text,
          ? AS translation
        FROM ${sourceTable}
        WHERE COALESCE(${textColumn}, '') <> ''
        ON CONFLICT(translation, bookFull, chapter, verse)
        DO UPDATE SET
          bookShort = excluded.bookShort,
          text = excluded.text;
      `,
      [translation]
    );

    return countRow?.total ?? 0;
  } finally {
    await runAsync(database, "DETACH DATABASE import_source;");
  }
}

export async function processBibleImport(
  filePath: string,
  translationName: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const extension = path.extname(filePath).toLowerCase();
  const normalizedTranslation = normalizeTranslationTag(translationName);

  if (!normalizedTranslation) {
    throw new Error("A translation tag is required before importing scripture data.");
  }

  const database = await initializeDatabase();

  if (extension === ".sqlite" || extension === ".db") {
    const sourceRecords = await readScripturesFromSourceDatabase(
      filePath,
      normalizedTranslation
    );
    const count = await executeTransaction(database, async () =>
      insertScriptureBatch(database, sourceRecords)
    );

    return {
      success: true,
      count
    };
  }

  let records: ScriptureInsertRecord[] = [];

  switch (extension) {
    case ".json":
      records = await parseJsonImport(filePath, normalizedTranslation);
      break;
    case ".txt":
      records = await parseStructuredText(filePath, normalizedTranslation, options);
      break;
    case ".sql":
      records = await parseSqlDumpImport(filePath, normalizedTranslation);
      break;
    case ".pdf":
      records = await parsePdfImport(filePath, normalizedTranslation, options);
      break;
    default:
      throw new Error(`Unsupported Bible import format: ${extension || "unknown"}`);
  }

  const dedupedRecords = Array.from(
    new Map(records.map((record) => [`${record.translation}:${createReferenceLabel(record)}`, record])).values()
  );

  const count = await executeTransaction(database, async () =>
    insertScriptureBatch(database, dedupedRecords)
  );

  return {
    success: true,
    count
  };
}
