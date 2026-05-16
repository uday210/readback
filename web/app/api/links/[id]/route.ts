import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "https://readback-production.up.railway.app";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const res = await fetch(`${API_URL}/links/${params.id}`, { method: "DELETE" });
  if (!res.ok) {
    return NextResponse.json({ error: "Delete failed" }, { status: res.status });
  }
  return NextResponse.json({ deleted: true });
}
