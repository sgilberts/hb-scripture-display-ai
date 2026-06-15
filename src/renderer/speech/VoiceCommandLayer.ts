export function detectVoiceCommand(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  
  if (!normalized) return null;

  const validCommands = [
    "next",
    "go",
    "go forward",
    "back",
    "go back",
    "stop",
    "from two to six",
    "previous verse",
    "previous chapter",
    "forward"
  ];
  
  if (validCommands.includes(normalized)) {
    return normalized;
  }

  // Also catch variations with trailing words if the core command is exact
  for (const cmd of validCommands) {
    if (normalized === cmd || normalized.startsWith(`${cmd} `)) {
      return cmd;
    }
  }

  return null;
}
