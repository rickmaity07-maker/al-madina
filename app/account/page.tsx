"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Package, User as UserIcon, Heart, MapPin, RefreshCw, Plus, Trash2 } from "lucide-react";

type Account = { id: string; name: string; email: string; phone: string | null };
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
  const [account, setAccount] = useState<Account | null | undefined>(undefined); // undefined = loading
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
      .then((res) => res.json())
      .then((data) => setAccount(data.user));
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
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> Back to shop
        </Link>

        {account === undefined && <p>Loading…</p>}

        {account === null && (
          <div className="checkout-modal" style={{ position: "static", boxShadow: "none", padding: 0 }}>
            <span className="eyebrow">Account</span>
            <h1 style={{ fontSize: 32, marginBottom: 18 }}>{mode === "login" ? "Sign in" : "Create an account"}</h1>

            <div className="fulfillment-toggle" style={{ marginBottom: 18 }}>
              <button type="button" className={mode === "login" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setMode("login")}>
                Sign in
              </button>
              <button type="button" className={mode === "register" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setMode("register")}>
                Register
              </button>
            </div>

            <form onSubmit={submit} className="checkout-fields">
              {mode === "register" && <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
              <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {mode === "register" && (
                <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              )}
              <input
                required
                type="password"
                placeholder={mode === "register" ? "Password (min. 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <div className="checkout-error">{error}</div>}
              <button className="primary-btn full" disabled={submitting}>
                {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        )}

        {account && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <UserIcon size={22} />
                <div>
                  <h1 style={{ fontSize: 24 }}>{account.name}</h1>
                  <small style={{ color: "rgba(24,32,27,.6)" }}>{account.email}</small>
                </div>
              </div>
              <button className="text-btn" onClick={logout}>
                <LogOut size={16} /> Log out
              </button>
            </div>

            <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Package size={18} /> Order history
            </h2>

            {orders.length === 0 && <p style={{ color: "rgba(24,32,27,.55)" }}>No orders yet — your placed orders will show up here.</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
              {orders.map((o) => (
                <div key={o.id} className="checkout-box" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Link href={`/account/orders/${o.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
                      #{o.orderNumber}
                    </Link>
                    <span>{STATUS_LABEL[o.status] ?? o.status}</span>
                  </div>
                  <small style={{ color: "rgba(24,32,27,.55)" }}>
                    {new Date(o.createdAt).toLocaleDateString()} · {o.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"}
                  </small>
                  <ul style={{ fontSize: 14, marginTop: 4 }}>
                    {o.items.map((it) => (
                      <li key={it.id}>
                        {it.qty}× {it.name} {it.sizeLabel ? `(${it.sizeLabel})` : ""}
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                    <span>Total (cash) · €{o.total.toFixed(2)}</span>
                    <Link href={`/?reorder=${o.id}`} className="text-btn" style={{ fontWeight: 500 }}>
                      <RefreshCw size={14} /> Reorder
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Heart size={18} /> Wishlist
            </h2>
            {wishlist.length === 0 && (
              <p style={{ color: "rgba(24,32,27,.55)", marginBottom: 36 }}>
                Items you save with the heart icon on the shop page will show up here.
              </p>
            )}
            {wishlist.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginBottom: 36 }}>
                {wishlist.map((p) => (
                  <div key={p.id} style={{ position: "relative" }}>
                    <Link href="/">
                      <img src={p.image} alt={p.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10 }} />
                      <small style={{ display: "block", marginTop: 4 }}>{p.name}</small>
                    </Link>
                    <button
                      onClick={() => removeWishlistItem(p.id)}
                      aria-label="Remove"
                      style={{ position: "absolute", top: 4, right: 4, background: "rgba(255,255,255,.9)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <MapPin size={18} /> Saved addresses
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {addresses.map((a) => (
                <div key={a.id} className="checkout-box" style={{ alignItems: "center" }}>
                  <div>
                    <b>{a.label}</b> {a.isDefault && <small style={{ color: "rgba(24,32,27,.5)" }}>(default)</small>}
                    <div style={{ fontSize: 14 }}>{a.address}</div>
                  </div>
                  <button onClick={() => removeAddress(a.id)} className="text-btn" aria-label="Remove address">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addAddress} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input placeholder="Label (e.g. Home)" value={newAddressLabel} onChange={(e) => setNewAddressLabel(e.target.value)} style={{ flex: "0 0 140px" }} />
              <input placeholder="Full address" value={newAddressText} onChange={(e) => setNewAddressText(e.target.value)} style={{ flex: "1 1 220px" }} />
              <button className="primary-btn">
                <Plus size={15} /> Add
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
