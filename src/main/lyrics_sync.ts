import { app } from "electron";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getLyrics, saveLyric } from "./db";
import type { LyricRecord } from "../shared/types";

async function getAssetsDirectory(): Promise<string> {
  await app.whenReady();
  const assetsDirectory = path.join(app.getPath("userData"), "assets");
  await mkdir(assetsDirectory, { recursive: true });
  return assetsDirectory;
}

export async function getHblFilePath(): Promise<string> {
  const dir = await getAssetsDirectory();
  return path.join(dir, "lyrics_db.hbl");
}

export async function exportLyricsToHbl(): Promise<void> {
  try {
    const lyrics = await getLyrics();
    const hblPath = await getHblFilePath();
    await writeFile(hblPath, JSON.stringify(lyrics, null, 2), "utf8");
    console.log("Successfully exported lyrics to", hblPath);
  } catch (error) {
    console.error("Failed to export lyrics to .hbl:", error);
  }
}

export async function importLyricsFromHbl(): Promise<void> {
  try {
    const hblPath = await getHblFilePath();
    const data = await readFile(hblPath, "utf8");
    const lyrics: LyricRecord[] = JSON.parse(data);

    for (const lyric of lyrics) {
      await saveLyric(lyric);
    }
    console.log(`Successfully imported ${lyrics.length} lyrics from`, hblPath);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error("Failed to import lyrics from .hbl:", error);
    } else {
      console.log("No lyrics_db.hbl found to import.");
    }
  }
}

// Helper to trigger sync on DB updates
export async function syncLyricsDb(): Promise<void> {
  await exportLyricsToHbl();
}
