import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  "BOOT SEQUENCE INITIATED...",
  "CORE KERNEL MOUNTED",
  "NDI PIPELINE ACTIVE :: PORT 5960",
  "SYNCING CLOUD ASSETS...",
  "SYSTEM INITIALIZATION COMPLETE",
];

export default function SplashScreen({ onComplete }: SplashScreenProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const totalDuration = 4000; // 4 seconds total loading
    const intervalTime = 50;
    const steps = totalDuration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const currentProgress = Math.min(100, Math.floor((currentStep / steps) * 100));
      setProgress(currentProgress);

      if (currentProgress < 25) setLogIndex(0);
      else if (currentProgress < 50) setLogIndex(1);
      else if (currentProgress < 75) setLogIndex(2);
      else if (currentProgress < 95) setLogIndex(3);
      else setLogIndex(4);

      if (currentProgress >= 100) {
        clearInterval(timer);
        setTimeout(onComplete, 500); // Wait a tiny bit at 100%
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden font-body-sm text-on-surface antialiased pointer-events-auto bg-transparent">
      {/* Digital Tech Light Traces (Circuit Board) */}
      <svg
        className="absolute top-0 left-0 w-full h-[60vh] z-0 opacity-30 pointer-events-none"
        fill="none"
        preserveAspectRatio="xMidYMin slice"
        viewBox="0 0 1200 600"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
          <path
            d="M100,0 V120 L180,200 H350 L400,250 V300"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            strokeOpacity="0.5"
            style={{ animation: "trace-flow 6s linear infinite" }}
          ></path>
          <circle
            className="animate-pulse"
            cx="400"
            cy="300"
            fill="#10b981"
            fillOpacity="0.8"
            r="4"
            style={{ animationDelay: "2s" }}
          ></circle>
          <path
            d="M300,0 V80 L350,130 H500 L550,180 V220"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            strokeOpacity="0.4"
            style={{ animation: "trace-flow 8s linear infinite 1s" }}
          ></path>
          <circle
            className="animate-pulse"
            cx="550"
            cy="220"
            fill="#10b981"
            fillOpacity="0.7"
            r="3"
            style={{ animationDelay: "3s" }}
          ></circle>
          <path
            d="M900,0 V150 L820,230 H650 L600,280 V350"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            strokeOpacity="0.6"
            style={{ animation: "trace-flow 7s linear infinite 0.5s" }}
          ></path>
          <circle
            className="animate-pulse"
            cx="600"
            cy="350"
            fill="#10b981"
            fillOpacity="0.9"
            r="4.5"
            style={{ animationDelay: "2.5s" }}
          ></circle>
          <path
            d="M1100,0 V100 L1020,180 H850 L800,230 V270"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            strokeOpacity="0.3"
            style={{ animation: "trace-flow 9s linear infinite 2s" }}
          ></path>
          <circle
            className="animate-pulse"
            cx="800"
            cy="270"
            fill="#10b981"
            fillOpacity="0.6"
            r="2.5"
            style={{ animationDelay: "4s" }}
          ></circle>
          <path
            d="M600,0 V60 L550,110 H450 L420,140 V180"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            strokeOpacity="0.4"
            style={{ animation: "trace-flow 5s linear infinite 1.5s" }}
          ></path>
          <circle
            className="animate-pulse"
            cx="420"
            cy="180"
            fill="#10b981"
            fillOpacity="0.7"
            r="3"
            style={{ animationDelay: "1.5s" }}
          ></circle>
        </g>
      </svg>

      {/* Subtle overlay grid for industrial feel */}
      <div className="absolute inset-0 z-0 scanline opacity-20 pointer-events-none"></div>

      {/* Main Initialization Modal */}
      <main className="relative z-10 w-full max-w-md mx-4 flex flex-col bg-surface-container border-panel-margin border-outline-variant shadow-[0_0_40px_rgba(16,185,129,0.08)] rounded-lg p-5 overflow-hidden">
        {/* Neon circuit traces inside modal background */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-lg">
          {/* Horizontal traces */}
          <div className="absolute top-[18%] left-0 w-full h-[1px] overflow-hidden">
            <div className="absolute w-16 h-full bg-gradient-to-r from-transparent via-[#10b981] to-transparent shadow-[0_0_6px_#10b981]"
              style={{ animation: 'circuit-trace-h 4s linear infinite' }} />
          </div>
          <div className="absolute top-[42%] left-0 w-full h-[1px] overflow-hidden">
            <div className="absolute w-20 h-full bg-gradient-to-r from-transparent via-[#4edea3] to-transparent shadow-[0_0_8px_#10b981]"
              style={{ animation: 'circuit-trace-h 5.5s linear infinite 0.8s' }} />
          </div>
          <div className="absolute top-[68%] left-0 w-full h-[1px] overflow-hidden">
            <div className="absolute w-14 h-full bg-gradient-to-r from-transparent via-[#10b981] to-transparent shadow-[0_0_5px_#10b981]"
              style={{ animation: 'circuit-trace-h 4.2s linear infinite 1.5s' }} />
          </div>
          <div className="absolute top-[88%] left-0 w-full h-[1px] overflow-hidden">
            <div className="absolute w-12 h-full bg-gradient-to-r from-transparent via-[#4edea3] to-transparent shadow-[0_0_6px_#10b981]"
              style={{ animation: 'circuit-trace-h 6s linear infinite 0.3s' }} />
          </div>

          {/* Vertical traces */}
          <div className="absolute left-[15%] top-0 h-full w-[1px] overflow-hidden">
            <div className="absolute h-12 w-full bg-gradient-to-b from-transparent via-[#10b981] to-transparent shadow-[0_0_6px_#10b981]"
              style={{ animation: 'circuit-trace-v 4.8s linear infinite 0.5s' }} />
          </div>
          <div className="absolute left-[55%] top-0 h-full w-[1px] overflow-hidden">
            <div className="absolute h-16 w-full bg-gradient-to-b from-transparent via-[#4edea3] to-transparent shadow-[0_0_8px_#10b981]"
              style={{ animation: 'circuit-trace-v 5.2s linear infinite 1.2s' }} />
          </div>
          <div className="absolute left-[82%] top-0 h-full w-[1px] overflow-hidden">
            <div className="absolute h-10 w-full bg-gradient-to-b from-transparent via-[#10b981] to-transparent shadow-[0_0_5px_#10b981]"
              style={{ animation: 'circuit-trace-v 3.8s linear infinite 2s' }} />
          </div>

          {/* Circuit junction nodes */}
          <div className="absolute top-[18%] left-[15%] w-2 h-2 rounded-full bg-[#10b981]"
            style={{ animation: 'circuit-node-pulse 2s ease-in-out infinite' }} />
          <div className="absolute top-[42%] left-[55%] w-1.5 h-1.5 rounded-full bg-[#4edea3]"
            style={{ animation: 'circuit-node-pulse 2.5s ease-in-out infinite 0.7s' }} />
          <div className="absolute top-[68%] left-[82%] w-2 h-2 rounded-full bg-[#10b981]"
            style={{ animation: 'circuit-node-pulse 1.8s ease-in-out infinite 1.3s' }} />
          <div className="absolute top-[88%] left-[15%] w-1.5 h-1.5 rounded-full bg-[#4edea3]"
            style={{ animation: 'circuit-node-pulse 3s ease-in-out infinite 0.4s' }} />
          <div className="absolute top-[42%] left-[82%] w-1 h-1 rounded-full bg-[#10b981]"
            style={{ animation: 'circuit-node-pulse 2.2s ease-in-out infinite 1.8s' }} />
        </div>
        {/* Header / Branding */}
        <header className="relative z-[1] flex flex-col items-center justify-center pt-4 pb-8 border-b border-panel-margin border-outline-variant">
          <div className="mb-6 rounded-full bg-[#111] flex items-center justify-center overflow-hidden size-32 animate-[pulse-glow_3s_ease-in-out_infinite] ring-2 ring-[#10b981]/50 relative">
            <svg
              className="absolute w-full h-full mix-blend-screen opacity-90 scale-[1.2]"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="HallelujahBeamer Logo"
            >
              <defs>
                <linearGradient id="hb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#4edea3" />
                </linearGradient>
                <linearGradient id="hb-bg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2a2a2d" />
                  <stop offset="100%" stopColor="#111" />
                </linearGradient>
                <filter id="hb-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Base circular emblem background */}
              <circle cx="64" cy="64" r="56" fill="url(#hb-bg)" stroke="#3c4a42" strokeWidth="2" />
              
              {/* Stylized musical note / wave in the center */}
              <path 
                d="M 45 75 Q 55 50 75 45 T 85 75" 
                stroke="#e4e1e6" 
                strokeWidth="4" 
                strokeLinecap="round" 
                fill="none"
              />
              <circle cx="45" cy="75" r="6" fill="#e4e1e6" />
              <circle cx="85" cy="75" r="8" fill="#e4e1e6" />
              <path 
                d="M 75 45 L 75 35 L 95 38 L 95 65" 
                stroke="#e4e1e6" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none"
              />

              {/* Green circuit-like accents at the bottom */}
              <g filter="url(#hb-glow)">
                {/* Flowing circuit waves */}
                <path 
                  d="M 20 90 Q 40 85 64 95 T 108 90" 
                  stroke="url(#hb-grad)" 
                  strokeWidth="2.5" 
                  fill="none" 
                  strokeLinecap="round"
                />
                <path 
                  d="M 28 98 Q 48 93 64 102 T 100 98" 
                  stroke="#10b981" 
                  strokeWidth="1.5" 
                  fill="none" 
                  strokeLinecap="round" 
                  opacity="0.8"
                />
                {/* Circuit nodes */}
                <path d="M 64 95 L 64 110" stroke="#4edea3" strokeWidth="2" />
                <circle cx="64" cy="110" r="2.5" fill="#10b981" />
                <path d="M 40 88.5 L 40 100" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="40" cy="100" r="2" fill="#4edea3" />
                <path d="M 88 88.5 L 88 105" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="88" cy="105" r="2" fill="#4edea3" />
              </g>
            </svg>
          </div>
          <h1 className="font-display-lg text-3xl text-inverse-surface tracking-tight mb-2">
            <span className="font-bold text-white">Hallelujah</span>
            <span className="text-[#10b981]">Beamer</span>
          </h1>
          <h2 className="font-label-caps text-[#10b981] tracking-[0.2em] text-xs uppercase opacity-90">
            Broadcast Control System
          </h2>
          <div className="font-status-nano text-[#10b981] opacity-60 mt-1 tracking-widest uppercase text-[7px]">
            Vs 1.0.1
          </div>
        </header>

        {/* Progress Section */}
        <section className="relative z-[1] py-8 flex flex-col gap-4">
          <div className="flex justify-between items-end px-1">
            <span className="font-label-caps text-on-surface-variant text-xs">System Initialization</span>
            <span className="font-code-sm text-[#10b981] font-bold">{progress}%</span>
          </div>
          <div className="h-3 w-full bg-surface-container-lowest rounded-full overflow-hidden border border-panel-margin border-outline-variant p-[2px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
            <div
              className="h-full bg-[#10b981] rounded-full relative overflow-hidden transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            >
              {/* Animated highlight inside progress bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
        </section>

        {/* Technical Log Console */}
        <section className="relative z-[1] bg-surface-container-lowest border border-panel-margin border-outline-variant rounded p-4 h-40 overflow-hidden shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          <div className="font-code-sm text-xs flex flex-col gap-2.5">
            {BOOT_LOGS.slice(0, logIndex + 1).map((log, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 ${index === logIndex && progress < 100
                    ? "text-inverse-surface"
                    : "text-on-surface-variant opacity-75"
                  }`}
              >
                <span
                  className={`font-bold min-w-[45px] ${index === logIndex && progress < 100 ? "text-secondary animate-pulse" : "text-[#10b981]"
                    }`}
                >
                  {index === logIndex && progress < 100 ? "[WAIT]" : "[OK]"}
                </span>
                <span className="break-all">
                  {log}
                  {index === logIndex && progress < 100 && (
                    <span className="inline-block w-1.5 h-3 bg-[#10b981] ml-1 align-middle animate-ping"></span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Fading overlay for logs */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-surface-container-lowest to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-surface-container-lowest to-transparent pointer-events-none"></div>
        </section>

        {/* Decorative node indicators bottom */}
        <footer className="relative z-[1] mt-6 flex justify-between items-center px-2 opacity-50">
          <div className="flex gap-1.5">
            <div className="size-1.5 rounded-full bg-[#10b981] shadow-[0_0_5px_#10b981]"></div>
            <div className="size-1.5 rounded-full bg-outline-variant"></div>
            <div className="size-1.5 rounded-full bg-outline-variant"></div>
          </div>
          <span className="font-status-nano text-outline uppercase tracking-widest text-[8px] text-right">
            NODE-ID: HB-701X2<br />
            <span className="opacity-70">POWERED BY: SEGITECH</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
