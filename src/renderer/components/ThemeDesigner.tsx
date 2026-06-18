import { useState, useRef, useEffect } from "react";
import type { ThemeDefinition, CanvasElement, CanvasElementKind } from "../../shared/types";
import OutputCanvas from "./OutputCanvas";

interface ThemeDesignerProps {
  isOpen: boolean;
  tabType: "SCRIPTURES" | "LYRICS" | "TIMER";
  initialTheme?: ThemeDefinition | null;
  onSave: (theme: ThemeDefinition) => void;
  onCancel: () => void;
  previewText?: string;
  previewReference?: string;
  onPreviewUpdate?: (theme: ThemeDefinition) => void;
}

function joinClasses(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

type InspectorTab = "Properties" | "Background" | "Animation";
type BackgroundMode = "Color" | "Image" | "Motion";
type LowerThirdPreset = "Classic" | "Banner" | "Minimal";


type LayerItem = {
  id: string; name: string; icon: string;
  visible: boolean; locked: boolean; active: boolean;
};

const createDefaultCanvasElements = (): CanvasElement[] => [
  { id: "bg-1", kind: "shape", x: 0, y: 0, width: 100, height: 100, rotation: 0, visible: true, locked: true, zIndex: 0, shapeType: "rect", fillColor: "#1a1a2e", fillOpacity: 1 },
  { id: "shape-1", kind: "shape", x: 0, y: 70, width: 100, height: 30, rotation: 0, visible: true, locked: false, zIndex: 5, shapeType: "lower-third-bar", fillColor: "#0d9488", fillOpacity: 0.9 },
  { id: "text-1", kind: "text", x: 5, y: 72, width: 90, height: 26, rotation: 0, visible: true, locked: false, zIndex: 10, fontSize: 6, fontFamily: "Inter, system-ui, sans-serif", fontColor: "#ffffff", textShadow: "0 2px 4px rgba(0,0,0,0.8)", bgOpacity: 0 },
];

let _nextElId = 100;

export default function ThemeDesigner({
  isOpen,
  tabType,
  initialTheme,
  onSave,
  onCancel,
  previewText,
  previewReference,
  onPreviewUpdate,
}: ThemeDesignerProps): JSX.Element | null {
  const isEditMode = !!initialTheme;

  const [themeName, setThemeName] = useState(initialTheme?.name || "");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("Properties");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("Color");
  const [lowerThirdPreset, setLowerThirdPreset] = useState<LowerThirdPreset>(
    initialTheme?.lowerThirdStyle === "BANNER" ? "Banner" :
    initialTheme?.lowerThirdStyle === "MINIMAL" ? "Minimal" : "Classic"
  );
  const [lowerThirdEnabled, setLowerThirdEnabled] = useState(true);

  // Background
  const [fillType, setFillType] = useState(initialTheme?.fillType || "Linear Gradient");
  const [bgScale, setBgScale] = useState(initialTheme?.scale || 100);
  const [bgPosX, setBgPosX] = useState(initialTheme?.backgroundPositionX || 0);
  const [bgPosY, setBgPosY] = useState(initialTheme?.backgroundPositionY || 0);
  const [bgImagePath, setBgImagePath] = useState(initialTheme?.backgroundImagePath || "");

  // Animation
  const [entranceAnimation, setEntranceAnimation] = useState(initialTheme?.entranceAnimation || "Slide Up");
  const [animationDuration, setAnimationDuration] = useState(initialTheme?.animationDuration || 0.8);
  const [animationCurve, setAnimationCurve] = useState(initialTheme?.animationCurve || "Ease-Out");

  // Text
  const [textPosX, setTextPosX] = useState(initialTheme?.textPositionX || 50);
  const [textPosY, setTextPosY] = useState(initialTheme?.textPositionY || 50);
  const [fontFamily, setFontFamily] = useState(initialTheme?.fontFamily || "Inter, system-ui, sans-serif");
  const [fontColor, setFontColor] = useState(initialTheme?.fontColor || "#ffffff");
  const [referencePosition, setReferencePosition] = useState<"TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "BELOW_TEXT">(initialTheme?.referencePosition || "BOTTOM_RIGHT");
  const [referenceColor, setReferenceColor] = useState(initialTheme?.referenceColor || "#9ca3af");
  const [referenceSize, setReferenceSize] = useState(initialTheme?.referenceSize || 100);
  const [referenceEnabled, setReferenceEnabled] = useState(initialTheme?.referenceEnabled ?? true);
  const [referenceWeight, setReferenceWeight] = useState(initialTheme?.referenceWeight || "normal");
  const [bgVideoPath, setBgVideoPath] = useState(initialTheme?.backgroundVideoPath || "");

  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>(initialTheme?.canvasElements || createDefaultCanvasElements());
  const [selectedElementId, setSelectedElementId] = useState<string | null>("text-1");
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeState, setResizeState] = useState<{ handle: string; startMouseX: number; startMouseY: number; startEl: CanvasElement } | null>(null);
  
  // New States for Drawing and Editing
  const [insertMode, setInsertMode] = useState<"text" | "shape" | null>(null);
  const [pendingShapeType, setPendingShapeType] = useState<CanvasElement["shapeType"]>("rect");
  const [textEditMode, setTextEditMode] = useState<string | null>(null);
  const [draggedLayerIdx, setDraggedLayerIdx] = useState<number | null>(null);
  const [drawingState, setDrawingState] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const currentTheme: ThemeDefinition = {
    id: initialTheme?.id || "temp",
    name: themeName,
    tabType,
    lowerThirdStyle: lowerThirdEnabled ? (lowerThirdPreset === "Banner" ? "BANNER" : lowerThirdPreset === "Minimal" ? "MINIMAL" : "CLASSIC") : "CUSTOM",
    backgroundStyle: backgroundMode === "Color" ? (canvasElements.find(el => el.id === "bg-1")?.fillColor === "transparent" ? "TRANSPARENT" : (fillType === "Solid" ? "SOLID" : "GRADIENT")) : backgroundMode === "Motion" ? "VIDEO" : "IMAGE",
    backgroundTexture: "NONE",
    backgroundImagePath: bgImagePath,
    backgroundVideoPath: bgVideoPath,
    backgroundPositionX: bgPosX,
    backgroundPositionY: bgPosY,
    textPositionX: textPosX,
    textPositionY: textPosY,
    fillType,
    scale: bgScale,
    entranceAnimation,
    animationDuration,
    animationCurve,
    fontFamily,
    fontColor,
    referencePosition,
    referenceColor,
    referenceSize,
    referenceEnabled,
    referenceWeight,
    canvasElements
  };

  useEffect(() => {
    if (onPreviewUpdate) {
      onPreviewUpdate(currentTheme);
    }
  }, [
    themeName, tabType, lowerThirdEnabled, lowerThirdPreset, backgroundMode,
    bgImagePath, bgVideoPath, bgPosX, bgPosY, textPosX, textPosY, fillType,
    bgScale, entranceAnimation, animationDuration, animationCurve, fontFamily,
    fontColor, referencePosition, referenceColor, referenceSize, referenceEnabled, referenceWeight,
    canvasElements
  ]);

  // Derived layers from canvas elements
  const layers: LayerItem[] = [...canvasElements]
    .sort((a, b) => b.zIndex - a.zIndex)
    .map(el => ({
      id: el.id,
      name: el.kind === "text" ? (el.text ? el.text.slice(0, 16) : "Text Layer") : el.kind === "shape" ? (el.shapeType === "lower-third-bar" ? "Lower Third" : el.shapeType === "circle" ? "Circle" : "Shape") : el.kind === "overlay" ? "Overlay" : el.kind === "image" ? "Image" : "Video",
      icon: el.kind === "text" ? "T" : el.kind === "shape" ? "◆" : el.kind === "overlay" ? "✦" : "▢",
      visible: el.visible,
      locked: el.locked,
      active: el.id === selectedElementId,
    }));

  // Canvas zoom
  const [canvasZoom, setCanvasZoom] = useState(75);

  // Toolbar
  const [activeToolbar, setActiveToolbar] = useState<"Text" | "Media" | "Shape" | "Lower Third">("Text");

  // Preset select
  const [presetSelect, setPresetSelect] = useState("Lower Third Tree");

  useEffect(() => {
    if (initialTheme) {
      setThemeName(initialTheme.name);
      setFillType(initialTheme.fillType || "Linear Gradient");
      setBgScale(initialTheme.scale || 100);
      setBgPosX(initialTheme.backgroundPositionX || 0);
      setBgPosY(initialTheme.backgroundPositionY || 0);
      
      const isBlob = (path?: string) => path && path.startsWith('blob:');
      setBgImagePath(isBlob(initialTheme.backgroundImagePath) ? "" : (initialTheme.backgroundImagePath || ""));
      setEntranceAnimation(initialTheme.entranceAnimation || "Slide Up");
      setAnimationDuration(initialTheme.animationDuration || 0.8);
      setAnimationCurve(initialTheme.animationCurve || "Ease-Out");
      setTextPosX(initialTheme.textPositionX || 50);
      setTextPosY(initialTheme.textPositionY || 50);
      setFontFamily(initialTheme.fontFamily || "Inter, system-ui, sans-serif");
      setFontColor(initialTheme.fontColor || "#ffffff");
      setReferencePosition(initialTheme.referencePosition || "BOTTOM_RIGHT");
      setReferenceColor(initialTheme.referenceColor || "#9ca3af");
      setReferenceSize(initialTheme.referenceSize || 100);
      setReferenceEnabled(initialTheme.referenceEnabled ?? true);
      setReferenceWeight(initialTheme.referenceWeight || "normal");
      setBgVideoPath(isBlob(initialTheme.backgroundVideoPath) ? "" : (initialTheme.backgroundVideoPath || ""));
      setLowerThirdPreset(
        initialTheme.lowerThirdStyle === "BANNER" ? "Banner" :
        initialTheme.lowerThirdStyle === "MINIMAL" ? "Minimal" : "Classic"
      );
      setCanvasElements(initialTheme.canvasElements || createDefaultCanvasElements());
    } else {
      // Reset for new theme
      setThemeName("");
      setFillType("Linear Gradient");
      setBgScale(100);
      setBgPosX(0);
      setBgPosY(0);
      setBgImagePath("");
      setEntranceAnimation("Slide Up");
      setAnimationDuration(0.8);
      setAnimationCurve("Ease-Out");
      setTextPosX(50);
      setTextPosY(50);
      setFontFamily("Inter, system-ui, sans-serif");
      setFontColor("#ffffff");
      setReferencePosition("BOTTOM_RIGHT");
      setReferenceColor("#9ca3af");
      setReferenceSize(100);
      setReferenceEnabled(true);
      setReferenceWeight("normal");
      setBgVideoPath("");
      setLowerThirdPreset("Classic");
      setCanvasElements(createDefaultCanvasElements());
    }
  }, [initialTheme, isOpen]);

  // Handle global keyboard shortcuts for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't delete if we're typing in a text box or input field
      if (textEditMode || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedElementId) {
          const el = canvasElements.find(ce => ce.id === selectedElementId);
          if (el && !el.locked) {
            setCanvasElements(prev => prev.filter(ce => ce.id !== selectedElementId));
            setSelectedElementId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, textEditMode, canvasElements]);

  // ── Canvas interaction handlers ──
  const selectedElement = canvasElements.find(el => el.id === selectedElementId) || null;

  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    if (textEditMode === elementId) return; // Let native text selection happen
    e.preventDefault();
    const el = canvasElements.find(ce => ce.id === elementId);
    if (!el) return;
    setSelectedElementId(elementId);
    if (el.locked) return;
    setIsDragging(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left) - (el.x / 100) * rect.width,
      y: (e.clientY - rect.top) - (el.y / 100) * rect.height,
    });
  };

  const handleElementDoubleClick = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    const el = canvasElements.find(ce => ce.id === elementId);
    if (el && el.kind === "text" && !el.locked) {
      setTextEditMode(elementId);
      setIsDragging(false);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (textEditMode) return;
    if (!selectedElementId) return;
    const el = canvasElements.find(ce => ce.id === selectedElementId);
    if (!el || el.locked) return;
    setResizeState({ handle, startMouseX: e.clientX, startMouseY: e.clientY, startEl: { ...el } });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    
    setSelectedElementId(null);
    setTextEditMode(null);

    if (insertMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const startX = ((e.clientX - rect.left) / rect.width) * 100;
      const startY = ((e.clientY - rect.top) / rect.height) * 100;
      setDrawingState({ startX, startY, currentX: startX, currentY: startY });
      // Keep insertMode active so we know what to draw, or clear it and track it inside drawingState?
      // Actually we'll keep insertMode until mouseUp.
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (isDragging && selectedElementId) {
      const newX = (((e.clientX - rect.left) - dragOffset.x) / rect.width) * 100;
      const newY = (((e.clientY - rect.top) - dragOffset.y) / rect.height) * 100;
      setCanvasElements(prev => prev.map(el =>
        el.id === selectedElementId
          ? { ...el, x: Math.max(-el.width * 0.5, Math.min(100 - el.width * 0.5, newX)), y: Math.max(-el.height * 0.5, Math.min(100 - el.height * 0.5, newY)) }
          : el
      ));
    } else if (resizeState && selectedElementId) {
      const dx = ((e.clientX - resizeState.startMouseX) / rect.width) * 100;
      const dy = ((e.clientY - resizeState.startMouseY) / rect.height) * 100;
      const s = resizeState.startEl;
      const h = resizeState.handle;
      let nX = s.x, nY = s.y, nW = s.width, nH = s.height;
      if (h.includes("e")) nW = Math.max(3, s.width + dx);
      if (h.includes("w")) { nX = s.x + dx; nW = Math.max(3, s.width - dx); }
      if (h.includes("s")) nH = Math.max(3, s.height + dy);
      if (h.includes("n")) { nY = s.y + dy; nH = Math.max(3, s.height - dy); }
      setCanvasElements(prev => prev.map(el =>
        el.id === selectedElementId ? { ...el, x: nX, y: nY, width: nW, height: nH } : el
      ));
    } else if (drawingState) {
      const currentX = ((e.clientX - rect.left) / rect.width) * 100;
      const currentY = ((e.clientY - rect.top) / rect.height) * 100;
      setDrawingState(prev => prev ? { ...prev, currentX, currentY } : null);
    }
  };

  const handleCanvasMouseUp = () => {
    if (drawingState && insertMode) {
      const { startX, startY, currentX, currentY } = drawingState;
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      if (width > 1 && height > 1) { // Only add if they actually dragged a bit
        if (insertMode === "text") {
          addCanvasElement("text", { x, y, width, height });
        } else if (insertMode === "shape") {
          addCanvasElement("shape", { x, y, width, height, shapeType: pendingShapeType });
        }
      }
      setDrawingState(null);
      setInsertMode(null);
    }

    if (isDragging) {
      setIsDragging(false);
      const el = canvasElements.find(ce => ce.id === selectedElementId);
      if (el && el.id === "text-1") {
        setTextPosX(Math.round(el.x + el.width / 2));
        setTextPosY(Math.round(el.y + el.height / 2));
      }
    }
    if (resizeState) setResizeState(null);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current && !drawingState) {
      setSelectedElementId(null);
      setTextEditMode(null);
    }
  };

  const addCanvasElement = (kind: CanvasElementKind, extras?: Partial<CanvasElement>) => {
    const id = `${kind}-${++_nextElId}`;
    const maxZ = Math.max(0, ...canvasElements.map(el => el.zIndex));
    const base: Record<CanvasElementKind, Partial<CanvasElement>> = {
      text: { x: 15, y: 35, width: 70, height: 18, fontSize: 22, fontFamily, fontColor, textShadow: "0 2px 4px rgba(0,0,0,0.8)", bgOpacity: 0, text: "New Text" },
      shape: { x: 20, y: 25, width: 60, height: 40, shapeType: "rect", fillColor: "#333333", fillOpacity: 0.8 },
      image: { x: 10, y: 10, width: 40, height: 40 },
      video: { x: 10, y: 10, width: 40, height: 40 },
      overlay: { x: 0, y: 0, width: 100, height: 100, overlayType: "dust", overlayOpacity: 0.4 },
    };
    const newEl: CanvasElement = { id, kind, rotation: 0, visible: true, locked: false, zIndex: maxZ + 1, ...base[kind], ...extras } as CanvasElement;
    setCanvasElements(prev => [...prev, newEl]);
    setSelectedElementId(id);
  };

  const toggleElementVisibility = (elementId: string) => {
    setCanvasElements(prev => prev.map(el => el.id === elementId ? { ...el, visible: !el.visible } : el));
  };

  const toggleElementLock = (elementId: string) => {
    setCanvasElements(prev => prev.map(el => el.id === elementId ? { ...el, locked: !el.locked } : el));
  };

  const renderCanvasElement = (el: CanvasElement) => {
    if (!el.visible) return null;
    const isSelected = selectedElementId === el.id;
    const isBgShape = el.kind === "shape" && el.zIndex === 0 && el.width === 100 && el.height === 100;
    const elStyle: React.CSSProperties = {
      position: "absolute",
      left: `${el.x}%`, top: `${el.y}%`,
      width: `${el.width}%`, height: `${el.height}%`,
      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      zIndex: el.zIndex,
      cursor: el.locked ? "default" : isDragging && isSelected ? "grabbing" : "grab",
      userSelect: textEditMode === el.id ? "text" : "none",
      pointerEvents: isBgShape ? "none" : textEditMode === el.id ? "auto" : "auto",
    };
    let content: React.ReactNode = null;
    if (el.kind === "text") {
      const displayText = el.id === "text-1" ? (previewText || el.text || "Sample Text") : (el.text || "Text");
      const displayRef = el.id === "text-1" ? (previewReference || "") : "";
      
      const handleTextInput = (e: React.FormEvent<HTMLSpanElement>, isRef: boolean) => {
        const newText = e.currentTarget.innerHTML;
        // In a full implementation, you would save this back to the element state
        // For now, we update the element's text property
        if (!isRef) {
          setCanvasElements(prev => prev.map(ce => ce.id === el.id ? { ...ce, text: newText } : ce));
        }
      };

      content = (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: el.fontFamily || fontFamily, color: el.fontColor || fontColor, fontSize: `${el.fontSize || 6}cqh`, textShadow: el.textShadow, WebkitTextStroke: el.textOutline || undefined, backgroundColor: el.bgOpacity ? `rgba(0,0,0,${el.bgOpacity})` : "transparent", textAlign: el.textAlign || "center", padding: "8px", overflow: "hidden", whiteSpace: "pre-wrap", lineHeight: 1.2, fontWeight: 600 }}>
          <span 
            contentEditable={textEditMode === el.id} 
            suppressContentEditableWarning 
            onInput={(e) => handleTextInput(e, false)}
            dangerouslySetInnerHTML={{ __html: displayText }}
            style={{ outline: textEditMode === el.id ? '1px dashed #4edea3' : 'none', cursor: textEditMode === el.id ? 'text' : 'inherit', width: '100%' }}
          />
          {displayRef && referenceEnabled && <span 
            contentEditable={textEditMode === el.id}
            suppressContentEditableWarning
            style={{ fontSize: `${(el.fontSize || 6) * 0.5 * (referenceSize / 100)}cqh`, color: referenceColor, fontWeight: referenceWeight as any, marginTop: "4px", letterSpacing: "0.15em", textTransform: "uppercase", outline: textEditMode === el.id ? '1px dashed #4edea3' : 'none', cursor: textEditMode === el.id ? 'text' : 'inherit', width: '100%' }}
            dangerouslySetInnerHTML={{ __html: displayRef }}
          />}
        </div>
      );
    } else if (el.kind === "shape") {
      let clipPath = "";
      if (el.shapeType === "triangle") clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
      else if (el.shapeType === "diamond") clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
      else if (el.shapeType === "pentagon") clipPath = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
      else if (el.shapeType === "hexagon") clipPath = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
      else if (el.shapeType === "star") clipPath = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
      else if (el.shapeType === "arrow-right") clipPath = "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";
      else if (el.shapeType === "arrow-left") clipPath = "polygon(40% 0%, 40% 20%, 100% 20%, 100% 80%, 40% 80%, 40% 100%, 0% 50%)";
      else if (el.shapeType === "arrow-up") clipPath = "polygon(50% 0%, 100% 40%, 80% 40%, 80% 100%, 20% 100%, 20% 40%, 0% 40%)";
      else if (el.shapeType === "arrow-down") clipPath = "polygon(20% 0%, 80% 0%, 80% 60%, 100% 60%, 50% 100%, 0% 60%, 20% 60%)";
      else if (el.shapeType === "callout") clipPath = "polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 50% 100%, 50% 75%, 0% 75%)";
      else if (el.shapeType === "parallelogram") clipPath = "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)";
      else if (el.shapeType === "trapezoid") clipPath = "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)";
      else if (el.shapeType === "cross") clipPath = "polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)";
      else if (el.shapeType === "banner") clipPath = "polygon(0% 0%, 100% 0%, 100% 100%, 50% 70%, 0% 100%)";
      else if (el.shapeType === "line") clipPath = "polygon(0% 48%, 100% 48%, 100% 52%, 0% 52%)";

      content = (
        <div style={{ width: "100%", height: "100%", backgroundColor: el.fillColor || "#333", opacity: el.fillOpacity ?? 1, borderRadius: el.shapeType === "rounded-rect" ? "8px" : el.shapeType === "circle" ? "50%" : `${el.borderRadius || 0}px`, border: el.borderWidth && !clipPath ? `${el.borderWidth}px solid ${el.borderColor || "#fff"}` : undefined, clipPath: clipPath || undefined, ...(el.shapeType === "lower-third-bar" ? { background: `linear-gradient(to right, ${el.fillColor || "#0d9488"}, ${el.fillColor || "#14b8a6"}cc, ${el.fillColor || "#0f766e"})` } : {}) }} />
      );
    } else if (el.kind === "image") {
      content = el.mediaSrc
        ? <img src={el.mediaSrc} alt="" style={{ width: "100%", height: "100%", objectFit: el.objectFit || "cover", pointerEvents: "none", opacity: el.fillOpacity ?? 1, borderRadius: `${el.borderRadius || 0}px`, mixBlendMode: el.blendMode || "normal" }} />
        : <div style={{ width: "100%", height: "100%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: "11px", opacity: el.fillOpacity ?? 1 }}>No Image</div>;
    } else if (el.kind === "video") {
      content = el.mediaSrc
        ? <video src={el.mediaSrc} style={{ width: "100%", height: "100%", objectFit: el.objectFit || "cover", pointerEvents: "none", opacity: el.fillOpacity ?? 1, borderRadius: `${el.borderRadius || 0}px`, mixBlendMode: el.blendMode || "normal" }} autoPlay loop muted />
        : <div style={{ width: "100%", height: "100%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: "11px", opacity: el.fillOpacity ?? 1 }}>No Video</div>;
    } else if (el.kind === "overlay") {
      const oCSS: React.CSSProperties = el.overlayType === "light-leak"
        ? { background: "linear-gradient(135deg, rgba(255,200,50,0.2), transparent 50%, rgba(255,100,50,0.15))", animation: "overlayPulse 4s ease-in-out infinite" }
        : el.overlayType === "bokeh"
          ? { background: "radial-gradient(circle at 25% 35%, rgba(255,255,255,0.12) 0%, transparent 45%), radial-gradient(circle at 72% 58%, rgba(255,255,255,0.08) 0%, transparent 35%)" }
          : el.overlayType === "film-grain"
            ? { background: "repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px" }
            : { background: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "18px 18px", animation: "overlayDrift 12s linear infinite" };
      content = <div style={{ width: "100%", height: "100%", opacity: el.overlayOpacity ?? 0.4, pointerEvents: "none", ...oCSS }} />;
    }
    return (
      <div key={el.id} style={elStyle} onMouseDown={(e) => handleElementMouseDown(e, el.id)} onDoubleClick={(e) => handleElementDoubleClick(e, el.id)}>
        {content}
        {isSelected && !el.locked && (
          <>
            <div style={{ position: "absolute", inset: "-1px", border: "2px solid #10b981", pointerEvents: "none", boxShadow: "0 0 12px rgba(16,185,129,0.3)" }} />
            {[
              { pos: "nw", css: { top: -5, left: -5, cursor: "nwse-resize" } },
              { pos: "ne", css: { top: -5, right: -5, cursor: "nesw-resize" } },
              { pos: "sw", css: { bottom: -5, left: -5, cursor: "nesw-resize" } },
              { pos: "se", css: { bottom: -5, right: -5, cursor: "nwse-resize" } },
              { pos: "n", css: { top: -5, left: "calc(50% - 5px)", cursor: "ns-resize" } },
              { pos: "s", css: { bottom: -5, left: "calc(50% - 5px)", cursor: "ns-resize" } },
              { pos: "w", css: { top: "calc(50% - 5px)", left: -5, cursor: "ew-resize" } },
              { pos: "e", css: { top: "calc(50% - 5px)", right: -5, cursor: "ew-resize" } },
            ].map(({ pos, css }) => (
              <div key={pos} onMouseDown={(ev) => handleResizeMouseDown(ev, pos)} style={{ position: "absolute", width: 10, height: 10, backgroundColor: "#fff", border: "1.5px solid #10b981", borderRadius: 2, zIndex: 100, ...(css as any) }} />
            ))}
            <div style={{ position: "absolute", top: -26, left: "calc(50% - 6px)", width: 12, height: 12, backgroundColor: "#fff", border: "1.5px solid #10b981", borderRadius: "50%", cursor: "grab", zIndex: 100 }} />
            <div style={{ position: "absolute", top: -14, left: "calc(50% - 0.5px)", width: 1, height: 14, backgroundColor: "#10b981", zIndex: 99 }} />
          </>
        )}
        {isSelected && el.locked && (
          <div style={{ position: "absolute", inset: "-1px", border: "2px dashed #9ca3af", pointerEvents: "none" }} />
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const handleSave = () => {
    const theme: ThemeDefinition = {
      ...currentTheme,
      id: initialTheme?.id || `theme_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: themeName.trim() || `${tabType} Theme`,
    };
    onSave(theme);
  };

  const tabLabel = tabType === "SCRIPTURES" ? "Scripture" : tabType === "LYRICS" ? "Lyrics" : "Timer";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[1440px] h-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          backgroundColor: "#131316",
          borderRadius: "0.75rem",
          border: "1px solid #39393c",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
          outline: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TITLE BAR / MAIN TOOLBAR                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col shrink-0" style={{ borderBottom: "1px solid #39393c" }}>
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: "#353538" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 flex items-center justify-center"
                style={{
                  borderRadius: "4px",
                  backgroundColor: "rgba(16,185,129,0.2)",
                  color: "#10b981",
                  boxShadow: "0 0 10px rgba(16,185,129,0.3)",
                }}
              >
                <span style={{ fontSize: "10px" }}>⬡</span>
              </div>
              <span className="font-semibold text-sm tracking-wide text-white">
                HallelujahBeamer{" "}
                <span className="font-normal text-xs ml-1" style={{ color: "#9ca3af" }}>
                  {tabLabel} Theme & Motion Workspace
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme Name Input */}
              <input
                type="text"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder={`${tabLabel} Theme Name...`}
                className="px-2 py-1 text-xs outline-none"
                style={{
                  backgroundColor: "#353538",
                  border: "1px solid #39393c",
                  borderRadius: "4px",
                  color: "#e3e3e3",
                  width: "180px",
                }}
              />
              <button
                className="px-3 py-1 text-xs transition-colors"
                style={{
                  backgroundColor: "#39393c",
                  border: "1px solid #39393c",
                  borderRadius: "4px",
                  color: "#e3e3e3",
                }}
              >
                ↓ Export
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-1 font-medium text-xs transition-colors"
                style={{
                  backgroundColor: "#10b981",
                  color: "#0a0a0c",
                  borderRadius: "4px",
                  boxShadow: "0 0 10px rgba(16,185,129,0.3)",
                }}
              >
                {isEditMode ? "Update Theme" : "Save Workspace"}
              </button>
              <button
                onClick={onCancel}
                className="w-7 h-7 flex items-center justify-center text-sm"
                style={{ color: "#9ca3af" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Sub toolbar */}
          <div
            className="flex items-center justify-between px-2 py-1.5"
            style={{ backgroundColor: "#222225" }}
          >
            <div className="flex items-center gap-1">
              {/* Preset select */}
              <div className="relative mr-2">
                <select
                  value={presetSelect}
                  onChange={(e) => setPresetSelect(e.target.value)}
                  className="appearance-none outline-none transition-colors pr-6"
                  style={{
                    backgroundColor: "#353538",
                    border: "1px solid #39393c",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    width: "192px",
                    color: "#e3e3e3",
                  }}
                >
                  <option>Lower Third Tree</option>
                  <option>Main Title Preset</option>
                </select>
                <span
                  className="absolute right-2 top-2 pointer-events-none"
                  style={{ fontSize: "10px", color: "#9ca3af" }}
                >
                  ▾
                </span>
              </div>

              {/* Undo/Redo */}
              <div className="flex items-center gap-1" style={{ borderRight: "1px solid #39393c", paddingRight: "8px", marginRight: "8px" }}>
                <button className="w-7 h-7 flex items-center justify-center rounded transition-colors" style={{ color: "#9ca3af" }} title="Undo">↺</button>
                <button className="w-7 h-7 flex items-center justify-center rounded transition-colors" style={{ color: "#9ca3af" }} title="Redo">↻</button>
              </div>

              {/* Tool buttons */}
              <div className="flex items-center gap-1 relative">
                <button
                  onClick={() => { setActiveToolbar("Text"); setInsertMode("text"); }}
                  className="px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                  style={{
                    fontSize: "11px",
                    backgroundColor: insertMode === "text" ? "#39393c" : "transparent",
                    color: insertMode === "text" ? "#10b981" : "#9ca3af",
                    border: insertMode === "text" ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                    boxShadow: insertMode === "text" ? "0 0 10px rgba(16,185,129,0.3)" : "none",
                  }}
                  title="Draw Text Box"
                >
                  A Text
                </button>
                <button
                  onClick={() => {
                    setActiveToolbar("Media");
                    document.getElementById("media-upload-input")?.click();
                  }}
                  className="px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                  style={{
                    fontSize: "11px",
                    backgroundColor: activeToolbar === "Media" ? "#39393c" : "transparent",
                    color: activeToolbar === "Media" ? "#10b981" : "#9ca3af",
                  }}
                >
                  Media
                </button>
                <input
                  type="file"
                  id="media-upload-input"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const isVideo = file.type.startsWith('video/');
                      // Get the native file path (available in Electron)
                      const nativePath = ('path' in file && typeof (file as any).path === 'string')
                        ? (file as any).path as string
                        : null;

                      let persistentSrc: string;
                      if (nativePath && window.electron?.importCanvasMedia) {
                        // Copy file to app assets folder so it persists across restarts
                        const result = await window.electron.importCanvasMedia(nativePath);
                        persistentSrc = `file://${result.path.replace(/\\/g, '/').replace(/ /g, '%20')}`;
                      } else {
                        // Fallback: blob URL (not persistent, but better than nothing)
                        persistentSrc = URL.createObjectURL(file);
                      }
                      addCanvasElement(isVideo ? "video" : "image", { mediaSrc: persistentSrc, mediaType: isVideo ? "video" : "image", width: 40, height: 40 });
                    }
                    e.target.value = ""; // Reset input
                  }}
                />
                <div className="relative group">
                  <button
                    onClick={() => setActiveToolbar("Shape")}
                    className="px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                    style={{
                      fontSize: "11px",
                      backgroundColor: insertMode === "shape" ? "#39393c" : "transparent",
                      color: insertMode === "shape" ? "#10b981" : "#9ca3af",
                      border: insertMode === "shape" ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                      boxShadow: insertMode === "shape" ? "0 0 10px rgba(16,185,129,0.3)" : "none",
                    }}
                  >
                    Shape ▾
                  </button>
                  <div className="absolute left-0 top-full mt-1 w-64 bg-[#222225] border border-[#39393c] rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 grid grid-cols-4 gap-1">
                    {[
                      { type: "rect", label: "Rectangle" }, { type: "rounded-rect", label: "Rounded" }, { type: "circle", label: "Oval" }, { type: "triangle", label: "Triangle" },
                      { type: "diamond", label: "Diamond" }, { type: "pentagon", label: "Pentagon" }, { type: "hexagon", label: "Hexagon" }, { type: "star", label: "Star" },
                      { type: "arrow-right", label: "Right Arrow" }, { type: "arrow-left", label: "Left Arrow" }, { type: "arrow-up", label: "Up Arrow" }, { type: "arrow-down", label: "Down Arrow" },
                      { type: "callout", label: "Callout" }, { type: "line", label: "Line" }, { type: "parallelogram", label: "Parallelogram" }, { type: "trapezoid", label: "Trapezoid" },
                      { type: "cross", label: "Cross" }, { type: "cylinder", label: "Cylinder" }, { type: "heart", label: "Heart" }, { type: "moon", label: "Moon" },
                      { type: "cloud", label: "Cloud" }, { type: "lightning", label: "Lightning" }, { type: "speech-bubble", label: "Speech" }, { type: "banner", label: "Banner" }
                    ].map(shape => (
                      <button
                        key={shape.type}
                        title={shape.label}
                        onClick={() => { setInsertMode("shape"); setPendingShapeType(shape.type as any); setActiveToolbar("Shape"); }}
                        className="h-8 flex items-center justify-center rounded hover:bg-[#353538] text-[#9ca3af] hover:text-[#10b981]"
                      >
                        {shape.type === "rect" && <div className="w-4 h-4 border border-current" />}
                        {shape.type === "rounded-rect" && <div className="w-4 h-4 border border-current rounded" />}
                        {shape.type === "circle" && <div className="w-4 h-4 border border-current rounded-full" />}
                        {shape.type !== "rect" && shape.type !== "rounded-rect" && shape.type !== "circle" && <span className="text-[10px]">{(shape.type as string).substring(0, 3)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setActiveToolbar("Lower Third")}
                  className="px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors font-medium"
                  style={{
                    fontSize: "11px",
                    backgroundColor: activeToolbar === "Lower Third" ? "#39393c" : "transparent",
                    color: activeToolbar === "Lower Third" ? "#10b981" : "#9ca3af",
                  }}
                >
                  Lower Third
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1" style={{ borderLeft: "1px solid #39393c", paddingLeft: "8px" }}>
              <button className="w-7 h-7 flex items-center justify-center rounded transition-colors" style={{ color: "#9ca3af" }} title="Grid">⊞</button>
              <button className="w-7 h-7 flex items-center justify-center rounded transition-colors" style={{ color: "#9ca3af" }} title="Snap">⊡</button>
              <button
                className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                style={{ backgroundColor: "#39393c", color: "#10b981" }}
                title="Preview"
              >
                ▶
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MAIN WORK AREA                                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex overflow-hidden">
          {/* ─── LEFT COLUMN: Layer Manager ─── */}
          <aside
            className="w-64 flex flex-col shrink-0 z-10"
            style={{
              backgroundColor: "#222225",
              borderRight: "1px solid #39393c",
              boxShadow: "4px 0 12px rgba(0,0,0,0.3)",
            }}
          >
            {/* Layer Stack Header */}
            <div
              className="px-3 py-2 flex justify-between items-center"
              style={{ backgroundColor: "#353538", borderBottom: "1px solid #39393c" }}
            >
              <span
                className="uppercase font-semibold"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                }}
              >
                Layer Stack
              </span>
              <button onClick={() => addCanvasElement(activeToolbar === "Text" ? "text" : activeToolbar === "Shape" ? "shape" : activeToolbar === "Lower Third" ? "shape" : activeToolbar === "Media" ? "image" : "text", activeToolbar === "Lower Third" ? { shapeType: "lower-third-bar", fillColor: "#0d9488", fillOpacity: 0.9, x: 0, y: 70, width: 100, height: 30 } : undefined)} style={{ color: "#9ca3af" }}>
                <span style={{ fontSize: "10px" }}>+</span>
              </button>
            </div>

            {/* Layer Items */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  draggable={!layer.locked}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedLayerIdx(idx);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedLayerIdx !== null && draggedLayerIdx !== idx) {
                      const newLayers = [...layers];
                      const dragged = newLayers.splice(draggedLayerIdx, 1)[0];
                      newLayers.splice(idx, 0, dragged);
                      
                      const newZIndexes = new Map(newLayers.map((l, i) => [l.id, newLayers.length - i]));
                      setCanvasElements(prev => prev.map(el => ({ ...el, zIndex: newZIndexes.get(el.id) || el.zIndex })));
                    }
                    setDraggedLayerIdx(null);
                  }}
                  onDragEnd={() => setDraggedLayerIdx(null)}
                  onClick={() => setSelectedElementId(layer.id)}
                  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer group ${draggedLayerIdx === idx ? 'opacity-50' : ''}`}
                  style={{
                    backgroundColor: selectedElementId === layer.id ? "rgba(16,185,129,0.1)" : "transparent",
                    border: selectedElementId === layer.id ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                    boxShadow: selectedElementId === layer.id ? "0 0 10px rgba(16,185,129,0.3)" : "none",
                    opacity: layer.locked ? 0.7 : 1,
                  }}
                >
                  <span style={{ fontSize: "10px", color: "#9ca3af", opacity: 0.5, cursor: "grab" }}>⠿</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleElementVisibility(layer.id); }} style={{ color: layer.visible ? (selectedElementId === layer.id ? "#10b981" : "#9ca3af") : "#555", fontSize: "10px" }}>
                    {layer.visible ? "👁" : "🙈"}
                  </button>
                  <div
                    className="w-4 h-4 flex items-center justify-center"
                    style={{
                      border: "1px solid #39393c",
                      borderRadius: "2px",
                      fontSize: "8px",
                      color: "#9ca3af",
                      backgroundColor: layer.locked ? "#39393c" : "transparent",
                    }}
                  >
                    {layer.icon}
                  </div>
                  <span
                    className="text-xs flex-1 truncate"
                    style={{
                      color: selectedElementId === layer.id ? "#fff" : "#e3e3e3",
                      fontWeight: selectedElementId === layer.id ? 500 : 400,
                    }}
                  >
                    {layer.name}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); toggleElementLock(layer.id); }} style={{ fontSize: "10px", color: "#9ca3af" }}>
                    {layer.locked ? "🔒" : "🔓"}
                  </button>
                </div>
              ))}
            </div>

            {/* Assets */}
            <div
              className="px-3 py-2"
              style={{ backgroundColor: "#353538", borderTop: "1px solid #39393c", borderBottom: "1px solid #39393c" }}
            >
              <span
                className="uppercase font-semibold"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.05em",
                  color: "#9ca3af",
                }}
              >
                Assets
              </span>
            </div>
            <div
              className="overflow-y-auto p-2 grid grid-cols-2 gap-2"
              style={{ backgroundColor: "#0e0e11", height: "33%" }}
            >
              {["Img_1.jpg", "Loop.mp4"].map((asset) => (
                <div
                  key={asset}
                  className="aspect-video flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    backgroundColor: "#39393c",
                    border: "1px solid #39393c",
                    borderRadius: "4px",
                  }}
                >
                  <span style={{ fontSize: "8px", color: "#9ca3af" }}>{asset}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* ─── CENTER COLUMN: Canvas ─── */}
          <main className="flex-1 relative flex flex-col" style={{ backgroundColor: "#0a0a0c" }}>
            {/* Canvas Area */}
            <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
              {/* Dot grid background */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Overlay animation keyframes */}
              <style>{`
                @keyframes overlayDrift { 0% { transform: translate(0,0); } 50% { transform: translate(10px,-8px); } 100% { transform: translate(0,0); } }
                @keyframes overlayPulse { 0%,100% { opacity: 0.15; } 50% { opacity: 0.35; } }
              `}</style>

              {/* 16:9 Canvas */}
              <div
                ref={canvasRef}
                className="aspect-video w-full max-w-5xl relative overflow-hidden"
                style={{
                  backgroundColor: "#000",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
                  outline: "1px solid #39393c",
                  cursor: isDragging || resizeState ? "grabbing" : "default",
                  containerType: "size",
                }}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onClick={handleCanvasClick}
              >
                {/* Live Theme Background */}
                {backgroundMode === "Color" && (
                  <div className="absolute inset-0" style={{
                    background: fillType === "Linear Gradient" ? "linear-gradient(135deg, #1a1a2e 0%, #0a0a0c 100%)" : fillType === "Radial Gradient" ? "radial-gradient(circle, #1a1a2e 0%, #0a0a0c 100%)" : "#0a0a0c",
                  }} />
                )}
                {backgroundMode === "Image" && bgImagePath && (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${bgImagePath}")`, backgroundPosition: `${bgPosX}% ${bgPosY}%`, transform: `scale(${bgScale / 100})` }} />
                )}
                {backgroundMode === "Motion" && bgVideoPath && (
                  <video src={bgVideoPath} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted style={{ objectPosition: `${bgPosX}% ${bgPosY}%`, transform: `scale(${bgScale / 100})` }} />
                )}
                {backgroundMode !== "Color" && !(backgroundMode === "Image" && bgImagePath) && !(backgroundMode === "Motion" && bgVideoPath) && (
                  <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #0a0a0c 100%)" }} />
                )}

                {/* Interactive Canvas Elements */}
                {[...canvasElements].sort((a, b) => a.zIndex - b.zIndex).map(el => renderCanvasElement(el))}
                
                {/* Drawing Box Preview */}
                {drawingState && (
                  <div style={{
                    position: "absolute",
                    left: `${Math.min(drawingState.startX, drawingState.currentX)}%`,
                    top: `${Math.min(drawingState.startY, drawingState.currentY)}%`,
                    width: `${Math.abs(drawingState.currentX - drawingState.startX)}%`,
                    height: `${Math.abs(drawingState.currentY - drawingState.startY)}%`,
                    border: "1px dashed #10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    pointerEvents: "none",
                    zIndex: 9999
                  }} />
                )}

                {/* Guide grid when nothing selected */}
                {!selectedElementId && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-1/3 top-0 bottom-0 w-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                    <div className="absolute top-1/3 left-0 right-0 h-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                    <div className="absolute top-2/3 left-0 right-0 h-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
                  </div>
                )}
              </div>
            </div>

            {/* Canvas Controls Bottom */}
            <div
              className="h-10 flex items-center px-4 justify-between shrink-0 z-10"
              style={{
                backgroundColor: "#222225",
                borderTop: "1px solid #39393c",
                boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#9ca3af" }}>1920x1080 (16:9)</span>
                <div className="h-4 w-px" style={{ backgroundColor: "#39393c" }} />
                <span className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#9ca3af" }}>X: {selectedElement ? Math.round(selectedElement.x) : "—"} Y: {selectedElement ? Math.round(selectedElement.y) : "—"}</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
                  style={{
                    backgroundColor: "#39393c",
                    border: "1px solid #39393c",
                    color: "#10b981",
                    boxShadow: "0 0 10px rgba(16,185,129,0.3)",
                  }}
                >
                  ↻ Preview Loop
                </button>
                <div className="flex items-center gap-2">
                  <button style={{ color: "#9ca3af" }} onClick={() => setCanvasZoom(Math.max(25, canvasZoom - 25))}>
                    <span style={{ fontSize: "10px" }}>−</span>
                  </button>
                  <span className="text-xs w-10 text-center" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#e3e3e3" }}>
                    {canvasZoom}%
                  </span>
                  <button style={{ color: "#9ca3af" }} onClick={() => setCanvasZoom(Math.min(200, canvasZoom + 25))}>
                    <span style={{ fontSize: "10px" }}>+</span>
                  </button>
                </div>
                <button style={{ color: "#9ca3af" }} title="Fit to Screen">
                  <span style={{ fontSize: "12px" }}>⛶</span>
                </button>
              </div>
            </div>
          </main>

          {/* ─── RIGHT COLUMN: Advanced Inspector ─── */}
          <aside
            className="w-80 flex flex-col shrink-0 z-10 overflow-y-auto"
            style={{
              backgroundColor: "#222225",
              borderLeft: "1px solid #39393c",
              boxShadow: "-4px 0 12px rgba(0,0,0,0.3)",
            }}
          >
            {/* Live Preview Section */}
            <div className="p-4 shrink-0" style={{ backgroundColor: "#0e0e11", borderBottom: "1px solid #39393c" }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="uppercase font-semibold"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.65rem",
                    letterSpacing: "0.05em",
                    color: "#9ca3af",
                  }}
                >
                  Live Preview
                </span>
                <button style={{ color: "#9ca3af" }} title="Toggle Safe Areas">
                  <span style={{ fontSize: "10px" }}>⊞</span>
                </button>
              </div>
              <div
                className="aspect-video w-full relative overflow-hidden"
                style={{
                  backgroundColor: "#000",
                  borderRadius: "4px",
                  border: "1px solid #39393c",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                }}
              >
                {/* Mini preview content */}
                <div className="absolute inset-0">
                    <OutputCanvas 
                        overrideThemeDefinition={currentTheme} 
                        overrideText={previewText || "Sample Scripture Text\nLine Two"} 
                        overrideReference={previewReference || "John 3:16"} 
                        compact
                    />
                </div>

                {/* LIVE badge */}
                <div
                  className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: "#ef4444",
                      animation: "pulse 2s infinite",
                      boxShadow: "0 0 4px rgba(239,68,68,0.8)",
                    }}
                  />
                  <span className="font-bold text-white tracking-widest leading-none" style={{ fontSize: "7px", marginTop: "1px" }}>LIVE</span>
                </div>

                {/* Resolution badge */}
                <div
                  className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span className="leading-none" style={{ fontSize: "7px", fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.9)" }}>
                    1920x1080 | 60fps
                  </span>
                </div>

                {/* Safe Areas */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                  <div className="absolute w-[90%] h-[90%]" style={{ border: "1px dashed rgba(16,185,129,0.3)", borderRadius: "2px" }} />
                  <div className="absolute w-[80%] h-[80%]" style={{ border: "1px dashed rgba(16,185,129,0.3)", borderRadius: "2px" }} />
                  <div className="absolute w-2 h-px" style={{ backgroundColor: "rgba(16,185,129,0.3)" }} />
                  <div className="absolute h-2 w-px" style={{ backgroundColor: "rgba(16,185,129,0.3)" }} />
                </div>
              </div>
            </div>

            {/* Tab Header */}
            <div
              className="flex items-center sticky top-0 z-10"
              style={{ backgroundColor: "#353538", borderBottom: "1px solid #39393c" }}
            >
              {(["Properties", "Background", "Animation"] as InspectorTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  className="flex-1 py-2 font-semibold transition-colors"
                  style={{
                    fontSize: "11px",
                    color: inspectorTab === tab ? "#e3e3e3" : "#9ca3af",
                    borderBottom: inspectorTab === tab ? "2px solid #10b981" : "2px solid transparent",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Inspector Content */}
            <div className="p-4 space-y-6">
              {/* ── Background Section ── */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span
                    className="uppercase font-semibold"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.65rem",
                      letterSpacing: "0.05em",
                      color: "#9ca3af",
                    }}
                  >
                    Background
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded" style={{ backgroundColor: "#39393c" }}>
                    {(["Color", "Image", "Motion"] as BackgroundMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setBackgroundMode(mode)}
                        className="px-2 py-0.5 text-xs"
                        style={{
                          borderRadius: "2px",
                          backgroundColor: backgroundMode === mode ? "#222225" : "transparent",
                          color: backgroundMode === mode ? "#e3e3e3" : "#9ca3af",
                          boxShadow: backgroundMode === mode ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="p-3 space-y-3"
                  style={{
                    backgroundColor: "#0e0e11",
                    border: "1px solid #39393c",
                    borderRadius: "4px",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "#9ca3af" }}>Fill Type</span>
                    <select
                      value={fillType}
                      onChange={(e) => setFillType(e.target.value)}
                      className="px-2 py-1 text-xs outline-none"
                      style={{
                        backgroundColor: "#39393c",
                        border: "1px solid #39393c",
                        borderRadius: "4px",
                        color: "#e3e3e3",
                        width: "128px",
                      }}
                    >
                      <option>Linear Gradient</option>
                      <option>Solid Color</option>
                      <option>Radial Gradient</option>
                    </select>
                  </div>

                  {/* Color swatches */}
                  <div className="flex flex-wrap gap-2">
                    {["transparent", "#1a1a2e", "#0e2b3c", "#1f1406", "#2a0808", "#0d402f", "#0a0a0c", "#4edea3", "#3b82f6", "#eab308", "#ef4444", "#ffffff"].map((color, i) => {
                      const bgEl = canvasElements.find(el => el.id === "bg-1");
                      const isActive = bgEl?.fillColor === color;
                      return (
                      <div
                        key={i}
                        title={color === "transparent" ? "Remove Background Color" : color}
                        onClick={() => {
                          setCanvasElements(prev => prev.map(el => el.id === "bg-1" ? { ...el, fillColor: color } : el));
                          setFillType("Solid Color");
                          setBackgroundMode("Color");
                        }}
                        className="w-8 h-8 rounded cursor-pointer relative transition-transform hover:scale-105 flex items-center justify-center"
                        style={{
                          backgroundColor: color === "transparent" ? "#222225" : color,
                          backgroundImage: color === "transparent" ? "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)" : "none",
                          backgroundSize: "8px 8px",
                          border: isActive ? "1px solid #10b981" : "1px solid #39393c",
                          boxShadow: isActive ? "0 0 10px rgba(16,185,129,0.3)" : "none",
                        }}
                      >
                        {color === "transparent" && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        )}
                        {isActive && (
                          <div
                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                            style={{ backgroundColor: "#10b981" }}
                          />
                        )}
                      </div>
                      );
                    })}
                    <button
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ border: "1px dashed #39393c", color: "#9ca3af" }}
                    >
                      <span style={{ fontSize: "10px" }}>+</span>
                    </button>
                  </div>

                  {/* Scale slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#9ca3af" }}>
                      <span>Scale</span>
                      <span>{bgScale}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={200}
                      value={bgScale}
                      onChange={(e) => setBgScale(Number(e.target.value))}
                      className="w-full"
                      style={{ accentColor: "#10b981" }}
                    />
                  </div>

                  {/* Position fields */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Position X", value: bgPosX, setter: setBgPosX },
                      { label: "Position Y", value: bgPosY, setter: setBgPosY },
                    ].map(({ label, value, setter }) => (
                      <div key={label} className="space-y-1">
                        <span style={{ fontSize: "10px", color: "#9ca3af" }}>{label}</span>
                        <div className="relative">
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setter(Number(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs text-right outline-none"
                            style={{
                              backgroundColor: "#39393c",
                              border: "1px solid #39393c",
                              borderRadius: "4px",
                              color: "#e3e3e3",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          />
                          <span className="absolute left-2 top-1 text-xs" style={{ color: "#9ca3af" }}>px</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Media Upload (Image/Video) */}
                  {(backgroundMode === "Image" || backgroundMode === "Motion") && (
                    <div className="pt-2 border-t border-[#39393c] mt-2 space-y-2">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>
                        {backgroundMode === "Image" ? "Background Image" : "Background Video"}
                      </span>
                      <input
                        type="file"
                        accept={backgroundMode === "Image" ? "image/*" : "video/*"}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const nativePath = ('path' in file && typeof (file as any).path === 'string') ? (file as any).path as string : null;
                            let url: string;
                            if (nativePath && window.electron?.importCanvasMedia) {
                              const result = await window.electron.importCanvasMedia(nativePath);
                              url = `file://${result.path.replace(/\\/g, '/').replace(/ /g, '%20')}`;
                            } else {
                              url = nativePath ? `file://${nativePath.replace(/\\/g, '/').replace(/ /g, '%20')}` : URL.createObjectURL(file);
                            }
                            if (backgroundMode === "Image") setBgImagePath(url);
                            else setBgVideoPath(url);
                          }
                          e.target.value = "";
                        }}
                        className="w-full text-[#e4e1e6] font-mono text-[8px] cursor-pointer"
                      />
                      {(backgroundMode === "Image" ? bgImagePath : bgVideoPath) && (
                        <button 
                          onClick={() => backgroundMode === "Image" ? setBgImagePath("") : setBgVideoPath("")}
                          className="text-[9px] text-[#ef4444] hover:text-[#f87171]"
                        >
                          Clear Media
                        </button>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* ── Lower Thirds Section ── */}
              <div className="space-y-3 pt-3" style={{ borderTop: "1px solid #39393c" }}>
                <div className="flex justify-between items-center">
                  <span
                    className="uppercase font-semibold"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.65rem",
                      letterSpacing: "0.05em",
                      color: "#9ca3af",
                    }}
                  >
                    Lower Third
                  </span>
                  {/* Toggle */}
                  <button
                    onClick={() => setLowerThirdEnabled(!lowerThirdEnabled)}
                    className="relative inline-flex items-center cursor-pointer"
                  >
                    <div
                      className="w-7 h-4 rounded-full relative transition-colors"
                      style={{ backgroundColor: lowerThirdEnabled ? "#10b981" : "#39393c" }}
                    >
                      <div
                        className="absolute top-[2px] h-3 w-3 rounded-full transition-transform"
                        style={{
                          backgroundColor: "#fff",
                          border: "1px solid #d1d5db",
                          left: lowerThirdEnabled ? "14px" : "2px",
                        }}
                      />
                    </div>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["Classic", "Banner", "Minimal"] as LowerThirdPreset[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setLowerThirdPreset(preset)}
                      className="py-2 px-1 flex flex-col items-center gap-1 transition-colors"
                      style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        borderRadius: "4px",
                        backgroundColor: lowerThirdPreset === preset ? "#39393c" : "#0e0e11",
                        border: lowerThirdPreset === preset ? "1px solid #10b981" : "1px solid #39393c",
                        color: lowerThirdPreset === preset ? "#10b981" : "#9ca3af",
                        boxShadow: lowerThirdPreset === preset ? "0 0 10px rgba(16,185,129,0.3)" : "none",
                      }}
                    >
                      {/* Mini preview */}
                      <div
                        className="w-8 h-4 flex items-center justify-center relative"
                        style={{
                          borderRadius: "2px",
                          border: lowerThirdPreset === preset ? "1px solid rgba(16,185,129,0.5)" : "none",
                          backgroundColor: lowerThirdPreset === preset ? "rgba(16,185,129,0.2)" : "#39393c",
                        }}
                      >
                        {preset === "Classic" && <div className="absolute bottom-0 left-0 w-3 h-full" style={{ backgroundColor: lowerThirdPreset === preset ? "rgba(16,185,129,0.4)" : "#39393c" }} />}
                        {preset === "Banner" && <div className="w-6 h-1 rounded-full" style={{ backgroundColor: "#39393c" }} />}
                        {preset === "Minimal" && <div className="w-1 h-3 ml-1" style={{ backgroundColor: "#39393c" }} />}
                      </div>
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Context-Aware Inspector ── */}
              <div className="space-y-3 pt-3" style={{ borderTop: "1px solid #39393c" }}>

                {/* ── Delete Row (always visible) ── */}
                <div className="flex justify-between items-center">
                  <span className="uppercase font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", letterSpacing: "0.05em", color: "#9ca3af" }}>
                    {(selectedElement?.kind === "image" || selectedElement?.kind === "video") ? "Media Layer" : "Typography & Layout"}
                  </span>
                  <button
                    onClick={() => {
                      if (selectedElementId) {
                        setCanvasElements(prev => prev.filter(el => el.id !== selectedElementId));
                        setSelectedElementId(null);
                      }
                    }}
                    disabled={!selectedElementId}
                    className="px-2 py-1 text-xs outline-none transition-colors"
                    style={{ backgroundColor: selectedElementId ? "#ef4444" : "#39393c", border: "1px solid #39393c", borderRadius: "4px", color: selectedElementId ? "#fff" : "#9ca3af", width: "100px", cursor: selectedElementId ? "pointer" : "not-allowed" }}
                  >
                    Delete Layer
                  </button>
                </div>

                {/* ════════════════════════════════════════ */}
                {/* MEDIA ELEMENT CONTROLS (image / video)  */}
                {/* ════════════════════════════════════════ */}
                {(selectedElement?.kind === "image" || selectedElement?.kind === "video") && (
                  <div className="p-3 space-y-4" style={{ backgroundColor: "#0e0e11", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "6px", boxShadow: "0 0 12px rgba(16,185,129,0.05)" }}>

                    {/* Header badge */}
                    <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid #39393c" }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ backgroundColor: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>
                        {selectedElement.kind === "video" ? "▶" : "🖼"}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: "#e3e3e3" }}>
                        {selectedElement.kind === "video" ? "Video Layer" : "Image Layer"}
                      </span>
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                        {selectedElement.mediaSrc ? "Loaded" : "Empty"}
                      </span>
                    </div>

                    {/* ── Opacity / Alpha ── */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: "#e3e3e3" }}>Opacity / Alpha</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono tabular-nums" style={{ color: "#10b981", minWidth: "36px", textAlign: "right" }}>
                            {Math.round((selectedElement.fillOpacity ?? 1) * 100)}%
                          </span>
                          <button
                            title="Full opacity"
                            onClick={() => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fillOpacity: 1 } : el))}
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "#39393c", color: "#9ca3af", border: "1px solid #39393c" }}
                          >100%</button>
                          <button
                            title="Half opacity"
                            onClick={() => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fillOpacity: 0.5 } : el))}
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "#39393c", color: "#9ca3af", border: "1px solid #39393c" }}
                          >50%</button>
                          <button
                            title="Hidden"
                            onClick={() => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fillOpacity: 0 } : el))}
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "#39393c", color: "#9ca3af", border: "1px solid #39393c" }}
                          >0%</button>
                        </div>
                      </div>
                      {/* Gradient track slider */}
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "linear-gradient(to right, transparent, #10b981)", opacity: 0.25, borderRadius: "99px" }} />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={selectedElement.fillOpacity ?? 1}
                          onChange={(e) => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fillOpacity: parseFloat(e.target.value) } : el))}
                          className="relative w-full h-2 appearance-none cursor-pointer"
                          style={{ accentColor: "#10b981", backgroundColor: "transparent" }}
                        />
                      </div>
                      {/* Visual opacity preview strip */}
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "repeating-conic-gradient(#39393c 0% 25%, #222225 0% 50%) 0 0 / 8px 8px" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${(selectedElement.fillOpacity ?? 1) * 100}%`, backgroundColor: selectedElement.kind === "video" ? "#7c3aed" : "#0891b2", opacity: selectedElement.fillOpacity ?? 1 }} />
                      </div>
                    </div>

                    {/* ── Object Fit ── */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium" style={{ color: "#e3e3e3" }}>Fit Mode</span>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { value: "cover", label: "Cover", desc: "Fill & crop" },
                          { value: "contain", label: "Contain", desc: "Fit inside" },
                          { value: "fill", label: "Stretch", desc: "Stretch to fill" },
                        ].map(({ value, label, desc }) => {
                          const current = (selectedElement as any).objectFit || "cover";
                          return (
                            <button
                              key={value}
                              title={desc}
                              onClick={() => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, objectFit: value as any } : el))}
                              className="py-1.5 px-1 flex flex-col items-center gap-0.5 rounded transition-colors"
                              style={{
                                fontSize: "9px",
                                backgroundColor: current === value ? "rgba(16,185,129,0.12)" : "#1a1a1e",
                                border: current === value ? "1px solid rgba(16,185,129,0.4)" : "1px solid #39393c",
                                color: current === value ? "#10b981" : "#9ca3af",
                                boxShadow: current === value ? "0 0 8px rgba(16,185,129,0.2)" : "none",
                              }}
                            >
                              <span style={{ fontSize: "11px" }}>{value === "cover" ? "⬛" : value === "contain" ? "🔲" : "⬜"}</span>
                              <span className="font-semibold">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Size & Position (read-only display, editable via canvas) ── */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium" style={{ color: "#e3e3e3" }}>Transform</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "X", value: Math.round(selectedElement.x), prop: "x" },
                          { label: "Y", value: Math.round(selectedElement.y), prop: "y" },
                          { label: "W", value: Math.round(selectedElement.width), prop: "width" },
                          { label: "H", value: Math.round(selectedElement.height), prop: "height" },
                        ].map(({ label, value, prop }) => (
                          <div key={prop} className="flex items-center gap-1.5">
                            <span className="text-[10px] w-4 font-mono" style={{ color: "#9ca3af" }}>{label}</span>
                            <input
                              type="number"
                              value={value}
                              onChange={(e) => {
                                const num = parseFloat(e.target.value);
                                if (!isNaN(num) && selectedElementId) {
                                  setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, [prop]: num } : el));
                                }
                              }}
                              className="flex-1 px-1.5 py-1 text-xs text-right outline-none font-mono"
                              style={{ backgroundColor: "#1a1a1e", border: "1px solid #39393c", borderRadius: "3px", color: "#e3e3e3" }}
                            />
                            <span className="text-[9px]" style={{ color: "#555" }}>%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Corner Radius ── */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium" style={{ color: "#e3e3e3" }}>Corner Radius</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="50"
                          step="1"
                          value={(selectedElement as any).borderRadius ?? 0}
                          onChange={(e) => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, borderRadius: parseInt(e.target.value) } : el))}
                          className="w-20"
                          style={{ accentColor: "#10b981" }}
                        />
                        <span className="text-xs font-mono" style={{ color: "#9ca3af", minWidth: "24px" }}>{(selectedElement as any).borderRadius ?? 0}px</span>
                      </div>
                    </div>

                    {/* ── Blend Mode ── */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium" style={{ color: "#e3e3e3" }}>Blend Mode</span>
                      <select
                        value={(selectedElement as any).blendMode || "normal"}
                        onChange={(e) => setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, blendMode: e.target.value as any } : el))}
                        className="px-2 py-1 text-xs outline-none"
                        style={{ backgroundColor: "#39393c", border: "1px solid #39393c", borderRadius: "4px", color: "#e3e3e3", width: "120px" }}
                      >
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                        <option value="color-dodge">Color Dodge</option>
                        <option value="color-burn">Color Burn</option>
                        <option value="hard-light">Hard Light</option>
                        <option value="soft-light">Soft Light</option>
                        <option value="difference">Difference</option>
                        <option value="exclusion">Exclusion</option>
                        <option value="hue">Hue</option>
                        <option value="saturation">Saturation</option>
                        <option value="luminosity">Luminosity</option>
                      </select>
                    </div>

                    {/* ── Replace Media ── */}
                    <div className="pt-2" style={{ borderTop: "1px solid #39393c" }}>
                      <label
                        htmlFor="media-replace-input"
                        className="w-full flex items-center justify-center gap-2 py-2 rounded cursor-pointer transition-colors text-xs font-medium"
                        style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px dashed rgba(16,185,129,0.35)", color: "#4edea3" }}
                      >
                        <span>↑</span> Replace Media File
                        <input
                          type="file"
                          id="media-replace-input"
                          className="hidden"
                          accept="image/*,video/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file && selectedElementId) {
                              const isVideo = file.type.startsWith('video/');
                              const nativePath = ('path' in file && typeof (file as any).path === 'string') ? (file as any).path as string : null;
                              let src: string;
                              if (nativePath && window.electron?.importCanvasMedia) {
                                const result = await window.electron.importCanvasMedia(nativePath);
                                src = `file://${result.path.replace(/\\/g, '/').replace(/ /g, '%20')}`;
                              } else {
                                src = URL.createObjectURL(file);
                              }
                              setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, mediaSrc: src, mediaType: isVideo ? "video" : "image" } : el));
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                  </div>
                )}

                {/* ════════════════════════════════════════ */}
                {/* TEXT / SHAPE CONTROLS                   */}
                {/* ════════════════════════════════════════ */}
                {selectedElement?.kind !== "image" && selectedElement?.kind !== "video" && (
                  <div className="p-3 space-y-3" style={{ backgroundColor: "#0e0e11", border: "1px solid #39393c", borderRadius: "4px" }}>
                    <div className="flex justify-between items-center pt-2" style={{ borderTop: "1px solid #39393c" }}>
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Alignment</span>
                      <div className="flex gap-1">
                        {[
                          { value: "left", label: "⫷" },
                          { value: "center", label: "≣" },
                          { value: "justify", label: "▤" },
                          { value: "right", label: "⫸" },
                        ].map(align => {
                          const selEl = selectedElementId ? canvasElements.find(el => el.id === selectedElementId) : null;
                          const isAlignSelected = selEl && selEl.kind === "text" ? selEl.textAlign === align.value : false;
                          return (
                            <button
                              key={align.value}
                              onClick={() => {
                                if (selectedElementId) {
                                  setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, textAlign: align.value as any } : el));
                                }
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                              style={{
                                backgroundColor: isAlignSelected ? "#39393c" : "transparent",
                                color: isAlignSelected ? "#10b981" : "#9ca3af",
                                border: isAlignSelected ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                              }}
                              title={`Align ${align.value}`}
                            >
                              {align.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Font Family</span>
                      <select
                        value={selectedElement && selectedElement.kind === 'text' && selectedElement.fontFamily ? selectedElement.fontFamily : fontFamily}
                        onChange={(e) => {
                          setFontFamily(e.target.value);
                          if (selectedElementId) {
                             setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fontFamily: e.target.value } : el));
                          }
                        }}
                        className="px-2 py-1 text-xs outline-none"
                        style={{ backgroundColor: "#39393c", border: "1px solid #39393c", borderRadius: "4px", color: "#e3e3e3", width: "128px" }}
                      >
                        <option value="Inter, system-ui, sans-serif">Inter</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="'Courier New', monospace">Courier New</option>
                        <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                        <option value="Impact, sans-serif">Impact</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Text Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedElement && selectedElement.kind === 'text' && selectedElement.fontColor ? selectedElement.fontColor : fontColor}
                          onChange={(e) => {
                            setFontColor(e.target.value);
                            if (selectedElementId) {
                               setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fontColor: e.target.value } : el));
                            }
                          }}
                          className="w-8 h-8 rounded border border-[#39393c] cursor-pointer bg-[#39393c]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Bg Opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedElement && selectedElement.kind === 'text' && selectedElement.bgOpacity !== undefined ? selectedElement.bgOpacity : 0}
                        onChange={(e) => {
                          if (selectedElementId) {
                             setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, bgOpacity: parseFloat(e.target.value) } : el));
                          }
                        }}
                        className="w-24 h-1 appearance-none bg-[#39393c] rounded-full accent-[#10b981] cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Font Size</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={selectedElement && selectedElement.kind === 'text' && selectedElement.fontSize ? selectedElement.fontSize : 6}
                          onChange={(e) => {
                            const newSize = parseInt(e.target.value) || 6;
                            if (selectedElementId) {
                               setCanvasElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, fontSize: newSize } : el));
                            }
                          }}
                          className="px-2 py-1 text-xs outline-none w-16 text-right"
                          style={{ backgroundColor: "#39393c", border: "1px solid #39393c", borderRadius: "4px", color: "#e3e3e3" }}
                        />
                        <span className="text-[10px] text-gray-500">cqh</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2" style={{ borderTop: "1px solid #39393c" }}>
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Object Fill Color</span>
                      <div className="flex items-center gap-2">
                        <button
                          title="No Color (Transparent)"
                          onClick={() => {
                            if (selectedElementId) {
                              setCanvasElements(prev => prev.map(el =>
                                el.id === selectedElementId
                                  ? (el.kind === "text" ? { ...el, bgOpacity: 0 } : { ...el, fillOpacity: 0 })
                                  : el
                              ));
                            }
                          }}
                          className="w-8 h-8 rounded flex items-center justify-center border border-[#39393c] transition-colors hover:bg-[#353538]"
                          style={{ backgroundColor: "transparent", color: "#ef4444" }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <input
                          type="color"
                          value={
                            selectedElement
                              ? (selectedElement.kind === 'shape' ? (selectedElement.fillColor || "#333333") : (selectedElement.backgroundColor || "#000000"))
                              : "#333333"
                          }
                          onChange={(e) => {
                            if (selectedElementId) {
                               setCanvasElements(prev => prev.map(el =>
                                 el.id === selectedElementId
                                   ? (el.kind === "text" ? { ...el, backgroundColor: e.target.value } : { ...el, fillColor: e.target.value })
                                   : el
                               ));
                            }
                          }}
                          className="w-8 h-8 rounded border border-[#39393c] cursor-pointer bg-[#39393c]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Fill Opacity</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedElement && selectedElement.kind === 'shape' && selectedElement.fillOpacity !== undefined ? selectedElement.fillOpacity : (selectedElement?.kind === 'text' && selectedElement.bgOpacity !== undefined ? selectedElement.bgOpacity : 1)}
                        onChange={(e) => {
                          if (selectedElementId) {
                             setCanvasElements(prev => prev.map(el =>
                               el.id === selectedElementId
                                 ? (el.kind === "text" ? { ...el, bgOpacity: parseFloat(e.target.value) } : { ...el, fillOpacity: parseFloat(e.target.value) })
                                 : el
                             ));
                          }
                        }}
                        className="w-24 h-1 appearance-none bg-[#39393c] rounded-full accent-[#10b981] cursor-pointer"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Ref Position</span>
                      <select
                        value={referencePosition}
                        onChange={(e) => setReferencePosition(e.target.value as any)}
                        className="px-2 py-1 text-xs outline-none"
                        style={{ backgroundColor: "#39393c", border: "1px solid #39393c", borderRadius: "4px", color: "#e3e3e3", width: "128px" }}
                      >
                        <option value="BOTTOM_RIGHT">Bottom Right</option>
                        <option value="BOTTOM_LEFT">Bottom Left</option>
                        <option value="TOP_RIGHT">Top Right</option>
                        <option value="TOP_LEFT">Top Left</option>
                        <option value="BELOW_TEXT">Below Text</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Show Reference</span>
                      <input
                        type="checkbox"
                        checked={referenceEnabled}
                        onChange={(e) => setReferenceEnabled(e.target.checked)}
                        className="w-4 h-4 accent-[#10b981] cursor-pointer"
                      />
                    </div>
                    {referenceEnabled && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: "#9ca3af" }}>Ref Color</span>
                          <input
                            type="color"
                            value={referenceColor}
                            onChange={(e) => setReferenceColor(e.target.value)}
                            className="w-8 h-8 rounded border border-[#39393c] cursor-pointer bg-[#39393c]"
                          />
                        </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Ref Size (%)</span>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        value={referenceSize}
                        onChange={(e) => setReferenceSize(Number(e.target.value))}
                        className="w-[128px]"
                        style={{ accentColor: "#10b981" }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>Ref Weight</span>
                      <select
                        value={referenceWeight}
                        onChange={(e) => setReferenceWeight(e.target.value)}
                        className="px-2 py-1 text-xs outline-none"
                        style={{ backgroundColor: "#39393c", border: "1px solid #39393c", borderRadius: "4px", color: "#e3e3e3", width: "128px" }}
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="300">Light</option>
                        <option value="900">Black</option>
                      </select>
                    </div>
                    </>
                  )}
                  </div>
                )}
              </div>

              {/* ── Animation Section ── */}
              <div className="space-y-3 pt-3" style={{ borderTop: "1px solid #39393c" }}>
                <span
                  className="uppercase font-semibold"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.65rem",
                    letterSpacing: "0.05em",
                    color: "#9ca3af",
                  }}
                >
                  Animation
                </span>
                <div
                  className="p-3 space-y-3"
                  style={{
                    backgroundColor: "#0e0e11",
                    border: "1px solid #39393c",
                    borderRadius: "4px",
                  }}
                >
                  {/* Entrance */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "#9ca3af" }}>Entrance</span>
                    <select
                      value={entranceAnimation}
                      onChange={(e) => setEntranceAnimation(e.target.value)}
                      className="px-2 py-1 text-xs outline-none"
                      style={{
                        backgroundColor: "#39393c",
                        border: "1px solid #39393c",
                        borderRadius: "4px",
                        color: "#e3e3e3",
                        width: "112px",
                      }}
                    >
                      <option>Slide Up</option>
                      <option>Fade In</option>
                      <option>Wipe</option>
                      <option>None</option>
                    </select>
                  </div>

                  {/* Duration */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "#9ca3af" }}>Duration</span>
                    <div className="relative" style={{ width: "112px" }}>
                      <input
                        type="text"
                        value={animationDuration}
                        onChange={(e) => setAnimationDuration(Number(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs text-right outline-none"
                        style={{
                          backgroundColor: "#39393c",
                          border: "1px solid #39393c",
                          borderRadius: "4px",
                          color: "#e3e3e3",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      />
                      <span className="absolute left-2 top-1 text-xs" style={{ color: "#9ca3af" }}>s</span>
                    </div>
                  </div>

                  {/* Speed Curve */}
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#9ca3af" }}>
                      <span>Speed Curve</span>
                      <span>{animationCurve}</span>
                    </div>
                    <div
                      className="h-6 w-full relative overflow-hidden"
                      style={{
                        backgroundColor: "#39393c",
                        borderRadius: "4px",
                        border: "1px solid #39393c",
                      }}
                    >
                      <svg
                        className="absolute inset-0 w-full h-full"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                        style={{ color: "#10b981" }}
                      >
                        <path
                          d="M 0 100 C 20 100, 40 0, 100 0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
