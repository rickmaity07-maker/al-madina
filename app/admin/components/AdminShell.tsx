"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ClipboardList, LogOut, Package, ShoppingBag, Volume2, VolumeX } from "lucide-react";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundOnRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("almadina_admin_sound");
    if (saved === "on") {
      soundOnRef.current = true;
      setSoundOn(true);
    }
  }, []);

  // Live connection to the order stream — plays the chime the instant a new order lands,
  // no matter which admin page you're on.
  useEffect(() => {
    const source = new EventSource("/api/orders/stream");
    source.addEventListener("order", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.type === "new_order") {
          setFlash(true);
          setTimeout(() => setFlash(false), 4000);
          if (soundOnRef.current && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
          window.dispatchEvent(new CustomEvent("almadina:new-order", { detail: data }));
        } else if (data.type === "order_updated") {
          window.dispatchEvent(new CustomEvent("almadina:order-updated", { detail: data }));
        }
      } catch {
        /* ignore malformed event */
      }
    });
    return () => source.close();
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    localStorage.setItem("almadina_admin_sound", next ? "on" : "off");
    if (next && audioRef.current) {
      // Unlock autoplay: browsers require a real user gesture before audio can play.
      // This click IS that gesture, so we play+immediately allow future auto-plays.
      audioRef.current.play().then(() => {
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const navItems = [
    { href: "/admin", label: "Orders", icon: ClipboardList },
    { href: "/admin/products", label: "Products", icon: Package },
  ];

  return (
    <div className="min-h-screen bg-[#f4f3ee] flex">
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
      {flash && (
        <div className="fixed inset-0 pointer-events-none z-[999] ring-8 ring-[#a12e3d]/40 animate-pulse" />
      )}

      <aside className="w-60 shrink-0 bg-white border-r border-black/5 flex flex-col p-5 sticky top-0 h-screen">
        <a href="/admin" className="flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="Al-Madina" className="w-10 h-12 object-contain" />
          <div>
            <div className="font-serif text-base font-medium leading-tight">Al-Madina</div>
            <div className="text-[10px] uppercase tracking-wider text-black/40">Admin</div>
          </div>
        </a>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                pathname === href ? "bg-[#a12e3d] text-white" : "text-black/70 hover:bg-black/5"
              }`}
            >
              <Icon size={16} /> {label}
            </a>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={toggleSound}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border ${
              soundOn ? "border-[#4f9d5f] text-[#2f6b3a] bg-[#4f9d5f]/10" : "border-black/10 text-black/60"
            }`}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {soundOn ? "New-order sound: ON" : "Enable order sound"}
          </button>
          <a href="/" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-black/50 hover:bg-black/5">
            <ShoppingBag size={16} /> View storefront
          </a>
          <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-black/50 hover:bg-black/5">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
