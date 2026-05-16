"use client";

export default function TweetThread({ tweets }: { tweets: string[] }) {
  if (!tweets.length) return null;
  return (
    <div className="space-y-3">
      {tweets.map((tweet, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="shrink-0 mt-0.5">
            <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-600">
              {i + 1}
            </div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{tweet}</p>
        </div>
      ))}
    </div>
  );
}
