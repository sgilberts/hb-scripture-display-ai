const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/renderer/components/ControlPanel.tsx');

const lines = fs.readFileSync(targetFile, 'utf8').split('\n');

let returnIndex = -1;
for (let i = 700; i < lines.length; i++) {
    if (lines[i].includes('return (')) {
        returnIndex = i;
        break;
    }
}

if (returnIndex === -1) {
    console.error("Could not find 'return ('");
    process.exit(1);
}

const preReturn = lines.slice(0, returnIndex).join('\n');

const newStateLogic = `
  const [activeTab, setActiveTab] = useState<"SCRIPTURES" | "LYRICS" | "TIMER">("SCRIPTURES");
  const [productionTab, setProductionTab] = useState<"RECORD" | "STREAM" | "COUNTDOWN" | "TIME" | "STOPWATCH">("COUNTDOWN");
  const [stopwatchTimeMs, setStopwatchTimeMs] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [countdownTimeMs, setCountdownTimeMs] = useState(300000); // 5 mins in ms
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchTimeMs(prev => prev + 10);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountdownRunning) {
      interval = setInterval(() => {
        setCountdownTimeMs(prev => Math.max(0, prev - 10));
      }, 10);
    }
    return () => clearInterval(interval);
  }, [isCountdownRunning]);

  const formatTime = (ms: number, isCountdown = false) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const micro = Math.floor((ms % 1000) / 10);
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (isCountdown && hours > 0) {
        return \`\${pad(hours)}:\${pad(minutes)}:\${pad(seconds)}:\${pad(micro)}\`;
    }
    return \`\${pad(minutes)}:\${pad(seconds)}:\${pad(micro)}\`;
  };
`;

const newJsx = `
  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-[#131316] font-sans text-[#e4e1e6] text-[10px]">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-[#3c4a42] bg-[#131316] px-3">
        <div className="flex items-center gap-4 h-full">
          <h1 className="font-display-lg text-xl tracking-tight">
            <span className="font-bold text-white">Hallelujah</span>
            <span className="text-[#10b981]">Beamer</span>
          </h1>
          <nav className="flex h-full items-center gap-4 pt-1">
            {["Dashboard", "Monitors", "Patching", "Logs"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={joinClasses(
                  "h-full border-b-2 px-1 text-[10px] font-semibold transition",
                  index === 0
                    ? "border-[#4edea3] text-[#4edea3]"
                    : "border-transparent text-[#bbcabf] hover:text-[#e4e1e6]"
                )}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex h-full items-center gap-2">
          <button
            type="button"
            onClick={() => void handleGoLiveToggle()}
            className={joinClasses(
              "h-7 min-w-[6rem] border px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition active:scale-[0.99]",
              state.isLiveMode
                ? "border-[#4edea3] bg-[#4edea3] text-[#003824]"
                : "border-[#4edea3] bg-[#4edea3] text-[#003824] hover:brightness-110"
            )}
          >
            {state.isLiveMode ? "ON AIR" : "GO LIVE"}
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            className="grid h-7 w-7 place-items-center border border-transparent font-mono text-[9px] font-bold uppercase text-[#bbcabf] transition hover:border-[#3c4a42] hover:text-[#4edea3]"
          >
            SET
          </button>
          <button className="grid h-7 w-7 place-items-center border border-transparent font-mono text-[9px] font-bold uppercase text-[#bbcabf] transition hover:border-[#3c4a42] hover:text-[#4edea3]">ALT</button>
          <button className="grid h-7 w-7 place-items-center border border-transparent font-mono text-[9px] font-bold uppercase text-[#bbcabf] transition hover:border-[#3c4a42] hover:text-[#4edea3]">ID</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-12 shrink-0 flex-col border-r border-[#3c4a42] bg-[#1b1b1e]">
          <div className="flex flex-col items-center gap-1 border-b border-[#3c4a42] py-2">
            <div className="grid h-6 w-6 place-items-center rounded bg-[#353438] font-mono text-[9px] font-bold text-[#bbcabf]">CN</div>
            <div className="text-center font-mono text-[8px] leading-tight">
               <div>Control</div>
               <div>Node 01</div>
               <div className="text-[#4edea3] mt-0.5">Online</div>
            </div>
          </div>
          <nav className="flex flex-col items-center gap-1 py-2">
            {RAIL_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.label === "Settings" ? handleOpenSettings : undefined}
                className={joinClasses(
                  "flex w-10 flex-col items-center gap-1 border py-1.5 transition",
                  item.active
                    ? "border-[#10b981] bg-[#10b981] text-[#003824]"
                    : "border-transparent text-[#bbcabf] hover:border-[#3c4a42] hover:bg-[#2a2a2d]"
                )}
              >
                <span className="font-mono text-[9px] font-bold">{item.icon}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-px bg-[#3c4a42] p-px">
          <div className="flex min-h-0 shrink-0 gap-px h-[40%] max-h-[360px]">
            <section className="flex w-56 shrink-0 flex-col overflow-y-auto bg-[#1f1f22]">
               <div className="bg-[#2a2a2d] px-2 py-1.5 border-b border-[#3c4a42] shrink-0">
                 <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#e4e1e6]">Media Settings</h2>
               </div>
               <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                    <label className="block">
                        <span className="mb-1 block font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#bbcabf]">Audio Input</span>
                        <select
                            value={selectedAudioDeviceId}
                            onChange={(e) => handleAudioDeviceChange(e.target.value)}
                            className="h-7 w-full border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] text-[#e4e1e6] outline-none"
                        >
                            <option value="default">System Default</option>
                            {audioDevices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || \`Input \${i + 1}\`}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 flex justify-between font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#bbcabf]">
                            <span>Volume</span><span>{inputGain}%</span>
                        </span>
                        <input
                            className="h-1 w-full appearance-none rounded-full accent-[#4edea3]"
                            type="range" min={0} max={200} value={inputGain}
                            onChange={(e) => setInputGain(Number(e.target.value))}
                        />
                    </label>
                    <div>
                        <div className="mb-1 flex justify-between font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#bbcabf]">
                            <span>Level</span><span>{Math.round(inputLevelDb)}dB</span>
                        </div>
                        <div className="h-1 border border-[#3c4a42] bg-[#131316]"><div className="h-full bg-[#4edea3]" style={{ width: \`\${inputLevel}%\` }}/></div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleGoLiveToggle()}
                        className="flex h-7 w-full items-center justify-between border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] font-bold uppercase text-[#e4e1e6]"
                    >
                        <span>Go Live</span><StatusLed active={state.isLiveMode} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsAutoDisplayMode(!state.isAutoDisplayMode)}
                        className="flex h-7 w-full items-center justify-between border border-[#3c4a42] bg-[#131316] px-2 font-mono text-[9px] font-bold uppercase text-[#e4e1e6]"
                    >
                        <span>Auto-Display</span>
                        <span className={joinClasses("relative h-4 w-8 rounded-full", state.isAutoDisplayMode ? "bg-[#10b981]" : "bg-[#353438]")}>
                            <span className={joinClasses("absolute top-0.5 h-3 w-3 rounded-full bg-[#bbcabf] transition-transform", state.isAutoDisplayMode ? "left-4.5" : "left-0.5")}/>
                        </span>
                    </button>
                    <div className="grid grid-cols-2 gap-1">
                        <button onClick={() => setDisplayFormat("FULL")} className={joinClasses("h-7 border font-mono text-[8px] font-bold uppercase", state.displayFormat === "FULL" ? "border-[#10b981] text-[#4edea3] bg-[#10b981]/10" : "border-[#3c4a42] text-[#bbcabf]")}>FULL</button>
                        <button onClick={() => setDisplayFormat("LOWER_THIRD")} className={joinClasses("h-7 border font-mono text-[8px] font-bold uppercase", state.displayFormat === "LOWER_THIRD" ? "border-[#10b981] text-[#4edea3] bg-[#10b981]/10" : "border-[#3c4a42] text-[#bbcabf]")}>L-THIRD</button>
                    </div>
               </div>
            </section>
            
            <section className="flex min-w-0 flex-1 gap-px bg-[#3c4a42]">
                <div className="flex-1 bg-[#1f1f22] flex flex-col min-w-0">
                    <div className="flex justify-between items-center px-2 py-1 bg-[#1f1f22]">
                        <span className="font-mono text-[9px] font-bold uppercase text-[#bbcabf]">Preview</span>
                    </div>
                    <div className="flex-1 bg-black p-1 relative border border-[#3c4a42]">
                        <OutputCanvas compact indicatorLabel="PREVIEW" indicatorTone="preview" />
                    </div>
                </div>
                <div className="flex-1 bg-[#1f1f22] flex flex-col min-w-0">
                    <div className="flex justify-between items-center px-2 py-1 bg-[#1f1f22]">
                        <span className="font-mono text-[9px] font-bold uppercase text-[#ef4444]">Output</span>
                    </div>
                    <div className="flex-1 bg-black p-1 relative border-2 border-transparent">
                        <OutputCanvas compact indicatorLabel="LIVE" indicatorTone="live" />
                    </div>
                </div>
            </section>
            
            <section className="flex w-64 shrink-0 flex-col gap-px bg-[#3c4a42]">
               <div className="flex-1 bg-[#1f1f22] flex flex-col min-h-0">
                  <div className="bg-[#2a2a2d] px-2 py-1.5 border-b border-[#3c4a42] shrink-0">
                     <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#e4e1e6]">AI Semantic Parse</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                     {semanticMatches.map((match, i) => (
                         <div key={match.id} className={joinClasses("p-1.5 border", i === 0 ? "border-[#10b981] bg-[#10b981]/5" : "border-[#3c4a42] bg-[#131316]")} onClick={() => { if (match.record) displayScriptureRecord(match.record, "Semantic match selected"); }}>
                             <div className="flex justify-between items-center">
                                 <div className="font-mono text-[10px] font-bold text-[#e4e1e6] truncate">{match.reference}</div>
                                 <div className={joinClasses("px-1 py-0.5 text-[8px] font-mono", i === 0 ? "bg-[#10b981] text-[#003824]" : "bg-[#353438] text-[#bbcabf]")}>{match.score}%</div>
                             </div>
                             <div className="text-[9px] text-[#bbcabf] truncate mt-1">{match.text}</div>
                         </div>
                     ))}
                  </div>
               </div>
               <div className="flex-1 bg-[#1f1f22] flex flex-col min-h-0">
                  <div className="bg-[#2a2a2d] px-2 py-1.5 border-b border-[#3c4a42] shrink-0">
                     <h2 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#e4e1e6]">History Queue</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 font-mono text-[9px] text-[#bbcabf] space-y-1">
                     <div className="flex gap-2"><span>10:42:01</span><span>[SYSTEM] Init OK</span></div>
                     <div className="flex gap-2"><span>10:45:12</span><span className="text-[#4edea3]">[LIVE] {state.currentReferenceOutput || "Gen 1:1"}</span></div>
                  </div>
               </div>
            </section>
          </div>

          <div className="flex min-h-0 flex-1 gap-px">
            
            <section className="flex w-64 shrink-0 flex-col gap-px bg-[#3c4a42]">
                <div className="flex flex-col bg-[#1f1f22] p-2 gap-2 shrink-0">
                   <div className="flex items-center gap-2">
                       <div className="flex gap-1">
                           <div className="w-2 h-2 bg-[#ef4444]"></div>
                           <div className="w-2 h-2 bg-[#3b82f6]"></div>
                           <div className="w-2 h-2 bg-[#22c55e]"></div>
                           <div className="w-2 h-2 bg-[#eab308]"></div>
                       </div>
                       <input type="text" className="h-6 flex-1 bg-black border border-[#3c4a42] px-2 font-mono text-[9px] text-[#e4e1e6]" placeholder="Search inputs..." />
                   </div>
                   <div className="grid grid-cols-2 gap-1">
                       {[1,2,3,4].map(num => (
                           <div key={num} className="bg-black border border-[#3c4a42] flex flex-col">
                               <div className="flex justify-between items-center px-1 py-0.5 border-b border-[#3c4a42] bg-[#1f1f22]">
                                   <span className="font-mono text-[8px] text-[#4edea3]">{num} CAMERA {num}</span>
                               </div>
                               <div className="h-10"></div>
                               <div className="grid grid-cols-8 gap-px p-px bg-[#3c4a42]">
                                   {[1,2,3,4,5,6,7,8].map(i => (
                                       <button key={i} className="bg-[#1f1f22] h-4 font-mono text-[7px] text-[#bbcabf] hover:bg-[#353438] min-w-0 px-0.5 text-center flex items-center justify-center leading-none tracking-tighter">{i}</button>
                                   ))}
                               </div>
                               <div className="grid grid-cols-3 gap-px p-px bg-[#3c4a42]">
                                   <button className="bg-[#1f1f22] h-4 font-mono text-[7px] text-[#e4e1e6]">CUT</button>
                                   <button className="bg-[#1f1f22] h-4 font-mono text-[7px] text-[#e4e1e6]">FADE</button>
                                   <button className="bg-[#1f1f22] h-4 font-mono text-[7px] text-[#e4e1e6]">AUDIO</button>
                               </div>
                           </div>
                       ))}
                   </div>
                </div>

                <div className="flex flex-col bg-[#1f1f22] p-2 gap-2 shrink-0 border-y border-[#3c4a42]">
                   <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#bbcabf]">Bible Controls</div>
                   <div className="flex items-center gap-1">
                       <select 
                           value={state.currentBibleTranslation}
                           onChange={(e) => handleTranslationChange(e.target.value)}
                           className="h-7 flex-1 bg-black border border-[#3c4a42] px-2 font-mono text-[9px] text-[#e4e1e6] outline-none"
                       >
                           {availableTranslations.map((t) => <option key={t} value={t}>{t}</option>)}
                       </select>
                       <button onClick={() => void runSearch()} className="h-7 px-2 border border-[#10b981] bg-[#10b981]/10 text-[#4edea3] font-mono text-[9px] font-bold uppercase">SRCH</button>
                   </div>
                   <input
                       type="text"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       onKeyDown={handleSearchKeyDown}
                       placeholder="Search..."
                       className="h-7 w-full bg-black border border-[#3c4a42] px-2 font-mono text-[9px] text-[#e4e1e6] outline-none focus:border-[#4edea3]"
                   />
                   <div className="grid grid-cols-4 gap-1">
                       {[
                         ["<<", "PREVIOUS_CHAPTER"],
                         ["<", "PREVIOUS_VERSE"],
                         [">", "NEXT_VERSE"],
                         [">>", "NEXT_CHAPTER"]
                       ].map(([symbol, direction]) => (
                           <button 
                               key={symbol} 
                               onClick={() => void handleNavigateScripture(direction as ScriptureNavigationDirection)}
                               className="h-7 bg-[#1f1f22] border border-[#3c4a42] font-mono text-[10px] text-[#e4e1e6] hover:border-[#4edea3]"
                           >
                               {symbol}
                           </button>
                       ))}
                   </div>
                   <button 
                       onClick={() => setVerseHoldFlag(!state.verseHoldFlag)}
                       className={joinClasses("h-7 flex justify-between items-center px-2 border font-mono text-[9px] font-bold uppercase", state.verseHoldFlag ? "border-[#ee9800] text-[#ffb95f]" : "border-[#3c4a42] text-[#bbcabf]")}
                   >
                       <span>Verse Lock (V)</span>
                       <span className="border px-1 py-0.5 text-[7px] leading-none">{state.verseHoldFlag ? "LOCK" : "OPEN"}</span>
                   </button>
                </div>
            </section>

            <section className="flex flex-col bg-[#1f1f22] min-w-0 flex-1">
                <div className="flex border-b border-[#3c4a42]">
                    {["SCRIPTURES", "LYRICS", "TIMER"].map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab as any)}
                            className={joinClasses(
                                "px-4 h-8 font-mono text-[9px] font-bold uppercase transition",
                                activeTab === tab ? "text-[#4edea3] border-b-2 border-[#4edea3]" : "text-[#bbcabf] hover:bg-[#2a2a2d]"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="flex-1 p-2 overflow-y-auto">
                    {activeTab === "SCRIPTURES" && (
                        <div className="space-y-1">
                            {searchResults.length > 0 ? (
                                searchResults.map((result) => (
                                    <button
                                        key={result.id}
                                        onClick={() => displayScriptureRecord(result, "Manual selection")}
                                        className={joinClasses(
                                            "w-full flex items-center justify-between border px-2 py-1.5 transition",
                                            state.currentReferenceOutput === \`\${result.bookFull} \${result.chapter}:\${result.verse}\`
                                                ? "border-[#10b981] bg-[#10b981]/12 text-[#4edea3]"
                                                : "border-[#3c4a42] bg-[#131316] hover:border-[#4edea3]"
                                        )}
                                    >
                                        <div className="truncate text-left text-[9px]">
                                            <span className="font-bold">\${result.bookFull} \${result.chapter}:\${result.verse}</span> - \${result.text}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="text-[#bbcabf] text-[9px]">No scriptures found. Try searching above.</div>
                            )}
                        </div>
                    )}
                    {activeTab === "LYRICS" && (
                        <div className="text-[#bbcabf] text-[9px]">Lyrics list will appear here...</div>
                    )}
                    {activeTab === "TIMER" && (
                        <div className="text-[#bbcabf] text-[9px]">Timer list will appear here...</div>
                    )}
                </div>
            </section>

            <section className="flex w-[26rem] shrink-0 gap-px bg-[#3c4a42]">
                <div className="flex-1 bg-[#1f1f22] flex flex-col p-2">
                    <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#e4e1e6] mb-2">Output Monitor Matrix</h2>
                    <div className="grid grid-cols-2 gap-2 flex-1">
                        {availableOutputs.slice(0,4).map(out => (
                            <div key={out.id} className="border border-[#3c4a42] bg-black flex flex-col min-h-[60px]">
                                <div className="flex justify-between px-1.5 py-1 bg-[#1f1f22] border-b border-[#3c4a42]">
                                    <span className="font-mono text-[8px] text-[#e4e1e6] font-bold truncate">{out.label}</span>
                                    {state.selectedOutputIds.includes(out.id) && <span className="font-mono text-[8px] text-[#4edea3]">LIVE</span>}
                                </div>
                                <div className="flex-1 flex items-center justify-center text-[#bbcabf] text-[9px] font-mono">Preview</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-52 shrink-0 bg-[#1f1f22] flex flex-col p-2">
                    <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#e4e1e6] mb-2">Production Control</h2>
                    
                    <div className="grid grid-cols-2 gap-1 mb-2">
                        <button className="h-7 bg-[#ef4444] text-white font-mono text-[8px] font-bold flex items-center justify-center gap-1 rounded-[2px]"><span className="w-1.5 h-1.5 rounded-full bg-white"></span> RECORD</button>
                        <button className="h-7 bg-[#10b981] text-[#003824] font-mono text-[8px] font-bold rounded-[2px]">STREAM LIVE</button>
                    </div>

                    <div className="flex gap-1 mb-2">
                        {["Countdown", "Current Time", "Stopwatch"].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setProductionTab(tab.toUpperCase() as any)}
                                className={joinClasses(
                                    "flex-1 h-6 font-mono text-[7px] font-bold uppercase rounded-[2px] border",
                                    productionTab === tab.toUpperCase() ? "bg-[#4edea3] text-[#003824] border-[#4edea3]" : "bg-[#131316] text-[#bbcabf] border-[#3c4a42]"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="h-12 bg-black border border-[#3c4a42] flex items-center justify-center mb-2 font-mono text-xl text-[#4edea3]">
                        {productionTab === "COUNTDOWN" && (
                            <input 
                                type="text" 
                                value={formatTime(countdownTimeMs, true)}
                                onChange={() => {}}
                                className="bg-transparent text-center outline-none w-full"
                            />
                        )}
                        {productionTab === "TIME" && (
                            <span>{new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                        )}
                        {productionTab === "STOPWATCH" && (
                            <span>{formatTime(stopwatchTimeMs, false)}</span>
                        )}
                    </div>

                    <div className="bg-black border border-[#3c4a42] p-1.5 mb-2 flex-1 min-h-0 overflow-y-auto">
                        <div className="font-mono text-[7px] text-[#bbcabf] mb-1">TARGET SELECTION:</div>
                        <div className="grid grid-cols-2 gap-1">
                            {["HDMI 1", "OMT 1", "OMT 2", "NDI A", "USB", "Pastor"].map(target => (
                                <label key={target} className="flex items-center gap-1 font-mono text-[7px] text-[#e4e1e6] cursor-pointer">
                                    <input type="radio" name="target" className="accent-[#4edea3] w-2 h-2" />
                                    {target}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-1 mt-auto shrink-0">
                        <button 
                            onClick={() => {
                                if (productionTab === 'STOPWATCH') setIsStopwatchRunning(!isStopwatchRunning);
                                if (productionTab === 'COUNTDOWN') setIsCountdownRunning(!isCountdownRunning);
                            }}
                            className="flex-1 h-7 bg-[#1f1f22] border border-[#3c4a42] text-[#e4e1e6] font-mono text-[8px] font-bold hover:bg-[#353438]"
                        >
                            {(productionTab === 'STOPWATCH' && isStopwatchRunning) || (productionTab === 'COUNTDOWN' && isCountdownRunning) ? "PAUSE" : "START"}
                        </button>
                        <button 
                            onClick={() => {
                                if (productionTab === 'STOPWATCH') { setIsStopwatchRunning(false); setStopwatchTimeMs(0); }
                                if (productionTab === 'COUNTDOWN') { setIsCountdownRunning(false); setCountdownTimeMs(300000); }
                            }}
                            className="w-10 h-7 bg-[#93000a] border border-[#ffb4ab] text-[#ffdad6] font-mono text-[8px] font-bold hover:bg-[#b00012]"
                        >
                            STOP
                        </button>
                        <button 
                            onClick={() => void handleGoLiveToggle()}
                            className="w-12 h-7 bg-[#10b981]/20 border border-[#10b981] text-[#4edea3] font-mono text-[8px] font-bold hover:bg-[#10b981] hover:text-[#003824]"
                        >
                            LIVE
                        </button>
                    </div>
                </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
`;

fs.writeFileSync(targetFile, preReturn + '\n' + newStateLogic + newJsx);
console.log('Successfully patched ControlPanel.tsx');
