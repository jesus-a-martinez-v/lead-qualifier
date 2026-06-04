import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/auth";

export async function POST(request: NextRequest) {
  // redirect:false so we control the 303 response — keeps the POST-form contract
  // used by the header's sign-out button.
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), {
    status: 303,
  });
}
