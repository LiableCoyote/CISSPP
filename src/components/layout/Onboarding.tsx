import { useState, useEffect, useRef } from "react";
import { useProfile } from "../../state/profile";
import { updateSlotMeta, getActiveSlotId } from "../../lib/profiles";
import { getItem, setItem } from "../../lib/safeStorage";

type Step = "welcome" | "exam-date" | "daily-goal" | "done";

export default function Onboarding() {
  const { profile, updateProfile } = useProfile();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyGoal, setDailyGoal] = useState(120);
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Derived during render rather than pushed into state by an effect: the wizard
  // shows for a fresh profile that hasn't completed onboarding, and `dismissed`
  // is the only thing the finish handler needs to set.
  const wasOnboarded = getItem("cisspp-onboarded-" + getActiveSlotId()) !== null;
  const visible = !dismissed && !wasOnboarded && !!profile && profile.displayName === "Scholar";

  // Focus trap
  useEffect(() => {
    if (!visible) return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => first?.focus(), 50);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, step]);

  if (!visible || !profile) return null;

  const finish = async () => {
    await updateProfile({
      displayName: name || "Scholar",
      examDate: examDate || null,
      dailyGoalMinutes: dailyGoal,
    });
    updateSlotMeta(getActiveSlotId(), {
      displayName: name || "Scholar",
      examDate: examDate || null,
    });
    // Guarded: an unguarded throw here previously skipped the line below, leaving
    // the wizard on screen forever even though the profile had already saved.
    setItem("cisspp-onboarded-" + getActiveSlotId(), "1");
    setDismissed(true);
  };

  const eightWeeksDefault = () => {
    const d = new Date();
    d.setDate(d.getDate() + 56);
    return d.toISOString().split("T")[0];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        ref={dialogRef}
        className="card max-w-md w-full p-6 shadow-2xl"
      >
        {step === "welcome" && (
          <>
            <div className="text-4xl text-center mb-4" aria-hidden="true">◆</div>
            <h1 id="onboarding-title" className="text-2xl font-bold text-center mb-2">
              Welcome to CISSPP
            </h1>
            <p className="text-dim text-sm text-center mb-6">
              Your gamified CISSP study companion. Let's get you set up in 3 quick steps.
            </p>
            <label htmlFor="onboard-name" className="block text-sm text-dim mb-1">
              What should we call you?
            </label>
            <input
              id="onboard-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setStep("exam-date")}
              placeholder="Your name or nickname…"
              className="input mb-4"
              maxLength={40}
            />
            <button
              onClick={() => setStep("exam-date")}
              className="btn-primary w-full"
            >
              Next →
            </button>
          </>
        )}

        {step === "exam-date" && (
          <>
            <h1 id="onboarding-title" className="text-xl font-bold mb-2">When's your exam?</h1>
            <p className="text-dim text-sm mb-4">
              This drives the countdown and the 8-week plan pacing. You can change it later.
            </p>
            <label htmlFor="onboard-date" className="block text-sm text-dim mb-1">
              Exam date
            </label>
            <input
              id="onboard-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="input mb-3"
              min={new Date().toISOString().split("T")[0]}
            />
            <button
              onClick={() => {
                if (!examDate) setExamDate(eightWeeksDefault());
                setStep("daily-goal");
              }}
              className="btn-outline w-full mb-2 text-sm"
            >
              Use 8-week default ({eightWeeksDefault()})
            </button>
            <div className="flex gap-2">
              <button onClick={() => setStep("welcome")} className="btn-ghost flex-1">
                ← Back
              </button>
              <button onClick={() => setStep("daily-goal")} className="btn-primary flex-1">
                Next →
              </button>
            </div>
          </>
        )}

        {step === "daily-goal" && (
          <>
            <h1 id="onboarding-title" className="text-xl font-bold mb-2">Daily study goal</h1>
            <p className="text-dim text-sm mb-4">
              The plan recommends 2–3 hours/day. Set a realistic target for your schedule.
            </p>
            <label htmlFor="onboard-goal" className="block text-sm text-dim mb-1">
              Daily goal:{" "}
              <span className="text-ink font-semibold">{dailyGoal} minutes</span>
            </label>
            <input
              id="onboard-goal"
              type="range"
              min={30}
              max={360}
              step={30}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(parseInt(e.target.value))}
              className="w-full mb-2"
              aria-valuetext={`${dailyGoal} minutes`}
            />
            <div className="flex justify-between text-xs text-dim mb-4">
              <span>30 min</span>
              <span>3 hrs ★</span>
              <span>6 hrs</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("exam-date")} className="btn-ghost flex-1">
                ← Back
              </button>
              <button onClick={() => setStep("done")} className="btn-primary flex-1">
                Next →
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="text-4xl text-center mb-4" aria-hidden="true">🎯</div>
            <h1 id="onboarding-title" className="text-xl font-bold text-center mb-2">
              You're ready, {name || "Scholar"}!
            </h1>
            <div className="text-sm text-dim space-y-2 mb-6">
              <p>• Complete today's quests to build your streak</p>
              <p>• Review flashcards daily — even 10 cards counts</p>
              <p>• Think like a <strong>CISO</strong>, not a technician</p>
              <p>• The plan works — trust the process</p>
            </div>
            <button onClick={finish} className="btn-primary w-full">
              Let's go! →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
