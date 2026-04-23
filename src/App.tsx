import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initializeDb } from "./db/seed";
import { useProfile } from "./state/profile";
import DashboardPage from "./features/dashboard/DashboardPage";

function App() {
  const { initProfile, loading } = useProfile();

  useEffect(() => {
    initializeDb().then(() => initProfile());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg text-ink">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">CISSPP</h1>
          <p className="text-dim">Loading your quest...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="*" element={<div className="p-8 text-center text-dim">404 — Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
