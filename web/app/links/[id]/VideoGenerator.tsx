"use client";

import { useState, useEffect, useCallback } from "react";

type Props = {
  linkId: string;
  initialStatus?: string | null;
  initialVideoUrl?: string | null;
  hasOgImage: boolean;
};

export default function VideoGenerator({ linkId, initialStatus, initialVideoUrl, hasOgImage }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    const r = await fetch(`/api/links/${linkId}/video`);
    const data = await r.json();
    setStatus(data.video_status ?? null);
    setVideoUrl(data.video_url ?? null);
    return data;
  }, [linkId]);

  useEffect(() => {
    if (status !== "generating") return;
    const id = setInterval(async () => {
      const data = await poll();
      if (data.video_status !== "generating") clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [status, poll]);

  async function handleGenerate() {
    setError(null);
    setStatus("generating");
    const r = await fetch(`/api/links/${linkId}/video`, { method: "POST" });
    if (!r.ok) {
      const data = await r.json();
      setError(data.detail ?? "Failed to start video generation");
      setStatus(null);
    }
  }

  if (!hasOgImage && !videoUrl) {
    return (
      <p className="text-xs text-slate-400 italic">
        Video generation requires an article image. Re-process the link to fetch one.
      </p>
    );
  }

  if (videoUrl) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-black overflow-hidden shadow-sm">
          <video controls src={videoUrl} className="w-full" style={{ maxHeight: 400 }} />
        </div>
        <button
          onClick={handleGenerate}
          className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
        >
          ↻ Regenerate video
        </button>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-6 flex items-center gap-4">
        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-800">Generating with Runway ML…</p>
          <p className="text-xs text-indigo-500 mt-0.5">Takes ~30–60 seconds, page will update automatically</p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">Video generation failed.</p>
        </div>
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium shadow-sm"
        >
          🎬 Retry
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Runway ML Gen-3 creates a 5-second cinematic video from the article image. On-demand only.
      </p>
      <button
        onClick={handleGenerate}
        className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium shadow-sm"
      >
        🎬 Generate AI Video
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
