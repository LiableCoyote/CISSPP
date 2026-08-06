import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import { useProfile } from "../../state/profile";
import { DOMAINS } from "../../data/domains";
import { WEEK_META } from "../../data/weeks";
import { xpToLevel, LEVEL_XP_THRESHOLDS } from "../../lib/xp";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import InstallPrompt from "../../components/InstallPrompt";
import { ACHIEVEMENT_DEFS } from "../../data/achievements";
import ShareCard from "../stats/ShareCard";

const MINDSET_PROMPTS = [
  "Would a CISO patch the server, or update the policy first?",
  "You can't pick technical over governance. Always.",
  "BEST, FIRST, MOST — watch for these every single question.",
  "When two answers look right, choose the one that reduces organizational risk.",
  "The exam rewards 'what should a manager do' — not 'what can an admin do'.",
  "Is your answer a control? Good. Is it the FIRST control? That's better.",
  "Assess risk → Select control → Implement → Monitor. Always in that order.",
  "If it feels hard, the algorithm thinks you're strong. Keep going.",
  "Never spend >90 seconds on one question. Decide and commit.",
  "Your goal on exam day: think CISO. Not sysadmin. Not engineer. CISO.",
];

export default function DashboardPage() {
  const { profile } = useProfile();
  const attempts = useLiveQuery(() => db.attempts.toArray()) || [];
  const quests = useLiveQuery(() => db.quests.toArray()) || [];
  const answers = useLiveQuery(() => db.answers.toArray()) || [];
  const unlocks = useLiveQuery(() =>
    db.achievements.orderBy("unlockedAt").reverse().limit(3).toArray(),
  ) || [];
  const unlockCount = useLiveQuery(() => db.achievements.count()) ?? 0;

  if (!profile) return null;

  const today = new Date();
  const daysUntilExam = profile.examDate ? differenceInCalendarDays(parseISO(profile.examDate), today) : 56;
  const daysSinceStart = differenceInCalendarDays(today, parseISO(profile.startDate));
  const currentWeek = Math.min(8, Math.max(1, Math.floor(daysSinceStart / 7) + 1));
  const currentDay = Math.min(7, (daysSinceStart % 7) + 1);

  const { level, levelTitle, xpInLevel } = xpToLevel(profile.xp);
  const nextThreshold = LEVEL_XP_THRESHOLDS[Math.min(level + 1, LEVEL_XP_THRESHOLDS.length - 1)];
  const levelBase = LEVEL_XP_THRESHOLDS[level];
  const xpRange = nextThreshold - levelBase;
  const levelProgress = xpRange > 0 ? Math.min(100, (xpInLevel / xpRange) * 100) : 100;

  // Today's quests
  const todaysQuests = quests.filter((q) => q.week === currentWeek && q.day === currentDay);

  // Domain mastery radar
  const radarData = DOMAINS.map((d) => {
    const ds = attempts.filter((a) => a.domainId === d.id);
    const avg = ds.length > 0 ? ds.reduce((s, a) => s + a.scorePct, 0) / ds.length : 0;
    return { domain: `D${d.id}`, mastery: Math.round(avg), weight: d.weight };
  });

  // CISO score
  const total = answers.length;
  const cisoScore = total > 0 ? Math.round(((total - answers.filter((a) => a.flaggedMindset).length) / total) * 100) : 100;

  // Next boss
  const bossWeeks = [4, 6, 7];
  const nextBoss = bossWeeks.find((w) => w > currentWeek) || null;

  // Mindset prompt of the day
  const promptIdx = daysSinceStart % MINDSET_PROMPTS.length;

  // Countdown color
  const countdownColor = daysUntilExam > 28 ? "text-high" : daysUntilExam > 14 ? "text-warn" : daysUntilExam > 7 ? "text-med" : "text-danger";

  // Domain hoarder check - last 7 days
  const last7 = attempts.filter((a) => differenceInCalendarDays(today, parseISO(a.startedAt)) <= 7);
  const domainHoard: Record<number, number> = {};
  last7.forEach((a) => {
    if (a.domainId) domainHoard[a.domainId] = (domainHoard[a.domainId] || 0) + 1;
  });
  const totalLast7 = Object.values(domainHoard).reduce((a, b) => a + b, 0);
  const maxD = Math.max(0, ...Object.values(domainHoard));
  const hoarderAlert = totalLast7 >= 3 && maxD / totalLast7 > 0.6;
  const hoarderDomain = Object.entries(domainHoard).find(([, v]) => v === maxD)?.[0];

  // Cramming alert: 6+ attempts in a single domain over the last 2 days.
  const last2 = attempts.filter((a) => differenceInCalendarDays(today, parseISO(a.startedAt)) <= 2);
  const cram2d: Record<number, number> = {};
  last2.forEach((a) => {
    if (a.domainId) cram2d[a.domainId] = (cram2d[a.domainId] || 0) + 1;
  });
  const crammedMax = Math.max(0, ...Object.values(cram2d));
  const crammingAlert = crammedMax >= 6;
  const crammedDomain = Object.entries(cram2d).find(([, v]) => v === crammedMax)?.[0];

  return (
    <div className="page">
      <InstallPrompt />

      {/* Countdown hero */}
      <section aria-labelledby="countdown-heading" className="card mb-4 text-center py-5 md:py-8 shadow-glow border-2 border-accent">
        <h2 id="countdown-heading" className="text-dim text-xs uppercase tracking-wider font-medium">Days Until Exam</h2>
        <p className={`text-6xl md:text-7xl font-bold ${countdownColor} my-1`} aria-label={`${daysUntilExam} days until exam`}>
          {daysUntilExam}
        </p>
        <p className="text-sm text-dim">
          Day {Math.min(56, daysSinceStart + 1)} of 56 · Week {currentWeek} · Day {currentDay}
        </p>
      </section>

      {/* Level progress */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-dim">Level {level}</p>
            <p className="font-semibold">{levelTitle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-dim">XP</p>
            <p className="font-bold text-xp">{profile.xp}</p>
          </div>
        </div>
        <div
          className="h-3 bg-panel2 rounded-full overflow-hidden"
          role="progressbar"
          aria-label="XP progress to next level"
          aria-valuenow={Math.round(levelProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${xpInLevel} of ${xpRange} XP toward level ${level + 1}`}
        >
          <div
            className="h-full bg-gradient-to-r from-xp to-accent2 transition-all"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
        <p className="text-xs text-dim mt-1 text-right">
          {xpInLevel} / {xpRange} to next level
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Streak</p>
          <p className="text-2xl font-bold text-streak animate-flicker">🔥 {profile.streak}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">Longest</p>
          <p className="text-2xl font-bold text-high">{profile.longestStreak}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-dim">CISO Score</p>
          <p className="text-2xl font-bold text-accent">{cisoScore}%</p>
        </div>
      </div>

      {/* Recent achievements */}
      {unlockCount > 0 && (
        <section aria-labelledby="recent-unlocks-heading" className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 id="recent-unlocks-heading" className="font-semibold">
              <span aria-hidden="true">🏆 </span>Achievements
            </h3>
            <Link to="/achievements" className="text-xs text-accent hover:underline">
              {unlockCount} / {ACHIEVEMENT_DEFS.length} →
            </Link>
          </div>
          <ul className="space-y-2" role="list">
            {unlocks.map((u) => {
              const def = ACHIEVEMENT_DEFS.find((d) => d.id === u.id);
              if (!def) return null;
              return (
                <li key={u.id} className="flex items-center gap-3">
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {def.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{def.name}</p>
                    <p className="text-xs text-dim truncate">{def.description}</p>
                  </div>
                  <span className="text-[10px] text-dim whitespace-nowrap">
                    {format(parseISO(u.unlockedAt), "MMM d")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Domain hoarder warning */}
      {hoarderAlert && (
        <div className="card mb-4 border-warn/40 bg-warn/5" role="alert">
          <p className="text-sm">
            <span className="font-semibold text-warn">
              <span aria-hidden="true">⚠ </span>Domain Hoarder Alert:{" "}
            </span>
            You've drilled Domain {hoarderDomain} more than 60% of the past week. Time to rotate.
          </p>
        </div>
      )}

      {/* Cramming alert */}
      {crammingAlert && (
        <div className="card mb-4 border-warn/40 bg-warn/5" role="alert">
          <p className="text-sm">
            <span className="font-semibold text-warn">
              <span aria-hidden="true">⏱ </span>Cramming detected:{" "}
            </span>
            {crammedMax} quizzes on Domain {crammedDomain} in 2 days. Try a mixed set or
            flashcard review tomorrow — spaced repetition beats marathon drilling.
          </p>
        </div>
      )}

      {/* Today's quests */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Today's Quests</h3>
          <Link to={`/plan/week/${currentWeek}`} className="text-xs link">
            Week {currentWeek} →
          </Link>
        </div>
        {todaysQuests.length === 0 ? (
          <p className="text-sm text-dim">No quests scheduled for today. Visit the Campaign page.</p>
        ) : (
          <ul className="space-y-2">
            {todaysQuests.slice(0, 4).map((q) => (
              <li key={q.id} className="flex items-start gap-2 text-sm">
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                  q.completedAt ? "bg-high border-high text-bg" : "border-border"
                }`}>
                  {q.completedAt && "✓"}
                </span>
                <span className={q.completedAt ? "line-through text-dim" : ""}>{q.title}</span>
              </li>
            ))}
            {todaysQuests.length > 4 && (
              <li className="text-xs text-dim pl-7">+ {todaysQuests.length - 4} more</li>
            )}
          </ul>
        )}
      </div>

      {/* Radar */}
      {radarData.some((r) => r.mastery > 0) && (
        <section aria-labelledby="mastery-heading" className="card mb-4">
          <h3 id="mastery-heading" className="font-semibold mb-2">Domain Mastery</h3>
          <div role="img" aria-label={`Domain mastery chart: ${radarData.map(r => `${r.domain} ${r.mastery}%`).join(", ")}`}>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#243046" />
                <PolarAngleAxis dataKey="domain" stroke="#8b97ab" fontSize={11} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} stroke="#243046" />
                <Radar dataKey="mastery" fill="#6ee7b7" fillOpacity={0.3} stroke="#6ee7b7" strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Next boss */}
      {nextBoss && (
        <div className="card mb-4 border-danger/40 bg-danger/5">
          <p className="text-xs uppercase text-danger font-semibold tracking-wider">Next Boss</p>
          <p className="font-semibold mt-1">{WEEK_META[nextBoss - 1].title}</p>
          <p className="text-xs text-dim mt-1">Week {nextBoss} · {WEEK_META[nextBoss - 1].target || "Full-length exam"}</p>
        </div>
      )}

      {/* Mindset of the day */}
      <div className="card border-accent/30 mb-4">
        <p className="text-xs uppercase tracking-wider text-accent font-semibold">CISO Mindset · {format(today, "MMM d")}</p>
        <p className="text-sm mt-2 italic">{MINDSET_PROMPTS[promptIdx]}</p>
      </div>

      <ShareCard />
    </div>
  );
}
