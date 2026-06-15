import { useState } from "react";
import ControlPanel from "../components/ControlPanel";
import SettingsPage from "../components/SettingsPage";
import SplashScreen from "../components/SplashScreen";

type ActiveScreen = "splash" | "dashboard" | "settings";

export default function App(): JSX.Element {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("splash");

  if (activeScreen === "splash") {
    return <SplashScreen onComplete={() => setActiveScreen("dashboard")} />;
  }

  if (activeScreen === "settings") {
    return (
      <div className="bg-[#0e0e11] min-h-screen w-full">
        <SettingsPage
          onClose={() => setActiveScreen("dashboard")}
          onOpenStudio={() => setActiveScreen("dashboard")}
        />
      </div>
    );
  }

  return (
    <div className="bg-[#0e0e11] min-h-screen w-full">
      <ControlPanel onOpenSettings={() => setActiveScreen("settings")} />
    </div>
  );
}
