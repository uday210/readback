"use client";

export default function TweetThread({ tweets }: { tweets: string[] }) {
  if (!tweets.length) return null;
  return (
    <div className="space-y-3">
      {tweets.map((tweet, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="shrink-0 mt-0.5">
            <div className="w-7 h-7 rounded-full bg-indigo-600/40 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-300">
              {i + 1}
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{tweet}</p>
        </div>
      ))}
    </div>
  );
}
