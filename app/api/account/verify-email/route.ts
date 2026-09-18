import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { verifyEmailCode } from "@/lib/email-verification";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const ip = clientIp(req);
  const { allowed } = rateLimit(`verify-email:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again in a minute." }, { status: 429 });
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const result = await verifyEmailCode(session.userId, code);

  switch (result) {
    case "OK":
      return NextResponse.json({ ok: true });
    case "NO_PENDING_CODE":
      return NextResponse.json({ error: "No verification code is pending — request a new one." }, { status: 400 });
    case "EXPIRED":
      return NextResponse.json({ error: "That code has expired — request a new one." }, { status: 400 });
    case "TOO_MANY_ATTEMPTS":
      return NextResponse.json({ error: "Too many incorrect attempts — request a new code." }, { status: 429 });
    case "INVALID":
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }
}
