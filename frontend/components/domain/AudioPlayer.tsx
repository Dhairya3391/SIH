"use client";

import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

interface AudioPlayerProps {
  src?: string | null;
  text?: string | null;
  label?: string;
  lang?: string;
  className?: string;
  variant?: "pill" | "card";
}

/**
 * Multi-Lingual Audio Player & Text-To-Speech Synthesizer.
 *
 * Caters directly to low-literacy rural/tribal citizens and disaster coordinators:
 * 1. Plays back raw audio recordings uploaded via voice reports / IVR.
 * 2. Provides client-side zero-latency Text-to-Speech (Hindi hi-IN / English en-IN)
 *    to read out citizen reports, emergency directives, or status receipts.
 */
export function AudioPlayer({
  src,
  text,
  label,
  lang = "hi-IN",
  className = "",
  variant = "pill",
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSpeechAvailable(true);
    }
  }, []);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle recorded audio file playback
  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn("Audio play prevented:", err);
      });
    }
  };

  // Handle Text-To-Speech read aloud
  const toggleSpeech = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    if (!text) return;

    window.speechSynthesis.cancel(); // cancel any ongoing utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Choose appropriate voice if available
    const voices = window.speechSynthesis.getVoices();
    const isHindi = lang.toLowerCase().startsWith("hi");
    const voice = voices.find((v) => 
      isHindi 
        ? v.lang.includes("hi") || v.name.toLowerCase().includes("hindi") || v.lang.includes("IN")
        : v.lang.includes("IN") || v.lang.includes("en")
    );

    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = lang;
    utterance.rate = 0.95; // Slightly measured pace for disaster clarity

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!src && !text) return null;

  // Recorded audio mode
  if (src) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-lg bg-sand/60 px-3 py-1.5 text-xs text-navy ${className}`}>
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setProgress(audioRef.current.currentTime);
              setDuration(audioRef.current.duration || 0);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
        />
        <button
          type="button"
          onClick={toggleAudioPlay}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-sand hover:bg-navy-dark transition-colors"
          title={isPlaying ? "Pause voice note" : "Play voice note"}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={11} />
        </button>
        <span className="font-medium mono text-[11px]">
          {label || "Voice note"} ({Math.round(duration || 0)}s)
        </span>
        {isPlaying && (
          <div className="flex items-center gap-0.5 ml-1">
            <span className="h-2.5 w-0.5 animate-pulse bg-teal rounded-full" />
            <span className="h-4 w-0.5 animate-pulse delay-75 bg-teal rounded-full" />
            <span className="h-1.5 w-0.5 animate-pulse delay-150 bg-teal rounded-full" />
          </div>
        )}
      </div>
    );
  }

  // Text-To-Speech Read-Aloud mode
  if (variant === "card") {
    return (
      <div className={`flex items-center justify-between rounded-xl border border-sand-dark/40 bg-sand/30 p-3 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy/10 text-navy">
            <Icon name="volume" size={14} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-navy">
              {label || "ऑडियो सुनें (Audio Feedback)"}
            </div>
            <div className="text-[12px] text-mute line-clamp-1 max-w-[280px]">
              {text}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleSpeech}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            isPlaying
              ? "bg-alert-soft text-alert-ink border border-alert/20"
              : "bg-navy text-sand hover:bg-navy-dark"
          }`}
        >
          <Icon name={isPlaying ? "stop" : "play"} size={11} />
          <span>{isPlaying ? "रोकें (Stop)" : "सुनें (Listen)"}</span>
          {isPlaying && (
            <div className="flex items-center gap-0.5 ml-1">
              <span className="h-2 w-0.5 animate-pulse bg-current rounded-full" />
              <span className="h-3 w-0.5 animate-pulse delay-75 bg-current rounded-full" />
              <span className="h-1.5 w-0.5 animate-pulse delay-150 bg-current rounded-full" />
            </div>
          )}
        </button>
      </div>
    );
  }

  // Pill variant
  return (
    <button
      type="button"
      onClick={toggleSpeech}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
        isPlaying
          ? "bg-teal-soft text-teal-ink border border-teal/30"
          : "bg-sand/80 text-navy hover:bg-sand-dark/30 border border-sand-dark/30"
      } ${className}`}
      title="Listen to this report in Hindi / English"
    >
      <Icon name={isPlaying ? "stop" : "volume"} size={11} />
      <span>{isPlaying ? "रोकें" : label || "सुनें"}</span>
      {isPlaying && (
        <span className="flex items-center gap-0.5">
          <span className="h-2 w-0.5 animate-pulse bg-teal rounded-full" />
          <span className="h-3 w-0.5 animate-pulse delay-75 bg-teal rounded-full" />
          <span className="h-1.5 w-0.5 animate-pulse delay-150 bg-teal rounded-full" />
        </span>
      )}
    </button>
  );
}

/**
 * Compact ListenButton for table or list item rows
 */
export function ListenButton({
  text,
  lang = "hi-IN",
  label = "सुनें",
}: {
  text?: string | null;
  lang?: string;
  label?: string;
}) {
  if (!text) return null;
  return <AudioPlayer text={text} lang={lang} label={label} variant="pill" />;
}
