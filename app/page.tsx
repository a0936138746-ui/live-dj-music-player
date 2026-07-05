"use client";

import {
  ArrowDown,
  ArrowUp,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Download,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Song = {
  id: string;
  title: string;
  artist: string;
  language: string;
  mood: "tech" | "rock" | "ballad";
  bpm: number;
  duration: number;
  audioSrc?: string;
  visualVideo?: string;
  minAge: number;
  lyric: string[];
  accent: string;
};

type AudioAnalysis = {
  bpm: number;
  confidence: number;
  energy: number;
  mood: Song["mood"];
};

type LiveAudioMetrics = {
  volume: number;
  bass: number;
  vocal: number;
  energy: number;
  ready: boolean;
};

type VisualMode =
  | "idle"
  | "groove"
  | "sing"
  | "chorus"
  | "drop"
  | "wave"
  | "point"
  | "clap"
  | "transition";

type SingerDanceProfile = "soft" | "groove" | "hype" | "drop";
type PlaylistFilter = "all" | Song["mood"];
type ScanStatusTone = "auto" | "manual" | "fallback" | "pending" | "scanning";
type GuestDjStatus = "entering" | "live" | "exiting" | "encore";
type GuestDjScene = {
  label: string;
  status: GuestDjStatus;
  video: string;
};

type StoredLocalSong = Omit<Song, "audioSrc"> & {
  bpmOverride?: number;
  file: Blob;
  fileName: string;
  isShelved?: boolean;
  moodOverride?: Song["mood"] | "auto";
};

const visualModeLabels: Record<VisualMode, string> = {
  idle: "待機呼吸",
  groove: "跟拍律動",
  sing: "伴唱模式",
  chorus: "副歌拉升",
  drop: "低音爆點",
  wave: "揮手帶場",
  point: "聚焦觀眾",
  clap: "節拍脈衝",
  transition: "轉場淡入",
};

const singerAnimationConfig: Record<VisualMode, { frameCount: number; cycleBeats: number; note: string }> = {
  idle: { frameCount: 16, cycleBeats: 8, note: "slow breathing loop" },
  groove: { frameCount: 16, cycleBeats: 4, note: "side-step groove loop" },
  sing: { frameCount: 16, cycleBeats: 4, note: "microphone singing loop" },
  chorus: { frameCount: 16, cycleBeats: 2, note: "wide step chorus loop" },
  drop: { frameCount: 16, cycleBeats: 2, note: "bass hit crouch loop" },
  wave: { frameCount: 16, cycleBeats: 4, note: "wave to crowd loop" },
  point: { frameCount: 16, cycleBeats: 4, note: "point to audience loop" },
  clap: { frameCount: 16, cycleBeats: 1, note: "clap hop loop" },
  transition: { frameCount: 16, cycleBeats: 4, note: "smooth transition loop" },
};

const singerDanceCycleMultipliers: Record<SingerDanceProfile, number> = {
  soft: 1.35,
  groove: 1,
  hype: 0.72,
  drop: 0.54,
};

const mediaBaseUrl = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/$/, "");
const djVariantAssetsEnabled = process.env.NEXT_PUBLIC_ENABLE_DJ_VARIANTS === "true";
const singerFrameAssetsEnabled = process.env.NEXT_PUBLIC_ENABLE_SINGER_FRAMES === "true";

function getMediaUrl(src: string) {
  if (/^(blob:|data:|https?:\/\/)/i.test(src)) return src;
  if (!mediaBaseUrl) return src;

  return `${mediaBaseUrl}${src.startsWith("/") ? src : `/${src}`}`;
}

function getSingerFrameSrc(mode: VisualMode, frameIndex: number) {
  const frameNumber = String(frameIndex + 1).padStart(2, "0");
  return getMediaUrl(`/assets/holo-singer-frames/${mode}/${mode}-${frameNumber}.png`);
}

function getSingerFrameSources(mode: VisualMode) {
  return Array.from({ length: singerAnimationConfig[mode].frameCount }, (_, index) => getSingerFrameSrc(mode, index));
}

function getSingerDanceProfile(
  song: Song,
  progress: number,
  metrics: LiveAudioMetrics,
  mode: VisualMode,
  isPlaying: boolean,
): SingerDanceProfile {
  if (!isPlaying) return "soft";
  if (mode === "drop" || mode === "clap" || metrics.bass > 0.68) return "drop";
  if (mode === "chorus" || mode === "wave" || song.mood === "rock" || song.bpm >= 132 || progress >= 72) {
    return "hype";
  }
  if (song.mood === "ballad" || song.bpm < 105) return "soft";
  return "groove";
}

function getSingerDanceDrive(profile: SingerDanceProfile, visualEnergy: number, metrics: LiveAudioMetrics) {
  const base = profile === "drop" ? 0.82 : profile === "hype" ? 0.64 : profile === "groove" ? 0.42 : 0.22;
  const audioDrive = Math.max(metrics.energy * 0.9, metrics.bass * 0.76, visualEnergy * 0.72);
  return Math.min(1, Math.max(base, audioDrive));
}

function getSingerFrameCycleMs(mode: VisualMode, profile: SingerDanceProfile, beatMs: number) {
  return beatMs * singerAnimationConfig[mode].cycleBeats * singerDanceCycleMultipliers[profile];
}

const djVisual = {
  idleVideo: "/assets/dj-soft.mp4",
  softSlot: "/assets/dj-soft.mp4",
  softAlt: "/assets/dj-soft-01.mp4",
  grooveSlot: "/assets/dj-groove.mp4",
  grooveAlt: "/assets/dj-groove-01.mp4",
  peakSlot: "/assets/dj-peak.mp4",
  peakAlt: "/assets/dj-peak-01.mp4",
  rockSlot: "/assets/dj-rock-live.mp4",
  rockAlt: "/assets/dj-rock-live-01.mp4",
  guestSlot: "/assets/dj-guest-01.mp4",
  guestAlt: "/assets/dj-guest-unique-01.mp4",
};

const djVideoPools = {
  [djVisual.softSlot]: djVariantAssetsEnabled ? [djVisual.softSlot, djVisual.softAlt] : [djVisual.softSlot],
  [djVisual.grooveSlot]: djVariantAssetsEnabled ? [djVisual.grooveSlot, djVisual.grooveAlt] : [djVisual.grooveSlot],
  [djVisual.peakSlot]: djVariantAssetsEnabled ? [djVisual.peakSlot, djVisual.peakAlt] : [djVisual.peakSlot],
  [djVisual.rockSlot]: djVariantAssetsEnabled ? [djVisual.rockSlot, djVisual.rockAlt] : [djVisual.rockSlot],
  [djVisual.guestSlot]: djVariantAssetsEnabled ? [djVisual.guestSlot, djVisual.guestAlt] : [djVisual.guestSlot],
};

const ageOptions = ["全年齡", "13+", "16+", "18+"];
const playlistFilterOptions: Array<{ value: PlaylistFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "tech", label: "科技電音" },
  { value: "rock", label: "搖滾" },
  { value: "ballad", label: "抒情" },
];
const setFlowMoodOrder: Record<Song["mood"], number> = {
  ballad: 0,
  tech: 1,
  rock: 2,
};
const moodOverrideOptions: Array<{ value: Song["mood"] | "auto"; label: string }> = [
  { value: "auto", label: "AUTO" },
  { value: "tech", label: "電音" },
  { value: "rock", label: "搖滾" },
  { value: "ballad", label: "抒情" },
];
const stageLedBars = Array.from({ length: 18 }, (_, index) => index);
const stageLaserBeams = Array.from({ length: 7 }, (_, index) => index);
const stageFogLayers = Array.from({ length: 3 }, (_, index) => index);
const stageBurstRings = Array.from({ length: 3 }, (_, index) => index);
const djVideoSources = [...new Set(Object.values(djVideoPools).flat())];
const analysisConfidenceThreshold = 0.22;
const localSongDbName = "live-dj-local-songs";
const localSongStoreName = "songs";

const defaultSongs: Song[] = [];
const emptySong: Song = {
  id: "empty",
  title: "尚未加入歌曲",
  artist: "請先加入本機歌曲",
  language: "自選",
  mood: "tech",
  bpm: 122,
  duration: 210,
  minAge: 0,
  accent: "#25f3ff",
  lyric: ["點選上方的加入歌曲", "匯入你的音樂後就會出現在歌單", "DJ 會依歌曲風格開始演出"],
};

const plannedDjVideoSlots = djVideoSources;

function openLocalSongDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(localSongDbName, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(localSongStoreName)) {
        db.createObjectStore(localSongStoreName, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStoredLocalSongs() {
  const db = await openLocalSongDb();

  return new Promise<StoredLocalSong[]>((resolve, reject) => {
    const transaction = db.transaction(localSongStoreName, "readonly");
    const store = transaction.objectStore(localSongStoreName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as StoredLocalSong[]);
    transaction.oncomplete = () => db.close();
  });
}

async function saveStoredLocalSong(song: StoredLocalSong) {
  const db = await openLocalSongDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(localSongStoreName, "readwrite");
    const store = transaction.objectStore(localSongStoreName);

    store.put(song);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function clearStoredLocalSongs() {
  const db = await openLocalSongDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(localSongStoreName, "readwrite");
    const store = transaction.objectStore(localSongStoreName);

    store.clear();
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function updateStoredLocalSongShelfStatus(songId: string, isShelved: boolean) {
  const db = await openLocalSongDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(localSongStoreName, "readwrite");
    const store = transaction.objectStore(localSongStoreName);
    const request = store.get(songId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const storedSong = request.result as StoredLocalSong | undefined;
      if (storedSong) {
        store.put({
          ...storedSong,
          isShelved,
        });
      }
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function patchStoredLocalSong(songId: string, patch: Partial<Omit<StoredLocalSong, "file" | "id">>) {
  const db = await openLocalSongDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(localSongStoreName, "readwrite");
    const store = transaction.objectStore(localSongStoreName);
    const request = store.get(songId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const storedSong = request.result as StoredLocalSong | undefined;
      if (storedSong) {
        store.put({
          ...storedSong,
          ...patch,
        });
      }
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function deleteStoredLocalSong(songId: string) {
  const db = await openLocalSongDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(localSongStoreName, "readwrite");
    const store = transaction.objectStore(localSongStoreName);

    store.delete(songId);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function analyzeAudioFile(src: string): Promise<AudioAnalysis> {
  const response = await fetch(src);
  const buffer = await response.arrayBuffer();
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const decoded = await audioContext.decodeAudioData(buffer.slice(0));
  await audioContext.close();

  const channel = decoded.getChannelData(0);
  const sampleRate = decoded.sampleRate;
  const blockSize = Math.max(1024, Math.floor(sampleRate * 0.08));
  const levels: number[] = [];
  let energyTotal = 0;

  for (let offset = 0; offset < channel.length; offset += blockSize) {
    let sum = 0;
    const end = Math.min(offset + blockSize, channel.length);

    for (let i = offset; i < end; i += 1) {
      sum += channel[i] * channel[i];
    }

    const rms = Math.sqrt(sum / Math.max(1, end - offset));
    levels.push(rms);
    energyTotal += rms;
  }

  const average = energyTotal / Math.max(1, levels.length);
  const threshold = average * 1.35;
  const peaks: number[] = [];

  for (let i = 1; i < levels.length - 1; i += 1) {
    if (levels[i] > threshold && levels[i] > levels[i - 1] && levels[i] >= levels[i + 1]) {
      peaks.push((i * blockSize) / sampleRate);
    }
  }

  const candidates = new Map<number, number>();

  for (let i = 1; i < peaks.length; i += 1) {
    const interval = peaks[i] - peaks[i - 1];
    if (interval <= 0) continue;

    let bpm = 60 / interval;
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;

    const rounded = Math.round(bpm);
    candidates.set(rounded, (candidates.get(rounded) ?? 0) + 1);
  }

  const best = [...candidates.entries()].sort((a, b) => b[1] - a[1])[0];
  const bpm = best ? best[0] : Math.round(120 + average * 120);
  const confidence = best ? Math.min(1, best[1] / Math.max(1, peaks.length)) : 0.25;
  const mood: Song["mood"] = bpm < 105 ? "ballad" : average > 0.14 || bpm >= 134 ? "rock" : "tech";

  return {
    bpm,
    confidence,
    energy: average,
    mood,
  };
}

function getMoodLabel(mood: Song["mood"]) {
  if (mood === "rock") return "搖滾";
  if (mood === "ballad") return "抒情";
  return "科技電音";
}

function getBpmBand(bpm: number) {
  if (bpm < 105) return "慢速";
  if (bpm < 128) return "中速";
  return "快速";
}

function getMoodAccent(mood: Song["mood"]) {
  if (mood === "rock") return "#ff4f8b";
  if (mood === "ballad") return "#ffb74a";
  return "#25f3ff";
}

function getDjState(song: Song, progress: number, isPlaying: boolean) {
  if (!isPlaying) {
    return {
      cue: "DJ standing by",
      label: "READY",
      video: djVisual.idleVideo,
    };
  }

  if (song.mood === "ballad" || song.bpm < 105) {
    return {
      cue: "Soft showcase",
      label: "BALLAD FLOW",
      video: djVisual.softSlot,
    };
  }

  if (song.mood === "rock" || song.bpm >= 136) {
    return {
      cue: progress >= 72 ? "Rock peak" : "Rock showcase",
      label: progress >= 72 ? "HYPE DROP" : "ROCK MODE",
      video: progress >= 72 ? djVisual.peakSlot : djVisual.rockSlot,
    };
  }

  if (progress >= 75 || song.bpm >= 128) {
    return {
      cue: "Drop incoming",
      label: "HYPE DROP",
      video: djVisual.peakSlot,
    };
  }

  if (progress >= 50) {
    return {
      cue: "Energy rising",
      label: "HIGH ENERGY",
      video: djVisual.grooveSlot,
    };
  }

  return {
    cue: "Track visual",
    label: "TRACK VIDEO",
    video: song.visualVideo ?? djVisual.grooveSlot,
  };
}

function getEnergyClass(song: Song, progress: number) {
  if (song.mood === "ballad" || song.bpm < 105) return "energy-slow";
  if (song.mood === "rock" || song.bpm >= 132 || progress >= 75) return "energy-fast";
  if (progress >= 50 || song.bpm >= 120) return "energy-mid";
  return "energy-slow";
}

function getVideoRate(song: Song, progress: number, isPlaying: boolean) {
  if (!isPlaying) return 0.82;
  if (song.mood === "ballad" || song.bpm < 105) return 0.72;
  if (song.mood === "rock" || song.bpm >= 136) return progress >= 72 ? 1.24 : 1.12;
  if (progress >= 75 || song.bpm >= 128) return 1.18;
  if (progress >= 50 || song.bpm >= 118) return 1.02;
  return 0.9;
}

function getVocalistCue(song: Song, progress: number) {
  if (song.mood === "ballad") return "soft vocal";
  if (song.mood === "rock") return "crowd chant";
  if (progress >= 75) return "hype call";
  if (progress >= 50) return "build vocal";
  return "tempo chant";
}

function hasLikelyVocals(song: Song) {
  const text = `${song.title} ${song.artist} ${song.language}`.toLowerCase();
  return !/(instrumental|伴奏|純音樂|inst\.?|karaoke|off vocal)/i.test(text);
}

function chooseVisualMode({
  bassEnergy,
  beatCount,
  beatPulse,
  djSong,
  hasVocals,
  liveEnergy,
  phrasePulse,
  progress,
  vocalEnergy,
}: {
  bassEnergy: number;
  beatCount: number;
  beatPulse: number;
  djSong: Song;
  hasVocals: boolean;
  liveEnergy: number;
  phrasePulse: number;
  progress: number;
  vocalEnergy: number;
}): VisualMode {
  const isHighEnergy = djSong.mood === "rock" || djSong.bpm >= 132 || progress >= 72;
  const isSoftSection = djSong.mood === "ballad" || djSong.bpm < 105;
  const hasStrongBass = bassEnergy > 0.62 || beatPulse > 0.86;
  const hasVocalPhrase = vocalEnergy > 0.3 || phrasePulse > 0.46;
  const hasLiveLift = liveEnergy > 0.58 || progress >= 62;

  if (hasStrongBass && (isHighEnergy || bassEnergy > 0.72) && beatCount % 16 === 0) return "drop";
  if (isHighEnergy && hasLiveLift) return beatCount % 16 === 8 ? "wave" : "chorus";
  if (hasVocals && hasVocalPhrase) return beatCount % 16 === 4 ? "point" : "sing";
  if ((beatPulse > 0.72 || bassEnergy > 0.42) && !isSoftSection) return beatCount % 16 === 12 ? "clap" : "groove";
  if (beatCount % 16 === 0 && progress > 20) return "transition";
  return "idle";
}

function getGuestDjScene(song: Song, mainVideo: string, progress: number, isPlaying: boolean): GuestDjScene | undefined {
  if (!isPlaying || song.mood === "ballad" || song.bpm < 112) return undefined;
  if (mainVideo === djVisual.guestSlot) return undefined;

  const isPeakTrack = song.mood === "rock" || song.bpm >= 132;
  const guestWindows: Array<{
    end: number;
    label: string;
    start: number;
    status: Exclude<GuestDjStatus, "entering" | "exiting">;
  }> =
    isPeakTrack
      ? [
          { end: 24, label: "2ND DJ LIVE", start: 10, status: "live" },
          { end: 60, label: "DJ BATTLE", start: 48, status: "live" },
          { end: 88, label: "ENCORE", start: 80, status: "encore" },
        ]
      : song.bpm >= 122
        ? [
            { end: 30, label: "2ND DJ LIVE", start: 18, status: "live" },
            { end: 74, label: "BACK TO STAGE", start: 64, status: "encore" },
          ]
        : [
            { end: 38, label: "2ND DJ LIVE", start: 28, status: "live" },
            { end: 84, label: "FINAL CALL", start: 76, status: "encore" },
          ];
  const activeWindow = guestWindows.find((window) => progress >= window.start && progress < window.end);

  if (!activeWindow) return undefined;

  const status = progress - activeWindow.start < 2.2 ? "entering" : activeWindow.status;

  return {
    label: activeWindow.label,
    status,
    video: djVisual.guestSlot,
  };
}

function resolveDjVideo(video: string, availableVideos: Record<string, boolean>, variantSeed: number) {
  const pool = djVideoPools[video] ?? [video];
  const availablePool = pool.filter((source) => availableVideos[source]);

  if (availablePool.length > 0) {
    return availablePool[Math.abs(variantSeed) % availablePool.length];
  }

  return djVisual.softSlot;
}

function resolveOptionalDjVideo(video: string, availableVideos: Record<string, boolean>, variantSeed: number) {
  const pool = djVideoPools[video] ?? [video];
  const availablePool = pool.filter((source) => availableVideos[source]);

  if (availablePool.length > 0) {
    return availablePool[Math.abs(variantSeed) % availablePool.length];
  }

  return undefined;
}

function getEffectiveSong(
  song: Song,
  analysis: AudioAnalysis | undefined,
  moodOverride: Song["mood"] | "auto",
  bpmOverride?: number,
) {
  const usableAnalysis = analysis && analysis.confidence >= analysisConfidenceThreshold ? analysis : undefined;

  const effectiveSong = usableAnalysis
    ? {
        ...song,
        bpm: usableAnalysis.bpm,
        mood: usableAnalysis.mood,
        accent: getMoodAccent(usableAnalysis.mood),
      }
      : {
        ...song,
      };

  if (moodOverride !== "auto") {
    effectiveSong.mood = moodOverride;
    effectiveSong.accent = getMoodAccent(moodOverride);
  }

  if (typeof bpmOverride === "number") {
    effectiveSong.bpm = bpmOverride;
  }

  return effectiveSong;
}

function getScanStatus({
  analysis,
  analysisStatus,
  bpmOverride,
  isActive,
  moodOverride,
}: {
  analysis: AudioAnalysis | undefined;
  analysisStatus: string;
  bpmOverride: number | undefined;
  isActive: boolean;
  moodOverride: Song["mood"] | "auto";
}): { label: string; tone: ScanStatusTone } {
  if (moodOverride !== "auto" || typeof bpmOverride === "number") return { label: "手動", tone: "manual" };
  if (analysis && analysis.confidence >= analysisConfidenceThreshold) return { label: "AUTO", tone: "auto" };
  if (analysis) return { label: "低信心", tone: "fallback" };
  if (isActive && analysisStatus === "SCANNING") return { label: "掃描中", tone: "scanning" };
  return { label: "待掃描", tone: "pending" };
}

function getRecommendedTrackIndex(
  activeIndex: number,
  playlist: Song[],
  currentSong: Song,
  analysisById: Record<string, AudioAnalysis>,
  moodOverrides: Record<string, Song["mood"] | "auto">,
  bpmOverrides: Record<string, number>,
) {
  if (playlist.length <= 1) return -1;

  const moodPenalty = {
    tech: { tech: 0, rock: 10, ballad: 28 },
    rock: { tech: 12, rock: 0, ballad: 34 },
    ballad: { tech: 24, rock: 36, ballad: 0 },
  } satisfies Record<Song["mood"], Record<Song["mood"], number>>;

  return playlist
    .map((candidate, index) => {
      const candidateSong = getEffectiveSong(
        candidate,
        analysisById[candidate.id],
        moodOverrides[candidate.id] ?? "auto",
        bpmOverrides[candidate.id],
      );
      const naturalOrderBonus = index === (activeIndex + 1) % playlist.length ? -4 : 0;
      const bpmScore = Math.abs(candidateSong.bpm - currentSong.bpm);
      const styleScore = moodPenalty[currentSong.mood][candidateSong.mood];

      return {
        index,
        score: index === activeIndex ? Number.POSITIVE_INFINITY : bpmScore + styleScore + naturalOrderBonus,
      };
    })
    .sort((a, b) => a.score - b.score)[0].index;
}

function getCoverLetters(title: string) {
  const cleanTitle = title.replace(/[()[\]{}]/g, "").trim();
  return (cleanTitle.match(/[A-Za-z0-9]/g)?.slice(0, 2).join("") || cleanTitle.slice(0, 2) || "DJ").toUpperCase();
}

function getCoverStyle(song: Song) {
  const seed = [...song.id].reduce((total, char) => total + char.charCodeAt(0), 0);
  const secondaryHue = (seed * 37) % 360;

  return {
    "--cover-accent": song.accent,
    "--cover-secondary": `hsl(${secondaryHue} 88% 58%)`,
    "--cover-tilt": `${(seed % 18) - 9}deg`,
  } as React.CSSProperties;
}

function getCoverSecondaryColor(song: Song) {
  const seed = [...song.id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return `hsl(${(seed * 37) % 360} 88% 58%)`;
}

function getSafeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").slice(0, 80) || "song-cover";
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function guessSongMoodFromName(name: string): Song["mood"] {
  const normalizedName = name.toLowerCase();

  if (/(ballad|soft|slow|love|piano|acoustic|lo-fi|lofi|chill|抒情|慢歌|情歌|療癒|疗愈)/.test(normalizedName)) {
    return "ballad";
  }
  if (
    /(rock|metal|guitar|band|drum|drums|heavy|epic|symphonic|orchestral|power|battle|搖滾|摇滚|熱血|热血|重鼓|史詩|史诗)/.test(
      normalizedName,
    )
  ) {
    return "rock";
  }
  return "tech";
}

function guessSongBpmFromMood(mood: Song["mood"]) {
  if (mood === "ballad") return 92;
  if (mood === "rock") return 136;
  return 122;
}

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState(emptySong.duration);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(true);
  const [isGuestVideoReady, setIsGuestVideoReady] = useState(false);
  const [renderedGuestDjScene, setRenderedGuestDjScene] = useState<GuestDjScene | undefined>();
  const [audioStatus, setAudioStatus] = useState("READY");
  const [analysisById, setAnalysisById] = useState<Record<string, AudioAnalysis>>({});
  const [analysisStatus, setAnalysisStatus] = useState("SCAN READY");
  const [moodOverrides, setMoodOverrides] = useState<Record<string, Song["mood"] | "auto">>({});
  const [bpmOverrides, setBpmOverrides] = useState<Record<string, number>>({});
  const [importNotice, setImportNotice] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const [audioKick, setAudioKick] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>("idle");
  const [singerFrameIndex, setSingerFrameIndex] = useState(0);
  const [visualEnergy, setVisualEnergy] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [liveAudioMetrics, setLiveAudioMetrics] = useState<LiveAudioMetrics>({
    bass: 0,
    energy: 0,
    ready: false,
    vocal: 0,
    volume: 0,
  });
  const [age, setAge] = useState(ageOptions[0]);
  const [playlistFilter, setPlaylistFilter] = useState<PlaylistFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlist, setPlaylist] = useState<Song[]>(defaultSongs);
  const [shelvedSongs, setShelvedSongs] = useState<Song[]>([]);
  const [availableDjVideos, setAvailableDjVideos] = useState<Record<string, boolean>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioSourceElementRef = useRef<HTMLAudioElement | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const liveAudioFrameRef = useRef<number | null>(null);
  const guestExitTimerRef = useRef<number | null>(null);
  const lastLiveMetricUpdateRef = useRef(0);
  const lastVisualModeBeatRef = useRef(-1);

  const hasSongs = playlist.length > 0;
  const song = playlist[activeIndex] ?? emptySong;
  const songAudioSrc = song.audioSrc ? getMediaUrl(song.audioSrc) : undefined;
  const activeAnalysis = analysisById[song.id];
  const moodOverride = moodOverrides[song.id] ?? "auto";
  const bpmOverride = bpmOverrides[song.id];
  const usableAnalysis =
    activeAnalysis && activeAnalysis.confidence >= analysisConfidenceThreshold ? activeAnalysis : undefined;
  const analysisSource = usableAnalysis ? "AUTO" : activeAnalysis ? "FALLBACK" : "PENDING";
  const currentScanStatus = getScanStatus({
    analysis: activeAnalysis,
    analysisStatus,
    bpmOverride,
    isActive: true,
    moodOverride,
  });
  const djSong = getEffectiveSong(song, activeAnalysis, moodOverride, bpmOverride);
  const djState = getDjState(djSong, progress, isPlaying);
  const djEnergy = djState.label;
  const djVideo = resolveDjVideo(djState.video, availableDjVideos, activeIndex);
  const guestDjScene = getGuestDjScene(djSong, djVideo, progress, isPlaying);
  const guestDjVideo = renderedGuestDjScene
    ? resolveOptionalDjVideo(renderedGuestDjScene.video, availableDjVideos, activeIndex + 1)
    : undefined;
  const energyClass = getEnergyClass(djSong, progress);
  const vocalistCue = getVocalistCue(djSong, progress);
  const energyLabel =
    energyClass === "energy-fast" ? "Peak motion" : energyClass === "energy-mid" ? "Groove motion" : "Soft motion";
  const aiDjPlan =
    djSong.mood === "ballad"
      ? ["soft blend", "warm lights", "slow body cue"]
      : djSong.mood === "rock"
        ? ["drive rhythm", "amber hits", "strong gesture"]
        : progress >= 75
          ? ["trigger drop", "hype lights", "peak motion"]
          : progress >= 50
            ? ["raise energy", "tighten groove", "prepare drop"]
            : ["lock tempo", "scan energy", "build groove"];
  const aiBrainLevel = Math.min(100, Math.round((djSong.bpm / 150) * 54 + progress * 0.38));
  const mappingSourceLabel =
    moodOverride !== "auto" || typeof bpmOverride === "number"
      ? "手動修正"
      : usableAnalysis
        ? "自動分檢"
        : activeAnalysis
          ? "保守預估"
          : "等待掃描";
  const mappingConfidenceLabel = activeAnalysis
    ? `${Math.round(activeAnalysis.confidence * 100)}%`
    : "待掃描";
  const videoRate = getVideoRate(djSong, progress, isPlaying);
  const recommendedIndex = useMemo(
    () => getRecommendedTrackIndex(activeIndex, playlist, djSong, analysisById, moodOverrides, bpmOverrides),
    [activeIndex, analysisById, bpmOverrides, djSong, moodOverrides, playlist],
  );
  const recommendedSong = recommendedIndex >= 0 ? playlist[recommendedIndex] : undefined;
  const recommendedDjSong = recommendedSong
    ? getEffectiveSong(
        recommendedSong,
        analysisById[recommendedSong.id],
        moodOverrides[recommendedSong.id] ?? "auto",
        bpmOverrides[recommendedSong.id],
      )
    : undefined;
  const queueNextSong = playlist.length > 1 ? playlist[(activeIndex + 1) % playlist.length] : undefined;
  const queueNextDjSong = queueNextSong
    ? getEffectiveSong(
        queueNextSong,
        analysisById[queueNextSong.id],
        moodOverrides[queueNextSong.id] ?? "auto",
        bpmOverrides[queueNextSong.id],
      )
    : undefined;
  const elapsedTime = (trackDuration * progress) / 100;
  const remainingTime = Math.max(0, trackDuration - elapsedTime);
  const playlistRows = useMemo(
    () =>
      playlist.map((item, index) => ({
        effectiveSong: getEffectiveSong(
          item,
          analysisById[item.id],
          moodOverrides[item.id] ?? "auto",
          bpmOverrides[item.id],
        ),
        scanStatus: getScanStatus({
          analysis: analysisById[item.id],
          analysisStatus,
          bpmOverride: bpmOverrides[item.id],
          isActive: index === activeIndex,
          moodOverride: moodOverrides[item.id] ?? "auto",
        }),
        index,
        item,
      })),
    [activeIndex, analysisById, analysisStatus, bpmOverrides, moodOverrides, playlist],
  );
  const filteredPlaylistRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return playlistRows.filter(({ effectiveSong, item }) => {
      const matchesFilter = playlistFilter === "all" || effectiveSong.mood === playlistFilter;
      const searchableText = [
        item.title,
        item.artist,
        item.language,
        getMoodLabel(effectiveSong.mood),
        `${effectiveSong.bpm}`,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (query.length === 0 || searchableText.includes(query));
    });
  }, [playlistFilter, playlistRows, searchQuery]);
  const playlistFilterCounts = useMemo(
    () =>
      playlistRows.reduce<Record<PlaylistFilter, number>>(
        (counts, row) => ({
          ...counts,
          all: counts.all + 1,
          [row.effectiveSong.mood]: counts[row.effectiveSong.mood] + 1,
        }),
        { all: 0, tech: 0, rock: 0, ballad: 0 },
      ),
    [playlistRows],
  );
  const playlistInsights = useMemo(() => {
    const totalBpm = playlistRows.reduce((sum, row) => sum + row.effectiveSong.bpm, 0);
    const manualCount = playlistRows.filter((row) => row.scanStatus.tone === "manual").length;
    const pendingCount = playlistRows.filter(
      (row) => row.scanStatus.tone === "pending" || row.scanStatus.tone === "scanning",
    ).length;

    return {
      averageBpm: playlistRows.length > 0 ? Math.round(totalBpm / playlistRows.length) : 0,
      manualCount,
      pendingCount,
    };
  }, [playlistRows]);
  const modeTimeline =
    djSong.mood === "tech"
      ? [
          { label: "LIVE", active: isPlaying && progress < 50 },
          { label: "HIGH", active: isPlaying && progress >= 50 && progress < 75 },
          { label: "HYPE", active: isPlaying && progress >= 75 },
        ]
      : [{ label: djSong.mood === "rock" ? "ROCK" : "BALLAD", active: isPlaying }];
  const beatMs = Math.round(60000 / djSong.bpm);
  const eqMs = Math.max(360, Math.round(beatMs * 1.08));
  const lightMs = Math.max(520, Math.round(beatMs * 1.7));
  const spinMs = Math.max(1200, Math.round(beatMs * 4.8));
  const hasAudio = Boolean(songAudioSrc);
  const singerDanceProfile = getSingerDanceProfile(djSong, progress, liveAudioMetrics, visualMode, isPlaying);
  const singerDanceDrive = getSingerDanceDrive(singerDanceProfile, visualEnergy, liveAudioMetrics);
  const singerFrameCount = singerFrameAssetsEnabled ? singerAnimationConfig[visualMode].frameCount : 1;
  const singerFrameSrc = singerFrameAssetsEnabled
    ? getSingerFrameSrc(visualMode, singerFrameIndex % singerFrameCount)
    : getMediaUrl("/assets/holo-singer.png");
  const singerFramePreloadSources = useMemo(
    () => (singerFrameAssetsEnabled ? getSingerFrameSources(visualMode) : []),
    [visualMode],
  );
  const activeLyricIndex = useMemo(() => {
    return Math.min(
      song.lyric.length - 1,
      Math.floor((progress / 100) * song.lyric.length),
    );
  }, [progress, song]);

  function stopLiveAudioLoop() {
    if (liveAudioFrameRef.current !== null) {
      window.cancelAnimationFrame(liveAudioFrameRef.current);
      liveAudioFrameRef.current = null;
    }
  }

  function resetLiveAudioMetrics() {
    setLiveAudioMetrics({
      bass: 0,
      energy: 0,
      ready: Boolean(analyserRef.current),
      vocal: 0,
      volume: 0,
    });
  }

  function setupLiveAudioAnalyzer() {
    const audio = audioRef.current;
    if (!audio) return;

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextClass();
    }

    const audioContext = audioContextRef.current;

    if (audioSourceElementRef.current === audio && analyserRef.current) {
      audioContext.resume().catch(() => undefined);
      return;
    }

    audioSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.84;

    const source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    audioSourceRef.current = source;
    audioSourceElementRef.current = audio;
    analyserRef.current = analyser;
    frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    audioContext.resume().catch(() => undefined);
  }

  function readLiveAudioMetrics() {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    const frequencyData = frequencyDataRef.current;

    if (!analyser || !audioContext || !frequencyData) return;

    analyser.getByteFrequencyData(frequencyData);

    const binHz = audioContext.sampleRate / 2 / frequencyData.length;
    const averageRange = (minHz: number, maxHz: number) => {
      const start = Math.max(0, Math.floor(minHz / binHz));
      const end = Math.min(frequencyData.length - 1, Math.ceil(maxHz / binHz));
      let total = 0;
      let count = 0;

      for (let index = start; index <= end; index += 1) {
        total += frequencyData[index];
        count += 1;
      }

      return count ? total / count / 255 : 0;
    };

    const now = window.performance.now();

    if (now - lastLiveMetricUpdateRef.current > 70) {
      const bass = Math.min(1, averageRange(32, 180) * 2.6);
      const vocal = Math.min(1, averageRange(360, 3400) * 1.9);
      const volume = Math.min(1, averageRange(60, 12000) * 1.7);
      const energy = Math.min(1, volume * 0.52 + bass * 0.34 + vocal * 0.14);

      lastLiveMetricUpdateRef.current = now;
      setLiveAudioMetrics((current) => ({
        bass: current.bass * 0.58 + bass * 0.42,
        energy: current.energy * 0.62 + energy * 0.38,
        ready: true,
        vocal: current.vocal * 0.5 + vocal * 0.5,
        volume: current.volume * 0.62 + volume * 0.38,
      }));
    }

    liveAudioFrameRef.current = window.requestAnimationFrame(readLiveAudioMetrics);
  }

  useEffect(() => {
    let isCancelled = false;

    Promise.all(
      plannedDjVideoSlots.map(async (source) => {
        try {
          const response = await fetch(getMediaUrl(source), { method: "HEAD" });
          return [source, response.ok] as const;
        } catch {
          return [source, false] as const;
        }
      }),
    ).then((entries) => {
      if (isCancelled) return;
      setAvailableDjVideos(Object.fromEntries(entries));
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopLiveAudioLoop();
      audioSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      const audioContext = audioContextRef.current;
      audioSourceRef.current = null;
      audioSourceElementRef.current = null;
      analyserRef.current = null;
      frequencyDataRef.current = null;
      audioContextRef.current = null;
      audioContext?.close().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!importNotice) return;

    const timer = window.setTimeout(() => setImportNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [importNotice]);

  useEffect(() => {
    let isCancelled = false;
    const objectUrls: string[] = [];

    readStoredLocalSongs()
      .then((storedSongs) => {
        if (isCancelled || storedSongs.length === 0) return;

        const restoredEntries = storedSongs.map((storedSong) => {
          const audioSrc = URL.createObjectURL(storedSong.file);
          objectUrls.push(audioSrc);
          const { bpmOverride, file: _file, fileName: _fileName, isShelved, moodOverride, ...songData } = storedSong;

          return {
            bpmOverride,
            isShelved: Boolean(isShelved),
            moodOverride,
            song: {
              ...songData,
              audioSrc,
            },
          };
        });
        const restoredPlaylist = restoredEntries.filter((item) => !item.isShelved).map((item) => item.song);
        const restoredShelvedSongs = restoredEntries.filter((item) => item.isShelved).map((item) => item.song);
        const restoredBpmOverrides = Object.fromEntries(
          restoredEntries
            .filter((item) => typeof item.bpmOverride === "number")
            .map((item) => [item.song.id, item.bpmOverride as number]),
        );
        const restoredMoodOverrides = Object.fromEntries(
          restoredEntries
            .filter((item) => item.moodOverride && item.moodOverride !== "auto")
            .map((item) => [item.song.id, item.moodOverride as Song["mood"]]),
        );

        setPlaylist((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          const missingSongs = restoredPlaylist.filter((item) => !currentIds.has(item.id));
          return missingSongs.length > 0 ? [...current, ...missingSongs] : current;
        });
        setShelvedSongs((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          const missingSongs = restoredShelvedSongs.filter((item) => !currentIds.has(item.id));
          return missingSongs.length > 0 ? [...current, ...missingSongs] : current;
        });
        setBpmOverrides((current) => ({
          ...restoredBpmOverrides,
          ...current,
        }));
        setMoodOverrides((current) => ({
          ...restoredMoodOverrides,
          ...current,
        }));
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !hasAudio) {
      stopLiveAudioLoop();
      resetLiveAudioMetrics();
      return;
    }

    try {
      setupLiveAudioAnalyzer();
      stopLiveAudioLoop();
      liveAudioFrameRef.current = window.requestAnimationFrame(readLiveAudioMetrics);
    } catch {
      resetLiveAudioMetrics();
    }

    return () => stopLiveAudioLoop();
  }, [hasAudio, isPlaying, song.id]);

  useEffect(() => {
    if (!isPlaying || hasAudio) return;

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) return 0;
        return current + 0.45;
      });
    }, 240);

    return () => window.clearInterval(timer);
  }, [hasAudio, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audioContextRef.current?.resume().catch(() => undefined);
      audio.play().catch(() => undefined);
      return;
    }

    audio.pause();
  }, [isPlaying, songAudioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.muted = isMuted;
  }, [isMuted, songAudioSrc, volume]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT") return;

      if (event.code === "Space") {
        event.preventDefault();
        setIsPlaying((current) => !current);
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        moveSong(1);
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        moveSong(-1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex]);

  useEffect(() => {
    setTrackDuration(song.duration);
    setAudioStatus(songAudioSrc ? "LOADING" : "DEMO");
  }, [song, songAudioSrc]);

  useEffect(() => {
    if (!songAudioSrc || analysisById[song.id]) return;

    let isCancelled = false;
    setAnalysisStatus("SCANNING");

    analyzeAudioFile(songAudioSrc)
      .then((analysis) => {
        if (isCancelled) return;
        setAnalysisById((current) => ({
          ...current,
          [song.id]: analysis,
        }));
        setAnalysisStatus(
          analysis.confidence >= analysisConfidenceThreshold ? "AUTO MAPPED" : "LOW CONFIDENCE",
        );
      })
      .catch(() => {
        if (isCancelled) return;
        setAnalysisStatus("MANUAL DATA");
      });

    return () => {
      isCancelled = true;
    };
  }, [analysisById, song, songAudioSrc]);

  useEffect(() => {
    if (!isPlaying) return;

    const root = document.documentElement;
    const timer = window.setInterval(() => {
      root.classList.add("beat-on");
      window.setTimeout(() => root.classList.remove("beat-on"), Math.min(180, beatMs * 0.42));
    }, beatMs);

    return () => {
      window.clearInterval(timer);
      root.classList.remove("beat-on");
    };
  }, [beatMs, isPlaying]);

  useEffect(() => {
    setSingerFrameIndex(0);
  }, [song.id, visualMode]);

  useEffect(() => {
    if (!isPlaying || !hasSongs || singerFrameCount <= 1) {
      setSingerFrameIndex(0);
      return;
    }

    const cycleMs = getSingerFrameCycleMs(visualMode, singerDanceProfile, beatMs);
    const frameMs = Math.max(34, Math.round(cycleMs / singerFrameCount));
    const timer = window.setInterval(() => {
      setSingerFrameIndex((current) => (current + 1) % singerFrameCount);
    }, frameMs);

    return () => window.clearInterval(timer);
  }, [beatMs, hasSongs, isPlaying, singerDanceProfile, singerFrameCount, visualMode]);

  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>(".dj-video");
    if (!video) return;

    video.playbackRate = videoRate;
    video.play().catch(() => undefined);
  }, [djVideo, videoRate]);

  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>(".guest-dj video");
    if (!video) return;

    video.playbackRate = Math.min(1.12, Math.max(0.86, videoRate));
    video.play().catch(() => undefined);
  }, [guestDjVideo, videoRate]);

  useEffect(() => {
    if (guestExitTimerRef.current !== null) {
      window.clearTimeout(guestExitTimerRef.current);
      guestExitTimerRef.current = null;
    }

    if (guestDjScene) {
      setRenderedGuestDjScene(guestDjScene);
      return;
    }

    setRenderedGuestDjScene((current) =>
      current
        ? {
            ...current,
            label: "EXITING",
            status: "exiting",
          }
        : undefined,
    );

    guestExitTimerRef.current = window.setTimeout(() => {
      setRenderedGuestDjScene(undefined);
      guestExitTimerRef.current = null;
    }, 720);

    return () => {
      if (guestExitTimerRef.current !== null) {
        window.clearTimeout(guestExitTimerRef.current);
        guestExitTimerRef.current = null;
      }
    };
  }, [guestDjScene?.label, guestDjScene?.status, guestDjScene?.video]);

  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>(".dj-video");
    setIsVideoReady(Boolean(video?.readyState && video.readyState >= 2));
  }, [djVideo]);

  useEffect(() => {
    setIsGuestVideoReady(false);
  }, [guestDjVideo]);

  useEffect(() => {
    if (isPlaying) return;

    lastVisualModeBeatRef.current = -1;
    setVisualMode("idle");
    setVisualEnergy(0);
    setVoiceLevel(0);
  }, [isPlaying, song.id]);

  function selectSong(index: number) {
    audioRef.current?.pause();
    setActiveIndex(index);
    setProgress(0);
    setIsPlaying(true);
  }

  function moveSong(direction: number) {
    if (playlist.length === 0) return;

    const nextIndex = (activeIndex + direction + playlist.length) % playlist.length;
    selectSong(nextIndex);
  }

  function updateAudioProgress() {
    const audio = audioRef.current;
    if (!audio?.duration) return;

    const currentProgress = (audio.currentTime / audio.duration) * 100;
    setProgress(currentProgress);
    const beatPosition = (audio.currentTime * djSong.bpm) / 60;
    const beatCount = Math.floor(beatPosition);
    const beatPulse = Math.max(0, Math.sin(beatPosition * Math.PI * 2));
    const phrasePulse = Math.max(0, Math.sin(audio.currentTime * (djSong.mood === "ballad" ? 2.8 : 5.2)));
    const detectedBass = liveAudioMetrics.ready ? liveAudioMetrics.bass : 0;
    const detectedEnergy = liveAudioMetrics.ready ? liveAudioMetrics.energy : 0;
    const detectedVocal = hasLikelyVocals(song) && liveAudioMetrics.ready ? liveAudioMetrics.vocal : 0;
    const voiceDrive = hasLikelyVocals(song) ? Math.max(phrasePulse * 0.54, detectedVocal) : 0;
    const energyDrive = Math.min(
      1,
      beatPulse * 0.48 +
        phrasePulse * 0.22 +
        detectedBass * 0.24 +
        detectedEnergy * 0.22 +
        (djSong.mood === "rock" ? 0.18 : 0) +
        (currentProgress >= 66 ? 0.14 : 0),
    );
    const actionWindow = djSong.bpm >= 128 || djSong.mood === "rock" ? 4 : 8;
    const shouldSwitchVisualMode =
      beatCount > 0 &&
      beatCount !== lastVisualModeBeatRef.current &&
      beatCount % actionWindow === 0;

    setVisualEnergy(energyDrive);
    setVoiceLevel(voiceDrive);
    setAudioKick(beatPulse > 0.78 || detectedBass > 0.62);

    if (shouldSwitchVisualMode) {
      lastVisualModeBeatRef.current = beatCount;
      setVisualMode(
        chooseVisualMode({
          bassEnergy: detectedBass,
          beatCount,
          beatPulse,
          djSong,
          hasVocals: hasLikelyVocals(song),
          liveEnergy: detectedEnergy,
          phrasePulse,
          progress: currentProgress,
          vocalEnergy: detectedVocal,
        }),
      );
    }
  }

  function seekTrack(value: number) {
    setProgress(value);

    const audio = audioRef.current;
    if (!audio?.duration) return;

    audio.currentTime = (audio.duration * value) / 100;
  }

  function updateTrackDuration() {
    const audio = audioRef.current;
    if (!audio?.duration) return;

    setTrackDuration(audio.duration);
  }

  function changeVolume(value: number) {
    setVolume(value);
    setIsMuted(value === 0);
  }

  function patchSongInMemory(
    songId: string,
    patch: Partial<Pick<Song, "accent" | "bpm" | "mood">> &
      Partial<Pick<StoredLocalSong, "bpmOverride" | "moodOverride">>,
  ) {
    const { bpmOverride: _bpmOverride, moodOverride: _moodOverride, ...songPatch } = patch;

    setPlaylist((current) => current.map((item) => (item.id === songId ? { ...item, ...songPatch } : item)));
    setShelvedSongs((current) => current.map((item) => (item.id === songId ? { ...item, ...songPatch } : item)));
    void patchStoredLocalSong(songId, patch).catch(() => undefined);
  }

  function setCurrentMoodOverride(nextMood: Song["mood"] | "auto") {
    if (!hasSongs) return;

    setMoodOverrides((current) => {
      if (nextMood === "auto") {
        const { [song.id]: _removed, ...next } = current;
        return next;
      }

      return {
        ...current,
        [song.id]: nextMood,
      };
    });

    if (nextMood === "auto") {
      const autoMood =
        activeAnalysis && activeAnalysis.confidence >= analysisConfidenceThreshold
          ? activeAnalysis.mood
          : guessSongMoodFromName(song.title);

      patchSongInMemory(song.id, {
        accent: getMoodAccent(autoMood),
        mood: autoMood,
        moodOverride: "auto",
      });
      return;
    }

    patchSongInMemory(song.id, {
      accent: getMoodAccent(nextMood),
      mood: nextMood,
      moodOverride: nextMood,
    });
  }

  function setCurrentBpmOverride(nextBpm: number) {
    if (!hasSongs) return;

    const normalizedBpm = Math.max(60, Math.min(180, Math.round(nextBpm)));
    setBpmOverrides((current) => ({
      ...current,
      [song.id]: normalizedBpm,
    }));
    patchSongInMemory(song.id, {
      bpm: normalizedBpm,
      bpmOverride: normalizedBpm,
    });
  }

  function resetCurrentAutoMapping() {
    if (!hasSongs) return;

    const autoMood = usableAnalysis?.mood ?? guessSongMoodFromName(song.title);
    const autoBpm = usableAnalysis?.bpm ?? guessSongBpmFromMood(autoMood);

    setMoodOverrides((current) => {
      const { [song.id]: _removed, ...next } = current;
      return next;
    });
    setBpmOverrides((current) => {
      const { [song.id]: _removed, ...next } = current;
      return next;
    });
    patchSongInMemory(song.id, {
      accent: getMoodAccent(autoMood),
      bpm: autoBpm,
      bpmOverride: undefined,
      mood: autoMood,
      moodOverride: "auto",
    });
  }

  function sortPlaylistForDjSet() {
    if (playlist.length <= 1) return;

    const activeSongId = song.id;
    const sortedPlaylist = [...playlist].sort((first, second) => {
      const firstSong = getEffectiveSong(
        first,
        analysisById[first.id],
        moodOverrides[first.id] ?? "auto",
        bpmOverrides[first.id],
      );
      const secondSong = getEffectiveSong(
        second,
        analysisById[second.id],
        moodOverrides[second.id] ?? "auto",
        bpmOverrides[second.id],
      );
      const moodDifference = setFlowMoodOrder[firstSong.mood] - setFlowMoodOrder[secondSong.mood];

      if (moodDifference !== 0) return moodDifference;
      if (firstSong.bpm !== secondSong.bpm) return firstSong.bpm - secondSong.bpm;
      return first.title.localeCompare(second.title, "zh-Hant");
    });

    setPlaylist(sortedPlaylist);
    setActiveIndex(Math.max(0, sortedPlaylist.findIndex((item) => item.id === activeSongId)));
    setPlaylistFilter("all");
    setSearchQuery("");
    setImportNotice("已依風格與 BPM 整理歌單");
  }

  function movePlaylistItem(index: number, direction: number) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= playlist.length) return;

    setPlaylist((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });

    if (activeIndex === index) {
      setActiveIndex(targetIndex);
    } else if (activeIndex === targetIndex) {
      setActiveIndex(index);
    }
  }

  function shelvePlaylistItem(index: number) {
    const shelvedSong = playlist[index];
    if (!shelvedSong) return;

    setPlaylist((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setShelvedSongs((current) => [...current, shelvedSong]);
    void updateStoredLocalSongShelfStatus(shelvedSong.id, true).catch(() => undefined);
    settleActiveIndexAfterRemoval(index);
  }

  function restoreShelvedSong(index: number) {
    const restoredSong = shelvedSongs[index];
    if (!restoredSong) return;

    setShelvedSongs((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setPlaylist((current) => [...current, restoredSong]);
    void updateStoredLocalSongShelfStatus(restoredSong.id, false).catch(() => undefined);
  }

  function clearAllSongs() {
    const confirmed = window.confirm("確定要全部清除嗎？這會移除目前歌單、下架區與已儲存的本機匯入歌曲。");
    if (!confirmed) return;

    [...playlist, ...shelvedSongs].forEach((item) => {
      if (item.audioSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(item.audioSrc);
      }
    });

    audioRef.current?.pause();
    setPlaylist(defaultSongs);
    setShelvedSongs([]);
    setActiveIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setAnalysisById({});
    setMoodOverrides({});
    setBpmOverrides({});
    setImportNotice("");
    setIsDraggingFiles(false);
    setAnalysisStatus("SCAN READY");
    void clearStoredLocalSongs();
  }

  function forgetSong(songToForget: Song) {
    if (songToForget.audioSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(songToForget.audioSrc);
    }

    setAnalysisById((current) => {
      const { [songToForget.id]: _removed, ...next } = current;
      return next;
    });
    setMoodOverrides((current) => {
      const { [songToForget.id]: _removed, ...next } = current;
      return next;
    });
    setBpmOverrides((current) => {
      const { [songToForget.id]: _removed, ...next } = current;
      return next;
    });
    void deleteStoredLocalSong(songToForget.id).catch(() => undefined);
  }

  function settleActiveIndexAfterRemoval(index: number) {
    const nextLength = playlist.length - 1;

    if (activeIndex === index) {
      audioRef.current?.pause();
      setProgress(0);
      setIsPlaying(false);
      setActiveIndex(nextLength > 0 ? Math.min(index, nextLength - 1) : 0);
      return;
    }

    if (activeIndex > index) {
      setActiveIndex((current) => Math.max(0, current - 1));
    }
  }

  function deletePlaylistItem(index: number) {
    const songToDelete = playlist[index];
    if (!songToDelete) return;

    const confirmed = window.confirm(`確定永久刪除「${songToDelete.title}」嗎？`);
    if (!confirmed) return;

    setPlaylist((current) => current.filter((_, itemIndex) => itemIndex !== index));
    forgetSong(songToDelete);
    settleActiveIndexAfterRemoval(index);
  }

  function deleteShelvedSong(index: number) {
    const songToDelete = shelvedSongs[index];
    if (!songToDelete) return;

    const confirmed = window.confirm(`確定永久刪除「${songToDelete.title}」嗎？`);
    if (!confirmed) return;

    setShelvedSongs((current) => current.filter((_, itemIndex) => itemIndex !== index));
    forgetSong(songToDelete);
  }

  function getAudioFiles(files: File[]) {
    return files.filter((file) => {
      return file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name);
    });
  }

  function handleFileDragOver(event: React.DragEvent<HTMLElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;

    event.preventDefault();
    setIsDraggingFiles(true);
  }

  function handleFileDragLeave(event: React.DragEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDraggingFiles(false);
  }

  function handleFileDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);

    const audioFiles = getAudioFiles(Array.from(event.dataTransfer.files));
    if (audioFiles.length === 0) {
      setImportNotice("沒有找到可匯入的音訊檔");
      return;
    }

    addLocalSongs(audioFiles);
  }

  function addLocalSongs(files: File[]) {
    const audioFiles = getAudioFiles(files);
    if (audioFiles.length === 0) {
      setImportNotice("沒有找到可匯入的音訊檔");
      return;
    }

    const newSongs = audioFiles.map((file, index) => {
      const audioSrc = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const songId = `local-${Date.now()}-${index}-${randomSuffix}`;
      const guessedMood = guessSongMoodFromName(cleanTitle);
      const guessedBpm = guessSongBpmFromMood(guessedMood);

      return {
        id: songId,
        title: cleanTitle,
        artist: "Local Track",
        language: "自選",
        mood: guessedMood,
        bpm: guessedBpm,
        duration: 210,
        audioSrc,
        minAge: 0,
        accent: getMoodAccent(guessedMood),
        lyric: ["Local track loaded", "Scanning tempo and energy", "DJ mapping will update"],
        sourceFile: file,
      };
    });
    const firstNewIndex = playlist.length;

    setPlaylist((current) =>
      newSongs.reduce<Song[]>((next, item) => {
        const { sourceFile: _sourceFile, ...songItem } = item;
        return [...next, songItem];
      }, current),
    );
    setActiveIndex(firstNewIndex);
    setProgress(0);
    setIsPlaying(true);
    setImportNotice(
      newSongs.length === 1 ? `已加入：${newSongs[0].title}` : `已加入 ${newSongs.length} 首歌曲`,
    );

    newSongs.forEach((item) => {
      const { audioSrc: _audioSrc, sourceFile, ...storedSong } = item;
      void saveStoredLocalSong({
        ...storedSong,
        file: sourceFile,
        fileName: sourceFile.name,
        isShelved: false,
      }).catch(() => undefined);
    });
  }

  function handleLocalSongChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    addLocalSongs(files);
    event.target.value = "";
  }

  function downloadCurrentCover() {
    const canvas = document.createElement("canvas");
    const size = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    const secondaryColor = getCoverSecondaryColor(djSong);
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#090b12");
    gradient.addColorStop(0.42, djSong.accent);
    gradient.addColorStop(1, secondaryColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#050608";
      ctx.fillRect(i * 84 - 40, 760 - (i % 5) * 32, 36, 260 + (i % 4) * 42);
    }

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.42, 260, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.42, 148, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f8fbff";
    ctx.font = "900 210px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getCoverLetters(song.title), size / 2, size * 0.42);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 58px Arial";
    ctx.fillText(song.title.slice(0, 30), 92, 930);
    ctx.font = "700 34px Arial";
    ctx.fillStyle = "rgba(248, 251, 255, 0.72)";
    ctx.fillText(`${getMoodLabel(djSong.mood)} / ${djSong.bpm} BPM`, 92, 995);
    ctx.fillText(song.artist, 92, 1050);

    const link = document.createElement("a");
    link.download = `${getSafeFileName(song.title)}-cover.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main
      className={`player-shell mood-${djSong.mood} ${energyClass} ${audioKick && isPlaying ? "audio-kick" : ""} ${
        isDraggingFiles ? "is-dragging-files" : ""
      }`}
      onDragLeave={handleFileDragLeave}
      onDragOver={handleFileDragOver}
      onDrop={handleFileDrop}
      style={
        {
          "--accent": djSong.accent,
          "--beat-ms": `${beatMs}ms`,
          "--eq-ms": `${eqMs}ms`,
          "--light-ms": `${lightMs}ms`,
          "--bass-level": liveAudioMetrics.bass.toFixed(2),
          "--spin-ms": `${spinMs}ms`,
          "--stage-energy": Math.max(visualEnergy, liveAudioMetrics.energy).toFixed(2),
        } as React.CSSProperties
      }
    >
      <div className="drop-overlay" aria-hidden="true">
        <Sparkles size={22} />
        <span>放開加入歌曲</span>
      </div>
      <section className="studio">
        <header className="topbar">
          <div>
            <p className="kicker">Live AI DJ Player</p>
            <h1>真人 DJ 動態音樂播放器</h1>
          </div>

          <div className="top-actions">
            <label className="add-song-button">
              <Upload size={18} />
              <span>加入歌曲</span>
              <input accept="audio/*" multiple onChange={handleLocalSongChange} type="file" />
            </label>

            <button className="reset-list-button" onClick={clearAllSongs} type="button">
              <RotateCcw size={18} />
              <span>全部清除</span>
            </button>

            <label className="age-filter">
              <span>年齡</span>
              <select value={age} onChange={(event) => setAge(event.target.value)}>
                {ageOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <section className="hero-grid">
          <aside className="song-list" aria-label="歌曲清單">
            <div className="playlist-meta">
              <span>歌曲清單</span>
              <span>
                {playlist.length > 0 ? `顯示 ${filteredPlaylistRows.length} / ${playlist.length}` : "0 首"}
              </span>
            </div>
            <div className="playlist-tools">
              <label className="playlist-search">
                <Search size={14} />
                <input
                  aria-label="搜尋歌曲"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜尋歌曲 / 歌手 / BPM"
                  type="search"
                  value={searchQuery}
                />
              </label>
              <div className="playlist-filters" aria-label="風格篩選">
                {playlistFilterOptions.map((option) => (
                  <button
                    aria-pressed={playlistFilter === option.value}
                    className={playlistFilter === option.value ? "active" : ""}
                    key={option.value}
                    onClick={() => setPlaylistFilter(option.value)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <small>{playlistFilterCounts[option.value]}</small>
                  </button>
                ))}
              </div>
              <div className="playlist-insights" aria-label="歌單整理狀態">
                <span>
                  <small>平均</small>
                  <strong>{playlistInsights.averageBpm || "--"} BPM</strong>
                </span>
                <span>
                  <small>手動</small>
                  <strong>{playlistInsights.manualCount}</strong>
                </span>
                <span>
                  <small>待掃描</small>
                  <strong>{playlistInsights.pendingCount}</strong>
                </span>
              </div>
              <button
                className="smart-sort-button"
                disabled={playlist.length <= 1}
                onClick={sortPlaylistForDjSet}
                type="button"
              >
                <Sparkles size={14} />
                智慧整理歌單
              </button>
            </div>
            {playlist.length === 0 ? (
              <p className="shelf-empty">目前沒有歌曲，請點上方「加入歌曲」或直接拖放音訊檔。</p>
            ) : null}
            {importNotice ? (
              <div className="import-notice">
                <Sparkles size={14} />
                <span>{importNotice}</span>
              </div>
            ) : null}
            {playlist.length > 0 && filteredPlaylistRows.length === 0 ? (
              <p className="shelf-empty">沒有符合目前搜尋或分類的歌曲。</p>
            ) : null}
            {filteredPlaylistRows.map(({ effectiveSong: cardSong, index, item, scanStatus }) => {
              return (
                <article
                  className={`song-card ${index === activeIndex ? "active" : ""}`}
                  key={item.id}
                >
                  <button className="song-card-main" onClick={() => selectSong(index)} type="button">
                  <span className="song-card-content">
                    <span className="song-cover" style={getCoverStyle(cardSong)}>
                      <span>{getCoverLetters(item.title)}</span>
                    </span>
                    <span className="song-card-info">
                      <span className="song-card-top">
                        <span className="song-language">{getMoodLabel(cardSong.mood)}</span>
                        {index === activeIndex ? (
                          <span className="song-status">{isPlaying ? "播放中" : "已選取"}</span>
                        ) : null}
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.artist}</small>
                      <span className="song-card-foot">
                        <span>{cardSong.bpm} BPM</span>
                        <span className={`scan-badge status-${scanStatus.tone}`}>{scanStatus.label}</span>
                      </span>
                    </span>
                  </span>
                  </button>
                  <span className="song-card-actions">
                    <button
                      aria-label="上移歌曲"
                      disabled={index === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        movePlaylistItem(index, -1);
                      }}
                      type="button"
                      title="上移"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label="下移歌曲"
                      disabled={index === playlist.length - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        movePlaylistItem(index, 1);
                      }}
                      type="button"
                      title="下移"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className="action-shelve"
                      aria-label="下架歌曲"
                      onClick={(event) => {
                        event.stopPropagation();
                        shelvePlaylistItem(index);
                      }}
                      type="button"
                    >
                      下架
                    </button>
                    <button
                      className="action-delete"
                      aria-label="永久刪除歌曲"
                      onClick={(event) => {
                        event.stopPropagation();
                        deletePlaylistItem(index);
                      }}
                      type="button"
                      title="刪除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </article>
              );
            })}
            <div className="shelf-panel">
              <div className="playlist-meta">
                <span>下架區</span>
                <span>{shelvedSongs.length} 首</span>
              </div>
              {shelvedSongs.length === 0 ? (
                <p className="shelf-empty">目前沒有下架歌曲</p>
              ) : (
                shelvedSongs.map((item, index) => (
                  <article className="shelf-card" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {getMoodLabel(item.mood)} / {item.bpm} BPM
                      </small>
                    </div>
                    <div className="shelf-card-actions">
                      <button onClick={() => restoreShelvedSong(index)} type="button">
                        加回
                      </button>
                      <button aria-label="永久刪除下架歌曲" onClick={() => deleteShelvedSong(index)} type="button">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>

          <section className={`dj-stage ${isPlaying ? "is-playing" : ""}`} aria-label="DJ 主視覺">
            <div className="stage-orbit" aria-hidden="true" />
            <div className="crowd-pulse" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="light-rig">
              <span />
              <span />
              <span />
            </div>
            <div className="festival-stage-fx" aria-hidden="true">
              <div className="led-wall">
                {stageLedBars.map((bar) => (
                  <span key={bar} />
                ))}
              </div>
              <div className="laser-fan">
                {stageLaserBeams.map((beam) => (
                  <span key={beam} />
                ))}
              </div>
              <div className="stage-fog">
                {stageFogLayers.map((layer) => (
                  <span key={layer} />
                ))}
              </div>
              <div className="stage-burst">
                {stageBurstRings.map((ring) => (
                  <span key={ring} />
                ))}
              </div>
            </div>
            <div className="dj-motion">
              <video
                aria-label={isPlaying ? "AI DJ 播放動作影片" : "AI DJ 待機影片"}
                autoPlay
                className={`dj-video ${isVideoReady ? "is-ready" : ""}`}
                loop
                muted
                onLoadedData={() => setIsVideoReady(true)}
                playsInline
                preload="auto"
                src={getMediaUrl(djVideo)}
              />
            </div>
            {renderedGuestDjScene && guestDjVideo ? (
              <div
                className={`guest-dj status-${renderedGuestDjScene.status} ${
                  isGuestVideoReady ? "is-ready" : ""
                }`}
                aria-label="Guest DJ"
              >
                <span>{renderedGuestDjScene.label}</span>
                <video
                  autoPlay
                  loop
                  muted
                  onLoadedData={() => setIsGuestVideoReady(true)}
                  playsInline
                  preload="auto"
                  src={getMediaUrl(guestDjVideo)}
                />
              </div>
            ) : null}
            <div
              className={`holo-singer mode-${visualMode} dance-${singerDanceProfile} ${hasSongs ? "is-ready" : ""} ${
                isPlaying ? "is-performing" : ""
              }`}
              style={
                {
                  "--bass-level": liveAudioMetrics.bass.toFixed(2),
                  "--dance-drive": singerDanceDrive.toFixed(2),
                  "--holo-energy": Math.max(visualEnergy, liveAudioMetrics.energy).toFixed(2),
                  "--voice-level": Math.max(voiceLevel, liveAudioMetrics.vocal).toFixed(2),
                } as React.CSSProperties
              }
              aria-label="AI 伴唱小歌手"
            >
              <div className="holo-aura" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={`holo-character ${singerFrameAssetsEnabled ? "has-frame-sequence" : ""}`} aria-hidden="true">
                {singerFrameAssetsEnabled ? <img alt="" className="holo-singer-frame" src={singerFrameSrc} /> : null}
                <img alt="" className="holo-singer-image" src={getMediaUrl("/assets/holo-singer.png")} />
                <img alt="" className="holo-singer-layer holo-layer-head" src={getMediaUrl("/assets/holo-singer.png")} />
                <img alt="" className="holo-singer-layer holo-layer-mic" src={getMediaUrl("/assets/holo-singer.png")} />
                <img alt="" className="holo-singer-layer holo-layer-skirt" src={getMediaUrl("/assets/holo-singer.png")} />
                <span className="holo-rim-light" />
                <span className="holo-face-light" />
                <span className="holo-hand-light" />
                <span className="holo-mouth-glow" />
              </div>
              <div className="holo-frame-preloaders" aria-hidden="true">
                {singerFramePreloadSources.map((source) => (
                  <img alt="" key={source} src={source} />
                ))}
              </div>
              <div className="holo-platform" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="holo-cue">
                {vocalistCue} / {visualModeLabels[visualMode]}
              </span>
            </div>
            <div className="deck">
              <div className="deck-plates" aria-hidden="true">
                <span />
                <span />
              </div>
              <div className="eq-bars" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="deck-label">
                <Sparkles size={16} />
                {isPlaying ? djEnergy : "READY"}
              </div>
            </div>
          </section>

          <aside className="now-panel">
            <p className="kicker">Now Playing</p>
            <h2>{song.title}</h2>
            <p>{song.artist}</p>
            <div className="now-cover" style={getCoverStyle(djSong)} aria-label="自動產生封面">
              <span>{getCoverLetters(song.title)}</span>
            </div>

            <div className="now-quick-stats" aria-label="目前歌曲狀態">
              <span>
                <strong>{djSong.bpm}</strong>
                <small>BPM</small>
              </span>
              <span>
                <strong>{getMoodLabel(djSong.mood)}</strong>
                <small>風格</small>
              </span>
              <span>
                <strong>{getBpmBand(djSong.bpm)}</strong>
                <small>速度</small>
              </span>
            </div>

            <div className="mapping-panel" aria-label="DJ 歌曲判斷">
              <div className="mapping-panel-head">
                <span>DJ 判斷</span>
                <strong className={`mapping-status status-${currentScanStatus.tone}`}>{currentScanStatus.label}</strong>
              </div>
              <div className="mapping-readout">
                <span>
                  <small>來源</small>
                  <strong>{mappingSourceLabel}</strong>
                </span>
                <span>
                  <small>信心</small>
                  <strong>{mappingConfidenceLabel}</strong>
                </span>
              </div>

              <div className="bpm-editor" aria-label="快速調整 BPM">
                <span>BPM 微調</span>
                <div>
                  <button disabled={!hasSongs} onClick={() => setCurrentBpmOverride(djSong.bpm - 1)} type="button">
                    -1
                  </button>
                  <strong>{djSong.bpm}</strong>
                  <button disabled={!hasSongs} onClick={() => setCurrentBpmOverride(djSong.bpm + 1)} type="button">
                    +1
                  </button>
                </div>
              </div>

              <div className="style-corrector" aria-label="快速修正歌曲風格">
                <span>風格修正</span>
                <div className="style-buttons">
                  {moodOverrideOptions.map((option) => (
                    <button
                      aria-pressed={moodOverride === option.value}
                      className={moodOverride === option.value ? "active" : ""}
                      disabled={!hasSongs}
                      key={option.value}
                      onClick={() => setCurrentMoodOverride(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="auto-map-button" disabled={!hasSongs} onClick={resetCurrentAutoMapping} type="button">
                <RotateCcw size={15} />
                回到 AUTO
              </button>
            </div>

            <div className="now-actions">
              <button className="cover-download-button" disabled={!hasSongs} onClick={downloadCurrentCover} type="button">
                <Download size={16} />
                下載封面
              </button>
              {recommendedSong && recommendedDjSong ? (
                <button className="next-fit-button" type="button" onClick={() => selectSong(recommendedIndex)}>
                  <SkipForward size={16} />
                  接下一首
                </button>
              ) : null}
            </div>

            {recommendedSong && recommendedDjSong ? (
              <div className="next-track-card">
                <span>Next fit</span>
                <strong>{recommendedSong.title}</strong>
                <small>
                  {getMoodLabel(recommendedDjSong.mood)} / {recommendedDjSong.bpm} BPM
                </small>
              </div>
            ) : null}

            <details className="now-ai-details">
              <summary>AI 接歌狀態</summary>
              <div className="now-ai-summary">
                <strong>{djState.cue}</strong>
                <span>{energyLabel}</span>
              </div>
              <div className="ai-plan compact">
                {aiDjPlan.map((step) => (
                  <span key={step}>{step}</span>
                ))}
              </div>
            </details>
          </aside>
        </section>

        <section className={`control-panel ${isPlaying ? "is-playing" : ""}`} aria-label="播放控制">
          {songAudioSrc ? (
            <audio
              key={song.id}
              ref={audioRef}
              onCanPlay={() => setAudioStatus("READY")}
              onEnded={() => {
                if (repeatOne) {
                  seekTrack(0);
                  setIsPlaying(true);
                  return;
                }

                moveSong(1);
              }}
              onError={() => {
                setIsPlaying(false);
                setAudioStatus("ERROR");
              }}
              onLoadedMetadata={() => {
                updateTrackDuration();
                setAudioStatus("READY");
              }}
              onPause={() => setAudioStatus("READY")}
              onPlay={() => setAudioStatus("PLAYING")}
              onWaiting={() => setAudioStatus("LOADING")}
              onTimeUpdate={updateAudioProgress}
              src={songAudioSrc}
            />
          ) : null}

          <div className="control-topline">
            <div className="track-meta">
              <strong className="track-title-marquee">
                <span>{song.title}</span>
              </strong>
              <span>{song.artist}</span>
            </div>
            <div className="control-badges" aria-label="播放狀態">
              <span className={isPlaying ? "is-live" : ""}>{isPlaying ? "ON AIR" : "STANDBY"}</span>
              <span>{audioStatus}</span>
            </div>
          </div>

          <div className="control-dashboard">
            <div className="now-status">
              <span>{getMoodLabel(djSong.mood)}</span>
              <p>
                {djSong.bpm} BPM / {getBpmBand(djSong.bpm)} / 剩餘 {formatTime(remainingTime)}
              </p>
            </div>

            <div className="dj-cue" aria-label="DJ 互動提示">
              <span>{djState.cue}</span>
              <small>{energyLabel}</small>
            </div>

            {queueNextSong && queueNextDjSong ? (
              <button className="queue-next-card" onClick={() => moveSong(1)} type="button">
                <span>下一首</span>
                <strong>{queueNextSong.title}</strong>
                <small>
                  {getMoodLabel(queueNextDjSong.mood)} / {queueNextDjSong.bpm} BPM
                </small>
              </button>
            ) : (
              <div className="queue-next-card is-empty">
                <span>下一首</span>
                <strong>尚未排入</strong>
                <small>加入更多歌曲後顯示</small>
              </div>
            )}
          </div>

          <details className="advanced-panel">
            <summary>進階資訊與風格修正</summary>
            <div className="playback-stats" aria-label="播放資訊">
              <span>{getMoodLabel(djSong.mood)}</span>
              <span>{djSong.bpm} BPM</span>
              <span>{isPlaying ? djEnergy : "READY"}</span>
              <span>{song.language}</span>
              <span>{audioStatus}</span>
              <span>{availableDjVideos[djState.video] ? "新 DJ" : "備用 DJ"}</span>
            </div>

            <div className="analysis-row" aria-label="自動分檢">
              <span>{analysisStatus}</span>
              <span className={`analysis-source source-${analysisSource.toLowerCase()}`}>{analysisSource}</span>
              <span>
                {activeAnalysis
                  ? `${getMoodLabel(activeAnalysis.mood)} / ${activeAnalysis.bpm} BPM / confidence ${Math.round(
                      activeAnalysis.confidence * 100,
                    )}% / energy ${activeAnalysis.energy.toFixed(3)}`
                  : "waiting for local audio scan"}
              </span>
              <span>{mappingSourceLabel}</span>
            </div>

            <div className={`mode-timeline mode-count-${modeTimeline.length}`} aria-label="DJ 模式時間軸">
              {modeTimeline.map((mode) => (
                <span className={mode.active ? "active" : ""} key={mode.label}>
                  {mode.label}
                </span>
              ))}
            </div>
          </details>

          <div className="lyrics-strip" aria-label="歌詞">
            {song.lyric.map((line, index) => (
              <p className={index === activeLyricIndex ? "active" : ""} key={`${song.id}-${line}`}>
                {line}
              </p>
            ))}
          </div>

          <div className="transport-console">
            <div className="transport-main">
              <div className="progress-row">
                <span>{formatTime(elapsedTime)}</span>
                <input
                  aria-label="歌曲進度"
                  max="100"
                  min="0"
                  onChange={(event) => seekTrack(Number(event.target.value))}
                  onInput={(event) => seekTrack(Number(event.currentTarget.value))}
                  type="range"
                  value={progress}
                />
                <span>{formatTime(trackDuration)}</span>
              </div>

              <div className="controls">
                <button aria-label="上一首" disabled={!hasSongs} onClick={() => moveSong(-1)} type="button">
                  <SkipBack size={20} />
                </button>
                <button
                  aria-label={isPlaying ? "暫停" : "播放"}
                  className="play-button"
                  disabled={!hasSongs}
                  onClick={() => setIsPlaying((current) => !current)}
                  type="button"
                >
                  {isPlaying ? <Pause size={26} /> : <Play size={26} />}
                </button>
                <button aria-label="下一首" disabled={!hasSongs} onClick={() => moveSong(1)} type="button">
                  <SkipForward size={20} />
                </button>
                <button
                  aria-label={repeatOne ? "關閉單曲循環" : "單曲循環"}
                  className={repeatOne ? "active" : ""}
                  onClick={() => setRepeatOne((current) => !current)}
                  type="button"
                >
                  {repeatOne ? <Repeat1 size={20} /> : <Repeat size={20} />}
                </button>
              </div>
            </div>

            <div className="sound-row" aria-label="音量控制">
              <button
                aria-label={isMuted ? "取消靜音" : "靜音"}
                onClick={() => setIsMuted((current) => !current)}
                type="button"
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                aria-label="音量"
                max="1"
                min="0"
                onChange={(event) => changeVolume(Number(event.target.value))}
                onInput={(event) => changeVolume(Number(event.currentTarget.value))}
                step="0.05"
                type="range"
                value={isMuted ? 0 : volume}
              />
              <span>{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>
          </div>
        </section>
      </section>
      <div aria-hidden="true" className="video-preloaders">
        {djVideoSources.filter((source) => availableDjVideos[source]).map((source) => (
          <video key={source} muted playsInline preload="auto" src={getMediaUrl(source)} />
        ))}
      </div>
    </main>
  );
}
