import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const fail = new URL("/login", origin);
      fail.searchParams.set("error", error.message);
      return NextResponse.redirect(fail);
    }
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
