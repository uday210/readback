import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "https://readback-production.up.railway.app";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const r = await fetch(`${API_URL}/links/${params.id}/video`, { method: "POST" });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const r = await fetch(`${API_URL}/links/${params.id}/video`, { cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
