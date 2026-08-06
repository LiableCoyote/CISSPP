import { useState } from "react";
import { useProfile } from "../../state/profile";
import { db } from "../../db/schema";
import { exportData, importData } from "../../lib/export";
import { downloadJSON } from "../../lib/download";
import { getWeekKey } from "../../lib/streak";
import ProfileSwitcher from "../../components/ProfileSwitcher";

export default function SettingsPage() {
  const { profile, updateProfile } = useProfile();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [examDate, setExamDate] = useState(profile?.examDate || "");
  const [dailyGoal, setDailyGoal] = useState(profile?.dailyGoalMinutes || 120);
  const [reminderEnabled, setReminderEnabled] = useState(() => {
    return localStorage.getItem("cisspp-reminder-enabled") === "1";
  });
  const [reminderTime, setReminderTime] = useState(() => {
    return localStorage.getItem("cisspp-reminder-time") || "18:00";
  });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

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

  const toggleReminder = async () => {
    if (!reminderEnabled) {
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          localStorage.setItem("cisspp-reminder-enabled", "1");
          localStorage.setItem("cisspp-reminder-time", reminderTime);
          setReminderEnabled(true);
          new Notification("CISSPP Reminders Enabled", {
            body: `You'll be reminded at ${reminderTime} daily.`,
            icon: "/icons/icon-192.png",
          });
        } else {
          setImportStatus("Notification permission denied.");
        }
      }
    } else {
      localStorage.removeItem("cisspp-reminder-enabled");
      setReminderEnabled(false);
    }
  };

  const doExport = async () => {
    try {
      const data = await exportData();
      downloadJSON(data, `cisspp-backup-${new Date().toISOString().split("T")[0]}.json`);
      setImportStatus("✓ Backup downloaded.");
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(`✗ Export failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(text);
      setImportStatus("✓ Imported. Reloading…");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setImportStatus(`✗ Import failed: ${err instanceof Error ? err.message : "unknown"}`);
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
        <p className="text-sm text-dim mb-3">
          Enable a daily notification to keep your streak alive. Browser permission required.
        </p>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="reminder-time" className="text-sm text-dim">Reminder time</label>
          <input
            id="reminder-time"
            type="time"
            value={reminderTime}
            onChange={(e) => {
              setReminderTime(e.target.value);
              localStorage.setItem("cisspp-reminder-time", e.target.value);
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
      </div>

      <div className="card mb-4">
        <h3 className="font-semibold mb-3">Backup & Restore</h3>
        <button onClick={doExport} className="btn-outline w-full mb-2">
          📥 Export All Data (JSON)
        </button>
        <label className="btn-outline w-full mb-2 cursor-pointer block text-center">
          📤 Import Backup
          <input type="file" accept="application/json" onChange={doImport} className="hidden" />
        </label>
        <p className="text-xs text-dim">
          Export your data before switching devices or clearing browser storage.
        </p>
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
