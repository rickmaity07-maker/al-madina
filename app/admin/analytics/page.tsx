"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { AlertTriangle, TrendingUp, Package, Receipt } from "lucide-react";

type Analytics = {
  totalRevenue30d: number;
  totalOrders30d: number;
  averageOrderValue30d: number;
  ordersByStatus: { status: string; count: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { id: string; productName: string; sizeLabel: string; stock: number }[];
};

function money(n: number) {
  return `€${n.toFixed(2)}`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) return <AdminShell><p>Loading…</p></AdminShell>;

  const maxDayRevenue = Math.max(1, ...data.revenueByDay.map((d) => d.revenue));

  return (
    <AdminShell>
      <h1 className="text-2xl font-serif mb-6">Analytics</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <div className="flex items-center gap-2 text-black/50 text-xs uppercase tracking-wide mb-2">
            <Receipt size={14} /> Revenue (30d)
          </div>
          <div className="text-2xl font-semibold">{money(data.totalRevenue30d)}</div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <div className="flex items-center gap-2 text-black/50 text-xs uppercase tracking-wide mb-2">
            <TrendingUp size={14} /> Orders (30d)
          </div>
          <div className="text-2xl font-semibold">{data.totalOrders30d}</div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <div className="flex items-center gap-2 text-black/50 text-xs uppercase tracking-wide mb-2">
            <Package size={14} /> Avg. order value
          </div>
          <div className="text-2xl font-semibold">{money(data.averageOrderValue30d)}</div>
        </div>
      </div>

      {data.lowStock.length > 0 && (
        <div className="bg-[#fff3ee] border border-[#e0a98c] rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 font-semibold text-[#a12e3d] mb-3">
            <AlertTriangle size={16} /> Low stock
          </div>
          <ul className="text-sm space-y-1">
            {data.lowStock.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>
                  {s.productName} <span className="text-black/50">({s.sizeLabel})</span>
                </span>
                <span className="font-semibold">{s.stock} left</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/5 p-5 mb-8">
        <h2 className="font-semibold mb-4">Revenue, last 30 days</h2>
        {data.revenueByDay.length === 0 && <p className="text-black/50 text-sm">No orders in this period yet.</p>}
        <div className="flex items-end gap-1 h-32">
          {data.revenueByDay.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
              <div
                className="w-full bg-[#a12e3d]/70 rounded-t"
                style={{ height: `${Math.max(4, (d.revenue / maxDayRevenue) * 100)}%` }}
                title={`${d.date}: ${money(d.revenue)} · ${d.orders} orders`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-black/5 p-5">
        <h2 className="font-semibold mb-4">Top products, last 30 days</h2>
        {data.topProducts.length === 0 && <p className="text-black/50 text-sm">No sales in this period yet.</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 border-b border-black/5">
              <th className="py-2">Product</th>
              <th className="py-2 text-right">Units sold</th>
              <th className="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.topProducts.map((p) => (
              <tr key={p.name} className="border-b border-black/5 last:border-0">
                <td className="py-2">{p.name}</td>
                <td className="py-2 text-right">{p.qty}</td>
                <td className="py-2 text-right">{money(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
