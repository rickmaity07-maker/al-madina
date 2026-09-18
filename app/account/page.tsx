"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Package, User as UserIcon, Heart, MapPin, RefreshCw, Plus, Trash2, ShieldCheck } from "lucide-react";

type Account = { id: string; name: string; email: string; phone: string | null; role: "OWNER" | "STAFF" | null };
type OrderItem = { id: string; name: string; sizeLabel: string | null; price: number; qty: number };
type Order = {
  id: string;
  orderNumber: string;
  fulfillment: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
};
type WishlistProduct = { id: string; name: string; image: string; category: string };
type Address = { id: string; label: string; address: string; isDefault: boolean };

const STATUS_LABEL: Record<string, string> = {
  PLACED: "Placed",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressText, setNewAddressText] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadAccount() {
    fetch("/api/account/me")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Not logged in");
        }
        const data = await res.json();
        setAccount(data.user || null);
      })
      .catch(() => {
        setAccount(null);
      });
  }

  useEffect(() => {
    loadAccount();
  }, []);

  function loadAddresses() {
    fetch("/api/account/addresses")
      .then((res) => res.json())
      .then((data) => setAddresses(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    if (account) {
      fetch("/api/account/orders")
        .then((res) => res.json())
        .then((data) => setOrders(Array.isArray(data) ? data : []));
      fetch("/api/account/wishlist")
        .then((res) => res.json())
        .then((data) => setWishlist(Array.isArray(data) ? data : []));
      loadAddresses();
    }
  }, [account]);

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddressLabel || !newAddressText) return;
    await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newAddressLabel, address: newAddressText, isDefault: addresses.length === 0 }),
    });
    setNewAddressLabel("");
    setNewAddressText("");
    loadAddresses();
  }

  async function removeAddress(id: string) {
    await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    setAddresses((cur) => cur.filter((a) => a.id !== id));
  }

  async function removeWishlistItem(id: string) {
    await fetch(`/api/account/wishlist/${id}`, { method: "DELETE" });
    setWishlist((cur) => cur.filter((p) => p.id !== id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const endpoint = mode === "login" ? "/api/account/login" : "/api/account/register";
    const body = mode === "login" ? { email, password } : { name, email, password, phone };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      setAccount(data);
    } catch {
      setError("Connection error. Please try again.");
    }
    setSubmitting(false);
  }

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    setAccount(null);
    setOrders([]);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-10 px-4 md:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <Link href="/" className="text-btn inline-flex mb-8">
          <ArrowLeft size={16} className="mr-2" /> Back to shop
        </Link>

        {account === undefined && <p>Loading…</p>}

        {account === null && (
          <div className="w-full max-w-md bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5 mx-auto">
            <span className="eyebrow block mb-1">Account</span>
            <h1 className="text-2xl mb-6">{mode === "login" ? "Sign in" : "Create an account"}</h1>

            <div className="fulfillment-toggle mb-6 flex gap-2">
              <button type="button" className={`flex-1 py-2 rounded-lg border ${mode === "login" ? "bg-black text-white" : "bg-transparent text-black"}`} onClick={() => setMode("login")}>
                Sign in
              </button>
              <button type="button" className={`flex-1 py-2 rounded-lg border ${mode === "register" ? "bg-black text-white" : "bg-transparent text-black"}`} onClick={() => setMode("register")}>
                Register
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode === "register" && (
                <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black" />
              )}
              <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black" />
              {mode === "register" && (
                <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black" />
              )}
              <input
                required
                type="password"
                placeholder={mode === "register" ? "Password (min. 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black"
              />
              {error && <div className="text-red-600 bg-red-50 p-2 rounded-lg text-sm">{error}</div>}
              <button className="w-full bg-black text-white py-2.5 rounded-lg mt-2" disabled={submitting}>
                {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        )}

        {account && (
          <div className="space-y-12">
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-black/10">
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-full border border-black/5 shadow-sm">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-medium">{account.name}</h1>
                  <small className="text-black/60 text-sm">{account.email}</small>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {account.role && (
                  <Link
                    href="/admin"
                    className="text-sm flex items-center gap-2 rounded-full bg-[#a12e3d] text-white px-4 py-2 hover:bg-[#8a2734]"
                  >
                    <ShieldCheck size={16} /> Admin
                  </Link>
                )}
                <button className="text-sm flex items-center gap-2 text-black/70 hover:text-black" onClick={logout}>
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </div>

            {/* Orders */}
            <section>
              <h2 className="text-lg flex items-center gap-2 mb-4">
                <Package size={18} /> Order history
              </h2>
              {orders.length === 0 ? (
                <p className="text-black/50">No orders yet — your placed orders will show up here.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {orders.map((o) => (
                    <div key={o.id} className="bg-white p-5 rounded-xl border border-black/5 shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <Link href={`/account/orders/${o.id}`} className="font-semibold underline">
                          #{o.orderNumber}
                        </Link>
                        <span className="text-sm bg-black/5 px-3 py-1 rounded-full">{STATUS_LABEL[o.status] ?? o.status}</span>
                      </div>
                      <small className="text-black/60">
                        {new Date(o.createdAt).toLocaleDateString()} · {o.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"}
                      </small>
                      <ul className="text-sm mt-2 space-y-1">
                        {o.items.map((it) => (
                          <li key={it.id}>
                            {it.qty}× {it.name} {it.sizeLabel ? `(${it.sizeLabel})` : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between items-center font-semibold border-t border-black/10 pt-3 mt-2">
                        <span>Total (cash) · €{o.total.toFixed(2)}</span>
                        <Link href={`/?reorder=${o.id}`} className="text-sm flex items-center gap-2 text-[#a12e3d]">
                          <RefreshCw size={14} /> Reorder
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Wishlist */}
            <section>
              <h2 className="text-lg flex items-center gap-2 mb-4">
                <Heart size={18} /> Wishlist
              </h2>
              {wishlist.length === 0 ? (
                <p className="text-black/50">Items you save with the heart icon on the shop page will show up here.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {wishlist.map((p) => (
                    <div key={p.id} className="relative group">
                      <Link href="/" className="block">
                        <img src={p.image} alt={p.name} className="w-full aspect-square object-cover rounded-xl border border-black/5" />
                        <span className="block mt-2 text-sm font-medium truncate">{p.name}</span>
                      </Link>
                      <button
                        onClick={() => removeWishlistItem(p.id)}
                        aria-label="Remove"
                        className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow hover:bg-red-50 text-black/70 hover:text-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Addresses */}
            <section>
              <h2 className="text-lg flex items-center gap-2 mb-4">
                <MapPin size={18} /> Saved addresses
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {addresses.map((a) => (
                  <div key={a.id} className="bg-white p-4 rounded-xl border border-black/5 shadow-sm flex justify-between items-start">
                    <div>
                      <span className="font-semibold">{a.label}</span> {a.isDefault && <span className="text-xs text-black/50 ml-1">(default)</span>}
                      <p className="text-sm text-black/70 mt-1">{a.address}</p>
                    </div>
                    <button onClick={() => removeAddress(a.id)} className="text-black/40 hover:text-red-600 transition p-1" aria-label="Remove address">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={addAddress} className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-black/5 shadow-sm">
                <input 
                  placeholder="Label (e.g. Home)" 
                  value={newAddressLabel} 
                  onChange={(e) => setNewAddressLabel(e.target.value)} 
                  className="w-full sm:w-1/3 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black text-sm" 
                />
                <input 
                  placeholder="Full address" 
                  value={newAddressText} 
                  onChange={(e) => setNewAddressText(e.target.value)} 
                  className="w-full flex-1 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-black text-sm" 
                />
                <button className="bg-black text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm whitespace-nowrap">
                  <Plus size={16} /> Add Address
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}