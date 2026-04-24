import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  icon?: string;
  title: string;
  body?: string;
  action?:
    | { kind: "link"; to: string; label: string }
    | { kind: "button"; onClick: () => void; label: string };
  children?: ReactNode;
}

export default function EmptyState({ icon = "📭", title, body, action, children }: Props) {
  return (
    <div className="card text-center py-10 px-4">
      <p className="text-5xl mb-3" aria-hidden="true">
        {icon}
      </p>
      <h3 className="font-semibold mb-1">{title}</h3>
      {body && <p className="text-sm text-dim mb-4 max-w-sm mx-auto">{body}</p>}
      {action?.kind === "link" && (
        <Link to={action.to} className="btn-primary inline-block">
          {action.label}
        </Link>
      )}
      {action?.kind === "button" && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
