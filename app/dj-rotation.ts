export type DjPerformer = "black" | "red" | "violet" | "gold" | "silver";

export type DjRotationPlan = {
  mainPerformer: DjPerformer;
  nextPerformer?: DjPerformer;
  slotElapsed: number;
};

export type DjRotationSong = {
  bpm: number;
  mood: "tech" | "rock" | "ballad";
};

export const DJ_ROTATION_SECONDS = 28;
export const DJ_MIN_ROTATION_SECONDS = 24;
export const DJ_HANDOFF_CUE_SECONDS = 6;
export const DJ_NEXT_PRELOAD_SECONDS = 10;
export const DJ_MAIN_MAX_PLAYBACK_RATE = 1;

export function getDjRotationSeconds(song: DjRotationSong) {
  const eightBeatSeconds = (60 / Math.max(60, song.bpm)) * 8;
  const completePhrases = Math.max(1, Math.floor(DJ_ROTATION_SECONDS / eightBeatSeconds));
  const phraseAlignedSeconds = completePhrases * eightBeatSeconds;

  return Math.round(
    Math.max(DJ_MIN_ROTATION_SECONDS, Math.min(DJ_ROTATION_SECONDS, phraseAlignedSeconds)) * 1000,
  ) / 1000;
}

export function getDjRotationOrder(song: DjRotationSong): DjPerformer[] {
  if (song.mood === "rock") return ["red", "gold", "silver", "black", "violet"];
  if (song.mood === "ballad" || song.bpm < 105) return ["violet", "black", "silver", "gold", "red"];
  if (song.bpm >= 128) return ["gold", "red", "silver", "black", "violet"];
  if (song.bpm >= 116) return ["gold", "violet", "silver", "black", "red"];
  return ["violet", "gold", "black", "silver", "red"];
}

export function getDjRotationPlan(
  availablePerformers: DjPerformer[],
  activeIndex: number,
  elapsedTime: number,
  rotationSeconds = DJ_ROTATION_SECONDS,
): DjRotationPlan {
  if (availablePerformers.length === 0) {
    return { mainPerformer: "black", slotElapsed: 0 };
  }

  const normalizedTime = Math.max(0, elapsedTime);
  const normalizedRotationSeconds = Math.max(1, rotationSeconds);
  const slotIndex = Math.floor(normalizedTime / normalizedRotationSeconds);
  const slotElapsed = normalizedTime % normalizedRotationSeconds;
  const rosterIndex = (Math.max(0, activeIndex) + slotIndex) % availablePerformers.length;

  return {
    mainPerformer: availablePerformers[rosterIndex],
    nextPerformer:
      availablePerformers.length > 1
        ? availablePerformers[(rosterIndex + 1) % availablePerformers.length]
        : undefined,
    slotElapsed,
  };
}
