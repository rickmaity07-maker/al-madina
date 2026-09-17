import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ admin: null });
  return NextResponse.json({ admin: { username: session.username, role: session.role, adminId: session.adminId } });
}
