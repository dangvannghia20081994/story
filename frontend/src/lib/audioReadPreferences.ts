/** Cài đặt chung cho trang đọc (volume, tốc độ, hẹn giờ) — lưu localStorage để giữ khi đổi chương. */

const STORAGE_KEY = "story-audio-read-prefs:v1";

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
const SLEEP_PRESETS = new Set([0, 15, 30, 45, 60, 90]);

export type AudioReadPrefs = {
  volume: number;
  playbackRate: number;
  sleepPresetMinutes: number;
  sleepDeadlineAt: number | null;
};

export function defaultAudioReadPrefs(): AudioReadPrefs {
  return {
    volume: 1,
    playbackRate: 1,
    sleepPresetMinutes: 0,
    sleepDeadlineAt: null,
  };
}

export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

export function clampPlaybackRate(r: number): number {
  if (!Number.isFinite(r)) return 1;
  let best: number = PLAYBACK_RATES[0];
  let bestD = Math.abs(r - best);
  for (const o of PLAYBACK_RATES) {
    const d = Math.abs(r - o);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function clampSleepPreset(m: number): number {
  if (!Number.isFinite(m) || m <= 0) return 0;
  if (SLEEP_PRESETS.has(m)) return m;
  return 0;
}

export function loadAudioReadPrefs(): AudioReadPrefs {
  const d = defaultAudioReadPrefs();
  if (typeof window === "undefined") return d;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return d;
    const o = JSON.parse(raw) as Partial<AudioReadPrefs>;
    const volume = clampVolume(typeof o.volume === "number" ? o.volume : d.volume);
    const playbackRate = clampPlaybackRate(typeof o.playbackRate === "number" ? o.playbackRate : d.playbackRate);
    const sleepPresetMinutes = clampSleepPreset(
      typeof o.sleepPresetMinutes === "number" ? o.sleepPresetMinutes : d.sleepPresetMinutes,
    );
    let sleepDeadlineAt =
      typeof o.sleepDeadlineAt === "number" && Number.isFinite(o.sleepDeadlineAt) ? o.sleepDeadlineAt : null;
    if (sleepDeadlineAt != null && sleepDeadlineAt <= Date.now()) {
      sleepDeadlineAt = null;
    }
    if (sleepPresetMinutes <= 0) {
      sleepDeadlineAt = null;
    }
    return { volume, playbackRate, sleepPresetMinutes, sleepDeadlineAt };
  } catch {
    return d;
  }
}

export function saveAudioReadPrefs(patch: Partial<AudioReadPrefs>): void {
  if (typeof window === "undefined") return;
  const cur = loadAudioReadPrefs();
  const next: AudioReadPrefs = {
    volume: clampVolume(patch.volume ?? cur.volume),
    playbackRate: clampPlaybackRate(patch.playbackRate ?? cur.playbackRate),
    sleepPresetMinutes: clampSleepPreset(
      patch.sleepPresetMinutes !== undefined ? patch.sleepPresetMinutes : cur.sleepPresetMinutes,
    ),
    sleepDeadlineAt:
      patch.sleepDeadlineAt !== undefined ? patch.sleepDeadlineAt : cur.sleepDeadlineAt,
  };
  if (next.sleepPresetMinutes <= 0) {
    next.sleepDeadlineAt = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Khởi tạo state hẹn giờ từ prefs (giữ đếm ngược nếu deadline còn trong tương lai). */
export function initialSleepFromPrefs(p: AudioReadPrefs): { preset: number; left: number | null } {
  if (p.sleepPresetMinutes <= 0) return { preset: 0, left: null };
  if (p.sleepDeadlineAt != null && p.sleepDeadlineAt > Date.now()) {
    const left = Math.max(0, Math.ceil((p.sleepDeadlineAt - Date.now()) / 1000));
    if (left <= 0) return { preset: 0, left: null };
    return { preset: p.sleepPresetMinutes, left };
  }
  return { preset: 0, left: null };
}
