import { NextRequest, NextResponse, after } from "next/server";
import { getVerifiedCustomerSession } from "@/lib/customer-auth";
import { createEmailVerification, isEmailVerified } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getVerifiedCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const ip = clientIp(req);
  const { allowed } = rateLimit(`resend-verification:${session.userId}`, 3, 10 * 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Bitte warten Sie kurz, bevor Sie einen weiteren Code anfordern." }, { status: 429 });
  }
  // Also cap per-IP, independent of account, to slow down anyone cycling accounts.
  if (!rateLimit(`resend-verification-ip:${ip}`, 10, 10 * 60_000).allowed) {
    return NextResponse.json({ error: "Bitte warten Sie kurz, bevor Sie einen weiteren Code anfordern." }, { status: 429 });
  }

  if (await isEmailVerified(session.userId)) {
    return NextResponse.json({ error: "Diese E-Mail ist bereits bestätigt." }, { status: 400 });
  }

  const user = await prisma.$queryRaw<{ full_name: string }[]>`
    select full_name from users where id = ${session.userId}::uuid
  `;

  const code = await createEmailVerification(session.userId);
  after(async () => {
    await sendVerificationEmail(session.email, user[0]?.full_name ?? "", code).catch((e: unknown) =>
      console.error("[mailer] resend verification email failed", e)
    );
  });

  return NextResponse.json({ ok: true });
}
