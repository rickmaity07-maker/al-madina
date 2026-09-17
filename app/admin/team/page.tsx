"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Trash2, UserPlus } from "lucide-react";

type AdminAccount = { id: string; name: string; email: string; role: "OWNER" | "STAFF"; createdAt: string };

export default function TeamPage() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch("/api/admin/team")
      .then((res) => res.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []));
  }

  useEffect(load, []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create the account.");
        setSubmitting(false);
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      load();
    } catch {
      setError("Connection error. Please try again.");
    }
    setSubmitting(false);
  }

  async function removeAccount(id: string) {
    if (!confirm("Remove this admin account? They'll lose access immediately.")) return;
    const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not remove this account.");
      return;
    }
    load();
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-serif mb-2">Team</h1>
      <p className="text-black/50 text-sm mb-6">
        Owners have full access. Staff can manage orders but can't see analytics, edit products, moderate reviews, or manage the team.
      </p>

      <div className="bg-white rounded-xl border border-black/5 p-5 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <UserPlus size={16} /> Add an admin account
        </h2>
        <form onSubmit={addAccount} className="flex flex-wrap gap-2 items-start">
          <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]" />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
          <input required type="password" placeholder="Password (min. 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
          <select value={role} onChange={(e) => setRole(e.target.value as "OWNER" | "STAFF")} className="border rounded-lg px-3 py-2 text-sm">
            <option value="STAFF">Staff</option>
            <option value="OWNER">Owner</option>
          </select>
          <button disabled={submitting} className="bg-[#a12e3d] text-white rounded-lg px-4 py-2 text-sm font-medium">
            {submitting ? "Adding…" : "Add"}
          </button>
        </form>
        {error && <div className="text-sm text-[#a12e3d] mt-2">{error}</div>}
      </div>

      <div className="bg-white rounded-xl border border-black/5">
        {accounts === null && <p className="p-5 text-sm text-black/50">Loading…</p>}
        {accounts?.length === 0 && <p className="p-5 text-sm text-black/50">No accounts yet — add one above.</p>}
        {accounts && accounts.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-black/50 border-b border-black/5">
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5">Email</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-black/5 last:border-0">
                  <td className="py-3 px-5">{a.name}</td>
                  <td className="py-3 px-5">{a.email}</td>
                  <td className="py-3 px-5">
                    <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ${a.role === "OWNER" ? "bg-[#a12e3d]/10 text-[#a12e3d]" : "bg-black/5 text-black/50"}`}>
                      {a.role}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => removeAccount(a.id)} className="text-black/40 hover:text-[#a12e3d]" aria-label="Remove">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
