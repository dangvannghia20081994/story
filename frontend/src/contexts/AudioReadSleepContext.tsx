"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AUDIOREAD_SLEEP_ENDED_EVENT_NAME,
  AUDIOREAD_SLEEP_UI_BUMP_EVENT_NAME,
  clampSleepPresetMinutes,
  loadAudioReadPrefs,
  saveAudioReadPrefs,
  tryConsumeExpiredAudioReadSleep,
} from "@/lib/audioReadPreferences";

/** AudioWeb / AudioPlayer lắng nghe để tắt phát khi hết hẹn giờ (đồng bộ với prefs). */
export const STORY_AUDIOREAD_SLEEP_ENDED = AUDIOREAD_SLEEP_ENDED_EVENT_NAME;

type AudioReadSleepContextValue = {
  sleepTimer: number;
  sleepTimeLeft: number | null;
  /** Phút (0|3|15|30|45|60|90): bật = deadline từ bây giờ; 0 = tắt. */
  setSleepTimer: (minutes: number) => void;
};

const AudioReadSleepContext = createContext<AudioReadSleepContextValue | null>(null);

function readSleepTimeLeftSeconds(): number | null {
  const p = loadAudioReadPrefs();
  if (p.sleepPresetMinutes <= 0) return null;
  if (p.sleepDeadlineAt == null || p.sleepDeadlineAt <= Date.now()) return null;
  return Math.max(0, Math.ceil((p.sleepDeadlineAt - Date.now()) / 1000));
}

export function AudioReadSleepProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((x) => x + 1), []);

  const sleepTimer = useMemo(() => loadAudioReadPrefs().sleepPresetMinutes, [tick]);
  const sleepTimeLeft = useMemo(() => readSleepTimeLeftSeconds(), [tick]);

  const setSleepTimer = useCallback(
    (minutes: number) => {
      const m = clampSleepPresetMinutes(minutes);
      if (m <= 0) {
        saveAudioReadPrefs({ sleepPresetMinutes: 0, sleepDeadlineAt: null });
      } else {
        saveAudioReadPrefs({
          sleepPresetMinutes: m,
          sleepDeadlineAt: Date.now() + m * 60 * 1000,
        });
      }
      bump();
    },
    [bump],
  );

  useEffect(() => {
    const onUiBump = () => bump();
    window.addEventListener(AUDIOREAD_SLEEP_UI_BUMP_EVENT_NAME, onUiBump);
    return () => window.removeEventListener(AUDIOREAD_SLEEP_UI_BUMP_EVENT_NAME, onUiBump);
  }, [bump]);

  useEffect(() => {
    const tick = () => {
      tryConsumeExpiredAudioReadSleep();
      bump();
    };
    const id = window.setInterval(tick, 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bump]);

  const value = useMemo(
    () => ({ sleepTimer, sleepTimeLeft, setSleepTimer }),
    [sleepTimer, sleepTimeLeft, setSleepTimer],
  );

  return <AudioReadSleepContext.Provider value={value}>{children}</AudioReadSleepContext.Provider>;
}

export function useAudioReadSleep(): AudioReadSleepContextValue {
  const c = useContext(AudioReadSleepContext);
  if (!c) {
    throw new Error("useAudioReadSleep phải nằm trong AudioReadSleepProvider (AppProviders).");
  }
  return c;
}
