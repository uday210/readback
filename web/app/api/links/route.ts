import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "https://readback-production.up.railway.app";

export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${API_URL}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
