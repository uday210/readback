"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CollapsibleNotes({ markdown }: { markdown: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className={`relative overflow-hidden ${expanded ? "" : "max-h-52"}`}>
        <div className="md-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        {expanded ? "↑ Collapse" : "↓ Show full notes"}
      </button>
    </div>
  );
}
