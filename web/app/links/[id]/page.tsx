import { createClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";

export const revalidate = 0;

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

  const mermaidImgUrl = notes?.mermaid_diagram
    ? `https://mermaid.ink/img/${Buffer.from(notes.mermaid_diagram).toString("base64")}`
    : null;

  const flashcards = notes?.flashcards
    ? (typeof notes.flashcards === "string" ? JSON.parse(notes.flashcards) : notes.flashcards)
    : [];

  const quiz = notes?.quiz
    ? (typeof notes.quiz === "string" ? JSON.parse(notes.quiz) : notes.quiz)
    : [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <a href="/" className="text-sm text-gray-400 hover:text-gray-200 mb-6 inline-block">
        ← Back
      </a>

      <h1 className="text-xl font-bold mb-1 leading-snug">{link.title || link.url}</h1>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:underline break-all"
      >
        {link.url}
      </a>

      <div className="flex gap-2 mt-2 mb-6">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{link.source_type}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{link.status}</span>
      </div>

      {podcast?.audio_url && (
        <section className="mb-8 bg-gray-900 rounded-xl p-4">
          <p className="text-sm font-semibold mb-3 text-gray-200">Podcast Episode</p>
          <audio controls src={podcast.audio_url} className="w-full" />
          {podcast.duration_sec && (
            <p className="text-xs text-gray-500 mt-1">{Math.round(podcast.duration_sec / 60)} min</p>
          )}
        </section>
      )}

      {notes ? (
        <>
          {/* Tags */}
          {notes.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-6">
              {notes.tags.map((tag: string) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-300">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Key Takeaways */}
          {notes.key_takeaways?.length > 0 && (
            <section className="mb-8 bg-gray-900 rounded-xl p-4 border-l-4 border-indigo-500">
              <p className="text-sm font-semibold mb-3 text-gray-200">Key Takeaways</p>
              <ul className="space-y-2">
                {notes.key_takeaways.map((t: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Concept Diagram */}
          {mermaidImgUrl && (
            <section className="mb-8">
              <p className="text-sm font-semibold mb-3 text-gray-200">Concept Map</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mermaidImgUrl}
                alt="Concept diagram"
                className="w-full rounded-xl bg-white p-2"
              />
            </section>
          )}

          {/* Flashcards */}
          {flashcards.length > 0 && <Flashcards cards={flashcards} />}

          {/* Quiz */}
          {quiz.length > 0 && <Quiz questions={quiz} />}

          {/* Full Notes */}
          <section>
            <p className="text-sm font-semibold mb-3 text-gray-200">Notes</p>
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-gray-100 prose-headings:font-semibold
              prose-p:text-gray-300 prose-p:leading-relaxed
              prose-li:text-gray-300
              prose-strong:text-gray-100
              prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:rounded prose-code:px-1
              prose-blockquote:border-indigo-500 prose-blockquote:text-gray-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {notes.markdown}
              </ReactMarkdown>
            </div>
          </section>

          {/* Napkin Diagram */}
          {notes.napkin_url && (
            <div className="mt-8">
              <p className="text-sm font-semibold mb-3 text-gray-200">Visual Diagram</p>
              <iframe
                src={notes.napkin_url}
                className="w-full rounded-xl border border-gray-700"
                style={{ height: "480px" }}
                allow="fullscreen"
              />
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm">Notes not yet generated — check back soon.</p>
      )}
    </main>
  );
}
