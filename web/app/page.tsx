import { createClient } from "@/lib/supabase";
import Link from "next/link";

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

const SOURCE_ICON: Record<string, string> = {
  youtube: "▶",
  linkedin: "in",
  substack: "S",
  medium: "M",
  github: "⌥",
  article: "⊞",
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; text: string }> = {
  podcast_ready: { dot: "bg-emerald-400", label: "Ready", text: "text-emerald-400" },
  notes_ready:   { dot: "bg-blue-400",    label: "Notes", text: "text-blue-400" },
  extracted:     { dot: "bg-violet-400",  label: "Extracted", text: "text-violet-400" },
  extracting:    { dot: "bg-amber-400 animate-pulse", label: "Processing", text: "text-amber-400" },
  failed:        { dot: "bg-red-400",     label: "Failed", text: "text-red-400" },
  received:      { dot: "bg-gray-500",    label: "Received", text: "text-gray-500" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.received;
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/5 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">R</div>
            <span className="font-semibold tracking-tight">Readback</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{ready} ready</span>
            <span className="text-gray-700">·</span>
            <span>{total} total</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="rounded-xl border border-red-900 bg-red-950/50 p-4 text-sm text-red-400 mb-6">
            Failed to load: {error.message}
          </div>
        )}

        {!links?.length && !error && (
          <div className="text-center py-24">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-2xl mx-auto mb-4">🎧</div>
            <p className="text-gray-400 font-medium">No links yet</p>
            <p className="text-gray-600 text-sm mt-1">Share a URL to your Telegram bot to get started</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {links?.map((link: LinkRow) => {
            const audioUrl = link.podcasts?.[0]?.audio_url ?? null;
            const tags = link.notes?.[0]?.tags ?? [];
            const sourceIcon = SOURCE_ICON[link.source_type] ?? "⊞";
            const isPodcastReady = link.status === "podcast_ready";

            return (
              <div
                key={link.id}
                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] card-hover flex flex-col overflow-hidden"
              >
                {/* Accent line */}
                {isPodcastReady && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                )}

                <div className="p-5 flex-1">
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                      {sourceIcon} {link.source_type}
                    </span>
                    <StatusBadge status={link.status} />
                  </div>

                  {/* Title */}
                  <Link href={`/links/${link.id}`}>
                    <h2 className="font-medium text-gray-100 line-clamp-3 leading-snug text-sm mb-3 group-hover:text-white transition-colors">
                      {link.title || link.url}
                    </h2>
                  </Link>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.slice(0, 4).map((tag: string) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-950/60 text-indigo-400 border border-indigo-900/40">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Date */}
                  <p className="text-[11px] text-gray-600">{formatDate(link.created_at)}</p>
                </div>

                {/* Audio player */}
                {audioUrl && (
                  <div className="px-4 pb-4">
                    <audio controls src={audioUrl} className="w-full h-8" />
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
