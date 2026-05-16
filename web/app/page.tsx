import { createClient } from "@/lib/supabase";
import HomeClient from "./HomeClient";

export const revalidate = 0;

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

export default async function Home() {
  const supabase = createClient();
  const { data: links } = await supabase
    .from("links")
    .select("id, url, title, source_type, status, created_at, og_image, podcasts(audio_url), notes(tags, summary)")
    .order("created_at", { ascending: false })
    .limit(50);

  return <HomeClient rows={(links ?? []) as LinkRow[]} />;
}
