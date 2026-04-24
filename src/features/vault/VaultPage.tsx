import { useState } from "react";
import { VAULT_TABLES, BCP_STEPS, IR_PHASES, OSI_LAYERS } from "../../data/vault";
import OrderGame from "./OrderGame";

export default function VaultPage() {
  const [reading, setReading] = useState(false);

  return (
    <div className={reading ? "min-h-screen bg-bg p-4 max-w-3xl mx-auto safe-top safe-bottom" : "page"}>
      <div className="flex items-center justify-between mb-4 gap-2 no-print">
        <div>
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
          <h2 className="text-lg font-semibold mb-3 mt-6">🎮 Order Mini-Games</h2>
          <div className="space-y-3 mb-8">
            <OrderGame
              title="BCP Order of Operations"
              hint="Drag to order. BIA FIRST — always."
              canonicalOrder={BCP_STEPS}
            />
            <OrderGame
              title="NIST 800-61 Incident Response Phases"
              hint="Four phases, in order."
              canonicalOrder={IR_PHASES}
            />
            <OrderGame
              title="OSI Model (top → bottom)"
              hint="All People Seem To Need Data Processing."
              canonicalOrder={OSI_LAYERS}
            />
          </div>

          <h2 className="text-lg font-semibold mb-3">📋 Reference Tables</h2>
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
    </div>
  );
}
