import { useState, useEffect } from "react";
import type { LyricRecord } from "../../shared/types";

interface LyricsEditorPaneProps {
  selectedLyric: LyricRecord | null;
  onSendToTheme: (text: string) => void;
  onSaveLyric: (lyric: LyricRecord) => void;
  onDeleteLyric: (id: string) => void;
}

export default function LyricsEditorPane({
  selectedLyric,
  onSendToTheme,
  onSaveLyric,
  onDeleteLyric,
}: LyricsEditorPaneProps) {
  const [linesPerCard, setLinesPerCard] = useState(() => {
    const saved = localStorage.getItem("lyrics_linesPerCard");
    return saved ? parseInt(saved, 10) : 4;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editLyrics, setEditLyrics] = useState("");
  const [cards, setCards] = useState<string[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleLinesChange = (val: number) => {
    setLinesPerCard(val);
    localStorage.setItem("lyrics_linesPerCard", val.toString());
  };

  const handleAddOpen = () => {
    setEditTitle("");
    setEditArtist("");
    setEditLyrics("");
    setIsAddingNew(true);
    setIsEditing(true);
  };

  const handleEditOpen = () => {
    if (!selectedLyric) return;
    setEditTitle(selectedLyric.title);
    setEditArtist(selectedLyric.artist);
    setEditLyrics(selectedLyric.lyrics);
    setIsAddingNew(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (!selectedLyric) return;
    if (confirm("Are you sure you want to delete this song?")) {
      onDeleteLyric(selectedLyric.id);
    }
  };

  const handleSave = () => {
    onSaveLyric({
      id: isAddingNew ? crypto.randomUUID() : (selectedLyric ? selectedLyric.id : crypto.randomUUID()),
      title: editTitle,
      artist: editArtist,
      lyrics: editLyrics,
    });
    setIsEditing(false);
    setIsAddingNew(false);
  };

  const generateCards = (text: string) => {
    if (!text) return [];
    const sections = text.split(/\n\s*\n/);
    const generated: string[] = [];
    for (const section of sections) {
      const allLines = section.split("\n").map((l) => l.trim()).filter((l) => l);
      
      const tags = allLines.filter(l => /^\[.*\]$/.test(l));
      const content = allLines.filter(l => !/^\[.*\]$/.test(l));
      const tagString = tags.length > 0 ? tags.join(" ") + "\n" : "";

      for (let i = 0; i < content.length; i += linesPerCard) {
        generated.push(tagString + content.slice(i, i + linesPerCard).join("\n"));
      }
    }
    return generated;
  };

  useEffect(() => {
    if (selectedLyric && !isEditing) {
      setCards(generateCards(selectedLyric.lyrics));
    } else if (!selectedLyric && !isEditing) {
      setCards([]);
    }
  }, [selectedLyric, linesPerCard, isEditing]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

    const newCards = [...cards];
    const [movedCard] = newCards.splice(sourceIndex, 1);
    newCards.splice(targetIndex, 0, movedCard);
    setCards(newCards);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCardClick = (cardText: string) => {
    const cleanedText = cardText.split('\n').filter(line => !/^\[.*\]$/.test(line.trim())).join('\n');
    onSendToTheme(cleanedText);
  };

  return (
    <div className="flex flex-col h-full bg-[#1b1b1e] text-[#bbcabf] font-mono text-[10px] relative">
      <div className="p-2 border-b border-[#3c4a42] bg-[#2a2a2d] flex justify-between items-center gap-2">
        <h2 className="font-bold text-[12px] text-[#e4e1e6] uppercase tracking-wider truncate flex-1 flex gap-2 items-center">
          <span className="truncate">{selectedLyric ? selectedLyric.title : "Lyrics Output"}</span>
          {selectedLyric && (
            <>
              <button onClick={handleEditOpen} className="bg-[#353438] px-2 py-0.5 rounded text-[9px] hover:bg-amber-500 hover:text-[#131316]">Edit</button>
              <button onClick={handleDelete} className="bg-[#ef4444] text-white px-2 py-0.5 rounded text-[9px] hover:bg-red-600">Del</button>
            </>
          )}
        </h2>
        <div className="flex gap-2 items-center shrink-0">
          <label className="flex items-center gap-1">
            <span>Lines:</span>
            <select
              value={linesPerCard}
              onChange={(e) => handleLinesChange(Number(e.target.value))}
              className="bg-[#131316] border border-[#3c4a42] px-1 text-[#e4e1e6] outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            onClick={handleAddOpen}
            className="bg-[#10b981] text-[#131316] w-6 h-6 flex items-center justify-center font-bold text-[12px] hover:bg-amber-500 transition rounded"
            title="Add New Song"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 grid gap-2 bg-[#131316] content-start" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {cards.map((cardText, idx) => {
          const lines = cardText.split('\n');
          const tagLines = lines.filter(l => /^\[.*\]$/.test(l.trim()));
          const contentLines = lines.filter(l => !/^\[.*\]$/.test(l.trim()));
          
          return (
            <div
              key={`${idx}-${cardText.substring(0, 5)}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragOver={handleDragOver}
              onClick={() => handleCardClick(cardText)}
              className="p-3 bg-[#2a2a2d] border border-[#3c4a42] rounded cursor-pointer hover:border-amber-500 transition text-center shadow active:scale-95 flex flex-col justify-center"
            >
              {tagLines.length > 0 && (
                <div className="text-amber-500 font-bold text-[9px] mb-1 opacity-80 uppercase tracking-wider">
                  {tagLines.join(" ")}
                </div>
              )}
              <div className="whitespace-pre-wrap text-[#e4e1e6] text-[11px] leading-relaxed">
                {contentLines.join('\n')}
              </div>
            </div>
          );
        })}
        {cards.length === 0 && !isEditing && (
          <div className="col-span-2 text-center text-[#8b9992] mt-4">
            No lyrics selected.
          </div>
        )}
      </div>

      {isEditing && (
        <div className="absolute inset-0 bg-[#1b1b1e] flex flex-col z-10 p-2">
          <h2 className="font-bold text-[12px] text-[#e4e1e6] uppercase tracking-wider mb-2">
            {isAddingNew ? "New Lyric" : "Edit Lyric"}
          </h2>
          <input
            type="text"
            placeholder="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-[#131316] border border-[#3c4a42] px-2 py-1 outline-none text-[#e4e1e6] mb-2"
          />
          <input
            type="text"
            placeholder="Artist"
            value={editArtist}
            onChange={(e) => setEditArtist(e.target.value)}
            className="w-full bg-[#131316] border border-[#3c4a42] px-2 py-1 outline-none text-[#e4e1e6] mb-2"
          />
          <textarea
            placeholder="Lyrics (Separate sections with a blank line. Use [Tags] for subtitles)"
            value={editLyrics}
            onChange={(e) => setEditLyrics(e.target.value)}
            className="w-full flex-1 bg-[#131316] border border-[#3c4a42] px-2 py-1 outline-none text-[#e4e1e6] mb-2 resize-none"
          />
          <div className="flex justify-end gap-2 mt-auto">
            <button
              onClick={() => setIsEditing(false)}
              className="bg-[#353438] px-3 py-1 hover:bg-[#3c4a42] rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-[#10b981] text-[#131316] font-bold px-3 py-1 hover:bg-amber-500 rounded"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
