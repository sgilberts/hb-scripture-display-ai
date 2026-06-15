import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class PreviewErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    console.log("[PREVIEW INIT] ErrorBoundary mounted");
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[FRAME ERROR] Preview render failed", error, errorInfo);
    
    // Auto-recover after 1.5 seconds
    setTimeout(() => {
      console.log("[RENDER RESET] Recovering preview state");
      this.setState({ hasError: false });
    }, 1500);
  }

  render() {
    if (this.state.hasError) {
      // Fallback: clear to black
      return <div className="absolute inset-0 bg-black" />;
    }

    return this.props.children;
  }
}
