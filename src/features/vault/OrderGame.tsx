import { useState, useEffect } from "react";
import { Reorder } from "framer-motion";

interface Props {
  title: string;
  canonicalOrder: string[];
  hint?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function OrderGame({ title, canonicalOrder, hint }: Props) {
  const [items, setItems] = useState<string[]>(() => shuffle(canonicalOrder));
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked && correct) {
      if ("vibrate" in navigator) navigator.vibrate([10, 50, 10, 50, 30]);
    }
  }); // eslint-disable-line

  const correct = items.every((it, i) => it === canonicalOrder[i]);

  const retry = () => {
    setItems(shuffle(canonicalOrder));
    setChecked(false);
  };

  return (
    <div className="card">
      <h3 className="font-semibold mb-1">{title}</h3>
      {hint && <p className="text-xs text-dim mb-3">{hint}</p>}

      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
        {items.map((item, i) => {
          const isCorrectSpot = checked && item === canonicalOrder[i];
          const isWrongSpot = checked && item !== canonicalOrder[i];
          return (
            <Reorder.Item
              key={item}
              value={item}
              className={`list-row cursor-grab active:cursor-grabbing select-none ${
                isCorrectSpot ? "!border-high !bg-high/10" : isWrongSpot ? "!border-danger !bg-danger/10" : ""
              }`}
            >
              <span className="text-dim text-xs w-6">{i + 1}.</span>
              <span className="flex-1 font-medium">{item}</span>
              <span className="text-dim text-lg">⋮⋮</span>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <div className="flex gap-2 mt-4">
        {!checked ? (
          <button onClick={() => setChecked(true)} className="btn-primary flex-1">
            Check
          </button>
        ) : correct ? (
          <>
            <button onClick={retry} className="btn-ghost flex-1">Reshuffle</button>
            <div className="btn-primary flex-1 !bg-high !text-bg cursor-default">🎉 Correct!</div>
          </>
        ) : (
          <>
            <button onClick={retry} className="btn-ghost flex-1">Reshuffle</button>
            <button onClick={() => setChecked(false)} className="btn-outline flex-1">Try Again</button>
          </>
        )}
      </div>
    </div>
  );
}
