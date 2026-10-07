import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://intel.rizpram.cloud";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", APP_ORIGIN));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=oauth", APP_ORIGIN));

  return NextResponse.redirect(new URL("/", APP_ORIGIN));
}
