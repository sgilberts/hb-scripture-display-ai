import { useState, useEffect } from "react";
import type { LyricRecord, ScheduleRecord } from "../../shared/types";

interface LyricsPanelProps {
  onLyricSelect: (lyric: LyricRecord) => void;
  activeRail: string;
  refreshTrigger?: number;
}

export default function LyricsPanel({ onLyricSelect, activeRail, refreshTrigger = 0 }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricRecord[]>([]);
  const [scheduleItems, setScheduleItems] = useState<LyricRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLyrics = async () => {
    if (window.electron.getLyrics) {
      const data = await window.electron.getLyrics();
      setLyrics(data);
    }
  };

  useEffect(() => {
    if (activeRail === "LYR") {
      fetchLyrics();
    }
  }, [activeRail, refreshTrigger]);

  const filteredLyrics = lyrics.filter((l) =>
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.lyrics.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveSchedule = async () => {
    if (scheduleItems.length === 0) return;
    const data = JSON.stringify(scheduleItems, null, 2);
    if (window.electron.exportScheduleFile) {
      await window.electron.exportScheduleFile("New_Schedule", data);
    }
  };

  const handleLoadSchedule = async () => {
    if (window.electron.importScheduleFile) {
      const data = await window.electron.importScheduleFile();
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setScheduleItems(parsed);
        } catch (e) {
          console.error("Failed to parse schedule file");
        }
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

    const newItems = [...scheduleItems];
    const [movedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);
    setScheduleItems(newItems);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFromSchedule = (index: number) => {
    const newItems = [...scheduleItems];
    newItems.splice(index, 1);
    setScheduleItems(newItems);
  };

  return (
    <div className="flex flex-col h-full bg-[#1b1b1e] text-[#bbcabf] font-mono text-[10px]">
      <div className="p-2 border-b border-[#3c4a42] bg-[#2a2a2d]">
        <h2 className="font-bold text-[12px] text-[#e4e1e6] uppercase tracking-wider mb-2">Lyrics</h2>
        <input
          type="text"
          placeholder="Search Lyrics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#131316] border border-[#3c4a42] px-2 py-1 outline-none text-[#e4e1e6] mb-2"
        />
      </div>

      <div className="flex-1 overflow-y-auto border-b border-[#3c4a42]">
        {filteredLyrics.map((lyric) => (
          <div
            key={lyric.id}
            onClick={() => onLyricSelect(lyric)}
            onDoubleClick={() => setScheduleItems((prev) => [...prev, lyric])}
            className="p-2 border-b border-[#3c4a42] hover:bg-[#3c4a42] cursor-pointer flex justify-between items-center"
          >
            <div>
              <div className="font-bold text-[#e4e1e6]">{lyric.title}</div>
              <div className="text-[9px] text-[#8b9992]">{lyric.artist}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setScheduleItems((prev) => [...prev, lyric]);
              }}
              className="w-5 h-5 flex items-center justify-center border border-[#3c4a42] text-[#e4e1e6] hover:text-amber-500 rounded"
              title="Add to Schedule"
            >
              +
            </button>
          </div>
        ))}
      </div>

      <div className="p-2 bg-[#2a2a2d] border-b border-[#3c4a42] flex justify-between items-center">
        <h2 className="font-bold text-[11px] text-[#e4e1e6] uppercase tracking-wider">Schedule</h2>
        <div className="flex gap-1">
          <button onClick={handleSaveSchedule} className="bg-[#353438] px-2 py-1 hover:bg-[#3c4a42] rounded text-[9px]">Save .hbs</button>
          <button onClick={handleLoadSchedule} className="bg-[#353438] px-2 py-1 hover:bg-[#3c4a42] rounded text-[9px]">Load .hbs</button>
        </div>
      </div>

      <div className="h-[40%] overflow-y-auto bg-[#1b1b1e] p-2 space-y-1">
        {scheduleItems.length === 0 && (
          <div className="text-center text-[#8b9992] text-[9px] mt-4">
            Double-click a lyric to add to schedule
          </div>
        )}
        {scheduleItems.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragOver={handleDragOver}
            onClick={() => onLyricSelect(item)}
            className="p-2 border border-[#3c4a42] bg-[#2a2a2d] hover:border-amber-500 cursor-move flex justify-between items-center rounded shadow"
          >
            <div>
              <div className="font-bold text-[#e4e1e6] truncate w-32">{item.title}</div>
              <div className="text-[9px] text-[#8b9992] truncate w-32">{item.artist}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFromSchedule(index);
              }}
              className="text-[#ef4444] hover:text-[#ffb95f] px-1 font-bold text-[10px]"
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
