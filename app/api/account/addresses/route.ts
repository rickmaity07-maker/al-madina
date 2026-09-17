import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type AddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  latitude: string | null;
  longitude: string | null;
  isDefault: boolean;
};

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const addresses = await prisma.$queryRaw<AddressRow[]>`
    select id, label, line1, line2, city, postal_code as "postalCode",
           latitude, longitude, is_default as "isDefault"
    from addresses
    where user_id = ${session.userId}::uuid
    order by is_default desc, created_at desc
  `;

  return NextResponse.json(
    addresses.map((a) => ({
      ...a,
      latitude: a.latitude ? Number(a.latitude) : null,
      longitude: a.longitude ? Number(a.longitude) : null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = body.label;
  const isDefault = body.isDefault;
  
  // Support both the frontend's single 'address' string and separate fields
  const line1 = body.line1 || body.address;
  const line2 = body.line2 || null;
  const city = body.city || "Schweinfurt";
  const postalCode = body.postalCode || "97421";
  const latitude = body.latitude ?? null;
  const longitude = body.longitude ?? null;

  if (!label || !line1) {
    return NextResponse.json(
      { error: "label and address/line1 are required." },
      { status: 400 }
    );
  }

  if (isDefault) {
    await prisma.$executeRaw`
      update addresses set is_default = false where user_id = ${session.userId}::uuid
    `;
  }

  const created = await prisma.$queryRaw<AddressRow[]>`
    insert into addresses (user_id, label, line1, line2, city, postal_code, latitude, longitude, is_default)
    values (
      ${session.userId}::uuid, ${label}, ${line1}, ${line2}, ${city}, ${postalCode},
      ${latitude}, ${longitude}, ${!!isDefault}
    )
    returning id, label, line1, line2, city, postal_code as "postalCode",
              latitude, longitude, is_default as "isDefault"
  `;

  const address = created[0];
  return NextResponse.json(
    { ...address, latitude: address.latitude ? Number(address.latitude) : null, longitude: address.longitude ? Number(address.longitude) : null },
    { status: 201 }
  );
}