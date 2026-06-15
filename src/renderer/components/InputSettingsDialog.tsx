import React from 'react';
import { AppStateMatrix, InputSetting } from '../../shared/types';

export interface InputSettingsDialogProps {
    sid: number;
    settingsTab: string;
    setSettingsTab: (tab: string) => void;
    onClose: () => void;
    cameraInputs: any[];
    setCameraInputs: React.Dispatch<React.SetStateAction<any[]>>;
    inputSettings: Record<number, InputSetting>;
    updateInputSetting: (id: number, key: keyof InputSetting, value: any) => void;
    getInputSettings: (id: number) => InputSetting;
    cameraMultiviews: Record<number, Record<number, number>>;
    setCameraMultiviews: React.Dispatch<React.SetStateAction<Record<number, Record<number, number>>>>;
    activeMultiviewEditLayer: number | null;
    setActiveMultiviewEditLayer: (layer: number | null) => void;
    state: AppStateMatrix;
    patchState: (value: Partial<AppStateMatrix>) => void;
    computeAutoChromaSettings: (rgb: { r: number, g: number, b: number }) => any;
    hexToRgb: (hex: string) => { r: number, g: number, b: number } | null;
    renderInputMedia: (sid: number, fallbackThemeId: number) => React.ReactNode;
    videoDevices: MediaDeviceInfo[];
    cameraThemeMap: Record<number, string>;
    setCameraThemeMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ');
}

const SliderRow = ({
    label, keyName, value, min, max, step = 0.001, prefix, resetVal = 0, displayMultiplier = 1, displayDecimals = 3, sid, updateInputSetting
}: {
    label: string; keyName: string; value: number; min: number; max: number;
    step?: number; prefix?: React.ReactNode; resetVal?: number;
    displayMultiplier?: number; displayDecimals?: number;
    sid: number; updateInputSetting: (id: number, key: keyof InputSetting, value: any) => void;
}) => {
    const [draft, setDraft] = React.useState<string | null>(null);
    const displayVal = (value * displayMultiplier).toFixed(displayDecimals);
    return (
        <div className="flex items-center gap-1.5 mb-2.5">
            <span className="font-mono text-[9px] text-[#bbcabf] text-right shrink-0" style={{ width: 56 }}>{label}:</span>
            {prefix}
            <input
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={e => updateInputSetting(sid, keyName as keyof InputSetting, Number(e.target.value))}
                className="flex-1 h-1.5 bg-[#353438] rounded appearance-none cursor-pointer"
                style={{ minWidth: 0, accentColor: '#4edea3' }}
            />
            <input
                type="text"
                value={draft !== null ? draft : displayVal}
                onChange={e => setDraft(e.target.value)}
                onBlur={e => {
                    const parsed = Number(e.target.value) / displayMultiplier;
                    if (!isNaN(parsed)) updateInputSetting(sid, keyName as keyof InputSetting, Math.max(min, Math.min(max, parsed)));
                    setDraft(null);
                }}
                onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setDraft(null);
                }}
                className="bg-[#0d0d0f] border border-[#3c4a42] text-[#e4e1e6] font-mono text-[8px] h-6 px-1 text-right shrink-0"
                style={{ width: 68 }}
            />
            <button
                onClick={() => { updateInputSetting(sid, keyName as keyof InputSetting, resetVal); setDraft(null); }}
                className="font-mono text-[8px] h-6 px-2 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] shrink-0 transition-colors"
            >Reset</button>
        </div>
    );
};

const CropRow = ({ label, keyName, value, sid, updateInputSetting }: { label: string; keyName: string; value: number; sid: number; updateInputSetting: (id: number, key: keyof InputSetting, value: any) => void; }) => {
    const [draft, setDraft] = React.useState<string | null>(null);
    const displayVal = (value * 100).toFixed(1);
    return (
        <div className="flex items-center gap-1.5 mb-2.5">
            <span className="font-mono text-[9px] text-[#bbcabf] text-right shrink-0" style={{ width: 56 }}>{label}:</span>
            <input
                type="range" min={0} max={1} step={0.001}
                value={value}
                onChange={e => updateInputSetting(sid, keyName as keyof InputSetting, Number(e.target.value))}
                className="flex-1 h-1.5 bg-[#353438] rounded appearance-none cursor-pointer"
                style={{ minWidth: 0, accentColor: '#4edea3' }}
            />
            <span className="font-mono text-[8px] text-[#4edea3] shrink-0" style={{ width: 40, textAlign: 'right' }}>
                {draft !== null ? draft : displayVal + '%'}
            </span>
            <button
                onClick={() => updateInputSetting(sid, keyName as keyof InputSetting, 0)}
                className="font-mono text-[8px] h-6 px-2 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] shrink-0 transition-colors"
            >Reset</button>
        </div>
    );
};

export default function InputSettingsDialog({
    sid,
    settingsTab,
    setSettingsTab,
    onClose,
    cameraInputs,
    setCameraInputs,
    inputSettings,
    updateInputSetting,
    getInputSettings,
    cameraMultiviews,
    setCameraMultiviews,
    activeMultiviewEditLayer,
    setActiveMultiviewEditLayer,
    state,
    patchState,
    computeAutoChromaSettings,
    hexToRgb,
    renderInputMedia,
    videoDevices,
    cameraThemeMap,
    setCameraThemeMap
}: InputSettingsDialogProps) {
    const s = getInputSettings(sid);
    const camName = cameraInputs.find(c => c.id === sid)?.name || `INPUT ${sid}`;
    const currentType = s.type || cameraInputs.find(c => c.id === sid)?.type || "Camera";
    const tabs = ["General", "Colour Adjust", "Chroma Key", "MultiView", "Position", "Triggers", "Tally Light", "Advanced", "NDI / OMT / Desktop Capture"];
    if (currentType === "Image") tabs.splice(1, 0, "Image");
    if (currentType === "Video") tabs.splice(1, 0, "Video");
    const sliderClass = "w-full h-1.5 bg-[#353438] rounded accent-[#4edea3] appearance-none cursor-pointer";
    const labelClass = "font-mono text-[8px] text-[#bbcabf] uppercase tracking-wider";
    const fieldRowClass = "flex items-center gap-2 mb-2";
    const inputClass = "bg-black border border-[#3c4a42] text-[#e4e1e6] font-mono text-[8px] h-6 px-1.5 flex-1";
    const sectionTitle = "font-mono text-[9px] text-[#4edea3] font-bold uppercase tracking-wider mb-2 border-b border-[#3c4a42] pb-1";

    const joinClasses = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

    const handleSave = () => {
        setCameraInputs(prev => prev.map(c => {
            if (c.id === sid) {
                return { ...c, name: s.name || c.name, type: currentType, mediaPath: s.mediaPath || c.mediaPath };
            }
            return c;
        }));
        onClose();
    };

    const ColorBars = () => (
        <div className="w-full h-full flex flex-col pointer-events-none opacity-50">
            <div className="flex-1 flex">
                <div className="w-[14.28%] bg-[#c0c0c0]"></div>
                <div className="w-[14.28%] bg-[#c0c000]"></div>
                <div className="w-[14.28%] bg-[#00c0c0]"></div>
                <div className="w-[14.28%] bg-[#00c000]"></div>
                <div className="w-[14.28%] bg-[#c000c0]"></div>
                <div className="w-[14.28%] bg-[#c00000]"></div>
                <div className="w-[14.28%] bg-[#0000c0]"></div>
            </div>
            <div className="h-1/4 flex">
                <div className="w-[14.28%] bg-[#0000c0]"></div>
                <div className="w-[14.28%] bg-[#111111]"></div>
                <div className="w-[14.28%] bg-[#c000c0]"></div>
                <div className="w-[14.28%] bg-[#111111]"></div>
                <div className="w-[14.28%] bg-[#00c0c0]"></div>
                <div className="w-[14.28%] bg-[#111111]"></div>
                <div className="w-[14.28%] bg-[#c0c0c0]"></div>
            </div>
            <div className="h-1/4 flex">
                <div className="w-[14.28%] bg-[#00214c]"></div>
                <div className="w-[14.28%] bg-[#ffffff]"></div>
                <div className="w-[14.28%] bg-[#32006a]"></div>
                <div className="flex-1 bg-[#111111]"></div>
            </div>
        </div>
    );

    const NDITabContent = () => {
        return (
            <div className="flex flex-col h-full bg-[#131316] text-[#e4e1e6] w-full" onClick={(e) => e.stopPropagation()}>
                {/* Top Action Bar */}
                <div className="flex justify-between items-center p-2 pt-1 pb-1 border-b border-[#3c4a42]">
                    <div className="flex gap-1">
                        <button className="bg-[#10b981]/20 text-[#4edea3] px-8 py-1.5 text-[11px] font-bold border border-[#4edea3] transition-colors">Network</button>
                        <button className="bg-[#1f1f22] text-[#bbcabf] hover:text-[#e4e1e6] hover:bg-[#353438] px-6 py-1.5 text-[11px] font-bold border border-[#3c4a42] transition-colors">Local Desktop Capture</button>
                    </div>
                    <div className="flex gap-1 items-center">
                        <button className="bg-[#10b981]/20 text-[#4edea3] px-2 py-1 font-bold text-[12px] border border-[#4edea3]">NDI</button>
                        <button className="bg-[#10b981]/20 text-[#4edea3] px-2 py-1 font-bold text-[12px] border border-[#4edea3]">OMT</button>
                        <button className="bg-[#1f1f22] text-[#bbcabf] hover:text-[#e4e1e6] hover:bg-[#353438] w-7 h-6 flex items-center justify-center border border-[#3c4a42] ml-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>
                        </button>
                        <button className="bg-[#10b981]/20 text-[#4edea3] w-7 h-6 flex items-center justify-center border border-[#4edea3]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3zm0 7h18v2H3zm0 7h18v2H3z"/></svg>
                        </button>
                    </div>
                </div>

                {/* Logo Banner */}
                <div className="flex justify-between items-center px-4 py-2 bg-[#1f1f22] border-b border-[#3c4a42]">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="relative w-7 h-7 flex items-center justify-center">
                                <div className="absolute inset-0 rounded-full border-[3px] border-[#3c4a42] border-t-[#4edea3] border-r-[#4edea3] animate-spin"></div>
                            </div>
                            <span className="text-[22px] font-bold text-[#4edea3] tracking-tight">OMT</span>
                            <span className="text-[18px] font-semibold tracking-tight text-[#e4e1e6]">Open Media Transport</span>
                        </div>
                        <a href="https://omt.video" target="_blank" rel="noreferrer" className="text-[#bbcabf] hover:text-[#4edea3] underline text-[10px] ml-2 transition-colors">https://omt.video</a>
                    </div>
                    <div className="flex items-center gap-6 pr-4">
                        <span className="text-[32px] font-bold tracking-tighter leading-none relative text-[#e4e1e6]">NDI<span className="text-[10px] absolute -right-2.5 top-0 font-normal">®</span></span>
                        <a href="https://ndi.video" target="_blank" rel="noreferrer" className="text-[#bbcabf] hover:text-[#4edea3] underline text-[10px] transition-colors">https://ndi.video</a>
                    </div>
                </div>

                {/* Grid Area */}
                <div className="flex-1 bg-[#131316] px-2 py-3 overflow-y-auto border-b border-[#3c4a42]">
                    
                    {/* vMix Group */}
                    <div className="relative mb-6">
                        <div className="absolute -top-1 left-2 text-[9px] text-[#bbcabf] bg-[#131316] px-1 z-10 uppercase">vMix</div>
                        <div className="border-t border-[#3c4a42] mt-0.5 pt-3 grid grid-cols-4 gap-3 px-1">
                            {[1, 2, 3, 4].map(num => (
                                <div key={`vmix-${num}`} className="flex flex-col items-center">
                                    <div className="w-full aspect-video bg-[#0d0d0f] relative border border-[#3c4a42] shadow-sm flex items-center justify-center overflow-hidden hover:border-[#4edea3] transition-colors cursor-pointer">
                                        <ColorBars />
                                        <div className="absolute bottom-0 left-0 bg-[#1f1f22] text-[#4edea3] text-[9px] font-bold px-1.5 py-0.5 z-10 border-t border-r border-[#3c4a42]">{num % 2 === 0 ? 'NDI' : 'OMT'}</div>
                                    </div>
                                    <span className="text-[10px] mt-1 text-[#bbcabf] font-mono">vMix - Output {num}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Channel Group */}
                    <div className="relative mb-2 mt-4">
                        <div className="absolute -top-1 left-2 text-[9px] text-[#bbcabf] bg-[#131316] px-1 z-10 uppercase">LUMI-12345000</div>
                        <div className="border-t border-[#3c4a42] mt-0.5 pt-3 grid grid-cols-4 gap-3 px-1">
                            <div className="flex flex-col items-center">
                                <div className="w-full aspect-video bg-[#0d0d0f] relative border border-[#3c4a42] shadow-sm flex items-center justify-center overflow-hidden hover:border-[#4edea3] transition-colors cursor-pointer">
                                    {/* Dark scene placeholder */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1f] to-[#0a0a0c]"></div>
                                    <div className="absolute bottom-1/4 w-1/4 h-1/4 bg-[#2a2a2f] rounded"></div>
                                    <div className="absolute bottom-0 left-0 bg-[#1f1f22] text-[#4edea3] text-[9px] font-bold px-1.5 py-0.5 z-10 border-t border-r border-[#3c4a42]">NDI</div>
                                </div>
                                <span className="text-[10px] mt-1 text-[#bbcabf] font-mono">Channel 1</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Options */}
                <div className="p-1 px-4 flex items-center gap-6 text-[10px] bg-[#1f1f22] h-8 shrink-0 text-[#bbcabf]">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#e4e1e6] transition-colors"><input type="checkbox" className="w-3 h-3 accent-[#4edea3]" /> Low Bandwidth Mode</label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#e4e1e6] transition-colors"><input type="checkbox" className="w-3 h-3 accent-[#4edea3]" /> Audio Only</label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#e4e1e6] transition-colors"><input type="checkbox" className="w-3 h-3 accent-[#4edea3]" /> PsF</label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#e4e1e6] transition-colors"><input type="checkbox" className="w-3 h-3 accent-[#4edea3]" /> Increase Buffer Size</label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#e4e1e6] transition-colors"><input type="checkbox" className="w-3 h-3 accent-[#4edea3]" /> FEIM</label>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="w-[816px] h-[624px] bg-[#1f1f22] border border-[#3c4a42] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Title bar */}
                <div className="flex justify-between items-center bg-[#2a2a2d] px-3 py-2 border-b border-[#3c4a42]">
                    <h3 className="font-mono text-[10px] text-white font-bold tracking-widest uppercase">Input Settings — {camName}</h3>
                    <button onClick={onClose} className="text-[#bbcabf] hover:text-white text-[14px] leading-none w-5 h-5 flex items-center justify-center">×</button>
                </div>
                <div className="flex flex-1 min-h-0">
                    {/* Sidebar Tabs */}
                    <div className="w-36 bg-[#131316] border-r border-[#3c4a42] flex flex-col p-1 gap-0.5 overflow-y-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSettingsTab(tab)}
                                className={joinClasses(
                                    "font-mono text-[8px] py-1.5 px-2 text-left border-l-2 transition-colors",
                                    settingsTab === tab
                                        ? "bg-[#1f1f22] text-[#e4e1e6] border-[#4edea3] font-bold"
                                        : "bg-transparent text-[#bbcabf] border-transparent hover:bg-[#1f1f22] hover:text-[#e4e1e6]"
                                )}
                            >{tab}</button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className={joinClasses("flex-1 min-h-0", (settingsTab === "NDI / OMT / Desktop Capture" || settingsTab === "Position" || settingsTab === "MultiView") ? "overflow-hidden" : "overflow-y-auto p-3 bg-[#131316]")} style={(settingsTab === "Position" || settingsTab === "MultiView") ? { background: "#131316", display: "flex", flexDirection: "column" } : undefined}>

                        {settingsTab === "NDI / OMT / Desktop Capture" && <NDITabContent />}

                        {/* ========== GENERAL ========== */}
                        {settingsTab === "General" && (
                            <div>
                                <div className={sectionTitle}>Input Properties</div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Name</label>
                                    <input className={inputClass} value={s.name || cameraInputs.find(c => c.id === sid)?.name || ""} onChange={e => updateInputSetting(sid, 'name', e.target.value)} />
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Type</label>
                                    <select className={inputClass} value={s.type || cameraInputs.find(c => c.id === sid)?.type || "Camera"} onChange={e => updateInputSetting(sid, 'type', e.target.value)}>
                                        <option>Camera</option>
                                        <option>NDI</option>
                                        <option>Video</option>
                                        <option>Image</option>
                                        <option>Audio</option>
                                        <option>Scripture</option>
                                        <option>Virtual Set</option>
                                    </select>
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Format</label>
                                    <span className="font-mono text-[8px] text-[#e4e1e6]">1920×1080p 60fps</span>
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>{currentType === "Camera" ? "Device" : "Theme"}</label>
                                    {currentType === "Camera" ? (
                                        <select 
                                            className={inputClass} 
                                            value={s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath || ""} 
                                            onChange={e => {
                                                updateInputSetting(sid, 'mediaPath', e.target.value);
                                                setCameraInputs(prev => prev.map(c => c.id === sid ? { ...c, mediaPath: e.target.value } : c));
                                            }}
                                        >
                                            <option value="">Select Camera...</option>
                                            {videoDevices.map((device: any) => (
                                                <option key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select 
                                            className={inputClass} 
                                            value={cameraThemeMap[sid] || ""} 
                                            onChange={e => setCameraThemeMap(prev => ({ ...prev, [sid]: e.target.value }))}
                                        >
                                            <option value="">Default (App Settings)</option>
                                            <optgroup label="Scriptures">
                                                {(state.customThemes || [])
                                                    .filter((t: any) => t.tabType === "SCRIPTURES" && t.id === (state as any).defaultThemeId_SCRIPTURES)
                                                    .map((t: any) => (
                                                    <option key={t.id} value={t.id}>{t.name} (Default)</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Lyrics">
                                                {(state.customThemes || [])
                                                    .filter((t: any) => t.tabType === "LYRICS" && t.id === (state as any).defaultThemeId_LYRICS)
                                                    .map((t: any) => (
                                                    <option key={t.id} value={t.id}>{t.name} (Default)</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Timer">
                                                {(state.customThemes || [])
                                                    .filter((t: any) => t.tabType === "TIMER" && t.id === (state as any).defaultThemeId_TIMER)
                                                    .map((t: any) => (
                                                    <option key={t.id} value={t.id}>{t.name} (Default)</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    )}
                                </div>

                                <div className={`${sectionTitle} mt-4`}>Audio</div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Volume</label>
                                    <input type="range" min="0" max="100" value={s.volume} onChange={e => updateInputSetting(sid, 'volume', Number(e.target.value))} className={sliderClass} />
                                    <span className="font-mono text-[8px] text-[#e4e1e6] w-8 text-right">{s.volume}%</span>
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Solo / Mute</label>
                                    <div className="flex gap-4 items-center">
                                        <label className="flex items-center gap-1 font-mono text-[9px] text-[#9ca3af]">
                                          <input type="checkbox" className="accent-[#4edea3] w-3 h-3" checked={s.solo} onChange={e => updateInputSetting(sid, 'solo', e.target.checked)} />
                                          Solo
                                        </label>
                                        <label className="flex items-center gap-1 font-mono text-[9px] text-[#9ca3af]">
                                          <input type="checkbox" className="accent-[#ef4444] w-3 h-3" checked={s.muted} onChange={e => updateInputSetting(sid, 'muted', e.target.checked)} />
                                          Mute
                                        </label>
                                    </div>
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Audio Bus</label>
                                    <div className="flex gap-1">
                                        {["M", "A", "B", "C", "D", "E", "F", "G"].map(bus => (
                                            <button key={bus} className="bg-[#1f1f22] text-[#bbcabf] border border-[#3c4a42] w-5 h-5 font-mono text-[7px] hover:bg-[#353438]">{bus}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className={`${sectionTitle} mt-4`}>Deinterlace</div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>Mode</label>
                                    <select className={inputClass} value={s.deinterlace} onChange={e => updateInputSetting(sid, 'deinterlace', e.target.value)}>
                                        <option>None</option><option>Blend</option><option>Bob</option><option>Discard</option><option>Yadif</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* ========== MEDIA TABS ========== */}
                        {settingsTab === "Image" && (
                            <div>
                                <div className={sectionTitle}>Image Source</div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>File</label>
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0] as File & { path?: string };
                                            if (file) {
                                                const nativePath = file.path;
                                                let url: string;
                                                if (nativePath && (window as any).electron?.importCanvasMedia) {
                                                    const result = await (window as any).electron.importCanvasMedia(nativePath);
                                                    url = `file://${result.path.replace(/\\/g, '/').replace(/ /g, '%20')}`;
                                                } else {
                                                    url = nativePath ? `file://${nativePath.replace(/\\/g, '/').replace(/ /g, '%20')}` : URL.createObjectURL(file);
                                                }
                                                updateInputSetting(sid, 'mediaPath', url);
                                                updateInputSetting(sid, 'type', 'Image');
                                                setCameraInputs(prev => prev.map(c => c.id === sid ? { ...c, type: 'Image', mediaPath: url } : c));
                                            }
                                            e.target.value = "";
                                        }} 
                                        className="text-[#e4e1e6] font-mono text-[8px] flex-1 cursor-pointer" 
                                    />
                                </div>
                                <div className="text-[8px] text-[#bbcabf] font-mono mb-2 truncate px-1">
                                    {(s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath) ? 
                                        `Selected: ${decodeURIComponent((s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath || "").replace("file://", ""))}` : 
                                        "No image selected"}
                                </div>
                                {(s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath) && (
                                    <div className="mt-2 border border-[#3c4a42] p-1 bg-black">
                                        <img src={s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath} className="w-full h-auto max-h-48 object-contain" />
                                    </div>
                                )}
                            </div>
                        )}

                        {settingsTab === "Video" && (
                            <div>
                                <div className={sectionTitle}>Video Source</div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-16`}>File</label>
                                    <input 
                                        type="file" 
                                        accept="video/*"
                                        onChange={e => {
                                        const file = e.target.files?.[0] as File & { path?: string };
                                        if (file) {
                                            const url = file.path ? `file://${file.path.replace(/\\/g, '/').replace(/ /g, '%20')}` : URL.createObjectURL(file);
                                            updateInputSetting(sid, 'mediaPath', url);
                                            updateInputSetting(sid, 'type', 'Video');
                                            setCameraInputs(prev => prev.map(c => c.id === sid ? { ...c, type: 'Video', mediaPath: url } : c));
                                            patchState({
                                                videoPlaybackState: {
                                                    ...(state.videoPlaybackState || {}),
                                                    [sid]: false
                                                }
                                            });
                                        }
                                    }} 
                                    className="text-[#e4e1e6] font-mono text-[8px] flex-1 cursor-pointer" 
                                />
                                </div>
                                <div className="text-[8px] text-[#bbcabf] font-mono mb-2 truncate px-1">
                                    {(s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath) ? 
                                        `Selected: ${decodeURIComponent((s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath || "").replace("file://", ""))}` : 
                                        "No video selected"}
                                </div>
                                {(s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath) && (
                                    <div className="mt-2 border border-[#3c4a42] p-1 bg-black">
                                        <video src={s.mediaPath || cameraInputs.find(c => c.id === sid)?.mediaPath} className="w-full h-auto max-h-48 object-contain" controls />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ========== COLOUR ADJUST ========== */}
                        {settingsTab === "Colour Adjust" && (
                            <div>
                                <div className={sectionTitle}>Colour Correction</div>
                                {[
                                    { label: "Brightness", key: "brightness", min: -100, max: 100, val: s.brightness },
                                    { label: "Contrast", key: "contrast", min: -100, max: 100, val: s.contrast },
                                    { label: "Saturation", key: "saturation", min: -100, max: 100, val: s.saturation },
                                    { label: "Hue", key: "hue", min: -180, max: 180, val: s.hue },
                                    { label: "Gamma", key: "gamma", min: 0, max: 4, val: s.gamma },
                                ].map(param => (
                                    <div key={param.key} className={fieldRowClass}>
                                        <label className={`${labelClass} w-20`}>{param.label}</label>
                                        <input type="range" min={param.min} max={param.max} step={param.key === 'gamma' ? 0.1 : 1} value={param.val} onChange={e => updateInputSetting(sid, param.key as any, Number(e.target.value))} className={sliderClass} />
                                        <span className="font-mono text-[8px] text-[#e4e1e6] w-10 text-right">{param.val}</span>
                                    </div>
                                ))}

                                <div className={`${sectionTitle} mt-4`}>Lift / Gamma / Gain</div>
                                <div className="grid grid-cols-3 gap-3">
                                    {["Lift", "Gamma", "Gain"].map(label => (
                                        <div key={label} className="flex flex-col items-center">
                                            <div className="w-14 h-14 rounded-full border-2 border-[#3c4a42] bg-[#1f1f22] flex items-center justify-center mb-1">
                                                <div className="w-2 h-2 rounded-full bg-[#e4e1e6]"></div>
                                            </div>
                                            <span className={labelClass}>{label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => { updateInputSetting(sid, 'brightness', 0); updateInputSetting(sid, 'contrast', 0); updateInputSetting(sid, 'saturation', 0); updateInputSetting(sid, 'hue', 0); updateInputSetting(sid, 'gamma', 1); }} className="bg-[#353438] text-[#e4e1e6] h-6 px-3 font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Reset All</button>
                                </div>
                            </div>
                        )}

                        {/* ========== CHROMA KEY ========== */}
                        {settingsTab === "Chroma Key" && (
                            <div className="space-y-4 pt-1">
                                {/* Top Row */}
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" className="w-3 h-3 accent-[#4edea3]" checked={s.chromaEnabled} onChange={e => updateInputSetting(sid, 'chromaEnabled', e.target.checked)} />
                                        <span className={`${labelClass}`}>Colour Key</span>
                                    </label>
                                    <div className="relative">
                                        <div className="w-6 h-6 border border-gray-600 pointer-events-none" style={{ backgroundColor: s.chromaColor }}></div>
                                        <input type="color" value={s.chromaColor} onChange={e => updateInputSetting(sid, 'chromaColor', e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            if ((window as any).EyeDropper) {
                                                try {
                                                    const dropper = new (window as any).EyeDropper();
                                                    const result = await dropper.open();
                                                    updateInputSetting(sid, 'chromaColor', result.sRGBHex);
                                                    const autoSettings = computeAutoChromaSettings(hexToRgb(result.sRGBHex));
                                                    updateInputSetting(sid, 'chromaEnabled', true);
                                                    updateInputSetting(sid, 'chromaKey', autoSettings.chromaKey);
                                                    updateInputSetting(sid, 'chromaKeyFilterEnabled', autoSettings.chromaKeyFilterEnabled);
                                                    updateInputSetting(sid, 'chromaKeyFilter', autoSettings.chromaKeyFilter);
                                                    updateInputSetting(sid, 'chromaRed', autoSettings.red);
                                                    updateInputSetting(sid, 'chromaGreen', autoSettings.green);
                                                    updateInputSetting(sid, 'chromaBlue', autoSettings.blue);
                                                } catch (e) {
                                                    console.log("Eye dropper cancelled or failed", e);
                                                }
                                            }
                                        }}
                                        className="bg-[#353438] w-6 h-6 flex items-center justify-center border border-[#3c4a42] hover:bg-[#2a2a2d]" 
                                        title="Eye Dropper"
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2l4 4-10 10H4v-4L14 2z"></path><path d="M14 2l4 4"></path></svg>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const autoSettings = computeAutoChromaSettings(hexToRgb(s.chromaColor));
                                            updateInputSetting(sid, 'chromaEnabled', true);
                                            updateInputSetting(sid, 'chromaKey', autoSettings.chromaKey);
                                            updateInputSetting(sid, 'chromaKeyFilterEnabled', autoSettings.chromaKeyFilterEnabled);
                                            updateInputSetting(sid, 'chromaKeyFilter', autoSettings.chromaKeyFilter);
                                            updateInputSetting(sid, 'chromaRed', autoSettings.red);
                                            updateInputSetting(sid, 'chromaGreen', autoSettings.green);
                                            updateInputSetting(sid, 'chromaBlue', autoSettings.blue);
                                        }}
                                        className="bg-[#353438] w-6 h-6 flex items-center justify-center border border-[#3c4a42] hover:bg-[#2a2a2d]" 
                                        title="Auto Key"
                                    >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"></circle><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"></circle><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"></circle><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"></circle></svg>
                                    </button>
                                </div>

                                {/* Middle Box */}
                                <div className="border border-[#3c4a42] p-4 bg-[#1f1f22]">
                                    <div className="flex gap-6">
                                        {/* Left Column */}
                                        <div className="flex-1 space-y-4">
                                            {/* Chroma Key */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-28 text-right">
                                                    <span className={labelClass}>Chroma Key</span>
                                                </div>
                                                <input type="range" min="0" max="100" value={s.chromaKey} onChange={e => updateInputSetting(sid, 'chromaKey', Number(e.target.value))} className="flex-1 accent-[#3b82f6] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3b82f6]" />
                                            </div>
                                            
                                            {/* Chroma Key Filter */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-28 flex items-center justify-end gap-1.5">
                                                    <input type="checkbox" className="w-3 h-3 accent-[#4edea3]" checked={s.chromaKeyFilterEnabled} onChange={e => updateInputSetting(sid, 'chromaKeyFilterEnabled', e.target.checked)} />
                                                    <span className={labelClass}>Chroma Key Filter</span>
                                                </div>
                                                <input type="range" min="0" max="100" value={s.chromaKeyFilter} onChange={e => updateInputSetting(sid, 'chromaKeyFilter', Number(e.target.value))} className="flex-1 accent-[#3b82f6] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3b82f6]" />
                                            </div>

                                            {/* Anti Aliasing */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-28 flex items-center justify-end gap-1.5">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-3 h-3 accent-[#4edea3]" 
                                                        checked={s.chromaAntiAliasing !== "Off"}
                                                        onChange={e => updateInputSetting(sid, 'chromaAntiAliasing', e.target.checked ? "Low" : "Off")} 
                                                    />
                                                    <span className={labelClass}>Anti Aliasing</span>
                                                </div>
                                                <select value={s.chromaAntiAliasing} onChange={e => updateInputSetting(sid, 'chromaAntiAliasing', e.target.value)} className={`${inputClass} w-24 bg-[#2a2a2d]`}>
                                                    <option value="Off">Off</option>
                                                    <option value="Low">Low</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="High">High</option>
                                                </select>
                                            </div>

                                            {/* Presets */}
                                            <div className="flex items-center gap-3 pt-2">
                                                <span className={labelClass}>Auto Chroma Key Presets</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => { updateInputSetting(sid, 'chromaEnabled', true); updateInputSetting(sid, 'chromaKey', 40); updateInputSetting(sid, 'chromaKeyFilterEnabled', false); updateInputSetting(sid, 'chromaRed', -50); updateInputSetting(sid, 'chromaGreen', 0); updateInputSetting(sid, 'chromaBlue', 0); }} className="bg-[#2a2a2d] text-[#e4e1e6] w-6 h-5 font-mono text-[9px] border border-[#3c4a42] hover:bg-[#353438]">1</button>
                                                    <button onClick={() => { updateInputSetting(sid, 'chromaEnabled', true); updateInputSetting(sid, 'chromaKey', 60); updateInputSetting(sid, 'chromaKeyFilterEnabled', true); updateInputSetting(sid, 'chromaKeyFilter', 20); updateInputSetting(sid, 'chromaRed', -60); updateInputSetting(sid, 'chromaGreen', -10); updateInputSetting(sid, 'chromaBlue', 0); }} className="bg-[#2a2a2d] text-[#e4e1e6] w-6 h-5 font-mono text-[9px] border border-[#3c4a42] hover:bg-[#353438]">2</button>
                                                    <button onClick={() => { updateInputSetting(sid, 'chromaEnabled', true); updateInputSetting(sid, 'chromaKey', 80); updateInputSetting(sid, 'chromaKeyFilterEnabled', true); updateInputSetting(sid, 'chromaKeyFilter', 40); updateInputSetting(sid, 'chromaRed', -70); updateInputSetting(sid, 'chromaGreen', -20); updateInputSetting(sid, 'chromaBlue', -10); }} className="bg-[#2a2a2d] text-[#e4e1e6] w-6 h-5 font-mono text-[9px] border border-[#3c4a42] hover:bg-[#353438]">3</button>
                                                </div>
                                                <button onClick={() => { updateInputSetting(sid, 'chromaKey', 0); updateInputSetting(sid, 'chromaKeyFilterEnabled', false); updateInputSetting(sid, 'chromaKeyFilter', 0); updateInputSetting(sid, 'chromaRed', 0); updateInputSetting(sid, 'chromaGreen', 0); updateInputSetting(sid, 'chromaBlue', 0); }} className="bg-[#2a2a2d] text-[#e4e1e6] h-5 px-4 ml-6 font-mono text-[9px] border border-[#3c4a42] hover:bg-[#353438]">Reset</button>
                                            </div>
                                        </div>

                                        {/* Right Column (RGB Sliders) */}
                                        <div className="w-56 space-y-4 pt-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`${labelClass} text-red-500 font-bold w-8 text-right`}>Red</span>
                                                <input type="range" min="-100" max="100" value={s.chromaRed} onChange={e => updateInputSetting(sid, 'chromaRed', Number(e.target.value))} className="flex-1 accent-[#3b82f6] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3b82f6]" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`${labelClass} text-green-500 font-bold w-8 text-right`}>Green</span>
                                                <input type="range" min="-100" max="100" value={s.chromaGreen} onChange={e => updateInputSetting(sid, 'chromaGreen', Number(e.target.value))} className="flex-1 accent-[#3b82f6] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3b82f6]" />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`${labelClass} text-blue-500 font-bold w-8 text-right`}>Blue</span>
                                                <input type="range" min="-100" max="100" value={s.chromaBlue} onChange={e => updateInputSetting(sid, 'chromaBlue', Number(e.target.value))} className="flex-1 accent-[#3b82f6] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3b82f6]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Box */}
                                <div className="border border-[#3c4a42] p-4 bg-[#1f1f22] space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-28 text-right">
                                            <span className={labelClass}>Luma Key</span>
                                        </div>
                                        <input type="range" min="0" max="100" value={s.lumaKey} onChange={e => updateInputSetting(sid, 'lumaKey', Number(e.target.value))} className="w-1/2 accent-[#3b82f6] h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3b82f6]" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-28 text-right">
                                            <span className={labelClass}>Key/Fill Input</span>
                                        </div>
                                        <select value={s.keyFillInputId} onChange={e => updateInputSetting(sid, 'keyFillInputId', e.target.value)} className={`${inputClass} w-48 bg-[#2a2a2d]`}>
                                            <option value="None">None</option>
                                            {cameraInputs.filter(c => c.id !== sid).map(c => (
                                                <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                {/* Realtime Preview Screen */}
                                <div className="border border-[#3c4a42] p-2 bg-[#1f1f22] space-y-2 mt-4">
                                    <div className="font-mono text-[9px] text-[#e4e1e6] font-bold">Realtime Preview</div>
                                    <div className="relative w-full aspect-[16/9] bg-black overflow-hidden border border-[#3c4a42]">
                                        {(() => {
                                            return renderInputMedia(sid, 0);
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========== MULTIVIEW ========== */}
                        {settingsTab === "MultiView" && (
                            <div className="flex flex-col h-full bg-[#131316]" style={{ minHeight: 0 }}>
                                {/* Main body: layers + templates */}
                                <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

                                    {/* Left: Layers 1-10 */}
                                    <div className="flex flex-col overflow-y-auto border-r border-[#3c4a42] bg-[#0f0f11] shrink-0" style={{ width: 220 }}>
                                        {[1,2,3,4,5,6,7,8,9,10].map(layerNum => {
                                            const layerInputId = cameraMultiviews[sid]?.[layerNum];
                                            const isEditing = activeMultiviewEditLayer === layerNum;
                                            return (
                                                <div key={layerNum} className={joinClasses(
                                                    "flex items-center gap-1 px-1.5 py-1 border-b border-[#3c4a42] shrink-0",
                                                    isEditing ? "bg-[#162a20]" : "bg-[#0f0f11] hover:bg-[#1a1a1f]"
                                                )}>
                                                    <span className="font-mono text-[9px] text-[#bbcabf] w-5 text-right shrink-0 select-none">{layerNum}</span>
                                                    <input
                                                        type="checkbox"
                                                        className="accent-[#4edea3] w-3 h-3 shrink-0 cursor-pointer"
                                                        checked={layerInputId !== undefined}
                                                        onChange={e => {
                                                            if (!e.target.checked) {
                                                                setCameraMultiviews(prev => {
                                                                    const newObj = { ...(prev[sid] || {}) };
                                                                    delete newObj[layerNum];
                                                                    return { ...prev, [sid]: newObj };
                                                                });
                                                                if (activeMultiviewEditLayer === layerNum) setActiveMultiviewEditLayer(null);
                                                            }
                                                        }}
                                                    />
                                                    <select
                                                        className="flex-1 min-w-0 bg-[#1f1f22] border border-[#3c4a42] text-[#e4e1e6] font-mono text-[8px] h-6 px-1 cursor-pointer"
                                                        value={layerInputId ?? ""}
                                                        onChange={e => {
                                                            const val = e.target.value ? Number(e.target.value) : undefined;
                                                            setCameraMultiviews(prev => {
                                                                const newObj = { ...(prev[sid] || {}) };
                                                                if (val === undefined) delete newObj[layerNum];
                                                                else newObj[layerNum] = val;
                                                                return { ...prev, [sid]: newObj };
                                                            });
                                                        }}
                                                    >
                                                        <option value="">None</option>
                                                        {cameraInputs.filter(c => c.id !== sid).map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => setActiveMultiviewEditLayer(isEditing ? null : layerNum)}
                                                        className={joinClasses(
                                                            "font-mono text-[8px] h-6 px-2 border shrink-0 transition-colors",
                                                            isEditing
                                                                ? "bg-[#4edea3] text-black border-[#4edea3] font-bold"
                                                                : "bg-[#353438] text-[#bbcabf] border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6]"
                                                        )}
                                                    >Edit</button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Right: Template thumbnails */}
                                    <div className="flex-1 overflow-y-auto p-2 bg-[#0d0d0f]">
                                        <div className="grid grid-cols-3 gap-2">
                                            {/* Full Screen */}
                                            <div
                                                className="cursor-pointer group"
                                                onClick={() => {
                                                    for (let i = 1; i <= 10; i++) {
                                                        ['panX','panY','zoomX','zoomY','cropLeft','cropTop','cropRight','cropBottom'].forEach(p => updateInputSetting(sid, `layer${i}_${p}` as any, 0));
                                                    }
                                                }}
                                            >
                                                <div className="w-full aspect-video border border-[#3c4a42] group-hover:border-[#4edea3] bg-blue-800 relative overflow-hidden transition-colors flex items-center justify-center">
                                                    <span className="text-white font-bold text-2xl">1</span>
                                                </div>
                                                <div className="font-mono text-[8px] text-[#bbcabf] text-center mt-0.5">Full Screen</div>
                                            </div>

                                            {/* Side by Side */}
                                            <div
                                                className="cursor-pointer group"
                                                onClick={() => {
                                                    for (let i = 1; i <= 10; i++) ['panX','panY','zoomX','zoomY','cropLeft','cropTop','cropRight','cropBottom'].forEach(p => updateInputSetting(sid, `layer${i}_${p}` as any, 0));
                                                    updateInputSetting(sid, 'layer1_zoomX' as any, -0.5); updateInputSetting(sid, 'layer1_zoomY' as any, -0.5); updateInputSetting(sid, 'layer1_panX' as any, -0.5);
                                                    updateInputSetting(sid, 'layer2_zoomX' as any, -0.5); updateInputSetting(sid, 'layer2_zoomY' as any, -0.5); updateInputSetting(sid, 'layer2_panX' as any, 0.5);
                                                }}
                                            >
                                                <div className="w-full aspect-video border border-[#3c4a42] group-hover:border-[#4edea3] bg-black relative overflow-hidden transition-colors flex">
                                                    <div className="flex-1 bg-blue-800 flex items-center justify-center text-white font-bold border-r border-black">1</div>
                                                    <div className="flex-1 bg-red-800 flex items-center justify-center text-white font-bold">2</div>
                                                </div>
                                                <div className="font-mono text-[8px] text-[#bbcabf] text-center mt-0.5">Side by Side</div>
                                            </div>

                                            {/* PIP Bottom Right */}
                                            <div
                                                className="cursor-pointer group"
                                                onClick={() => {
                                                    for (let i = 1; i <= 10; i++) ['panX','panY','zoomX','zoomY','cropLeft','cropTop','cropRight','cropBottom'].forEach(p => updateInputSetting(sid, `layer${i}_${p}` as any, 0));
                                                    updateInputSetting(sid, 'layer2_zoomX' as any, -0.7); updateInputSetting(sid, 'layer2_zoomY' as any, -0.7);
                                                    updateInputSetting(sid, 'layer2_panX' as any, 0.8); updateInputSetting(sid, 'layer2_panY' as any, -0.8);
                                                }}
                                            >
                                                <div className="w-full aspect-video border border-[#3c4a42] group-hover:border-[#4edea3] bg-blue-800 relative overflow-hidden transition-colors">
                                                    <span className="absolute top-1/2 left-1/4 -translate-y-1/2 text-white font-bold text-xl">1</span>
                                                    <div className="absolute bottom-1 right-1 w-1/3 h-1/3 bg-red-800 flex items-center justify-center text-white font-bold text-xs border border-black">2</div>
                                                </div>
                                                <div className="font-mono text-[8px] text-[#bbcabf] text-center mt-0.5">PIP Bottom Right</div>
                                            </div>

                                            {/* 2x2 Grid */}
                                            <div
                                                className="cursor-pointer group"
                                                onClick={() => {
                                                    for (let i = 1; i <= 10; i++) ['panX','panY','zoomX','zoomY','cropLeft','cropTop','cropRight','cropBottom'].forEach(p => updateInputSetting(sid, `layer${i}_${p}` as any, 0));
                                                    [[1,-0.5,0.5],[2,0.5,0.5],[3,-0.5,-0.5],[4,0.5,-0.5]].forEach(([ln,px,py]) => {
                                                        updateInputSetting(sid, `layer${ln}_zoomX` as any, -0.5); updateInputSetting(sid, `layer${ln}_zoomY` as any, -0.5);
                                                        updateInputSetting(sid, `layer${ln}_panX` as any, px); updateInputSetting(sid, `layer${ln}_panY` as any, py);
                                                    });
                                                }}
                                            >
                                                <div className="w-full aspect-video border border-[#3c4a42] group-hover:border-[#4edea3] bg-black relative overflow-hidden transition-colors grid grid-cols-2 grid-rows-2 gap-px">
                                                    <div className="bg-blue-800 flex items-center justify-center text-white font-bold">1</div>
                                                    <div className="bg-red-800 flex items-center justify-center text-white font-bold">2</div>
                                                    <div className="bg-blue-900 flex items-center justify-center text-white font-bold">1</div>
                                                    <div className="bg-red-900 flex items-center justify-center text-white font-bold">2</div>
                                                </div>
                                                <div className="font-mono text-[8px] text-[#bbcabf] text-center mt-0.5">2×2 Grid</div>
                                            </div>

                                            {/* Split Diagonal */}
                                            <div className="cursor-pointer group">
                                                <div className="w-full aspect-video border border-[#3c4a42] group-hover:border-[#4edea3] bg-black relative overflow-hidden transition-colors">
                                                    <div className="absolute inset-0 bg-blue-800" style={{ clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)' }}></div>
                                                    <div className="absolute inset-0 bg-red-800" style={{ clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)' }}></div>
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white font-bold text-xl z-10">1</span>
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white font-bold text-xl z-10">2</span>
                                                </div>
                                                <div className="font-mono text-[8px] text-[#bbcabf] text-center mt-0.5">Diagonal Split</div>
                                            </div>

                                            {/* 1 Top + 2 Bottom */}
                                            <div className="cursor-pointer group">
                                                <div className="w-full aspect-video border border-[#3c4a42] group-hover:border-[#4edea3] bg-black relative overflow-hidden transition-colors flex flex-col gap-px">
                                                    <div className="flex-1 bg-blue-800 flex items-center justify-center text-white font-bold">1</div>
                                                    <div className="h-1/2 flex gap-px">
                                                        <div className="flex-1 bg-red-800 flex items-center justify-center text-white font-bold text-sm">1</div>
                                                        <div className="flex-1 bg-blue-900 flex items-center justify-center text-white font-bold text-sm">2</div>
                                                    </div>
                                                </div>
                                                <div className="font-mono text-[8px] text-[#bbcabf] text-center mt-0.5">Stacked</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: Live Preview */}
                                <div className="border-t border-[#3c4a42] bg-[#0d0d0f] relative shrink-0 flex items-center justify-center py-2" style={{ height: 220 }}>
                                    <div className="relative overflow-hidden aspect-video h-full shadow-[0_0_0_1px_#3c4a42] bg-black">
                                        {/* Checkered transparency bg */}
                                        <div className="absolute inset-0 -z-10" style={{ backgroundImage: 'linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px' }}></div>
                                        <div className="absolute inset-0">{renderInputMedia(sid, 0)}</div>
                                    </div>
                                </div>

                                {/* Bottom action bar */}
                                <div className="flex items-center justify-between px-2 py-1.5 bg-[#1a1a1f] border-t border-[#3c4a42] shrink-0">
                                    <button className="font-mono text-[9px] h-6 px-4 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] transition-colors">Copy From...</button>
                                    <div className="flex gap-1">
                                        <button className="font-mono text-[9px] h-6 px-4 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] transition-colors">Import</button>
                                        <button className="font-mono text-[9px] h-6 px-4 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] transition-colors">Export</button>
                                        <button className="font-mono text-[9px] h-6 px-4 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] transition-colors">Add</button>
                                        <button className="font-mono text-[9px] h-6 px-4 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#2a2a2d] hover:text-[#e4e1e6] transition-colors">Remove</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========== POSITION ========== */}
                        {settingsTab === "Position" && (() => {
                            // Read from the persisted inputSettings directly (same source renderInputMedia uses)
                            const posSettings = inputSettings[sid] || {};
                            const zoom     = (posSettings as any).zoom     ?? 1;
                            const zoomX    = (posSettings as any).zoomX    ?? 1;
                            const zoomY    = (posSettings as any).zoomY    ?? 1;
                            const panX     = (posSettings as any).panX     ?? 0;
                            const panY     = (posSettings as any).panY     ?? 0;
                            const rotation = (posSettings as any).rotation ?? 0;
                            const cropL    = (posSettings as any).cropLeft  ?? 0;
                            const cropT    = (posSettings as any).cropTop   ?? 0;
                            const cropR    = (posSettings as any).cropRight ?? 0;
                            const cropB    = (posSettings as any).cropBottom ?? 0;

                            // SliderRow and CropRow are now defined outside the component to prevent re-mounting

                            return (
                                <div className="flex flex-col h-full bg-[#131316]">
                                    {/* Top dropdown */}
                                    <div className="px-3 py-2 border-b border-[#3c4a42] bg-[#1a1a1f] shrink-0">
                                        <select className="bg-[#0d0d0f] border border-[#3c4a42] text-[#e4e1e6] font-mono text-[9px] h-7 px-2" style={{ width: 160 }}>
                                            <option value="Main">Main</option>
                                        </select>
                                    </div>

                                    {/* Sliders area */}
                                    <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                                        {/* Left: Zoom + Pan + Rotate */}
                                        <div className="flex-1 px-4 py-3 border-r border-[#3c4a42] overflow-y-auto">
                                            <SliderRow label="Zoom"   keyName="zoom"     value={zoom}     min={0.1} max={5}   step={0.001} resetVal={1} sid={sid} updateInputSetting={updateInputSetting} />
                                            <SliderRow label="Zoom X" keyName="zoomX"    value={zoomX}    min={0.1} max={5}   step={0.001} resetVal={1} sid={sid} updateInputSetting={updateInputSetting} />
                                            <SliderRow label="Zoom Y" keyName="zoomY"    value={zoomY}    min={0.1} max={5}   step={0.001} resetVal={1} sid={sid} updateInputSetting={updateInputSetting} />
                                            <SliderRow label="Pan X"  keyName="panX"     value={panX}     min={-1}  max={1}   step={0.001} resetVal={0} sid={sid} updateInputSetting={updateInputSetting} />
                                            <SliderRow label="Pan Y"  keyName="panY"     value={panY}     min={-1}  max={1}   step={0.001} resetVal={0} sid={sid} updateInputSetting={updateInputSetting} />
                                            <SliderRow
                                                label="Rotate" keyName="rotation" value={rotation} min={-180} max={180} step={0.1} resetVal={0}
                                                displayMultiplier={1} displayDecimals={1}
                                                prefix={<span className="font-mono text-[9px] bg-[#353438] border border-[#3c4a42] text-[#bbcabf] px-1.5 h-6 flex items-center shrink-0">°</span>}
                                                sid={sid} updateInputSetting={updateInputSetting}
                                            />
                                        </div>

                                        {/* Right: Crop */}
                                        <div className="flex-1 px-4 py-3 overflow-y-auto flex flex-col">
                                            <div className="font-mono text-[9px] text-[#4edea3] uppercase tracking-wider mb-3 border-b border-[#3c4a42] pb-1">Crop</div>
                                            <CropRow label="Crop X1" keyName="cropLeft"   value={cropL} sid={sid} updateInputSetting={updateInputSetting} />
                                            <CropRow label="Crop Y1" keyName="cropTop"    value={cropT} sid={sid} updateInputSetting={updateInputSetting} />
                                            <CropRow label="Crop X2" keyName="cropRight"  value={cropR} sid={sid} updateInputSetting={updateInputSetting} />
                                            <CropRow label="Crop Y2" keyName="cropBottom" value={cropB} sid={sid} updateInputSetting={updateInputSetting} />
                                            <div className="flex justify-end mt-auto pt-2">
                                                <button
                                                    onClick={() => {
                                                        updateInputSetting(sid, 'panX', 0); updateInputSetting(sid, 'panY', 0);
                                                        updateInputSetting(sid, 'zoom', 1); updateInputSetting(sid, 'zoomX', 1); updateInputSetting(sid, 'zoomY', 1);
                                                        updateInputSetting(sid, 'rotation', 0);
                                                        updateInputSetting(sid, 'cropLeft', 0); updateInputSetting(sid, 'cropTop', 0);
                                                        updateInputSetting(sid, 'cropRight', 0); updateInputSetting(sid, 'cropBottom', 0);
                                                    }}
                                                    className="font-mono text-[9px] h-7 px-6 bg-[#353438] text-[#e4e1e6] border border-[#3c4a42] hover:bg-[#2a2a2d] transition-colors"
                                                >Reset All</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom: Live Preview */}
                                    <div className="border-t border-[#3c4a42] bg-[#0d0d0f] relative shrink-0 flex items-center justify-center py-2" style={{ height: 220 }}>
                                        <div className="relative overflow-hidden aspect-video h-full shadow-[0_0_0_1px_#3c4a42] bg-black">
                                            <div className="absolute inset-0 -z-10" style={{ backgroundImage: 'linear-gradient(45deg,#1a1a1f 25%,transparent 25%),linear-gradient(-45deg,#1a1a1f 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a1f 75%),linear-gradient(-45deg,transparent 75%,#1a1a1f 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,0 4px,4px -4px,-4px 0' }}></div>
                                            <div className="absolute inset-0">{renderInputMedia(sid, 0)}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ========== TRIGGERS ========== */}
                        {settingsTab === "Triggers" && (
                            <div>
                                <div className={sectionTitle}>Event Triggers</div>
                                <table className="w-full text-[9px] font-mono border-collapse">
                                    <thead>
                                        <tr className="bg-[#1f1f22] border-b border-[#3c4a42] text-[#bbcabf] text-left">
                                            <th className="p-1 font-normal">Trigger</th>
                                            <th className="p-1 font-normal">Function</th>
                                            <th className="p-1 font-normal">Input</th>
                                            <th className="p-1 font-normal">Duration</th>
                                            <th className="p-1 font-normal">Delay</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-[#3c4a42] text-[#e4e1e6]">
                                            <td className="p-1">OnTransitionIn</td>
                                            <td className="p-1">OverlayInput1</td>
                                            <td className="p-1">Title 1</td>
                                            <td className="p-1">0</td>
                                            <td className="p-1">0</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="mt-2 flex gap-1">
                                    <button className="bg-[#353438] text-[#e4e1e6] h-6 px-3 font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Add</button>
                                    <button className="bg-[#353438] text-[#e4e1e6] h-6 px-3 font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Edit</button>
                                    <button className="bg-[#353438] text-[#e4e1e6] h-6 px-3 font-mono text-[8px] border border-[#3c4a42] hover:bg-[#2a2a2d]">Delete</button>
                                </div>
                            </div>
                        )}

                        {/* ========== TALLY LIGHT ========== */}
                        {settingsTab === "Tally Light" && (
                            <div>
                                <div className={sectionTitle}>Web Tally</div>
                                <div className="flex gap-4">
                                    <div className="w-32 h-32 bg-red-600 border border-red-800 flex items-center justify-center font-bold text-white tracking-wider">LIVE</div>
                                    <div className="w-32 h-32 bg-green-600 border border-green-800 flex items-center justify-center font-bold text-white tracking-wider">PREVIEW</div>
                                </div>
                                <p className="font-mono text-[8px] text-[#bbcabf] mt-4">Assign this input to a specific hardware tally address or view its status via the web interface.</p>
                            </div>
                        )}

                        {/* ========== ADVANCED ========== */}
                        {settingsTab === "Advanced" && (
                            <div>
                                <div className={sectionTitle}>Advanced Properties</div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-24`}>Buffer (Frames)</label>
                                    <input className={`${inputClass} max-w-[60px]`} value="0" readOnly />
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-24`}>DirectShow Audio</label>
                                    <label className="flex items-center gap-1 font-mono text-[9px] text-[#e4e1e6]">
                                        <input type="checkbox" className="accent-[#4edea3] w-3 h-3" /> Enable
                                    </label>
                                </div>
                                <div className={fieldRowClass}>
                                    <label className={`${labelClass} w-24`}>PTZ Protocol</label>
                                    <select className={`${inputClass} w-48`}><option>None</option><option>Sony VISCA</option><option>Panasonic</option></select>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
                {/* ===== FOOTER: OK / Cancel ===== */}
                <div className="flex justify-end items-center gap-2 px-3 py-2 bg-[#2a2a2d] border-t border-[#3c4a42] shrink-0">
                    <button
                        onClick={onClose}
                        className="font-mono text-[9px] h-7 px-5 bg-[#353438] text-[#bbcabf] border border-[#3c4a42] hover:bg-[#1f1f22] hover:text-[#e4e1e6] transition-colors uppercase tracking-wider"
                    >Cancel</button>
                    <button
                        onClick={handleSave}
                        className="font-mono text-[9px] h-7 px-8 bg-[#4edea3] text-black font-bold border border-[#4edea3] hover:bg-[#3bc98e] transition-colors uppercase tracking-widest"
                    >OK</button>
                </div>
            </div>
        </div>
    );
}
