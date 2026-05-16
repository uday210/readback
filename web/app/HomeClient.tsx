"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

type LinkRow = {
  id: string;
  url: string;
  title: string | null;
  source_type: string;
  status: string;
  created_at: string;
  og_image: string | null;
  podcasts: { audio_url: string | null }[];
  notes: { tags: string[] | null; summary: string | null }[];
};

const SOURCE_CONFIG: Record<string, { label: string; color: string; text: string; icon: string }> = {
  youtube:  { label: "YouTube",  color: "#dc2626", text: "text-red-600",    icon: "▶" },
  linkedin: { label: "LinkedIn", color: "#2563eb", text: "text-blue-600",   icon: "in" },
  substack: { label: "Substack", color: "#ea580c", text: "text-orange-600", icon: "S" },
  medium:   { label: "Medium",   color: "#16a34a", text: "text-green-600",  icon: "M" },
  github:   { label: "GitHub",   color: "#4b5563", text: "text-gray-600",   icon: "⌥" },
  article:  { label: "Article",  color: "#6366f1", text: "text-indigo-600", icon: "◈" },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  podcast_ready: { label: "● Ready",       cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  notes_ready:   { label: "● Notes",       cls: "text-sky-700 bg-sky-50 border-sky-200" },
  extracting:    { label: "◌ Processing",  cls: "text-amber-700 bg-amber-50 border-amber-200" },
  extracted:     { label: "◈ Extracted",   cls: "text-violet-700 bg-violet-50 border-violet-200" },
  failed:        { label: "✕ Failed",      cls: "text-red-700 bg-red-50 border-red-200" },
  received:      { label: "○ Received",    cls: "text-gray-500 bg-gray-50 border-gray-200" },
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 604800) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function HomeClient({ rows }: { rows: LinkRow[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status" | "source">("newest");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    rows.forEach(r => r.notes?.[0]?.tags?.forEach((t: string) => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 20);
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(r =>
        (r.title || r.url).toLowerCase().includes(q) ||
        r.notes?.[0]?.tags?.some((t: string) => t.toLowerCase().includes(q)) ||
        r.notes?.[0]?.summary?.toLowerCase().includes(q)
      );
    }
    if (activeTag) {
      result = result.filter(r => r.notes?.[0]?.tags?.includes(activeTag));
    }
    return result;
  }, [rows, query, activeTag]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "oldest") arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === "status") arr.sort((a, b) => a.status.localeCompare(b.status));
    else if (sortBy === "source") arr.sort((a, b) => a.source_type.localeCompare(b.source_type));
    else arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  }, [filtered, sortBy]);

  const readyCount = rows.filter(l => l.status === "podcast_ready").length;
  const processingCount = rows.filter(l => ["extracting", "received", "extracted"].includes(l.status)).length;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[13px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}
            >
              R
            </div>
            <span className="font-bold text-[15px] tracking-tight text-slate-900">Readback</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-emerald-600 font-semibold">{readyCount} ready</span>
              {processingCount > 0 && <span className="text-amber-600">{processingCount} processing</span>}
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{rows.length} total</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="search"
            placeholder="Search by title, tag, or summary…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 shadow-sm transition-all"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as "newest" | "oldest" | "status" | "source")}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 shadow-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="status">By status</option>
            <option value="source">By source</option>
          </select>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="text-xs px-2.5 py-1 rounded-full border bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                ✕ Clear
              </button>
            )}
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  activeTag === tag
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!sorted.length && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {query || activeTag ? (
              <>
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-slate-700 font-semibold mb-1">No results</p>
                <p className="text-slate-400 text-sm">Try a different search or clear the filter</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl mb-5 flex items-center justify-center text-2xl bg-indigo-50 border border-indigo-100">🎧</div>
                <p className="text-slate-700 font-semibold mb-1">Nothing here yet</p>
                <p className="text-slate-400 text-sm">Share a URL to your Telegram bot to get started</p>
              </>
            )}
          </div>
        )}

        {/* Card grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {sorted.map((link) => {
            const src = SOURCE_CONFIG[link.source_type] ?? SOURCE_CONFIG.article;
            const sta = STATUS[link.status] ?? STATUS.received;
            const audioUrl = link.podcasts?.[0]?.audio_url ?? null;
            const tags = (link.notes?.[0]?.tags ?? []).slice(0, 3);
            const summary = link.notes?.[0]?.summary;
            const isReady = link.status === "podcast_ready";

            return (
              <div
                key={link.id}
                className={`group flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-200 hover:-translate-y-0.5 ${
                  isReady
                    ? "border border-indigo-200 shadow-[0_2px_12px_rgba(99,102,241,0.12)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.2)]"
                    : "border border-slate-200 shadow-sm hover:shadow-md"
                }`}
              >
                {/* OG image or source color stripe */}
                {link.og_image ? (
                  <div className="relative w-full overflow-hidden bg-slate-100" style={{ height: 144 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={link.og_image}
                      alt={link.title || ""}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none" />
                  </div>
                ) : (
                  <div
                    className="h-1"
                    style={{ background: `linear-gradient(90deg, ${src.color}cc, ${src.color}33)` }}
                  />
                )}

                {/* Source + status row */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-widest ${src.text}`}>
                    {src.icon} {src.label}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sta.cls}`}>
                    {sta.label}
                  </span>
                </div>

                {/* Body */}
                <div className="px-4 pb-4 flex-1 flex flex-col">
                  <Link href={`/links/${link.id}`}>
                    <h2 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors leading-relaxed line-clamp-3 mb-2">
                      {link.title || link.url}
                    </h2>
                  </Link>

                  {summary && (
                    <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{summary}</p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map((t: string) => (
                        <button
                          key={t}
                          onClick={() => setActiveTag(activeTag === t ? null : t)}
                          className="text-[10px] px-1.5 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 mt-auto">{timeAgo(link.created_at)}</p>
                </div>

                {/* Audio player */}
                {audioUrl && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                    <audio controls src={audioUrl} className="w-full h-7" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
