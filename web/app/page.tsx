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

const SOURCE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  youtube:  { label: "YouTube",  bg: "from-red-950/80 to-red-900/20",      text: "text-red-400",    icon: "▶" },
  linkedin: { label: "LinkedIn", bg: "from-blue-950/80 to-blue-900/20",    text: "text-blue-400",   icon: "in" },
  substack: { label: "Substack", bg: "from-orange-950/80 to-orange-900/20",text: "text-orange-400", icon: "S" },
  medium:   { label: "Medium",   bg: "from-green-950/80 to-green-900/20",  text: "text-green-400",  icon: "M" },
  github:   { label: "GitHub",   bg: "from-zinc-900/80 to-zinc-800/20",    text: "text-zinc-400",   icon: "⌥" },
  article:  { label: "Article",  bg: "from-indigo-950/80 to-indigo-900/20",text: "text-indigo-400", icon: "◈" },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  podcast_ready: { label: "● Ready",      cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  notes_ready:   { label: "● Notes",      cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  extracting:    { label: "◌ Processing", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  extracted:     { label: "◈ Extracted",  cls: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  failed:        { label: "✕ Failed",     cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  received:      { label: "○ Received",   cls: "text-gray-500 bg-gray-500/10 border-gray-500/30" },
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
    <div className="min-h-screen" style={{ background: "#06070d" }}>
      {/* Header */}
      <header className="border-b border-white/[0.06]" style={{ background: "rgba(6,7,13,0.9)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div className="max-w-5xl mx-auto px-5 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 10, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>R</div>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Readback</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-4" style={{ fontSize: 12, color: "#6b7280" }}>
              <span style={{ color: "#34d399", fontWeight: 600 }}>{readyCount} ready</span>
              {processingCount > 0 && <span style={{ color: "#fbbf24" }}>{processingCount} processing</span>}
              <span style={{ color: "#374151" }}>·</span>
              <span>{rows.length} total</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {error && <p className="text-red-400 text-sm mb-6">{error.message}</p>}

        {!rows.length && !error && (
          <div className="text-center py-32">
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 16px" }}>🎧</div>
            <p style={{ color: "#e5e7eb", fontWeight: 600, marginBottom: 6 }}>Nothing here yet</p>
            <p style={{ color: "#6b7280", fontSize: 13 }}>Share a URL to your Telegram bot to get started</p>
          </div>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {rows.map((link) => {
            const src = SOURCE_CONFIG[link.source_type] ?? SOURCE_CONFIG.article;
            const sta = STATUS[link.status] ?? STATUS.received;
            const audioUrl = link.podcasts?.[0]?.audio_url ?? null;
            const tags = (link.notes?.[0]?.tags ?? []).slice(0, 3);
            const summary = link.notes?.[0]?.summary;
            const isReady = link.status === "podcast_ready";

            return (
              <div key={link.id} style={{
                borderRadius: 18,
                border: `1px solid ${isReady ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"}`,
                background: "rgba(255,255,255,0.02)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
                transition: "transform 0.18s, border-color 0.18s, box-shadow 0.18s",
                boxShadow: isReady ? "0 0 30px rgba(99,102,241,0.08)" : "none",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLElement).style.borderColor = isReady ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLElement).style.boxShadow = isReady ? "0 8px 40px rgba(99,102,241,0.15)" : "0 8px 30px rgba(0,0,0,0.5)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.borderColor = isReady ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.boxShadow = isReady ? "0 0 30px rgba(99,102,241,0.08)" : "none";
              }}>

                {/* Colored top band */}
                <div style={{ height: 3, background: isReady ? "linear-gradient(90deg,#6366f1,#8b5cf6)" : "transparent" }} />

                {/* Source header */}
                <div className={`px-5 pt-4 pb-3 bg-gradient-to-b ${src.bg}`}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }} className={src.text}>
                      {src.icon} {src.label}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, border: "1px solid" }} className={`${sta.cls}`}>
                      {sta.label}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="px-5 pt-3 pb-4 flex-1 flex flex-col">
                  <Link href={`/links/${link.id}`}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: "#f3f4f6", marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#f3f4f6")}>
                      {link.title || link.url}
                    </h2>
                  </Link>

                  {summary && (
                    <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {summary}
                    </p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map((t: string) => (
                        <span key={t} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "rgba(99,102,241,0.08)", color: "rgba(129,140,248,0.8)", border: "1px solid rgba(99,102,241,0.15)" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: "#4b5563", marginTop: "auto" }}>{timeAgo(link.created_at)}</p>
                </div>

                {/* Audio */}
                {audioUrl && (
                  <div style={{ padding: "0 16px 14px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 12 }}>
                    <audio controls src={audioUrl} style={{ width: "100%", height: 28 }} />
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
