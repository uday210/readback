"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkActions({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this link and all its notes, podcast, and visuals?")) return;
    setDeleting(true);
    await fetch(`/api/links/${linkId}`, { method: "DELETE" });
    router.push("/");
  }

  async function handleRegenerate() {
    setRegenerating(true);
    await fetch(`/api/links/${linkId}/regenerate`, { method: "POST" });
    setTimeout(() => router.refresh(), 1500);
    setTimeout(() => setRegenerating(false), 5000);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRegenerate}
        disabled={regenerating}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:border-slate-300 disabled:opacity-50 transition-all shadow-sm"
      >
        <span className={regenerating ? "animate-spin" : ""}>↻</span>
        {regenerating ? "Regenerating…" : "Regenerate"}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:text-red-700 hover:border-red-300 disabled:opacity-50 transition-all shadow-sm"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
