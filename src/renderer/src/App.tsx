import { useState, useEffect } from "react";
import ControlPanel from "../components/ControlPanel";
import SettingsPage from "../components/SettingsPage";

type ActiveScreen = "dashboard" | "settings";

export default function App(): JSX.Element {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("dashboard");

  // Auto-open settings on first run when integrations are missing
  useEffect(() => {
    const checkIntegrations = async (): Promise<void> => {
      try {
        if (!window.electron?.getIntegrationStatus) return;
        const status = await window.electron.getIntegrationStatus();
        if (!status) return;
        if (!status.hasDeepSpeechModel || !status.hasAwsCreds) {
          setActiveScreen("settings");
        }
      } catch {
        // ignore
      }
    };

    void checkIntegrations();
  }, []);

  if (activeScreen === "settings") {
    return (
      <SettingsPage
        onClose={() => setActiveScreen("dashboard")}
        onOpenStudio={() => setActiveScreen("dashboard")}
      />
    );
  }

  return <ControlPanel onOpenSettings={() => setActiveScreen("settings")} />;
}
