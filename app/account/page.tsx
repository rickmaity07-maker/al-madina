"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Package, User as UserIcon, Heart, MapPin, RefreshCw, Plus, Trash2, ShieldCheck, MailWarning, MailCheck } from "lucide-react";

type Account = { id: string; name: string; email: string; phone: string | null; role: "OWNER" | "STAFF" | null; emailVerified: boolean };
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
type WishlistProduct = { id: string; name: string; slug: string; image: string | null; category: string | null };
type Address = { id: string; label: string; line1: string; city: string; postalCode: string; isDefault: boolean };

const STATUS_LABEL: Record<string, string> = {
  PLACED: "Placed",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

const muted = { color: "rgba(24,32,27,.6)" };
const mutedLight = { color: "rgba(24,32,27,.45)" };

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistProduct[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newLine1, setNewLine1] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [addressError, setAddressError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  function loadAccount() {
    fetch("/api/account/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("Not logged in");
        const data = await res.json();
        setAccount(data.user || null);
      })
      .catch(() => setAccount(null));
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
    setAddressError("");
    if (!newLabel || !newLine1 || !newCity || !newPostalCode) return;
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newLabel,
        line1: newLine1,
        city: newCity,
        postalCode: newPostalCode,
        isDefault: addresses.length === 0,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAddressError(data.error || "Couldn't save that address.");
      return;
    }
    setNewLabel("");
    setNewLine1("");
    setNewCity("");
    setNewPostalCode("");
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

  async function submitVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Could not verify that code.");
        setVerifying(false);
        return;
      }
      setVerifyCode("");
      loadAccount();
    } catch {
      setVerifyError("Connection error. Please try again.");
    }
    setVerifying(false);
  }

  async function resendVerification() {
    setResendMessage("");
    setVerifyError("");
    const res = await fetch("/api/account/resend-verification", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setVerifyError(data.error || "Could not resend the code.");
      return;
    }
    setResendMessage("A new code was sent to your email.");
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-10 px-4 md:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 32 }}>
          <ArrowLeft size={16} /> Back to shop
        </Link>

        {account === undefined && <p style={muted}>Loading…</p>}

        {account === null && (
          <div className="w-full max-w-md mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
            <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
              Account
            </span>
            <h1 style={{ fontSize: 30, margin: "8px 0 20px" }}>{mode === "login" ? "Sign in" : "Create an account"}</h1>

            <div className="size-row" style={{ margin: "0 0 20px" }}>
              <button
                type="button"
                className={mode === "login" ? "size-pill active" : "size-pill"}
                style={{ flex: 1, padding: "9px 0", fontSize: 12 }}
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === "register" ? "size-pill active" : "size-pill"}
                style={{ flex: 1, padding: "9px 0", fontSize: 12 }}
                onClick={() => setMode("register")}
              >
                Register
              </button>
            </div>

            <form onSubmit={submit} className="checkout-fields">
              {mode === "register" && (
                <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              )}
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
              <button className="primary-btn full" style={{ marginTop: 4 }} disabled={submitting}>
                {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        )}

        {account && (
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 24,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className="icon-btn" style={{ width: 48, height: 48 }}>
                  <UserIcon size={22} />
                </div>
                <div>
                  <h1 style={{ fontSize: 24, margin: 0 }}>{account.name}</h1>
                  <small style={muted}>{account.email}</small>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {account.role && (
                  <Link href="/admin" className="primary-btn">
                    <ShieldCheck size={16} /> Admin
                  </Link>
                )}
                <button className="text-btn" onClick={logout} style={{ fontSize: 13 }}>
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </div>

            {/* Email verification */}
            {account.emailVerified ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--green)" }}>
                <MailCheck size={16} /> Email verified
              </div>
            ) : (
              <div
                className="bg-white rounded-xl border border-black/5 shadow-sm"
                style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                  <MailWarning size={18} color="#c79a3a" /> Confirm your email to place orders
                </div>
                <p style={{ fontSize: 13, ...muted }}>
                  We sent a 6-digit code to <b>{account.email}</b>. Enter it below — you can browse and save items
                  to your basket without this, but you'll need to confirm your email before checking out.
                </p>
                <form onSubmit={submitVerifyCode} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: "9px 13px",
                      fontSize: 16,
                      letterSpacing: 4,
                      width: 140,
                    }}
                  />
                  <button className="primary-btn" disabled={verifying || verifyCode.length !== 6}>
                    {verifying ? "Checking…" : "Verify"}
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={resendVerification}
                    disabled={resendCooldown > 0}
                    style={{ fontSize: 13 }}
                  >
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                  </button>
                </form>
                {verifyError && <div className="checkout-error">{verifyError}</div>}
                {resendMessage && <small style={{ color: "var(--green)" }}>{resendMessage}</small>}
              </div>
            )}

            {/* Orders */}
            <section>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, marginBottom: 16 }}>
                <Package size={18} /> Order history
              </h2>
              {orders.length === 0 ? (
                <p style={muted}>No orders yet — your placed orders will show up here.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white rounded-xl border border-black/5 shadow-sm"
                      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link href={`/account/orders/${o.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
                          #{o.orderNumber}
                        </Link>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            background: "rgba(161,46,61,.08)",
                            color: "var(--green)",
                            padding: "5px 12px",
                            borderRadius: 999,
                          }}
                        >
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                      <small style={muted}>
                        {new Date(o.createdAt).toLocaleDateString()} · {o.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"}
                      </small>
                      <ul style={{ fontSize: 13, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {o.items.map((it) => (
                          <li key={it.id}>
                            {it.qty}× {it.name} {it.sizeLabel ? `(${it.sizeLabel})` : ""}
                          </li>
                        ))}
                      </ul>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontWeight: 700,
                          borderTop: "1px solid var(--line)",
                          paddingTop: 12,
                          marginTop: 8,
                        }}
                      >
                        <span>Total (cash) · €{o.total.toFixed(2)}</span>
                        <Link href={`/?reorder=${o.id}`} className="text-btn" style={{ fontSize: 13, padding: 0 }}>
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
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, marginBottom: 16 }}>
                <Heart size={18} /> Wishlist
              </h2>
              {wishlist.length === 0 ? (
                <p style={muted}>Items you save with the heart icon on the shop page will show up here.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
                  {wishlist.map((p) => (
                    <div key={p.id} style={{ position: "relative" }}>
                      <Link href={`/products/${p.slug}`} style={{ display: "block" }}>
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 14 }}
                            className="border border-black/5"
                          />
                        ) : (
                          <div
                            style={{ width: "100%", aspectRatio: "1/1", borderRadius: 14, background: "#eee" }}
                          />
                        )}
                        <span style={{ display: "block", marginTop: 8, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                      </Link>
                      <button
                        onClick={() => removeWishlistItem(p.id)}
                        aria-label="Remove"
                        className="heart liked"
                        style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Addresses */}
            <section>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, marginBottom: 16 }}>
                <MapPin size={18} /> Saved addresses
              </h2>
              {addresses.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {addresses.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white rounded-xl border border-black/5 shadow-sm"
                      style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                    >
                      <div>
                        <span style={{ fontWeight: 700 }}>{a.label}</span>
                        {a.isDefault && <small style={{ ...mutedLight, marginLeft: 6 }}>(default)</small>}
                        <p style={{ fontSize: 13, marginTop: 4, ...muted }}>
                          {a.line1}, {a.postalCode} {a.city}
                        </p>
                      </div>
                      <button onClick={() => removeAddress(a.id)} className="heart" style={{ position: "static", width: 30, height: 30 }} aria-label="Remove address">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={addAddress}
                className="checkout-fields bg-white rounded-xl border border-black/5 shadow-sm"
                style={{ padding: 16, gridTemplateColumns: "1fr 1fr", maxWidth: 560 }}
              >
                <input
                  placeholder="Label (e.g. Home)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={{ gridColumn: "1 / -1" }}
                />
                <input placeholder="Street and house number" value={newLine1} onChange={(e) => setNewLine1(e.target.value)} style={{ gridColumn: "1 / -1" }} />
                <input placeholder="Postal code" value={newPostalCode} onChange={(e) => setNewPostalCode(e.target.value)} />
                <input placeholder="City" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                {addressError && (
                  <div className="checkout-error" style={{ gridColumn: "1 / -1" }}>
                    {addressError}
                  </div>
                )}
                <button className="primary-btn" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                  <Plus size={16} /> Add address
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}