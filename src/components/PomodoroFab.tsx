import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../db/schema";
import { format } from "date-fns";
import { reportFailure } from "../lib/failure";

type Phase = "idle" | "focus" | "break";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

/**
 * `new Notification()` throws a TypeError on Android Chrome, where notifications
 * must go through the service worker registration. Never let that break the timer.
 */
function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: new URL("icons/icon-192.png", document.baseURI).href });
    }
  } catch (err) {
    console.warn("Notification failed:", err);
  }
}

export default function PomodoroFab() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(FOCUS_SECONDS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);

  // Declared before the timer effect and memoised on `phase`, so the interval
  // always closes over the current phase rather than the one captured at mount.
  const finishPhase = useCallback(async () => {
    if ("vibrate" in navigator) navigator.vibrate([30, 50, 30]);
    if (phase === "focus") {
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const existing = await db.studyLog.get(today);
        if (existing) {
          await db.studyLog.update(today, {
            minutes: existing.minutes + 25,
            sessions: existing.sessions + 1,
          });
        } else {
          await db.studyLog.add({
            date: today,
            minutes: 25,
            sessions: 1,
            questsCompleted: 0,
            flashcardsReviewed: 0,
          });
        }
      } catch (err) {
        // A failed write used to reject out of this function, which both lost
        // the session silently and skipped the phase change below — leaving the
        // timer stuck at 0:00 in "focus". The 25 minutes happened whether or not
        // the write did, so report it and carry on to the break either way.
        reportFailure("log that focus session", err, "The 25 minutes weren't added to today's study time.");
      }
      notify("Focus session complete", "Take a 5-minute break.");
      setPhase("break");
      setSeconds(BREAK_SECONDS);
    } else {
      notify("Break over", "Ready for another Pomodoro?");
      setPhase("idle");
      setSeconds(FOCUS_SECONDS);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "idle") return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          // Floating async call. The known failure — the studyLog write — is
          // now handled and reported inside finishPhase; this stays as the
          // backstop so anything unforeseen is still not an invisible
          // unhandled rejection.
          finishPhase().catch((err) => console.error("Pomodoro phase failed:", err));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, finishPhase]);

  useEffect(() => {
    if (!open) return;
    startBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const start = () => {
    setPhase("focus");
    setSeconds(FOCUS_SECONDS);
  };
  const stop = () => {
    setPhase("idle");
    setSeconds(FOCUS_SECONDS);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const phaseLabel =
    phase === "idle" ? "Pomodoro timer idle" :
    phase === "focus" ? "Focus session in progress" :
    "On break";

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label={`Open Pomodoro timer. ${phaseLabel}.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`fixed bottom-20 md:bottom-6 right-4 w-14 h-14 rounded-full shadow-glow flex items-center justify-center z-30 transition-colors ${
          phase === "focus" ? "bg-danger text-ink animate-flicker" : phase === "break" ? "bg-accent text-bg" : "bg-panel border border-border text-ink hover:bg-panel2"
        }`}
      >
        <span aria-hidden="true">
          {phase === "idle" ? "🍅" : phase === "focus" ? "🎯" : "☕"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)} role="presentation">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pomodoro-title"
            className="absolute bottom-0 inset-x-0 bg-panel border-t border-border rounded-t-2xl p-6 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-4" aria-hidden="true" />
            <h2 id="pomodoro-title" className="text-center font-semibold mb-2">
              {phase === "idle" ? "Pomodoro Timer" : phase === "focus" ? "🎯 Focus" : "☕ Break"}
            </h2>
            <p
              className="text-6xl font-mono text-center mb-4 font-bold"
              aria-live="off"
              aria-atomic="true"
            >
              <span className="sr-only">
                {`${parseInt(mm)} minutes ${parseInt(ss)} seconds remaining`}
              </span>
              <span aria-hidden="true">
                {mm}:{ss}
              </span>
            </p>
            {phase === "idle" ? (
              <button ref={startBtnRef} onClick={start} className="btn-primary w-full">
                Start 25-min Focus
              </button>
            ) : (
              <button ref={startBtnRef} onClick={stop} className="btn-danger w-full">
                Stop
              </button>
            )}
            <p className="text-xs text-dim text-center mt-3">
              Logs 25 minutes to your study heatmap on completion.
            </p>
            <button
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="btn-ghost w-full mt-2 text-sm"
            >
              Close (Esc)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
