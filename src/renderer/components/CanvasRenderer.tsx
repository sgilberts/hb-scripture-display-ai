import React from "react";
import type { CanvasElement, ThemeDefinition } from "../../shared/types";

interface CanvasRendererProps {
  theme: ThemeDefinition;
  elements: CanvasElement[];
  textOverride?: string;
  referenceOverride?: string;
  forceTransparentBg?: boolean;
}

export default function CanvasRenderer({
  theme,
  elements,
  textOverride,
  referenceOverride,
  forceTransparentBg = false,
}: CanvasRendererProps): JSX.Element {
  return (
    <div style={{ width: "100%", height: "100%", containerType: "size" }}>
      {/* Overlay animation keyframes */}
      <style>{`
        @keyframes overlayDrift { 0% { transform: translate(0,0); } 50% { transform: translate(10px,-8px); } 100% { transform: translate(0,0); } }
        @keyframes overlayPulse { 0%,100% { opacity: 0.15; } 50% { opacity: 0.35; } }
      `}</style>

      {/* Theme Background Layer - skip when transparent */}
      {!forceTransparentBg && (theme.backgroundStyle === "SOLID" || theme.backgroundStyle === "GRADIENT") && (() => {
        const bgEl = elements.find(el => el.id === "bg-1");
        const baseColor = bgEl?.fillColor || "#0a0a0c";
        const bgGradient = theme.fillType === "Linear Gradient" ? `linear-gradient(135deg, ${baseColor} 0%, #0a0a0c 100%)` : theme.fillType === "Radial Gradient" ? `radial-gradient(circle, ${baseColor} 0%, #0a0a0c 100%)` : baseColor;
        return <div className="absolute inset-0" style={{ background: bgGradient }} />;
      })()}
      {!forceTransparentBg && (theme.backgroundStyle === "IMAGE" || theme.backgroundStyle === "COMPOSITE") && theme.backgroundImagePath && (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${theme.backgroundImagePath.replace(/\\/g, '/').replace(/ /g, '%20')}")`, backgroundPosition: `${theme.backgroundPositionX}% ${theme.backgroundPositionY}%`, transform: `scale(${theme.scale / 100})` }} />
      )}
      {!forceTransparentBg && theme.backgroundStyle === "VIDEO" && theme.backgroundVideoPath && (
        <video src={theme.backgroundVideoPath.replace(/\\/g, '/').replace(/ /g, '%20')} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted style={{ objectPosition: `${theme.backgroundPositionX}% ${theme.backgroundPositionY}%`, transform: `scale(${theme.scale / 100})` }} />
      )}
      {!forceTransparentBg && theme.backgroundStyle !== "TRANSPARENT" && theme.backgroundStyle !== "SOLID" && theme.backgroundStyle !== "GRADIENT" && !(theme.backgroundStyle === "IMAGE" && theme.backgroundImagePath) && !(theme.backgroundStyle === "VIDEO" && theme.backgroundVideoPath) && (() => {
        const bgEl = elements.find(el => el.id === "bg-1");
        const baseColor = bgEl?.fillColor || "#1a1a2e";
        return <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${baseColor} 0%, #0a0a0c 100%)` }} />;
      })()}
      
      {elements.map(el => {
        if (!el.visible) return null;

        const elStyle: React.CSSProperties = {
          position: "absolute",
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.width}%`,
          height: `${el.height}%`,
          transform: `rotate(${el.rotation}deg)`,
          transformOrigin: "center center",
          zIndex: el.zIndex,
          pointerEvents: "none",
        };

        let content: JSX.Element | null = null;
        if (el.kind === "text") {
          const isPrimaryText = el.id === "text-1";
          const displayText = isPrimaryText && textOverride !== undefined ? textOverride : (el.text || "Text Element");
          const displayRef = isPrimaryText && referenceOverride !== undefined ? referenceOverride : "";

          content = (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: el.fontFamily || theme.fontFamily || "Inter, system-ui, sans-serif", color: el.fontColor || theme.fontColor || "#ffffff", fontSize: `${el.fontSize || 6}cqh`, textShadow: el.textShadow, WebkitTextStroke: el.textOutline || undefined, backgroundColor: el.bgOpacity ? (el.backgroundColor || `rgba(0,0,0,${el.bgOpacity})`) : "transparent", textAlign: el.textAlign || "center", padding: "8px", overflow: "hidden", whiteSpace: "pre-wrap", lineHeight: 1.2, fontWeight: 600 }}>
              <span dangerouslySetInnerHTML={{ __html: displayText }} />
              {displayRef && <span style={{ fontSize: `${(el.fontSize || 6) * 0.5}cqh`, color: theme.referenceColor || "#9ca3af", fontWeight: (theme.referenceWeight || "normal") as any, marginTop: "4px", letterSpacing: "0.15em", textTransform: "uppercase" }} dangerouslySetInnerHTML={{ __html: displayRef }} />}
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
          <div key={el.id} style={elStyle}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
