import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  // Create a short-lived client with anon key server-side
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "awake-cron" } },
  });

  // Ultra-light DB work
  const { data, error } = await supabase.rpc("ping");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { ok: true, message: data, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
