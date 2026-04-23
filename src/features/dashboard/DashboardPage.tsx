import { useProfile } from "../../state/profile";

export default function DashboardPage() {
  const { profile } = useProfile();

  if (!profile) return null;

  const daysUntilExam = profile.examDate
    ? Math.ceil((new Date(profile.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 56;

  return (
    <div className="min-h-screen bg-bg text-ink p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Welcome, {profile.displayName}!</h1>
        <p className="text-dim mb-8">CISSP Quest — 8 Weeks to Mastery</p>

        {/* Countdown */}
        <div className="card mb-8 p-6 border-2 border-accent shadow-glow">
          <p className="text-dim text-sm">Days Until Exam</p>
          <p className="text-6xl font-bold text-accent">{daysUntilExam}</p>
          <p className="text-dim text-sm mt-2">Exam Date: {profile.examDate}</p>
        </div>

        {/* Profile Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-dim text-xs">XP</p>
            <p className="text-2xl font-bold text-xp">{profile.xp}</p>
          </div>
          <div className="card p-4">
            <p className="text-dim text-xs">Level</p>
            <p className="text-2xl font-bold text-accent2">{profile.level}</p>
          </div>
          <div className="card p-4">
            <p className="text-dim text-xs">Streak</p>
            <p className="text-2xl font-bold text-streak">{profile.streak}</p>
          </div>
          <div className="card p-4">
            <p className="text-dim text-xs">Longest</p>
            <p className="text-2xl font-bold text-high">{profile.longestStreak}</p>
          </div>
        </div>

        {/* Placeholder: Full pages to come */}
        <div className="card p-6 text-center">
          <p className="text-lg font-semibold mb-2">🚀 More features coming soon!</p>
          <p className="text-dim text-sm">
            Campaign, Domains, Flashcards, Quiz, Vault, Stats, Resources, and Settings pages are in development.
          </p>
          <p className="text-dim text-xs mt-4 mb-6">
            Current build: Core data layer + profile state. Ready for feature expansion.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <span className="chip">Dashboard ✓</span>
            <span className="chip">~120 CISSP Qs ✓</span>
            <span className="chip">50+ Flashcards ✓</span>
            <span className="chip">Dexie DB ✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
