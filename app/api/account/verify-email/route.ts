import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { verifyEmailCode } from "@/lib/email-verification";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const ip = clientIp(req);
  const { allowed } = rateLimit(`verify-email:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut." }, { status: 429 });
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein." }, { status: 400 });
  }

  const result = await verifyEmailCode(session.userId, code);

  switch (result) {
    case "OK":
      return NextResponse.json({ ok: true });
    case "NO_PENDING_CODE":
      return NextResponse.json({ error: "Kein Bestätigungscode aktiv — fordern Sie einen neuen an." }, { status: 400 });
    case "EXPIRED":
      return NextResponse.json({ error: "Dieser Code ist abgelaufen — fordern Sie einen neuen an." }, { status: 400 });
    case "TOO_MANY_ATTEMPTS":
      return NextResponse.json({ error: "Zu viele falsche Versuche — fordern Sie einen neuen Code an." }, { status: 429 });
    case "INVALID":
      return NextResponse.json({ error: "Falscher Code. Bitte versuchen Sie es erneut." }, { status: 400 });
  }
}
