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
  notes: { tags: string[] | null }[];
};

const SOURCE_CONFIG: Record<string, { icon: string; color: string }> = {
  youtube:  { icon: "▶",  color: "bg-red-500/10 text-red-400 border-red-500/20" },
  linkedin: { icon: "in", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  substack: { icon: "S",  color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  medium:   { icon: "M",  color: "bg-green-500/10 text-green-400 border-green-500/20" },
  github:   { icon: "⌥",  color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  article:  { icon: "⊞",  color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; pill: string }> = {
  podcast_ready: { dot: "bg-emerald-400",                  label: "Ready",      pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
  notes_ready:   { dot: "bg-blue-400",                     label: "Notes",      pill: "bg-blue-500/10 text-blue-400 border-blue-500/25" },
  extracted:     { dot: "bg-violet-400",                   label: "Extracted",  pill: "bg-violet-500/10 text-violet-400 border-violet-500/25" },
  extracting:    { dot: "bg-amber-400 animate-pulse",      label: "Processing", pill: "bg-amber-500/10 text-amber-400 border-amber-500/25" },
  failed:        { dot: "bg-red-400",                      label: "Failed",     pill: "bg-red-500/10 text-red-400 border-red-500/25" },
  received:      { dot: "bg-gray-500",                     label: "Received",   pill: "bg-gray-500/10 text-gray-400 border-gray-500/25" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function Home() {
  const supabase = createClient();
  const { data: links, error } = await supabase
    .from("links")
    .select("id, url, title, source_type, status, created_at, podcasts(audio_url), notes(tags)")
    .order("created_at", { ascending: false })
    .limit(50);

  const total = links?.length ?? 0;
  const ready = links?.filter((l: LinkRow) => l.status === "podcast_ready").length ?? 0;

  return (
    <div className="min-h-screen bg-[#07080f]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-500/20">
              R
            </div>
            <span className="font-semibold tracking-tight">Readback</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-600">
              <span><span className="text-emerald-400 font-semibold">{ready}</span> ready</span>
              <span className="text-gray-700">·</span>
              <span><span className="text-gray-300 font-medium">{total}</span> total</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-400 mb-6">
            {error.message}
          </div>
        )}

        {!links?.length && !error && (
          <div className="text-center py-32">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-2xl mx-auto mb-5">🎧</div>
            <p className="text-gray-300 font-medium mb-1">Nothing here yet</p>
            <p className="text-gray-600 text-sm">Share a URL to your Telegram bot to get started</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {links?.map((link: LinkRow) => {
            const audioUrl = link.podcasts?.[0]?.audio_url ?? null;
            const tags = (link.notes?.[0]?.tags ?? []).slice(0, 3);
            const src = SOURCE_CONFIG[link.source_type] ?? SOURCE_CONFIG.article;
            const sta = STATUS_CONFIG[link.status] ?? STATUS_CONFIG.received;
            const isReady = link.status === "podcast_ready";

            return (
              <div key={link.id} className={`card rounded-2xl flex flex-col overflow-hidden group relative ${isReady ? "glow-indigo" : ""}`}>
                {/* Ready accent line */}
                {isReady && (
                  <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
                )}

                <div className="p-5 flex-1 flex flex-col">
                  {/* Meta row */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${src.color}`}>
                      {src.icon} {link.source_type}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sta.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sta.dot}`} />
                      {sta.label}
                    </span>
                  </div>

                  {/* Title */}
                  <Link href={`/links/${link.id}`} className="flex-1">
                    <h2 className="text-sm font-semibold text-gray-100 line-clamp-3 leading-relaxed mb-3 group-hover:text-white transition-colors">
                      {link.title || link.url}
                    </h2>
                  </Link>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map((tag: string) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-950/50 text-indigo-400/80 border border-indigo-900/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-gray-600 mt-auto">{formatDate(link.created_at)}</p>
                </div>

                {/* Audio player */}
                {audioUrl && (
                  <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
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
