"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

type State = "idle" | "recording" | "recorded" | "unsupported" | "denied";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VoiceRecorder({
  onChange,
  disabled,
}: {
  onChange: (blob: Blob | null, seconds: number) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      stopTracks();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [stopTracks],
  );

  async function start() {
    console.log("[VoiceRecorder] start() called (MediaRecorder mode)...");
    setError(null);
    setPlaybackError(null);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // The native MediaRecorder avoids all AudioContext bugs (silent streams, GC, suspension).
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create WebM or default audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const next = URL.createObjectURL(audioBlob);
        urlRef.current = next;
        setUrl(next);

        const finalSec = Math.round((Date.now() - startTimeRef.current) / 1000);
        setSeconds(finalSec);
        setDuration(finalSec);
        setState("recorded");
        
        console.log(`[VoiceRecorder] MediaRecorder stopped. Blob size: ${audioBlob.size} bytes, Duration: ${finalSec} seconds.`);
        onChange(audioBlob, finalSec);
      };

      startTimeRef.current = Date.now();
      setSeconds(0);
      setState("recording");

      mediaRecorder.start(200);

      timerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setSeconds(elapsed);
      }, 500);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
      } else {
        console.error("[VoiceRecorder] start() error:", e);
        setState("idle");
        setError(
          e instanceof Error
            ? e.message
            : "The microphone could not be opened. Type the report instead.",
        );
      }
      stopTracks();
    }
  }

  function stop() {
    console.log("[VoiceRecorder] stop() called...");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
  }

  function discard() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setSeconds(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setState("idle");
    onChange(null, 0);
  }

  function togglePlay() {
    console.log("[VoiceRecorder] togglePlay() called - isPlaying currently:", isPlaying);
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(null);

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (audio.ended || (duration > 0 && audio.currentTime >= duration)) {
        audio.currentTime = 0;
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error("Audio playback error:", err);
            setPlaybackError("Click to allow audio playback in your browser.");
            setIsPlaying(false);
          });
      }
    }
  }

  const mmss = formatDuration(seconds);
  const playMmss = formatDuration(currentTime);
  const totalMmss = formatDuration(duration || seconds);

  return (
    <div className="in p-4">
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onTimeUpdate={(e) => {
            const cur = e.currentTarget.currentTime;
            setCurrentTime(cur);
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
            }
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
            }
          }}
          onError={() => {
            setPlaybackError("Audio playback failed. Try re-recording.");
            setIsPlaying(false);
          }}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`up-s grid h-10 w-10 place-items-center ${
              state === "recording" ? "text-alert-ink" : "text-navy"
            }`}
          >
            <Icon name="mic" size={17} />
          </span>
          <div>
            <div className="text-[14px] font-bold text-ink">Say it instead</div>
            <div className="mono text-[10.5px] uppercase tracking-[0.08em] text-mute">
              {state === "recording"
                ? `recording ${mmss}`
                : state === "recorded"
                  ? `${totalMmss} recorded`
                  : "Hindi, Santali, Khortha or English"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state === "idle" && (
            <Button variant="secondary" size="sm" icon="mic" onClick={start} disabled={disabled}>
              Record
            </Button>
          )}
          {state === "recording" && (
            <Button variant="danger" size="sm" icon="stop" onClick={stop}>
              Stop
            </Button>
          )}
          {state === "recorded" && (
            <>
              <Button
                variant={isPlaying ? "secondary" : "primary"}
                size="sm"
                icon={isPlaying ? "pause" : "play"}
                onClick={togglePlay}
                disabled={disabled}
              >
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button variant="danger" size="sm" icon="x" onClick={discard} disabled={disabled}>
                Discard
              </Button>
            </>
          )}
        </div>
      </div>

      {state === "recording" && (
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-full bg-[var(--color-moderate)]"
              style={{
                height: 4 + ((i * 7 + seconds * 5) % 17),
                opacity: 0.35 + ((i * 13 + seconds * 3) % 50) / 100,
              }}
            />
          ))}
        </div>
      )}

      {state === "recorded" && url && (
        <div className="up-s mt-3.5 flex flex-col gap-2.5 p-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="up-hit grid h-9 w-9 place-items-center rounded-full bg-navy text-white shadow-md hover:bg-navy-dark"
              aria-label={isPlaying ? "Pause recording" : "Play recording"}
            >
              <Icon name={isPlaying ? "pause" : "play"} size={14} />
            </button>

            <div
              role="slider"
              aria-label="Playback progress"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={duration || seconds || 1}
              tabIndex={0}
              className="press relative flex h-3 flex-1 cursor-pointer items-center overflow-hidden rounded-full"
              onClick={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const targetTime = pct * (duration || seconds || 1);
                audio.currentTime = targetTime;
                setCurrentTime(targetTime);
              }}
            >
              <div
                className="h-full rounded-full bg-navy transition-all"
                style={{
                  width: `${
                    duration || seconds
                      ? Math.min(100, (currentTime / (duration || seconds)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            <span className="mono text-[11px] font-semibold text-ink">
              {playMmss} / {totalMmss}
            </span>
          </div>

        </div>
      )}

      {playbackError && (
        <p className="mt-2 text-[12px] leading-relaxed text-alert-ink">{playbackError}</p>
      )}

      {state === "recorded" && (
        <p className="mt-3 text-[12px] leading-relaxed text-body">
          This is sent as audio. The server transcribes it and will refuse the submission if the
          recording turns out to be silent, rather than guessing at words you did not say.
        </p>
      )}

      {state === "denied" && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-alert-ink">
          The browser blocked the microphone. You can allow it in the address bar, or just type
          the report below — both go to the same place.
        </p>
      )}

      {state === "unsupported" && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-body">
          This browser cannot record audio. Type the report below, or send it by SMS.
        </p>
      )}

      {error && <p className="mt-3 text-[12.5px] leading-relaxed text-alert-ink">{error}</p>}
    </div>
  );
}
