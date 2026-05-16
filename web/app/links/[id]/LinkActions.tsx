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
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:text-gray-200 hover:border-white/10 disabled:opacity-50 transition-all"
      >
        <span className={regenerating ? "animate-spin" : ""}>↻</span>
        {regenerating ? "Regenerating…" : "Regenerate"}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-900/40 bg-red-950/20 text-red-500 hover:text-red-400 hover:border-red-800/60 disabled:opacity-50 transition-all"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
