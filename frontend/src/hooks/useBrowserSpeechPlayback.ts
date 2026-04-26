"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  estimateSpeechDurationSec,
  logVietnameseVoiceAvailability,
  plainTextForSpeech,
  resolveVietnameseVoice,
} from "@/lib/browserSpeech";

type Options = {
  /** Bật khi không dùng thẻ audio (chỉ đọc trình duyệt). */
  enabled: boolean;
  text: string;
  rate: number;
  volume: number;
  /** `voiceURI` từ SpeechSynthesisVoice; rỗng = tự chọn giọng tiếng Việt đầu tiên. */
  voiceUri: string;
};

export function useBrowserSpeechPlayback({ enabled, text, rate, volume, voiceUri }: Options) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const plain = useMemo(() => plainTextForSpeech(text), [text]);
  const duration = useMemo(() => estimateSpeechDurationSec(plain, rate), [plain, rate]);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utterRef.current = null;
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    startedAtRef.current = null;
    setIsSpeaking(false);
    setCurrentTime(0);
  }, []);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis || !enabled || !plain) return;

    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = "vi-VN";
    u.rate = Math.max(0.5, Math.min(2, rate));
    u.volume = Math.max(0, Math.min(1, volume));

    const chosen = resolveVietnameseVoice(voices, voiceUri);
    if (chosen) {
      u.voice = chosen;
    }

    startedAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    setCurrentTime(0);
    setIsSpeaking(true);

    u.onboundary = (ev) => {
      if (ev.charIndex >= 0 && plain.length > 0) {
        const approx = (ev.charIndex / plain.length) * duration;
        setCurrentTime(Math.min(duration, approx));
      }
    };

    u.onend = () => {
      utterRef.current = null;
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      startedAtRef.current = null;
      setCurrentTime(duration);
      setIsSpeaking(false);
    };

    u.onerror = () => {
      utterRef.current = null;
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      startedAtRef.current = null;
      setIsSpeaking(false);
      setCurrentTime(0);
    };

    utterRef.current = u;
    window.speechSynthesis.speak(u);

    tickRef.current = window.setInterval(() => {
      if (startedAtRef.current == null) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const t = (now - startedAtRef.current) / 1000;
      const cap = duration - 0.25;
      setCurrentTime((prev) => {
        const next = Math.min(duration, Math.max(prev, t * 0.98));
        return next > cap && !window.speechSynthesis.speaking ? prev : Math.min(duration, next);
      });
    }, 400);
  }, [duration, enabled, plain, rate, volume, voiceUri]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const load = () => {
      try {
        const list = window.speechSynthesis.getVoices();
        logVietnameseVoiceAvailability(list);
      } catch {
        /* ignore */
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    stop();
  }, [plain, stop]);

  return {
    isSpeaking,
    currentTime,
    duration,
    speak,
    stop,
  };
}
