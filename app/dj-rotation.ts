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
export const DJ_HANDOFF_CUE_SECONDS = 6;

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
): DjRotationPlan {
  if (availablePerformers.length === 0) {
    return { mainPerformer: "black", slotElapsed: 0 };
  }

  const normalizedTime = Math.max(0, elapsedTime);
  const slotIndex = Math.floor(normalizedTime / DJ_ROTATION_SECONDS);
  const slotElapsed = normalizedTime % DJ_ROTATION_SECONDS;
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
