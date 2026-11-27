export type VoiceChoice = "neutral" | "edit" | "confirm" | "cancel";
export function voiceChoice(dx: number, dy: number): VoiceChoice {
  if (dy < -65 && Math.abs(dy) > Math.abs(dx)) return "cancel";
  if (dx >= 60 && Math.abs(dx) > Math.abs(dy) * 1.2) return "confirm";
  if (dx <= -60 && Math.abs(dx) > Math.abs(dy) * 1.2) return "edit";
  // Neutral release is editable, never an accidental confirmation.
  return "neutral";
}
