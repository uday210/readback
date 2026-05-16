import { createClient } from "@/lib/supabase";
import Link from "next/link";
import SignOutButton from "./SignOutButton";

export const revalidate = 0;

type LinkRow = {
  id: string;
  url: string;
  title: string | null;
  source_type: string;
  status: string;
  created_at: string;
  podcasts: { audio_url: string | null }[];
  notes: { tags: string[] | null; summary: string | null }[];
};

const SOURCE_CONFIG: Record<string, { label: string; headerBg: string; text: string; icon: string }> = {
  youtube:  { label: "YouTube",  headerBg: "bg-gradient-to-b from-red-950/70 to-transparent",      text: "text-red-400",    icon: "▶" },
  linkedin: { label: "LinkedIn", headerBg: "bg-gradient-to-b from-blue-950/70 to-transparent",     text: "text-blue-400",   icon: "in" },
  substack: { label: "Substack", headerBg: "bg-gradient-to-b from-orange-950/70 to-transparent",   text: "text-orange-400", icon: "S" },
  medium:   { label: "Medium",   headerBg: "bg-gradient-to-b from-green-950/70 to-transparent",    text: "text-green-400",  icon: "M" },
  github:   { label: "GitHub",   headerBg: "bg-gradient-to-b from-zinc-900/70 to-transparent",     text: "text-zinc-400",   icon: "⌥" },
  article:  { label: "Article",  headerBg: "bg-gradient-to-b from-indigo-950/70 to-transparent",   text: "text-indigo-400", icon: "◈" },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  podcast_ready: { label: "● Ready",       cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  notes_ready:   { label: "● Notes",       cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  extracting:    { label: "◌ Processing",  cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  extracted:     { label: "◈ Extracted",   cls: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  failed:        { label: "✕ Failed",      cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  received:      { label: "○ Received",    cls: "text-gray-500 bg-gray-500/10 border-gray-500/30" },
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 604800) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function Home() {
  const supabase = createClient();
  const { data: links, error } = await supabase
    .from("links")
    .select("id, url, title, source_type, status, created_at, podcasts(audio_url), notes(tags, summary)")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (links ?? []) as LinkRow[];
  const readyCount = rows.filter(l => l.status === "podcast_ready").length;
  const processingCount = rows.filter(l => ["extracting", "received", "extracted"].includes(l.status)).length;

  return (
    <div className="min-h-screen bg-[#06070d]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06]" style={{ background: "rgba(6,7,13,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[13px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
              R
            </div>
            <span className="font-bold text-[15px] tracking-tight">Readback</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-semibold">{readyCount} ready</span>
              {processingCount > 0 && <span className="text-amber-400">{processingCount} processing</span>}
              <span className="text-gray-700">·</span>
              <span className="text-gray-500">{rows.length} total</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {error && <p className="text-red-400 text-sm mb-6">{error.message}</p>}

        {!rows.length && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-14 h-14 rounded-[18px] mb-5 flex items-center justify-center text-2xl"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>🎧</div>
            <p className="text-gray-200 font-semibold mb-1.5">Nothing here yet</p>
            <p className="text-gray-600 text-sm">Share a URL to your Telegram bot to get started</p>
          </div>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {rows.map((link) => {
            const src = SOURCE_CONFIG[link.source_type] ?? SOURCE_CONFIG.article;
            const sta = STATUS[link.status] ?? STATUS.received;
            const audioUrl = link.podcasts?.[0]?.audio_url ?? null;
            const tags = (link.notes?.[0]?.tags ?? []).slice(0, 3);
            const summary = link.notes?.[0]?.summary;
            const isReady = link.status === "podcast_ready";

            return (
              <div key={link.id} className={`group flex flex-col overflow-hidden rounded-[18px] transition-all duration-200 hover:-translate-y-1 ${
                isReady
                  ? "border border-indigo-500/20 hover:border-indigo-500/40 hover:shadow-[0_8px_40px_rgba(99,102,241,0.15)]"
                  : "border border-white/[0.07] hover:border-white/[0.14] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
              }`} style={{ background: "rgba(255,255,255,0.025)" }}>

                {/* Indigo top stripe for ready items */}
                {isReady && <div className="h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-violet-500/0" />}

                {/* Source header band */}
                <div className={`px-5 pt-4 pb-3 ${src.headerBg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-widest ${src.text}`}>
                      {src.icon} {src.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sta.cls}`}>
                      {sta.label}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 pt-2 pb-4 flex-1 flex flex-col">
                  <Link href={`/links/${link.id}`}>
                    <h2 className="text-sm font-semibold text-gray-100 group-hover:text-white transition-colors leading-relaxed line-clamp-3 mb-2">
                      {link.title || link.url}
                    </h2>
                  </Link>

                  {summary && (
                    <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-2 mb-3">{summary}</p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md border"
                          style={{ background: "rgba(99,102,241,0.08)", color: "rgba(129,140,248,0.75)", borderColor: "rgba(99,102,241,0.15)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-gray-600 mt-auto">{timeAgo(link.created_at)}</p>
                </div>

                {/* Audio */}
                {audioUrl && (
                  <div className="px-4 pb-4 pt-3 border-t border-white/[0.04]">
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
