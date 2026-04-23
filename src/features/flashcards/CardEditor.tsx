import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, type Flashcard, type DomainId } from "../../db/schema";
import { DOMAINS } from "../../data/domains";

export default function CardEditor() {
  const navigate = useNavigate();
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [domainId, setDomainId] = useState<DomainId | "">("");
  const [tagsStr, setTagsStr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    const now = new Date().toISOString();
    const card: Flashcard = {
      id: `user-${Date.now()}`,
      front: front.trim(),
      back: back.trim(),
      domainId: domainId === "" ? null : (domainId as DomainId),
      tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
      ease: 2.5,
      interval: 0,
      reps: 0,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: null,
      createdAt: now,
      source: "user",
    };
    await db.flashcards.add(card);
    navigate("/flashcards");
  }

  return (
    <div className="page max-w-2xl">
      <h1 id="editor-heading" className="text-2xl font-bold mb-6">Add Flashcard</h1>
      <form onSubmit={save} className="space-y-4" aria-labelledby="editor-heading">
        <div>
          <label htmlFor="card-front" className="block text-sm text-dim mb-1">Front (question)</label>
          <textarea
            id="card-front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            className="input min-h-[96px]"
            placeholder="e.g. ALE formula"
            autoFocus
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="card-back" className="block text-sm text-dim mb-1">Back (answer)</label>
          <textarea
            id="card-back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            className="input min-h-[120px]"
            placeholder="e.g. ALE = SLE × ARO"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="card-domain" className="block text-sm text-dim mb-1">Domain (optional)</label>
          <select
            id="card-domain"
            value={domainId}
            onChange={(e) => setDomainId(e.target.value === "" ? "" : (parseInt(e.target.value) as DomainId))}
            className="input"
          >
            <option value="">None</option>
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                D{d.id} — {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="card-tags" className="block text-sm text-dim mb-1">Tags (comma-separated)</label>
          <input
            id="card-tags"
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            className="input"
            placeholder="risk, formula, governance"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={!front.trim() || !back.trim()}>
            Save Card
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
