export interface SpeechSession {
  stop(): void;
  cancel(): void;
}
export interface SpeechOptions {
  signal?: AbortSignal;
  onStart?: () => void;
}
