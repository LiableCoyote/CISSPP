import { useEffect, useState, Suspense, lazy } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { initializeDb } from "./db/seed";
import { maybeDailySnapshot } from "./lib/snapshots";
import { useProfile } from "./state/profile";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import PomodoroFab from "./components/PomodoroFab";

const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const CampaignPage = lazy(() => import("./features/plan/CampaignPage"));
const WeekDetailPage = lazy(() => import("./features/plan/WeekDetailPage"));
const FlashcardsPage = lazy(() => import("./features/flashcards/FlashcardsPage"));
const ReviewSession = lazy(() => import("./features/flashcards/ReviewSession"));
const CardEditor = lazy(() => import("./features/flashcards/CardEditor"));
const QuizLauncherPage = lazy(() => import("./features/quiz/QuizLauncherPage"));
const QuizSessionPage = lazy(() => import("./features/quiz/QuizSessionPage"));
const QuizReviewPage = lazy(() => import("./features/quiz/QuizReviewPage"));
const DomainsPage = lazy(() => import("./features/domains/DomainsPage"));
const DomainDetailPage = lazy(() => import("./features/domains/DomainDetailPage"));
const VaultPage = lazy(() => import("./features/vault/VaultPage"));
const StatsPage = lazy(() => import("./features/stats/StatsPage"));
const AchievementsPage = lazy(() => import("./features/achievements/AchievementsPage"));
const PaceBoardPage = lazy(() => import("./features/stats/PaceBoardPage"));
const StudyReportPage = lazy(() => import("./features/stats/StudyReportPage"));
const ResourcesPage = lazy(() => import("./features/resources/ResourcesPage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-4xl mb-2 animate-flicker">◆</div>
        <p className="text-dim text-sm">Loading…</p>
      </div>
    </div>
  );
}

function StartupError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md text-center">
        <p className="text-4xl mb-2" aria-hidden="true">
          🗄️
        </p>
        <h2 className="text-xl font-bold mb-2">Couldn't open your study data</h2>
        <p className="text-sm text-dim mb-4">{message}</p>
        <p className="text-xs text-dim mb-4">
          This usually means the database is open in another tab, or the browser is blocking
          storage for this site. Close other tabs and reload. Your data has not been changed.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary w-full">
          Reload App
        </button>
      </div>
    </div>
  );
}

function App() {
  const { initProfile, loading } = useProfile();
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    // Without a catch here a rejected init leaves `loading` true forever, and the
    // user sits on the spinner with no error and no way out — ErrorBoundary never
    // sees a rejected promise.
    initializeDb()
      .then(() => initProfile())
      // Best-effort and non-blocking: a snapshot must never delay startup.
      .then(() => maybeDailySnapshot().catch((err) => console.error("Daily snapshot:", err)))
      .catch((err: unknown) => {
        console.error("Startup failed:", err);
        setStartupError(err instanceof Error ? err.message : "Unknown error");
      });
  }, []); // eslint-disable-line

  if (startupError) return <StartupError message={startupError} />;
  if (loading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          {/* Immersive routes — no layout chrome */}
          <Route
            path="/flashcards/review"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ReviewSession />
              </Suspense>
            }
          />
          <Route
            path="/quiz/session"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <QuizSessionPage />
              </Suspense>
            }
          />

          {/* Everything else gets the layout */}
          <Route
            path="*"
            element={
              <Layout>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/plan" element={<CampaignPage />} />
                    <Route path="/plan/week/:n" element={<WeekDetailPage />} />
                    <Route path="/flashcards" element={<FlashcardsPage />} />
                    <Route path="/flashcards/new" element={<CardEditor />} />
                    <Route path="/quiz" element={<QuizLauncherPage />} />
                    <Route path="/quiz/review/:id" element={<QuizReviewPage />} />
                    <Route path="/domains" element={<DomainsPage />} />
                    <Route path="/domains/:id" element={<DomainDetailPage />} />
                    <Route path="/vault" element={<VaultPage />} />
                    <Route path="/stats" element={<StatsPage />} />
                    <Route path="/achievements" element={<AchievementsPage />} />
                    <Route path="/pace" element={<PaceBoardPage />} />
                    <Route path="/report" element={<StudyReportPage />} />
                    <Route path="/resources" element={<ResourcesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<div className="page text-center text-dim">404 · Page not found</div>} />
                  </Routes>
                </Suspense>
                <PomodoroFab />
              </Layout>
            }
          />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
