import { createClient } from "@/lib/supabase";

export const revalidate = 0;

type LinkRow = {
  id: string;
  url: string;
  title: string | null;
  source_type: string;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  podcast_ready: "bg-green-900 text-green-300",
  notes_ready: "bg-blue-900 text-blue-300",
  extracted: "bg-purple-900 text-purple-300",
  extracting: "bg-yellow-900 text-yellow-300",
  failed: "bg-red-900 text-red-300",
  received: "bg-gray-700 text-gray-300",
};

export default async function Home() {
  const supabase = createClient();
  const { data: links, error } = await supabase
    .from("links")
    .select("id, url, title, source_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <main className="p-6">
        <p className="text-red-400">Failed to load: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 tracking-tight">Readback</h1>

      {!links?.length && (
        <p className="text-gray-400 text-sm">No links yet — share something to your Telegram bot to get started.</p>
      )}

      <ul className="space-y-3">
        {links?.map((link: LinkRow) => (
          <li key={link.id} className="bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{link.source_type}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[link.status] ?? STATUS_COLORS.received}`}>
                {link.status}
              </span>
            </div>
            <a href={`/links/${link.id}`} className="font-medium hover:text-blue-400 transition-colors line-clamp-2 block">
              {link.title || link.url}
            </a>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(link.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
