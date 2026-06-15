export interface SpeechTranscript {
  text: string;
  isFinal: boolean;
  confidence?: number;
  parsedReference?: string | null;
}

export interface SpeechService {
  initialize(modelPath: string): Promise<void>;
  startListening(callback: (transcript: SpeechTranscript) => void): Promise<void>;
  stopListening(): Promise<void>;
}
