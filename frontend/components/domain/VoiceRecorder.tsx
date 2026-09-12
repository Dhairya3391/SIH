"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Record a voice note.
 *
 * Two things this deliberately does NOT do:
 *
 *  — It does not transcribe in the browser. The recording goes to the server,
 *    which runs Whisper and, critically, refuses silence. Whisper invents
 *    fluent sentences from a silent track ("The following video is a work of
 *    fiction…"), and filing that as a citizen's words would be worse than
 *    filing nothing. The refusal lives on the server so every channel gets it.
 *
 *  — It does not pretend the microphone worked. If permission is denied or the
 *    browser has no MediaRecorder, it says so and leaves the text box, which
 *    is always the fallback.
 */

type State = "idle" | "recording" | "recorded" | "unsupported" | "denied";

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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopTracks();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [stopTracks],
  );

  async function start() {
    setError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const next = URL.createObjectURL(blob);
        urlRef.current = next;
        setUrl(next);
        setState("recorded");
        onChange(blob, seconds);
        stopTracks();
      };

      recorder.start();
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
      } else {
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
    recorderRef.current?.stop();
  }

  function discard() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setSeconds(0);
    setState("idle");
    onChange(null, 0);
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="in p-4">
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
                  ? `${mmss} recorded`
                  : "Hindi, Santali, Khortha or English"}
            </div>
          </div>
        </div>

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
          <Button variant="danger" size="sm" icon="x" onClick={discard} disabled={disabled}>
            Discard
          </Button>
        )}
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

      {url && (
        <audio controls src={url} className="mt-3 w-full" aria-label="Your recording" />
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
