import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { VAULT_TABLES, ORDER_GAMES } from "../../data/vault";
import OrderGame from "./OrderGame";
import QuickTestMode from "./QuickTestMode";

export default function VaultPage() {
  const [reading, setReading] = useState(false);
  const [activeGameId, setActiveGameId] = useState(ORDER_GAMES[0].id);
  const [testing, setTesting] = useState(false);

  const activeGame = ORDER_GAMES.find((g) => g.id === activeGameId) || ORDER_GAMES[0];

  return (
    <div className={reading ? "min-h-screen bg-bg p-4 max-w-3xl mx-auto safe-top safe-bottom" : "page"}>
      <div className="flex items-center justify-between mb-4 gap-2 no-print">
        {/* min-w-0 lets the subtitle wrap instead of shoving the buttons off-screen */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Memorization Vault</h1>
          <p className="text-sm text-dim mt-1">If you can't reproduce these cold, you're not ready.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="btn-ghost text-xs"
            aria-label="Print vault as a cheat sheet"
          >
            <span aria-hidden="true">🖨️ </span>Print
          </button>
          <button
            onClick={() => setReading((r) => !r)}
            className="btn-ghost text-xs"
            aria-label="Toggle reading mode"
          >
            {reading ? "Exit Reading" : "📖 Reading"}
          </button>
        </div>
      </div>

      {!reading && (
        <>
          <div className="flex items-baseline justify-between mb-3 mt-6">
            <h2 className="text-lg font-semibold">
              <span aria-hidden="true">🎮 </span>Order Mini-Games
            </h2>
            <span className="text-xs text-dim">{ORDER_GAMES.length} sequences</span>
          </div>

          {/* Sequence picker — keeps one game on screen instead of a 12-game wall. */}
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3"
            role="tablist"
            aria-label="Choose a sequence to drill"
          >
            {ORDER_GAMES.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={g.id === activeGameId}
                onClick={() => setActiveGameId(g.id)}
                className={`chip text-xs px-3 py-1.5 whitespace-nowrap shrink-0 border transition-colors ${
                  g.id === activeGameId
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "bg-panel2 text-dim border-transparent hover:text-ink"
                }`}
              >
                {g.difficulty === "Core" && <span aria-hidden="true">★ </span>}
                {g.title}
              </button>
            ))}
          </div>
          <p className="text-xs text-dim mb-3">
            <span aria-hidden="true">★ </span>Core sequences are the ones to memorise before exam
            day. Currently drilling:{" "}
            <span className="text-ink font-medium">{activeGame.difficulty}</span>.
          </p>

          <div className="mb-8">
            <OrderGame
              key={activeGame.id}
              gameId={activeGame.id}
              title={activeGame.title}
              hint={activeGame.hint}
              canonicalOrder={activeGame.order}
              onQuickTest={() => setTesting(true)}
            />
          </div>

          <h2 className="text-lg font-semibold mb-3">
            <span aria-hidden="true">📋 </span>Reference Tables
          </h2>
        </>
      )}

      <div className="space-y-6">
        {VAULT_TABLES.map((t) => (
          <div key={t.id} className="card">
            <h3 className="font-semibold mb-1">{t.title}</h3>
            <p className="text-xs text-dim mb-3">{t.intro}</p>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {t.columns.map((c, i) => (
                      <th key={i} className="text-left py-2 px-2 text-xs uppercase tracking-wider text-dim font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50 last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className={`py-2 px-2 align-top ${ci === 0 ? "font-semibold" : "text-dim"}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Sequences aren't in the printed tables — append them so the cheat sheet is complete. */}
      <div className="hidden print:block mt-6">
        <h2 className="text-lg font-semibold mb-3">Sequences</h2>
        <div className="space-y-4">
          {ORDER_GAMES.map((g) => (
            <div key={g.id}>
              <h3 className="font-semibold text-sm">{g.title}</h3>
              <ol className="text-sm list-decimal ml-5">
                {g.order.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {testing && <QuickTestMode game={activeGame} onClose={() => setTesting(false)} />}
      </AnimatePresence>
    </div>
  );
}
