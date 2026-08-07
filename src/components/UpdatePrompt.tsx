import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { initServiceWorker, reloadWithUpdate } from "../lib/pwa";

/**
 * Offers a reload when a new build is waiting, instead of swapping it in under
 * the running app. Also the only place a failed service-worker registration is
 * surfaced — the app's offline claim is otherwise unverifiable by the user.
 */
export default function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [swFailed, setSwFailed] = useState(false);
  const [dismissedFailure, setDismissedFailure] = useState(false);

  useEffect(() => {
    initServiceWorker({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => console.info("CISSPP is ready to work offline."),
      onRegisterError: (err) => {
        console.error("Service worker registration failed:", err);
        setSwFailed(true);
      },
    });
  }, []);

  const showFailure = swFailed && !dismissedFailure;

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          key="update"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          role="status"
          className="fixed left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-80 z-50"
        >
          <div className="card border-accent/50 shadow-glow">
            <p className="text-sm font-semibold">
              <span aria-hidden="true">✨ </span>New version available
            </p>
            <p className="text-xs text-dim mt-1">
              Reload to pick it up. Your study data isn't affected.
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setNeedRefresh(false)} className="btn-ghost flex-1 text-sm">
                Later
              </button>
              <button onClick={() => void reloadWithUpdate()} className="btn-primary flex-1 text-sm">
                Reload now
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {showFailure && (
        <motion.div
          key="swfail"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          role="alert"
          className="fixed left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-80 z-50"
        >
          <div className="card border-warn/50">
            <p className="text-sm font-semibold text-warn">
              <span aria-hidden="true">⚠ </span>Offline mode unavailable
            </p>
            <p className="text-xs text-dim mt-1">
              This browser blocked the service worker, so the app won't load without a
              connection. Your data is still saved locally.
            </p>
            <button
              onClick={() => setDismissedFailure(true)}
              className="btn-ghost w-full mt-3 text-sm"
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
