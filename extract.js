const fs = require('fs');
const path = './src/renderer/components/ControlPanel.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('{settingsDialogInputId !== null && (() => {'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('})()}'));

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find the block to extract');
    process.exit(1);
}

// Extract the inside of the block
const extractedLines = lines.slice(startIdx + 1, endIdx);

const newComponentCode = `import React from 'react';
import { AppStateMatrix, InputSetting } from '../../shared/types';
import abstractBackgroundUrl from '../assets/abstract-motion-background.png';

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
    hexToRgb: (hex: string) => { r: number, g: number, b: number };
    renderInputMedia: (inputId: number, depth: number) => React.ReactNode;
    videoDevices: any[];
    cameraThemeMap: Record<number, string>;
    setCameraThemeMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

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
    const joinClasses = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

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
                                <div key={\`vmix-\${num}\`} className="flex flex-col items-center">
                                    <div className="w-full aspect-video bg-[#0d0d0f] relative border border-[#3c4a42] shadow-sm flex items-center justify-center overflow-hidden hover:border-[#4edea3] transition-colors cursor-pointer">
                                        <div className="absolute bottom-0 left-0 bg-[#1f1f22] text-[#4edea3] text-[9px] font-bold px-1.5 py-0.5 z-10 border-t border-r border-[#3c4a42]">{\`\${num % 2 === 0 ? 'NDI' : 'OMT'}\`}</div>
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

    const CropSliderRow = ({ label, keyName, value }: { label: string; keyName: string; value: number }) => {
        return (
            <div className="flex flex-col mb-1.5">
            <div className="flex justify-between items-center mb-0.5">
                <span className="font-mono text-[8px] text-[#bbcabf]">{label}</span>
                <span className="font-mono text-[8px] text-[#4edea3]">{value.toFixed(3)}</span>
            </div>
            <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={value}
                onChange={e => updateInputSetting(sid, keyName as keyof InputSetting, Number(e.target.value))}
                className="w-full h-1.5 bg-[#353438] rounded accent-[#4edea3] appearance-none cursor-pointer"
            />
            </div>
        );
    };

` + extractedLines.join('\n')
    .replace(/setSettingsDialogInputId\(null\)/g, 'onClose()')
    .replace(/<NDITabContent \/>/g, '{NDITabContent()}') + `
}
`;

// Write the new component
fs.writeFileSync('./src/renderer/components/InputSettingsDialog.tsx', newComponentCode);

// Modify ControlPanel.tsx
const renderComponent = `        {settingsDialogInputId !== null && (
            <InputSettingsDialog
                sid={settingsDialogInputId}
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                onClose={() => setSettingsDialogInputId(null)}
                cameraInputs={cameraInputs}
                setCameraInputs={setCameraInputs}
                inputSettings={inputSettings}
                updateInputSetting={updateInputSetting}
                getInputSettings={getInputSettings}
                cameraMultiviews={cameraMultiviews}
                setCameraMultiviews={setCameraMultiviews}
                activeMultiviewEditLayer={activeMultiviewEditLayer}
                setActiveMultiviewEditLayer={setActiveMultiviewEditLayer}
                state={state}
                patchState={patchState}
                computeAutoChromaSettings={computeAutoChromaSettings}
                hexToRgb={hexToRgb}
                renderInputMedia={renderInputMedia}
                videoDevices={videoDevices}
                cameraThemeMap={cameraThemeMap}
                setCameraThemeMap={setCameraThemeMap}
            />
        )}`;

lines.splice(startIdx, endIdx - startIdx + 1, renderComponent);

// Add import to ControlPanel.tsx
const importIndex = lines.findIndex(l => l.includes('import ThemeDesigner from'));
if (importIndex !== -1) {
    lines.splice(importIndex, 0, 'import InputSettingsDialog from "./InputSettingsDialog";');
} else {
    lines.unshift('import InputSettingsDialog from "./InputSettingsDialog";');
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Successfully extracted InputSettingsDialog!');
