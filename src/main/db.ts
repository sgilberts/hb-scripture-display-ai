import { app } from "electron";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sqlite3 from "sqlite3";
import type {
  ScriptureNavigationDirection,
  ScriptureRecord
} from "../shared/types";

const sqlite = sqlite3.verbose();

export type SQLiteDatabase = sqlite3.Database;
export type ScriptureInsertRecord = Omit<ScriptureRecord, "id">;

interface ParsedReferenceQuery {
  book: string;
  chapter: number;
  verse?: number;
}

interface RunResult {
  changes: number;
  lastID: number;
}

let databasePromise: Promise<SQLiteDatabase> | null = null;

function openDatabase(filename: string): Promise<SQLiteDatabase> {
  return new Promise((resolve, reject) => {
    const database = new sqlite.Database(
      filename,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(database);
      }
    );
  });
}

function openReadOnlyDatabase(filename: string): Promise<SQLiteDatabase> {
  return new Promise((resolve, reject) => {
    const database = new sqlite.Database(
      filename,
      sqlite3.OPEN_READONLY,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(database);
      }
    );
  });
}

export function runAsync(
  database: SQLiteDatabase,
  sql: string,
  params: ReadonlyArray<string | number | null> = []
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    database.run(
      sql,
      params,
      function (
        this: { changes: number; lastID: number },
        error: Error | null
      ) {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          changes: this.changes ?? 0,
          lastID: this.lastID ?? 0
        });
      }
    );
  });
}

export function allAsync<T>(
  database: SQLiteDatabase,
  sql: string,
  params: ReadonlyArray<string | number | null> = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows: T[]) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

export function getAsync<T>(
  database: SQLiteDatabase,
  sql: string,
  params: ReadonlyArray<string | number | null> = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row: T | undefined) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function prepareStatementAsync(
  database: SQLiteDatabase,
  sql: string
): Promise<sqlite3.Statement> {
  return new Promise((resolve, reject) => {
    const statement = database.prepare(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(statement);
    });
  });
}

function runStatementAsync(
  statement: sqlite3.Statement,
  params: ReadonlyArray<string | number | null>
): Promise<void> {
  return new Promise((resolve, reject) => {
    statement.run(params, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function finalizeStatementAsync(statement: sqlite3.Statement): Promise<void> {
  return new Promise((resolve, reject) => {
    statement.finalize((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function getDatabasePath(): Promise<string> {
  await app.whenReady();

  const userDataDirectory = app.getPath("userData");
  await mkdir(userDataDirectory, { recursive: true });

  return join(userDataDirectory, "hallelujahbeamer.db");
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeBookName(value: string): string {
  return normalizeWhitespace(value.replace(/\./g, ""));
}

export function deriveBookShort(bookFull: string): string {
  const cleaned = normalizeBookName(bookFull).replace(/[^A-Za-z0-9 ]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    return words[0].slice(0, Math.min(4, words[0].length));
  }

  return words.map((word) => word[0]).join("").slice(0, 4);
}

function normalizeTranslation(value: string): string {
  return normalizeWhitespace(value).toUpperCase();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function toScriptureInsertRecordFromSourceRow(
  row: Record<string, unknown>,
  columns: {
    bookFull: string;
    bookShort?: string;
    chapter: string;
    verse: string;
    text: string;
  },
  translation: string
): ScriptureInsertRecord | null {
  const bookFull = normalizeBookName(String(row[columns.bookFull] ?? ""));
  const bookShortValue = columns.bookShort
    ? String(row[columns.bookShort] ?? "")
    : "";
  const chapter = Number.parseInt(String(row[columns.chapter] ?? ""), 10);
  const verse = Number.parseInt(String(row[columns.verse] ?? ""), 10);
  const text = normalizeWhitespace(String(row[columns.text] ?? ""));

  if (!bookFull || Number.isNaN(chapter) || Number.isNaN(verse) || !text) {
    return null;
  }

  return {
    bookFull,
    bookShort: normalizeWhitespace(bookShortValue) || deriveBookShort(bookFull),
    chapter,
    verse,
    text,
    translation: normalizeTranslation(translation)
  };
}

async function applySchema(database: SQLiteDatabase): Promise<void> {
  await runAsync(database, "PRAGMA journal_mode = WAL;");
  await runAsync(database, "PRAGMA synchronous = NORMAL;");
  await runAsync(database, "PRAGMA temp_store = MEMORY;");
  await runAsync(database, "PRAGMA foreign_keys = ON;");

  await runAsync(
    database,
    `
      CREATE TABLE IF NOT EXISTS scriptures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookFull TEXT NOT NULL,
        bookShort TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        translation TEXT NOT NULL
      );
    `
  );

  await runAsync(
    database,
    `
      DELETE FROM scriptures
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM scriptures
        GROUP BY translation, bookFull, chapter, verse
      );
    `
  );

  await runAsync(
    database,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS scriptures_translation_reference_unique
      ON scriptures (translation, bookFull, chapter, verse);
    `
  );

  await runAsync(
    database,
    `
      CREATE INDEX IF NOT EXISTS scriptures_translation_book_chapter_verse_idx
      ON scriptures (translation, bookFull, chapter, verse);
    `
  );

  await runAsync(
    database,
    `
      CREATE INDEX IF NOT EXISTS scriptures_translation_book_short_chapter_verse_idx
      ON scriptures (translation, bookShort, chapter, verse);
    `
  );

  await runAsync(
    database,
    `
      CREATE INDEX IF NOT EXISTS scriptures_translation_lookup_idx
      ON scriptures (translation);
    `
  );
}

function parseReferenceQuery(queryStr: string): ParsedReferenceQuery | null {
  const normalizedQuery = normalizeWhitespace(queryStr);
  const referencePattern =
    /^(?<book>(?:[1-3]\s+)?[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?<chapter>\d+)(?:(?::|\s+)(?<verse>\d+))?$/i;
  const matched = normalizedQuery.match(referencePattern);

  if (!matched?.groups) {
    return null;
  }

  const chapter = Number.parseInt(matched.groups.chapter, 10);
  const verse = matched.groups.verse
    ? Number.parseInt(matched.groups.verse, 10)
    : undefined;

  if (Number.isNaN(chapter) || (verse !== undefined && Number.isNaN(verse))) {
    return null;
  }

  return {
    book: normalizeBookName(matched.groups.book),
    chapter,
    verse
  };
}

function getReferenceSearchPlan(
  reference: ParsedReferenceQuery,
  translation: string
): {
  sql: string;
  params: Array<string | number>;
} {
  const normalizedBook = reference.book.toLowerCase();
  const params: Array<string | number> = [
    translation,
    normalizedBook,
    normalizedBook,
    `${normalizedBook}%`,
    `${normalizedBook}%`,
    reference.chapter
  ];

  const verseClause = reference.verse !== undefined ? "AND verse = ?" : "";

  if (reference.verse !== undefined) {
    params.push(reference.verse);
  }

  return {
    sql: `
      SELECT
        id,
        bookFull,
        bookShort,
        chapter,
        verse,
        text,
        translation
      FROM scriptures
      WHERE translation = ?
        AND (
          LOWER(bookFull) = ?
          OR LOWER(bookShort) = ?
          OR LOWER(bookFull) LIKE ?
          OR LOWER(bookShort) LIKE ?
        )
        AND chapter = ?
        ${verseClause}
      ORDER BY verse ASC, id ASC
      LIMIT 100;
    `,
    params
  };
}

function getTextSearchPlan(
  queryStr: string,
  translation: string
): {
  sql: string;
  params: Array<string | number>;
} {
  const tokens = normalizeWhitespace(queryStr)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .slice(0, 8);

  const conditions = tokens.map(
    () =>
      "(LOWER(bookFull) LIKE ? OR LOWER(bookShort) LIKE ? OR LOWER(text) LIKE ?)"
  );

  const params = tokens.flatMap((token) => {
    const likeToken = `%${token}%`;
    return [likeToken, likeToken, likeToken];
  });

  return {
    sql: `
      SELECT
        id,
        bookFull,
        bookShort,
        chapter,
        verse,
        text,
        translation
      FROM scriptures
      WHERE translation = ?
        AND ${conditions.join(" AND ")}
      ORDER BY
        CASE
          WHEN LOWER(bookShort) = ? THEN 0
          WHEN LOWER(bookFull) = ? THEN 1
          ELSE 2
        END,
        bookFull ASC,
        chapter ASC,
        verse ASC,
        id ASC
      LIMIT 100;
    `,
    params: [translation, ...params, tokens[0] ?? "", tokens[0] ?? ""]
  };
}

export async function executeTransaction<T>(
  database: SQLiteDatabase,
  action: () => Promise<T>
): Promise<T> {
  await runAsync(database, "BEGIN IMMEDIATE TRANSACTION;");

  try {
    const result = await action();
    await runAsync(database, "COMMIT;");
    return result;
  } catch (error) {
    await runAsync(database, "ROLLBACK;");
    throw error;
  }
}

export async function insertScriptureBatch(
  database: SQLiteDatabase,
  records: ScriptureInsertRecord[]
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const statement = await prepareStatementAsync(
    database,
    `
      INSERT INTO scriptures (
        bookFull,
        bookShort,
        chapter,
        verse,
        text,
        translation
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(translation, bookFull, chapter, verse)
      DO UPDATE SET
        bookShort = excluded.bookShort,
        text = excluded.text;
    `
  );

  try {
    for (const record of records) {
      await runStatementAsync(statement, [
        normalizeBookName(record.bookFull),
        normalizeWhitespace(record.bookShort || deriveBookShort(record.bookFull)),
        record.chapter,
        record.verse,
        normalizeWhitespace(record.text),
        normalizeTranslation(record.translation)
      ]);
    }
  } finally {
    await finalizeStatementAsync(statement);
  }

  return records.length;
}

export async function initializeDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const databasePath = await getDatabasePath();
      const database = await openDatabase(databasePath);

      try {
        await applySchema(database);
        return database;
      } catch (error) {
        databasePromise = null;
        database.close();
        throw error;
      }
    })();
  }

  return databasePromise;
}

export async function getInstalledTranslations(): Promise<string[]> {
  const database = await initializeDatabase();
  const rows = await allAsync<{ translation: string }>(
    database,
    `
      SELECT DISTINCT translation
      FROM scriptures
      ORDER BY translation ASC;
    `
  );

  return rows.map((row) => row.translation);
}

export async function deleteTranslation(translation: string): Promise<number> {
  const normalizedTranslation = normalizeTranslation(translation);

  if (!normalizedTranslation) {
    return 0;
  }

  const database = await initializeDatabase();
  const result = await runAsync(
    database,
    `
      DELETE FROM scriptures
      WHERE translation = ?;
    `,
    [normalizedTranslation]
  );

  return result.changes;
}

export async function readScripturesFromSourceDatabase(
  filePath: string,
  translation: string
): Promise<ScriptureInsertRecord[]> {
  const sourceDatabase = await openReadOnlyDatabase(filePath);

  try {
    const sourceTables = await allAsync<{ name: string }>(
      sourceDatabase,
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC;
      `
    );

    for (const table of sourceTables) {
      const tableInfo = await allAsync<{
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>(sourceDatabase, `PRAGMA table_info(${quoteIdentifier(table.name)});`);

      const columns = tableInfo.map((column) => column.name.toLowerCase());
      const findColumn = (...names: string[]): string | undefined =>
        tableInfo.find((column) => names.includes(column.name.toLowerCase()))?.name;

      const bookFull = findColumn("bookfull", "book_full", "book", "bookname", "name");
      const bookShort = findColumn("bookshort", "book_short", "abbr", "short");
      const chapter = findColumn("chapter", "chapter_no", "chapter_number");
      const verse = findColumn("verse", "verse_no", "verse_number");
      const text = findColumn("text", "verse_text", "versetext", "content", "body");

      if (!bookFull || !chapter || !verse || !text) {
        continue;
      }

      const rows = await allAsync<Record<string, unknown>>(
        sourceDatabase,
        `SELECT * FROM ${quoteIdentifier(table.name)};`
      );

      const records: ScriptureInsertRecord[] = rows
        .map((row) =>
          toScriptureInsertRecordFromSourceRow(
            row,
            { bookFull, bookShort, chapter, verse, text },
            translation
          )
        )
        .filter((record): record is ScriptureInsertRecord => Boolean(record));

      if (records.length > 0) {
        return records;
      }
    }

    return [];
  } finally {
    sourceDatabase.close();
  }
}

export async function searchVerses(
  queryStr: string,
  translation: string
): Promise<ScriptureRecord[]> {
  const normalizedQuery = normalizeWhitespace(queryStr);
  const normalizedTranslation = normalizeTranslation(translation);

  if (!normalizedQuery || !normalizedTranslation) {
    return [];
  }

  const database = await initializeDatabase();
  const parsedReference = parseReferenceQuery(normalizedQuery);
  const searchPlan = parsedReference
    ? getReferenceSearchPlan(parsedReference, normalizedTranslation)
    : getTextSearchPlan(normalizedQuery, normalizedTranslation);

  return allAsync<ScriptureRecord>(database, searchPlan.sql, searchPlan.params);
}

export async function searchVersesInPath(
  filePath: string,
  queryStr: string,
  translation: string,
): Promise<ScriptureRecord[]> {
  const normalizedQuery = normalizeWhitespace(queryStr);
  const normalizedTranslation = normalizeTranslation(translation);

  if (!normalizedQuery || !normalizedTranslation) {
    return [];
  }

  const parsedReference = parseReferenceQuery(normalizedQuery);
  const searchPlan = parsedReference
    ? getReferenceSearchPlan(parsedReference, normalizedTranslation)
    : getTextSearchPlan(normalizedQuery, normalizedTranslation);

  const sourceDatabase = await openReadOnlyDatabase(filePath);

  try {
    return await allAsync<ScriptureRecord>(
      sourceDatabase,
      searchPlan.sql,
      searchPlan.params,
    );
  } finally {
    sourceDatabase.close();
  }
}

async function getCurrentReferenceRecord(
  database: SQLiteDatabase,
  reference: string,
  translation: string
): Promise<ScriptureRecord | null> {
  const parsedReference = parseReferenceQuery(reference);

  if (!parsedReference) {
    return null;
  }

  const searchPlan = getReferenceSearchPlan(
    {
      ...parsedReference,
      verse: parsedReference.verse
    },
    translation
  );
  const records = await allAsync<ScriptureRecord>(
    database,
    searchPlan.sql,
    searchPlan.params
  );

  if (records[0]) {
    return records[0];
  }

  return (
    (await getAsync<ScriptureRecord>(
      database,
      `
        SELECT
          id,
          bookFull,
          bookShort,
          chapter,
          verse,
          text,
          translation
        FROM scriptures
        WHERE translation = ?
          AND (
            LOWER(bookFull) = ?
            OR LOWER(bookShort) = ?
            OR LOWER(bookFull) LIKE ?
            OR LOWER(bookShort) LIKE ?
          )
          AND chapter = ?
        ORDER BY verse ASC, id ASC
        LIMIT 1;
      `,
      [
        translation,
        parsedReference.book.toLowerCase(),
        parsedReference.book.toLowerCase(),
        `${parsedReference.book.toLowerCase()}%`,
        `${parsedReference.book.toLowerCase()}%`,
        parsedReference.chapter
      ]
    )) ?? null
  );
}

async function getOrderedChapterList(
  database: SQLiteDatabase,
  translation: string
): Promise<Array<{ bookFull: string; chapter: number }>> {
  return allAsync<{ bookFull: string; chapter: number }>(
    database,
    `
      SELECT bookFull, chapter
      FROM scriptures
      WHERE translation = ?
      GROUP BY bookFull, chapter
      ORDER BY MIN(id) ASC;
    `,
    [translation]
  );
}

async function getBoundaryVerseRecord(
  database: SQLiteDatabase,
  translation: string,
  bookFull: string,
  chapter: number,
  direction: "PREVIOUS" | "NEXT"
): Promise<ScriptureRecord | null> {
  return (
    (await getAsync<ScriptureRecord>(
      database,
      `
        SELECT
          id,
          bookFull,
          bookShort,
          chapter,
          verse,
          text,
          translation
        FROM scriptures
        WHERE translation = ?
          AND bookFull = ?
          AND chapter = ?
        ORDER BY ${direction === "PREVIOUS" ? "verse DESC, id DESC" : "verse ASC, id ASC"}
        LIMIT 1;
      `,
      [translation, bookFull, chapter]
    )) ?? null
  );
}

async function getAdjacentChapterRecord(
  database: SQLiteDatabase,
  translation: string,
  currentRecord: ScriptureRecord,
  direction: "PREVIOUS_CHAPTER" | "NEXT_CHAPTER"
): Promise<ScriptureRecord | null> {
  const chapters = await getOrderedChapterList(database, translation);
  const currentIndex = chapters.findIndex(
    (chapter) =>
      chapter.bookFull === currentRecord.bookFull && chapter.chapter === currentRecord.chapter
  );

  if (currentIndex === -1) {
    return null;
  }

  const adjacentChapter =
    direction === "PREVIOUS_CHAPTER"
      ? chapters[currentIndex - 1]
      : chapters[currentIndex + 1];

  if (!adjacentChapter) {
    return null;
  }

  return getBoundaryVerseRecord(
    database,
    translation,
    adjacentChapter.bookFull,
    adjacentChapter.chapter,
    direction === "PREVIOUS_CHAPTER" ? "PREVIOUS" : "NEXT"
  );
}

export async function navigateScripture(
  reference: string,
  translation: string,
  direction: ScriptureNavigationDirection
): Promise<ScriptureRecord | null> {
  const normalizedTranslation = normalizeTranslation(translation);

  if (!normalizeWhitespace(reference) || !normalizedTranslation) {
    return null;
  }

  const database = await initializeDatabase();
  const currentRecord = await getCurrentReferenceRecord(
    database,
    reference,
    normalizedTranslation
  );

  if (!currentRecord) {
    return null;
  }

  if (direction === "PREVIOUS_VERSE" || direction === "NEXT_VERSE") {
    const adjacentVerse = await getAsync<ScriptureRecord>(
      database,
      `
        SELECT
          id,
          bookFull,
          bookShort,
          chapter,
          verse,
          text,
          translation
        FROM scriptures
        WHERE translation = ?
          AND bookFull = ?
          AND chapter = ?
          AND verse ${direction === "PREVIOUS_VERSE" ? "<" : ">"} ?
        ORDER BY verse ${direction === "PREVIOUS_VERSE" ? "DESC" : "ASC"}, id ${direction === "PREVIOUS_VERSE" ? "DESC" : "ASC"}
        LIMIT 1;
      `,
      [normalizedTranslation, currentRecord.bookFull, currentRecord.chapter, currentRecord.verse]
    );

    if (adjacentVerse) {
      return adjacentVerse;
    }

    return direction === "PREVIOUS_VERSE"
      ? getAdjacentChapterRecord(
          database,
          normalizedTranslation,
          currentRecord,
          "PREVIOUS_CHAPTER"
        )
      : getAdjacentChapterRecord(
          database,
          normalizedTranslation,
          currentRecord,
          "NEXT_CHAPTER"
        );
  }

  return getAdjacentChapterRecord(
    database,
    normalizedTranslation,
    currentRecord,
    direction
  );
}
