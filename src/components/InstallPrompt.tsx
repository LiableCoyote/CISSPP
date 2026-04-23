import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "cisspp-install-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const skip = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="card mb-4 border-accent/40 bg-accent/5">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>📲</span>
        <div className="flex-1">
          <p className="font-semibold">Install CISSPP</p>
          <p className="text-sm text-dim mt-1">
            Add to your home screen for instant access, offline support, and a full-screen study experience.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={install} className="btn-primary text-sm">
              Install
            </button>
            <button onClick={skip} className="btn-ghost text-sm">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
