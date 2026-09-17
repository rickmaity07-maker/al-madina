// app/cart/page.tsx
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-auth";
import { getCart } from "@/lib/cart";
import { getCartMinimum } from "@/lib/pricing";
import { CartView } from "@/app/components/CartView";

export default async function CartPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account"); // login/register lives on the account page

  const [cart, cartMinimum] = await Promise.all([getCart(session.userId), getCartMinimum()]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-4xl text-(--ink)">Your cart</h1>
      <CartView initialCart={cart} cartMinimum={cartMinimum} />
    </main>
  );
}