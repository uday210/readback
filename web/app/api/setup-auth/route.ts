import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.createUser({
    email: "uday.sfdc1991@gmail.com",
    password: "Demo12345",
    email_confirm: true,
  });

  if (error && !error.message.toLowerCase().includes("already")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "User ready" });
}
