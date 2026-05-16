import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "https://readback-production.up.railway.app";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const res = await fetch(`${API_URL}/links/${params.id}/regenerate`, { method: "POST" });
  if (!res.ok) {
    return NextResponse.json({ error: "Regenerate failed" }, { status: res.status });
  }
  return NextResponse.json({ regenerating: true });
}
