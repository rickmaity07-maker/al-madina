"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Pencil, Plus, Trash2, X } from "lucide-react";

type Size = { id?: string; label: string; price: number | string; oldPrice?: number | string | null; stock?: number | string };
type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image: string;
  badge: string | null;
  unitNote: string | null;
  active: boolean;
  sizes: Size[];
};

const EMPTY: Omit<Product, "id"> = {
  name: "",
  category: "Fresh",
  description: "",
  image: "",
  badge: "",
  unitNote: "",
  active: true,
  sizes: [{ label: "", price: "" }],
};

const CATEGORIES = ["Fresh", "Bakery", "Pantry", "Chilled", "Sweets", "Spices", "Drinks", "Halal Meat", "Household"];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | (Omit<Product, "id"> & { id?: string }) | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setProducts((cur) => cur.filter((p) => p.id !== id));
    await fetch(`/api/products/${id}`, { method: "DELETE" });
  }

  async function handleSave(data: typeof EMPTY & { id?: string }) {
    const payload = {
      ...data,
      sizes: data.sizes
        .filter((s) => s.label && s.price !== "")
        .map((s) => ({ label: s.label, price: Number(s.price), oldPrice: s.oldPrice ? Number(s.oldPrice) : undefined, stock: s.stock ? Number(s.stock) : undefined })),
    };
    if (data.id) {
      await fetch(`/api/products/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setEditing(null);
    load();
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl">Products</h1>
          <p className="text-black/50 text-sm mt-1">Manage what's for sale in the Shop tab — including size options.</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          <Plus size={15} /> Add product
        </button>
      </div>

      {loading && <div className="text-black/40 text-sm">Loading products…</div>}

      <div className="grid gap-3">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-4 flex items-center gap-4">
            <img src={p.image} alt={p.name} className="w-16 h-16 rounded-xl object-cover bg-black/5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {!p.active && <span className="text-[10px] font-bold bg-black/10 text-black/50 px-2 py-0.5 rounded-full">HIDDEN</span>}
                {p.badge && <span className="text-[10px] font-bold bg-[#e3b23c]/30 text-[#7a5a10] px-2 py-0.5 rounded-full">{p.badge}</span>}
              </div>
              <div className="text-xs text-black/40 mt-0.5">{p.category}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {p.sizes.map((s, i) => (
                  <span key={i} className="text-[11px] bg-black/5 rounded-full px-2 py-0.5">
                    {s.label} · €{Number(s.price).toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setEditing(p)} className="btn-outline">
              <Pencil size={13} /> Edit
            </button>
            <button onClick={() => handleDelete(p.id)} className="btn-danger">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!loading && products.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-black/40">
            No products yet — click "Add product" to create your first one.
          </div>
        )}
      </div>

      {editing && <ProductModal initial={editing} onClose={() => setEditing(null)} onSave={handleSave} />}
    </AdminShell>
  );
}

function ProductModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Omit<Product, "id"> & { id?: string };
  onClose: () => void;
  onSave: (data: typeof EMPTY & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    sizes: initial.sizes.length ? initial.sizes : [{ label: "", price: "" }],
  }));

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSize(index: number, patch: Partial<Size>) {
    setForm((f) => ({ ...f, sizes: f.sizes.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }

  function addSize() {
    setForm((f) => ({ ...f, sizes: [...f.sizes, { label: "", price: "" }] }));
  }

  function removeSize(index: number) {
    setForm((f) => ({ ...f, sizes: f.sizes.filter((_, i) => i !== index) }));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 my-8 relative">
        <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <X size={16} />
        </button>
        <h2 className="font-serif text-2xl mb-5">{form.id ? "Edit product" : "Add product"}</h2>

        <div className="grid gap-3">
          <Field label="Name">
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={(e) => setField("category", e.target.value)} className="input">
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Badge (optional)">
              <input value={form.badge || ""} onChange={(e) => setField("badge", e.target.value)} placeholder="e.g. Heute frisch" className="input" />
            </Field>
          </div>

          <Field label="Image URL">
            <input value={form.image} onChange={(e) => setField("image", e.target.value)} placeholder="https://…" className="input" />
          </Field>

          <Field label="Description (optional)">
            <textarea value={form.description || ""} onChange={(e) => setField("description", e.target.value)} className="input" rows={2} />
          </Field>

          <Field label="Unit note (optional)">
            <input value={form.unitNote || ""} onChange={(e) => setField("unitNote", e.target.value)} placeholder="e.g. sold per kg" className="input" />
          </Field>

          <div>
            <label className="text-xs font-semibold text-black/60 mb-1.5 block">Sizes &amp; prices</label>
            <div className="grid gap-2">
              {form.sizes.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_90px_36px] gap-2 items-center">
                  <input
                    value={s.label}
                    onChange={(e) => setSize(i, { label: e.target.value })}
                    placeholder="e.g. 500g / 1kg / Small"
                    className="input"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={s.price}
                    onChange={(e) => setSize(i, { price: e.target.value })}
                    placeholder="Price €"
                    className="input"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={s.oldPrice ?? ""}
                    onChange={(e) => setSize(i, { oldPrice: e.target.value })}
                    placeholder="Was € (opt.)"
                    className="input"
                  />
                  <button onClick={() => removeSize(i)} className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addSize} className="btn-outline mt-2">
              <Plus size={13} /> Add another size
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm mt-1">
            <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} />
            Visible in the shop
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="btn-primary flex-1 justify-center">
            Save product
          </button>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          padding: 9px 11px;
          font-size: 13px;
          outline: none;
          background: #fff;
        }
        .input:focus {
          border-color: #a12e3d;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-black/60 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
