import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppStateProvider } from "./context/AppState";
import App from "./src/App";
import OutputCanvas from "./components/OutputCanvas";

const rootElement = document.getElementById("root");

if (!(rootElement instanceof HTMLDivElement)) {
  throw new Error("HallelujahBeamer could not find the renderer root element.");
}

function getWindowMode(): "main" | "output" {
  const mode = new URLSearchParams(window.location.search).get("window");
  return mode === "output" ? "output" : "main";
}

function RendererSwitch(): JSX.Element {
  const mode = getWindowMode();

  React.useEffect(() => {
    if (mode !== "output") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        window.electron?.exitOutputFullscreen?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  if (mode === "output") {
    return (
      <div className="h-screen w-screen bg-black">
        <OutputCanvas />
      </div>
    );
  }

  return <App />;
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AppStateProvider>
      <RendererSwitch />
    </AppStateProvider>
  </React.StrictMode>
);
