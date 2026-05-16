import { createClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";
import TweetThread from "./TweetThread";
import LinkActions from "./LinkActions";
import VideoGenerator from "./VideoGenerator";
import CollapsibleNotes from "./CollapsibleNotes";

export const revalidate = 0;

const SOURCE_ICON: Record<string, string> = {
  youtube: "▶", linkedin: "in", substack: "S",
  medium: "M", github: "⌥", article: "⊞",
};

function parse<T>(val: unknown): T | null {
  if (!val) return null;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return val as T;
}

export default async function LinkDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: link } = await supabase
    .from("links")
    .select("*, contents(*), notes(*), podcasts(*)")
    .eq("id", params.id)
    .single();

  if (!link) notFound();

  const notes = link.notes?.[0] ?? null;
  const podcast = link.podcasts?.[0] ?? null;
  const tags: string[] = notes?.tags ?? [];

  const mermaidImgUrl = notes?.mermaid_diagram
    ? `https://mermaid.ink/img/${Buffer.from(notes.mermaid_diagram).toString("base64")}`
    : null;

  const flashcards = parse<{ q: string; a: string }[]>(notes?.flashcards) ?? [];
  const quiz = parse<{ question: string; options: string[]; answer: string }[]>(notes?.quiz) ?? [];
  const actionPlan = parse<{ step: string; details: string }[]>(notes?.action_plan) ?? [];
  const tweetThread = parse<string[]>(notes?.tweet_thread) ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-800 transition-colors text-sm shrink-0">
            <span>←</span>
            <span>Back</span>
          </Link>
          <div className="w-px h-4 bg-slate-200 shrink-0" />
          <p className="text-sm text-slate-500 truncate flex-1">{link.title || link.url}</p>
          <LinkActions linkId={link.id} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-6 py-8 pb-32 flex-1">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {SOURCE_ICON[link.source_type] ?? "⊞"} {link.source_type}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {link.status}
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-tight mb-2 text-slate-900">
            {link.title || link.url}
          </h1>

          <a href={link.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline break-all transition-colors">
            {link.url}
          </a>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {notes ? (
          <div className="space-y-10">

            {/* Key Takeaways */}
            {notes.key_takeaways?.length > 0 && (
              <section>
                <SectionHeader icon="⚡" title="Key Takeaways" />
                <div className="grid gap-2">
                  {notes.key_takeaways.map((t: string, i: number) => (
                    <div key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <span className="text-indigo-600 font-bold text-sm mt-0.5 shrink-0">{i + 1}</span>
                      <p className="text-sm text-slate-700 leading-relaxed">{t}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Analogy */}
            {notes.analogy && (
              <section>
                <SectionHeader icon="💡" title="Analogy" />
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <p className="text-sm text-amber-800 leading-relaxed italic">"{notes.analogy}"</p>
                </div>
              </section>
            )}

            {/* Action Plan */}
            {actionPlan.length > 0 && (
              <section>
                <SectionHeader icon="🚀" title="Action Plan" />
                <div className="space-y-2">
                  {actionPlan.map((item, i) => (
                    <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="w-6 h-6 rounded-full border border-indigo-300 bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.step}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Concept Map */}
            {mermaidImgUrl && (
              <section>
                <SectionHeader icon="🗺" title="Concept Map" />
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mermaidImgUrl} alt="Concept diagram" className="w-full" />
                </div>
              </section>
            )}

            {/* Napkin AI Visual */}
            {notes.napkin_url && (
              <section>
                <SectionHeader icon="✦" title="AI Visual" />
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white p-2 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={notes.napkin_url} alt="Napkin AI visual" className="w-full rounded-xl" />
                </div>
              </section>
            )}

            {/* Comparison Table */}
            {notes.comparison_table && (
              <section>
                <SectionHeader icon="⚖️" title="Comparison" />
                <div className="rounded-2xl border border-slate-200 bg-white p-5 overflow-x-auto shadow-sm">
                  <div className="md-table">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {notes.comparison_table}
                    </ReactMarkdown>
                  </div>
                </div>
              </section>
            )}

            {/* Flashcards */}
            {flashcards.length > 0 && (
              <section>
                <SectionHeader icon="🃏" title={`Flashcards (${flashcards.length})`} />
                <Flashcards cards={flashcards} />
              </section>
            )}

            {/* Quiz */}
            {quiz.length > 0 && (
              <section>
                <SectionHeader icon="🧠" title={`Quiz (${quiz.length} questions)`} />
                <Quiz questions={quiz} />
              </section>
            )}

            {/* Tweet Thread */}
            {tweetThread.length > 0 && (
              <section>
                <SectionHeader icon="𝕏" title="Tweet Thread" />
                <TweetThread tweets={tweetThread} />
              </section>
            )}

            {/* AI Video */}
            <section>
              <SectionHeader icon="🎬" title="AI Video" />
              <VideoGenerator
                linkId={link.id}
                initialStatus={link.video_status ?? null}
                initialVideoUrl={link.video_url ?? null}
                hasOgImage={!!link.og_image}
              />
            </section>

            {/* Full Notes — collapsible */}
            <section>
              <SectionHeader icon="📄" title="Full Notes" />
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <CollapsibleNotes markdown={notes.markdown} />
              </div>
            </section>

          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl mx-auto mb-3">⏳</div>
            <p className="text-slate-500 text-sm">Notes are being generated — check back soon</p>
          </div>
        )}
      </main>

      {/* Sticky audio player */}
      {podcast?.audio_url && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur-md px-6 py-3 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs shrink-0">🎧</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 truncate mb-1">{link.title || "Episode"}</p>
              <audio controls src={podcast.audio_url} className="w-full h-7" />
            </div>
            {podcast.duration_sec && (
              <span className="text-xs text-slate-400 shrink-0">{Math.round(podcast.duration_sec / 60)}m</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h2 className="text-sm font-semibold text-slate-700 tracking-tight">{title}</h2>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}
