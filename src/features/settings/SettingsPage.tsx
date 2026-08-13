import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { useProfile } from "../../state/profile";
import { createSnapshotOrThrow, listSnapshots, restoreSnapshot } from "../../lib/snapshots";
import { db } from "../../db/schema";
import { exportData, importData } from "../../lib/export";
import { downloadJSON } from "../../lib/download";
import { getItem, setItem, removeItem } from "../../lib/safeStorage";
import {
  reminderSupport,
  enableBackgroundReminder,
  disableBackgroundReminder,
} from "../../lib/reminders";
import {
  backupKey,
  persistenceState,
  storageEstimate,
  describePersistence,
  formatBytes,
  daysSinceBackup,
  type PersistenceState,
  type StorageUsage,
} from "../../lib/storage";
import { getWeekKey } from "../../lib/streak";
import ProfileSwitcher from "../../components/ProfileSwitcher";

export default function SettingsPage() {
  const { profile, updateProfile } = useProfile();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [examDate, setExamDate] = useState(profile?.examDate || "");
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoalMinutes || 120);
  const [reminderEnabled, setReminderEnabled] = useState(() => {
    return getItem("cisspp-reminder-enabled") === "1";
  });
  const [reminderTime, setReminderTime] = useState(() => {
    return getItem("cisspp-reminder-time") || "18:00";
  });
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  // Capability probe, not a branch on behaviour: the summary is shown to the
  // user so the toggle never implies more than the browser can do.
  const [support] = useState(reminderSupport);
  const [lastBackup, setLastBackup] = useState<string | null>(() => getItem(backupKey()));
  const [persistence, setPersistence] = useState<PersistenceState | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const snapshots = useLiveQuery(() => listSnapshots()) || [];

  // Read-only probes. requestPersistence() runs once at startup in App.tsx;
  // this only reports the answer rather than asking again.
  useEffect(() => {
    void persistenceState().then(setPersistence);
    void storageEstimate().then(setUsage);
  }, []);

  const backupAgeDays = daysSinceBackup(lastBackup);

  if (!profile) return null;

  const save = async () => {
    await updateProfile({
      displayName,
      examDate: examDate || null,
      dailyGoalMinutes: dailyGoal,
    });
    setImportStatus("✓ Saved");
    setTimeout(() => setImportStatus(null), 2000);
  };

  /**
   * Turns on the in-app reminder, and asks for a system notification as a
   * bonus rather than as the feature.
   *
   * The previous version requested permission, stored the time, fired one
   * notification saying "You'll be reminded at 18:00 daily", and scheduled
   * nothing. The reminder never arrived. Here the in-app nudge is the product —
   * it works everywhere and honours the chosen time — and the background
   * notification is attempted only where the browser supports it.
   */
  const toggleReminder = async () => {
    if (reminderEnabled) {
      removeItem("cisspp-reminder-enabled");
      setReminderEnabled(false);
      await disableBackgroundReminder();
      setReminderStatus("Reminders off.");
      return;
    }

    setItem("cisspp-reminder-enabled", "1");
    setItem("cisspp-reminder-time", reminderTime);
    setReminderEnabled(true);
    // Reported before the permission round-trip, not after. The in-app reminder
    // is already live at this point, and requestPermission can sit unanswered
    // indefinitely while the user ignores the prompt — leaving them with a
    // toggle that flipped and said nothing.
    setReminderStatus("On. You'll see the reminder in the app.");

    // Permission is worth asking for only if the browser could act on it.
    if (!support.notifications || !support.background) return;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      if (await enableBackgroundReminder()) {
        setReminderStatus(
          "On. You'll see it in the app, and your browser may also show a system reminder.",
        );
      }
    } catch {
      // Permission prompts can reject outright in some embedded contexts. The
      // in-app reminder is unaffected, so there is nothing to tell the user.
    }
  };

  const doExport = async () => {
    try {
      const data = await exportData();
      downloadJSON(data, `cisspp-backup-${new Date().toISOString().split("T")[0]}.json`);
      // Slot-scoped: a backup covers one profile's data, so another slot's
      // export says nothing about whether this one is protected.
      setItem(backupKey(), new Date().toISOString());
      setLastBackup(new Date().toISOString());
      setImportStatus("✓ Backup downloaded.");
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(`✗ Export failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear the input so picking the same file twice still fires onChange.
    e.target.value = "";
    if (!file) return;

    // Import replaces everything. It used to run on a single tap while the far
    // less likely "Reset" had a two-tap confirm — hold the file and confirm.
    setPendingImport(file);
    setImportStatus(null);
  };

  const confirmImport = async () => {
    const file = pendingImport;
    if (!file) return;
    setPendingImport(null);
    setImportStatus("Saving a snapshot first…");
    try {
      // Must throw, not return null. The dialog just promised a snapshot would
      // be taken; proceeding without one would replace everything with no undo,
      // and a failure here means the storage is full — exactly when it matters.
      await createSnapshotOrThrow("pre-import");
    } catch (err) {
      setImportStatus(
        `✗ Import cancelled — couldn't save a snapshot first (${
          err instanceof Error ? err.message : "unknown"
        }). Nothing was changed.`,
      );
      return;
    }

    try {
      const text = await file.text();
      await importData(text);
      setImportStatus("✓ Imported. Reloading…");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setImportStatus(`✗ Import failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  const doRestoreSnapshot = async (id: string) => {
    setImportStatus("Restoring…");
    try {
      await restoreSnapshot(id);
      setImportStatus("✓ Restored. Reloading…");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setImportStatus(`✗ Restore failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  const thisWeekKey = getWeekKey(new Date());
  const freezesUsed =
    profile.streakWeekKey === thisWeekKey ? profile.streakFreezesUsedThisWeek : 0;
  const freezeAvailable = freezesUsed < 1 && profile.streak > 0;

  const applyFreeze = async () => {
    if (!freezeAvailable) return;
    const today = new Date().toISOString().split("T")[0];
    await updateProfile({
      streakFreezesUsedThisWeek: freezesUsed + 1,
      streakWeekKey: thisWeekKey,
      lastActiveDate: today,
    });
    setImportStatus("✓ Streak freeze applied for today.");
    setTimeout(() => setImportStatus(null), 3000);
  };

  const doReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    // Never delete without a backup in hand — if the export fails, stop.
    // The snapshot is in-database and dies with db.delete(), so the downloaded
    // file is the one that actually survives a reset.
    try {
      const data = await exportData();
      downloadJSON(data, `cisspp-pre-reset-backup-${Date.now()}.json`);
    } catch (err) {
      setResetConfirm(false);
      setImportStatus(
        `✗ Reset cancelled — couldn't save a backup first (${
          err instanceof Error ? err.message : "unknown"
        }). Nothing was deleted.`,
      );
      return;
    }
    await db.delete();
    window.location.reload();
  };

  return (
    <div className="page max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <ProfileSwitcher />

      <section aria-labelledby="streak-heading" className="card mb-4">
        <h2 id="streak-heading" className="font-semibold mb-1">Streak Freeze</h2>
        <p className="text-sm text-dim mb-3">
          One streak freeze per week skips a missed day without breaking your run. The plan is
          realistic — life happens.
        </p>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm">
              This week: <span className="font-semibold">{freezesUsed}/1</span> freeze used
            </p>
            <p className="text-xs text-dim">
              Current streak: {profile.streak} day{profile.streak === 1 ? "" : "s"}
              {profile.longestStreak > 0 ? ` · Longest: ${profile.longestStreak}` : ""}
            </p>
          </div>
          <span
            className={`pill ${freezeAvailable ? "bg-accent/15 text-accent" : "bg-panel2 text-dim"}`}
            aria-label={freezeAvailable ? "Freeze available" : "Freeze used this week"}
          >
            {freezeAvailable ? "❄ Available" : "Used"}
          </span>
        </div>
        <button
          onClick={applyFreeze}
          className="btn-outline w-full"
          disabled={!freezeAvailable}
          aria-disabled={!freezeAvailable}
        >
          {freezeAvailable ? "Use Streak Freeze for Today" : "No freeze available this week"}
        </button>
      </section>

      <section aria-labelledby="profile-heading" className="card mb-4">
        <h2 id="profile-heading" className="font-semibold mb-3">Profile</h2>
        <label htmlFor="display-name" className="block text-sm text-dim mb-1">Display name</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input mb-3"
        />
        <label htmlFor="exam-date" className="block text-sm text-dim mb-1">Exam date</label>
        <input
          id="exam-date"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          className="input mb-3"
        />
        <label htmlFor="daily-goal" className="block text-sm text-dim mb-1">
          Daily goal: <span className="font-semibold text-ink">{dailyGoal} minutes</span>
        </label>
        <input
          id="daily-goal"
          type="range"
          min={30}
          max={360}
          step={30}
          value={dailyGoal}
          onChange={(e) => setDailyGoal(parseInt(e.target.value))}
          className="w-full"
          aria-valuetext={`${dailyGoal} minutes per day`}
        />
        <button onClick={save} className="btn-primary w-full mt-3">Save</button>
        <div role="status" aria-live="polite" className="min-h-[1.25rem]">
          {importStatus && <p className="text-sm text-accent mt-2">{importStatus}</p>}
        </div>
      </section>

      <div className="card mb-4">
        <h3 className="font-semibold mb-1">Daily Reminder</h3>
        <p className="text-sm text-dim mb-2">
          A nudge on the dashboard when you haven't logged anything by your chosen time.
        </p>
        {/* Says what this browser will really do. No web app can schedule a
            notification for a specific time without a server to send it. */}
        <p className="text-xs text-dim mb-3">{support.summary}</p>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="reminder-time" className="text-sm text-dim">
            Preferred time
          </label>
          <input
            id="reminder-time"
            type="time"
            value={reminderTime}
            onChange={(e) => {
              setReminderTime(e.target.value);
              setItem("cisspp-reminder-time", e.target.value);
            }}
            className="input !w-auto"
            disabled={!reminderEnabled}
          />
        </div>
        <button
          onClick={toggleReminder}
          className={reminderEnabled ? "btn-danger w-full mt-3" : "btn-primary w-full mt-3"}
        >
          {reminderEnabled ? "Disable Reminder" : "Enable Reminder"}
        </button>
        <div role="status" aria-live="polite" className="min-h-[1.25rem]">
          {reminderStatus && <p className="text-sm text-accent mt-2">{reminderStatus}</p>}
        </div>
      </div>

      <section aria-labelledby="durability-heading" className="card mb-4">
        <h3 id="durability-heading" className="font-semibold mb-1">Where Your Data Lives</h3>
        <p className="text-sm text-dim mb-3">
          Everything is in this browser, on this device. There is no server copy.
        </p>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between gap-3">
            <dt className="text-dim">Browser keeps it</dt>
            <dd className="font-medium text-right">
              {persistence === null
                ? "checking…"
                : persistence === "granted"
                  ? "Yes — persistent"
                  : persistence === "denied"
                    ? "Best effort only"
                    : "Unknown"}
            </dd>
          </div>
          {usage && (
            <div className="flex justify-between gap-3">
              <dt className="text-dim">Space used</dt>
              <dd className="font-medium text-right">
                {formatBytes(usage.usageBytes)}{" "}
                <span className="text-dim">of {formatBytes(usage.quotaBytes)}</span>
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-dim">Last export</dt>
            <dd
              className={`font-medium text-right ${backupAgeDays === null || backupAgeDays >= 7 ? "text-warn" : ""}`}
            >
              {lastBackup === null
                ? "Never"
                : backupAgeDays === 0
                  ? "Today"
                  : `${backupAgeDays} day${backupAgeDays === 1 ? "" : "s"} ago`}
            </dd>
          </div>
        </dl>
        {/* The honest part. Persistence is a request, not a guarantee, and on
            the platform most likely to evict this data it does nothing. */}
        {persistence !== null && (
          <p className="text-xs text-dim mt-3 border-t border-border pt-3">
            {describePersistence(persistence)}
          </p>
        )}
      </section>

      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Backup & Restore</h3>
        <button onClick={doExport} className="btn-outline w-full mb-2">
          📥 Export All Data (JSON)
        </button>

        {pendingImport ? (
          <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 mb-2" role="alert">
            <p className="text-sm font-semibold text-danger">
              <span aria-hidden="true">⚠ </span>This replaces everything
            </p>
            <p className="text-xs text-dim mt-1">
              Importing <span className="text-ink">{pendingImport.name}</span> will replace all of
              your current study data. A snapshot is saved first, so you can undo it below.
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPendingImport(null)} className="btn-ghost flex-1 text-sm">
                Cancel
              </button>
              <button onClick={confirmImport} className="btn-danger flex-1 text-sm">
                Replace my data
              </button>
            </div>
          </div>
        ) : (
          <label className="btn-outline w-full mb-2 cursor-pointer block text-center">
            📤 Import Backup
            <input type="file" accept="application/json" onChange={doImport} className="hidden" />
          </label>
        )}

        <p className="text-xs text-dim">
          Export your data before switching devices or clearing browser storage.
        </p>

        {snapshots.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <h4 className="text-xs uppercase tracking-wider text-dim mb-2">Automatic snapshots</h4>
            <ul className="space-y-2" role="list">
              {snapshots.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {format(parseISO(s.createdAt), "MMM d, HH:mm")}
                      <span className="text-xs text-dim ml-2">
                        {s.reason === "daily"
                          ? "daily"
                          : s.reason === "pre-import"
                            ? "before import"
                            : "before reset"}
                      </span>
                    </p>
                    <p className="text-[11px] text-dim">{Math.round(s.sizeBytes / 1024)} KB</p>
                  </div>
                  <button
                    onClick={() => doRestoreSnapshot(s.id)}
                    className="btn-ghost text-xs shrink-0"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-dim mt-2">
              Taken automatically once a day and before anything destructive. The newest{" "}
              {snapshots.length === 1 ? "one is" : `${snapshots.length} are`} kept.
            </p>
          </div>
        )}
      </div>

      <div className="card border-danger/40 bg-danger/5">
        <h3 className="font-semibold mb-1 text-danger">Danger Zone</h3>
        <p className="text-sm text-dim mb-3">
          Reset all data. A backup will be downloaded automatically before deletion.
        </p>
        <button onClick={doReset} className="btn-danger w-full">
          {resetConfirm ? "Tap again to confirm reset" : "Reset All Data"}
        </button>
        {resetConfirm && (
          <button
            onClick={() => setResetConfirm(false)}
            className="btn-ghost w-full mt-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
