"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Heart,
  Leaf,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
  Instagram,
  Facebook,
  User,
  ArrowUpDown,
  Menu,
} from "lucide-react";

const MAP_URL = "https://www.google.com/maps/search/?api=1&query=Al-Madina%20Markt%2C%20Landwehrstra%C3%9Fe%2012%2C%2097421%20Schweinfurt%2C%20Germany";
const PHONE = "+49 163 8707437";
const FREE_DELIVERY_THRESHOLD = 40;
const DELIVERY_FEE = 3.99;

type ProductSize = { id: string; label: string; price: number; oldPrice: number | null; stock: number };
type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image: string;
  badge: string | null;
  unitNote: string | null;
  sizes: ProductSize[];
  ratingAverage: number;
  ratingCount: number;
};

type SortOption = "relevance" | "price-asc" | "price-desc" | "rating";
type Account = { id: string; name: string; email: string; phone: string | null };

type CartItem = {
  key: string; // the server-side cart_item id
  productId: string;
  sizeId: string;
  name: string;
  sizeLabel: string;
  price: number;
  image: string;
  qty: number;
  stock: number;
};

type ServerCartItem = {
  id: string;
  variant_id: string;
  quantity: number;
  size_label: string;
  price: number;
  stock_quantity: number;
  product_id: string;
  product_name: string;
  image_url: string | null;
};

function mapServerCart(items: ServerCartItem[]): CartItem[] {
  return items.map((it) => ({
    key: it.id,
    productId: it.product_id,
    sizeId: it.variant_id,
    name: it.product_name,
    sizeLabel: it.size_label,
    price: it.price,
    image: it.image_url ?? "",
    qty: it.quantity,
    stock: it.stock_quantity,
  }));
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const t = (de: string, en: string) => (language === "de" ? de : en);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [account, setAccount] = useState<Account | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

  const [productsError, setProductsError] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Products request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("[storefront] failed to load products", err);
        setProductsError(true);
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then((data) => setAccount(data.user))
      .catch(() => setAccount(null));
  }, []);

  // Load the cart (guest or account, whichever this browser already has) once on mount.
  useEffect(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data) => setCart(mapServerCart(data.items)))
      .catch(() => {});
  }, []);

  // Coming from the /cart page's "Go to checkout" link.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "1") {
      setCheckoutOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [products]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = products.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const haystack = `${p.name} ${p.category} ${p.description ?? ""}`.toLowerCase();
      const matchesQuery = q === "" || haystack.includes(q);
      return matchesCategory && matchesQuery;
    });

    const sorted = [...matches];
    if (sort === "price-asc") sorted.sort((a, b) => (a.sizes[0]?.price ?? 0) - (b.sizes[0]?.price ?? 0));
    else if (sort === "price-desc") sorted.sort((a, b) => (b.sizes[0]?.price ?? 0) - (a.sizes[0]?.price ?? 0));
    else if (sort === "rating") sorted.sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount);
    return sorted;
  }, [products, category, query, sort]);

  // "Customers also liked" — top-rated products, shown as a recommendations rail.
  const recommended = useMemo(
    () =>
      [...products]
        .filter((p) => p.ratingCount > 0)
        .sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount)
        .slice(0, 6),
    [products]
  );

  const recentlyViewed = useMemo(
    () => recentlyViewedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [products, recentlyViewedIds]
  );

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function addToCart(product: Product, size: ProductSize, qty: number = 1, silent: boolean = false) {
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: size.id, quantity: qty }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          showToast(data.error || t("Konnte nicht hinzugefügt werden", "Couldn't add that to your basket"));
          return;
        }
        setCart(mapServerCart(data.items));
        if (!silent) showToast(t(`${product.name} (${size.label}) wurde hinzugefügt`, `${product.name} (${size.label}) added to your basket`));
      })
      .catch(() => showToast(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again.")));
  }

  function changeQty(key: string, delta: number) {
    const current = cart.find((item) => item.key === key);
    if (!current) return;
    const nextQty = current.qty + delta;

    fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: key, quantity: nextQty }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          showToast(data.error || t("Konnte nicht aktualisiert werden", "Couldn't update that item"));
          return;
        }
        setCart(mapServerCart(data.items));
      })
      .catch(() => showToast(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again.")));
  }

  function toggleLike(id: string) {
    const isLiked = liked.includes(id);
    setLiked((current) => (isLiked ? current.filter((x) => x !== id) : [...current, id]));
    if (account) {
      if (isLiked) fetch(`/api/account/wishlist/${id}`, { method: "DELETE" }).catch(() => {});
      else fetch("/api/account/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id }) }).catch(() => {});
    }
  }

  // Load the customer's saved wishlist once we know who they are.
  useEffect(() => {
    if (!account) return;
    fetch("/api/account/wishlist")
      .then((res) => res.json())
      .then((items: Product[]) => setLiked(items.map((p) => p.id)));
  }, [account]);

  // Track recently viewed products locally (per device), Amazon-style.
  function trackRecentlyViewed(id: string) {
    try {
      const raw = localStorage.getItem("almadina_recently_viewed");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [id, ...ids.filter((x) => x !== id)].slice(0, 10);
      localStorage.setItem("almadina_recently_viewed", JSON.stringify(next));
      setRecentlyViewedIds(next);
    } catch {
      /* localStorage unavailable — recently-viewed just won't persist */
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("almadina_recently_viewed");
      if (raw) setRecentlyViewedIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Reorder: ?reorder=<orderId> arrives from the account page's "Reorder" button.
  useEffect(() => {
    if (products.length === 0) return;
    const reorderId = new URLSearchParams(window.location.search).get("reorder");
    if (!reorderId) return;

    fetch(`/api/account/orders/${reorderId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((order: { items: { sizeId: string | null; qty: number }[] } | null) => {
        if (!order) return;
        let added = 0;
        for (const it of order.items) {
          if (!it.sizeId) continue;
          for (const p of products) {
            const size = p.sizes.find((s) => s.id === it.sizeId);
            if (size) {
              addToCart(p, size, it.qty, true);
              added++;
              break;
            }
          }
        }
        showToast(
          added > 0
            ? t(`${added} Artikel aus Ihrer letzten Bestellung hinzugefügt`, `Added ${added} items from your past order`)
            : t("Diese Artikel sind leider nicht mehr verfügbar", "Sorry, those items are no longer available")
        );
        window.history.replaceState({}, "", "/");
      });
  }, [products]);

  function clearCartAfterOrder() {
    fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <div className="topbar">
        {t("Kostenlose Abholung in Schweinfurt", "Free pickup in Schweinfurt")} · <strong>€{FREE_DELIVERY_THRESHOLD}+</strong>{" "}
        {t("für kostenlose Lieferung · Zahlung bar bei Lieferung/Abholung", "for free delivery · Cash on delivery/pickup")}
      </div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f8f7f3]/95 backdrop-blur-xl">
        <div className="nav-row">
          <a href="#top" className="header-logo group nav-left" aria-label="Al-Madina home">
            <img src="/logo.png" alt="Al-Madina Markt logo" className="logo-image" />
            <span className="header-logo-text">
              <b>al-madina</b>
              <small>market · seit 1998</small>
            </span>
          </a>

          <div className="nav-center">
            <nav className="nav-links">
              <a href="#shop">Shop</a>
              <a href="#fresh">{t("Täglich frisch", "Fresh daily")}</a>
              <a href="#story">{t("Unsere Geschichte", "Our story")}</a>
              <a href="#visit">{t("Besuchen Sie uns", "Visit us")}</a>
            </nav>
            <div className="nav-search">
              <Search size={18} className="text-black/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Produkte suchen…", "Search products…")}
                className="ml-2 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="nav-right">
            <div className="nav-extra">
              <button onClick={() => setLanguage(language === "de" ? "en" : "de")} className="language-btn" aria-label={t("Sprache wechseln", "Change language")}>
                {language === "de" ? "English" : "Deutsch"}
              </button>
              <a className="icon-btn hidden sm:flex" href={`tel:${PHONE.replace(/\s/g, "")}`} aria-label={t("Al-Madina anrufen", "Call Al-Madina")}>
                <Phone size={19} />
              </a>
              <a className="icon-btn" href="/track" aria-label={t("Bestellung verfolgen", "Track order")} title={t("Bestellung verfolgen", "Track order")}>
                <Truck size={19} />
              </a>
              <a className="icon-btn" href="/account" aria-label={t("Mein Konto", "My account")} title={account ? account.name : t("Anmelden", "Sign in")}>
                <User size={19} />
              </a>
            </div>
            <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Open basket">
              <ShoppingBag size={19} />
              <span>{t("Warenkorb", "Basket")}</span>
              <i>{cartCount}</i>
            </button>
            <button className="nav-toggle" onClick={() => setMobileNavOpen(true)} aria-label={t("Menü öffnen", "Open menu")}>
              <Menu size={19} />
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="drawer-backdrop" onClick={() => setMobileNavOpen(false)}>
          <aside className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="header-logo-text">
                <b style={{ fontSize: 18 }}>al-madina</b>
              </span>
              <button onClick={() => setMobileNavOpen(false)} className="icon-btn" aria-label={t("Menü schließen", "Close menu")}>
                <X size={18} />
              </button>
            </div>
            <a href="#shop" onClick={() => setMobileNavOpen(false)}>
              Shop
            </a>
            <a href="#fresh" onClick={() => setMobileNavOpen(false)}>
              {t("Täglich frisch", "Fresh daily")}
            </a>
            <a href="#story" onClick={() => setMobileNavOpen(false)}>
              {t("Unsere Geschichte", "Our story")}
            </a>
            <a href="#visit" onClick={() => setMobileNavOpen(false)}>
              {t("Besuchen Sie uns", "Visit us")}
            </a>
            <div className="mobile-nav-divider" />
            <a href="/track" onClick={() => setMobileNavOpen(false)}>
              <Truck size={17} /> {t("Bestellung verfolgen", "Track order")}
            </a>
            <a href="/account" onClick={() => setMobileNavOpen(false)}>
              <User size={17} /> {account ? account.name : t("Anmelden", "Sign in")}
            </a>
            <a href={`tel:${PHONE.replace(/\s/g, "")}`} onClick={() => setMobileNavOpen(false)}>
              <Phone size={17} /> {PHONE}
            </a>
            <div className="mobile-nav-divider" />
            <button
              onClick={() => {
                setLanguage(language === "de" ? "en" : "de");
                setMobileNavOpen(false);
              }}
            >
              {language === "de" ? "English" : "Deutsch"}
            </button>
          </aside>
        </div>
      )}

      <section id="top" className="hero reveal mx-auto grid max-w-7xl gap-6 px-5 pb-8 pt-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pt-10">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> {t("Authentischer Geschmack. Jeden Tag frisch.", "Authentic taste. Fresh every day.")}
          </div>
          <h1>
            {t("Ihre Arabisch Speisekammer,", "Your Turkish pantry,")}
            <br />
            <em>{t("ganz in Ihrer Nähe.", "right around the corner.")}</em>
          </h1>
          <p>
            {t(
              "Von frischem Gemüse und warmem Simit bis zu Olivenöl, Gewürzen, Meze und Süßigkeiten – entdecken Sie die Aromen der Türkei, sorgfältig für Ihren Alltag ausgewählt.",
              "From fresh vegetables and warm simit to olive oil, spices, meze and sweets — discover the flavours of Turkey, chosen for your everyday table."
            )}
          </p>
          <div className="hero-actions">
            <a href="#shop" className="primary-btn">
              {t("Markt entdecken", "Explore the market")} <ArrowRight size={18} />
            </a>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="text-btn">
              <MapPin size={17} /> {t("Unser Geschäft finden", "Find our store")}
            </a>
          </div>
          <div className="trust-row">
            <span>
              <Check /> {t("Täglich frisch", "Fresh daily")}
            </span>
            <span>
              <Check /> {t("Halal-Auswahl", "Halal selection")}
            </span>
            <span>
              <Check /> {t("Familiengeführt", "Family run")}
            </span>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=88" alt="Fresh vegetables at a market" className="hero-image" />
          <div className="hero-card">
            <span>{t("Heute auf dem Markt", "In the market today")}</span>
            <b>
              {t("Frische Produkte", "Fresh produce")}
              <br />
              {t("ab €1,19", "from €1.19")}
            </b>
            <a href="#fresh">
              {t("Frische entdecken", "Discover fresh")} <ArrowRight size={14} />
            </a>
          </div>
          <div className="hero-stamp">
            <Leaf size={22} />
            <span>
              GOOD
              <br />
              <b>FOOD</b>
            </span>
          </div>
        </div>
      </section>

      <section className="benefits reveal">
        <div>
          <Truck />
          <b>{t("Lokale Lieferung", "Local delivery")}</b>
          <span>{t("Schnell & sorgfältig", "Fast & careful")}</span>
        </div>
        <div>
          <Leaf />
          <b>{t("Frische Produkte", "Fresh produce")}</b>
          <span>{t("Täglich ausgewählt", "Selected daily")}</span>
        </div>
        <div>
          <Star />
          <b>{t("Qualität zuerst", "Quality first")}</b>
          <span>{t("Bewährte Klassiker", "Trusted classics")}</span>
        </div>
        <div>
          <Clock3 />
          <b>{t("7 Tage geöffnet", "Open 7 days")}</b>
          <span>07:00 — 20:00</span>
        </div>
      </section>

      <section id="shop" className="reveal mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t("Die Al-Madina Auswahl", "The Al-Madina selection")}</span>
            <h2>
              {t("Gutes Essen,", "Good food,")} <em>{t("einfach schön.", "simply beautiful.")}</em>
            </h2>
          </div>
          <a href="#visit" className="text-btn">
            {t("Geschäft besuchen", "Visit the store")} <ArrowRight size={16} />
          </a>
        </div>
        <div className="category-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button key={c} className={category === c ? "category active" : "category"} onClick={() => setCategory(c)}>
                {c === "All" ? t("Alle", "All") : c}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(24,32,27,.65)" }}>
            <ArrowUpDown size={14} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 8, padding: "6px 8px", background: "transparent" }}
            >
              <option value="relevance">{t("Relevanz", "Relevance")}</option>
              <option value="price-asc">{t("Preis aufsteigend", "Price: low to high")}</option>
              <option value="price-desc">{t("Preis absteigend", "Price: high to low")}</option>
              <option value="rating">{t("Beste Bewertung", "Top rated")}</option>
            </select>
          </label>
        </div>
        <div className="mobile-search md:hidden">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Produkte suchen…", "Search products…")} />
        </div>

        {loadingProducts && <div className="empty">{t("Produkte werden geladen…", "Loading products…")}</div>}
        {!loadingProducts && (
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                liked={liked.includes(p.id)}
                onLike={() => toggleLike(p.id)}
                onAdd={(size) => addToCart(p, size)}
                onOpen={() => { setActiveProduct(p); trackRecentlyViewed(p.id); }}
                t={t}
              />
            ))}
          </div>
        )}
        {!loadingProducts && productsError && (
          <div className="empty">
            {t("Produkte konnten nicht geladen werden. Bitte laden Sie die Seite neu.", "Couldn't load products. Please refresh the page.")}
          </div>
        )}
        {!loadingProducts && !productsError && filtered.length === 0 && <div className="empty">{t("Keine Produkte gefunden.", "No products found. Try another search or category.")}</div>}

        {recentlyViewed.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div className="section-head">
              <div>
                <span className="eyebrow">{t("Ihr Verlauf", "Your history")}</span>
                <h2 style={{ fontSize: 26 }}>{t("Zuletzt angesehen", "Recently viewed")}</h2>
              </div>
            </div>
            <div className="product-grid">
              {recentlyViewed.map((p) => (
                <ProductCard
                  key={`rv-${p.id}`}
                  product={p}
                  liked={liked.includes(p.id)}
                  onLike={() => toggleLike(p.id)}
                  onAdd={(size) => addToCart(p, size)}
                  onOpen={() => { setActiveProduct(p); trackRecentlyViewed(p.id); }}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {recommended.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div className="section-head">
              <div>
                <span className="eyebrow">{t("Von Kunden geliebt", "Loved by customers")}</span>
                <h2 style={{ fontSize: 26 }}>{t("Am besten bewertet", "Top rated")}</h2>
              </div>
            </div>
            <div className="product-grid">
              {recommended.map((p) => (
                <ProductCard
                  key={`rec-${p.id}`}
                  product={p}
                  liked={liked.includes(p.id)}
                  onLike={() => toggleLike(p.id)}
                  onAdd={(size) => addToCart(p, size)}
                  onOpen={() => { setActiveProduct(p); trackRecentlyViewed(p.id); }}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="fresh" className="feature-band reveal">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div>
            <span className="eyebrow light">{t("Jeden Morgen frisch", "Fresh every morning")}</span>
            <h2>
              {t("Bringen Sie den Markt", "Bring the market")}
              <br />
              <em>{t("in Ihre Küche.", "into your kitchen.")}</em>
            </h2>
            <p>
              {t(
                "Frische Kräuter, reife Tomaten, knackige Gurken und saisonales Obst – ausgewählt, damit Kochen jeden Tag Freude macht.",
                "Fresh herbs, ripe tomatoes, crisp cucumbers and seasonal fruit — chosen so cooking is a joy every day."
              )}
            </p>
            <a href="#shop" className="light-btn">
              {t("Frische Produkte kaufen", "Shop fresh produce")} <ArrowRight size={17} />
            </a>
          </div>
          <div className="feature-photo">
            <img src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=88" alt="Fresh produce market display" />
            <div>
              <b>{t("Sorgfältig ausgewählt.", "Carefully chosen.")}</b>
              <span>{t("Qualität, die man sieht.", "Quality you can see.")}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="story reveal mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <div className="story-photo">
          <img src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=88" alt="Grocery store shelves" />
        </div>
        <div className="story-copy">
          <span className="eyebrow">{t("Unsere kleine Ecke der Türkei", "Our little corner of Turkey")}</span>
          <h2>
            {t("Ein Markt rund um", "A market built around")} <em>{t("die gemeinsame Tafel.", "the shared table.")}</em>
          </h2>
          <p>
            {t(
              "Al-Madina ist ein Nachbarschaftsmarkt für Menschen, die Zutaten, Gastfreundschaft und die kleinen Rituale rund ums Essen schätzen.",
              "Al-Madina is a neighbourhood market for people who value good ingredients, hospitality, and the small rituals around food."
            )}
          </p>
          <div className="quote">
            <div className="stars">★★★★★</div>
            <p>{t("„Eine warme, großzügige Auswahl Arabischr und mediterraner Favoriten.“", "“A warm, generous selection of Turkish and Mediterranean favourites.”")}</p>
          </div>
          <a href={MAP_URL} target="_blank" rel="noreferrer" className="outline-btn">
            <MapPin size={17} /> {t("Route planen", "Get directions")}
          </a>
        </div>
      </section>

      <section id="visit" className="visit reveal">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="visit-grid">
            <div>
              <span className="eyebrow">{t("Kommen Sie vorbei", "Come visit")}</span>
              <h2>
                {t("Wir sehen uns bei", "See you at")} <em>Al-Madina.</em>
              </h2>
              <p>
                Landwehrstraße 12
                <br />
                97421 Schweinfurt, Germany
              </p>
              <div className="visit-links">
                <a href={MAP_URL} target="_blank" rel="noreferrer">
                  <MapPin size={17} /> {t("Google Maps öffnen", "Open in Google Maps")}
                </a>
                <a href={`tel:${PHONE.replace(/\s/g, "")}`}>
                  <Phone size={17} /> {PHONE}
                </a>
              </div>
              <div className="hours">
                <b>{t("Öffnungszeiten", "Opening hours")}</b>
                <span>
                  Mon — Sat <strong>07:00 — 20:00</strong>
                </span>
                <span>
                  {t("Sonntag", "Sunday")} <strong>{t("Geschlossen", "Closed")}</strong>
                </span>
              </div>
            </div>
            <div className="map-card">
              <div className="map-grid"></div>
              <div className="pin">
                <MapPin size={26} />
                <b>Al-Madina</b>
                <small>Landwehrstraße 12</small>
              </div>
              <a href={MAP_URL} target="_blank" rel="noreferrer" className="map-overlay">
                {t("In Google Maps öffnen", "Open in Google Maps")} <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="footer-main">
            <div>
              <a href="#top" className="footer-logo-wrap">
                <img src="/logo.png" alt="Al-Madina Markt logo" className="footer-logo" />
                <span className="header-logo-text">
                  <b>al-madina</b>
                  <small>market · seit 1998</small>
                </span>
              </a>
              <p className="footer-note">{t("Arabisch & mediterrane Lebensmittel für Ihren Alltag.", "Turkish & Mediterranean groceries for your everyday table.")}</p>
            </div>
            <div className="footer-links">
              <div>
                <b>{t("Entdecken", "Discover")}</b>
                <a href="#shop">Shop</a>
                <a href="#fresh">{t("Täglich frisch", "Fresh daily")}</a>
                <a href="#story">{t("Unsere Geschichte", "Our story")}</a>
              </div>
              <div>
                <b>{t("Besuchen", "Visit")}</b>
                <a href={MAP_URL} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
                <a href={`tel:${PHONE.replace(/\s/g, "")}`}>{t("Anrufen", "Call")}</a>
                <a href="#visit">{t("Öffnungszeiten", "Opening hours")}</a>
              </div>
              <div>
                <b>{t("Folgen", "Follow")}</b>
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                  <Instagram size={15} /> Instagram
                </a>
                <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
                  <Facebook size={15} /> Facebook
                </a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Al-Madina Market.</span>
            <span>{t("Zahlung ausschließlich in bar bei Lieferung oder Abholung.", "Payment is cash only, on delivery or pickup.")}</span>
          </div>
        </div>
      </footer>

      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="eyebrow">{t("Ihr Warenkorb", "Your basket")}</span>
                <h3>
                  {cartCount} {t("Artikel", "item")}
                  {cartCount === 1 ? "" : "s"}
                </h3>
              </div>
              <button onClick={() => setCartOpen(false)} className="icon-btn" aria-label={t("Schließen", "Close")}>
                <X />
              </button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag size={42} />
                <h3>{t("Ihr Warenkorb wartet.", "Your basket is waiting.")}</h3>
                <p>{t("Fügen Sie einige Favoriten hinzu – sie erscheinen hier.", "Add a few favourites — they'll show up here.")}</p>
                <button className="primary-btn" onClick={() => setCartOpen(false)}>
                  {t("Weiter einkaufen", "Continue shopping")}
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.key}>
                      <img src={item.image} alt="" />
                      <div>
                        <b>{item.name}</b>
                        <span>
                          {item.sizeLabel} · €{item.price.toFixed(2)}
                        </span>
                        <div className="qty">
                          <button onClick={() => changeQty(item.key, -1)} aria-label={t("Menge verringern", "Decrease quantity")}>
                            <Minus size={13} />
                          </button>
                          <span>{item.qty}</span>
                          <button onClick={() => changeQty(item.key, 1)} aria-label={t("Menge erhöhen", "Increase quantity")}>
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div>
                    <span>{t("Zwischensumme", "Subtotal")}</span>
                    <b>€{subtotal.toFixed(2)}</b>
                  </div>
                  <small style={{ textAlign: "left" }}>
                    {t("Lieferkosten & Abholoption werden an der Kasse gewählt.", "Delivery fee / pickup option is chosen at checkout.")}
                  </small>
                  <button className="primary-btn full" onClick={() => setCheckoutOpen(true)}>
                    {t("Zur Kasse", "Checkout")} <ArrowRight size={17} />
                  </button>
                  <small>{t("Zahlung bar bei Lieferung oder Abholung", "Cash payment on delivery or pickup")}</small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal cart={cart} subtotal={subtotal} account={account} onClose={() => setCheckoutOpen(false)} onSuccess={clearCartAfterOrder} t={t} />
      )}

      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          account={account}
          liked={liked.includes(activeProduct.id)}
          onLike={() => toggleLike(activeProduct.id)}
          onClose={() => setActiveProduct(null)}
          onAdd={(size) => addToCart(activeProduct, size)}
          onOpenRelated={(id) => {
            const p = products.find((pr) => pr.id === id);
            if (p) {
              setActiveProduct(p);
              trackRecentlyViewed(p.id);
            }
          }}
          t={t}
        />
      )}
    </main>
  );
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} style={{ color: "#d99a2b" }} />
      ))}
    </span>
  );
}

function ProductCard({
  product,
  liked,
  onLike,
  onAdd,
  onOpen,
  t,
}: {
  product: Product;
  liked: boolean;
  onLike: () => void;
  onAdd: (size: ProductSize) => void;
  onOpen: () => void;
  t: (de: string, en: string) => string;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];
  if (!size) return null;

  return (
    <article className="product-card">
      <div className="product-image" onClick={onOpen} style={{ cursor: "pointer" }}>
        <img src={product.image} alt={product.name} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className={liked ? "heart liked" : "heart"}
          aria-label={liked ? t("Aus Wunschliste entfernen", "Remove from wishlist") : t("Zur Wunschliste hinzufügen", "Add to wishlist")}
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <h3 onClick={onOpen} style={{ cursor: "pointer" }}>
          {product.name}
        </h3>
        {product.ratingCount > 0 ? (
          <button
            onClick={onOpen}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <StarRating value={product.ratingAverage} />
            <small style={{ color: "rgba(24,32,27,.6)" }}>
              {product.ratingAverage.toFixed(1)} ({product.ratingCount})
            </small>
          </button>
        ) : (
          <button onClick={onOpen} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <small style={{ color: "rgba(24,32,27,.45)" }}>{t("Noch keine Bewertungen", "No reviews yet")}</small>
          </button>
        )}

        {product.sizes.length > 1 && (
          <div className="size-row">
            {product.sizes.map((s) => (
              <button key={s.id} className={s.id === size.id ? "size-pill active" : "size-pill"} onClick={() => setSizeId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="product-bottom">
          <div>
            <b>€{size.price.toFixed(2)}</b>
            {product.unitNote && <small> {product.unitNote}</small>}
            {size.oldPrice && <del>€{size.oldPrice.toFixed(2)}</del>}
          </div>
          <button onClick={() => onAdd(size)} className="add-btn">
            <Plus size={17} />
            <span>{t("Hinzufügen", "Add")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function CheckoutModal({
  cart,
  subtotal,
  account,
  onClose,
  onSuccess,
  t,
}: {
  cart: CartItem[];
  subtotal: number;
  account: Account | null;
  onClose: () => void;
  onSuccess: () => void;
  t: (de: string, en: string) => string;
}) {
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: string; total: number } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<{ id: string; label: string; address: string; isDefault: boolean }[]>([]);

  useEffect(() => {
    if (!account) return;
    fetch("/api/account/addresses")
      .then((res) => res.json())
      .then((data: { id: string; label: string; address: string; isDefault: boolean }[]) => {
        setSavedAddresses(Array.isArray(data) ? data : []);
        const def = data?.find((a) => a.isDefault) ?? data?.[0];
        if (def) setAddress(def.address);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const deliveryFee = fulfillment === "PICKUP" ? 0 : subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsLogin(false);
    setNeedsVerification(false);
    if (fulfillment === "DELIVERY" && !address.trim()) {
      setError(t("Bitte geben Sie Ihre Lieferadresse an.", "Please enter a delivery address."));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          fulfillment,
          address: fulfillment === "DELIVERY" ? address : undefined,
          notes,
          items: cart.map((c) => ({ sizeId: c.sizeId, qty: c.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setNeedsLogin(true);
        if (data.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
        setError(data.error || t("Bestellung fehlgeschlagen. Bitte versuchen Sie es erneut.", "Could not place order. Please try again."));
        setSubmitting(false);
        return;
      }
      setSuccess({ orderNumber: data.orderNumber, total: data.total });
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="modal-backdrop">
        <div className="checkout-modal">
          <button className="close-modal" onClick={onSuccess} aria-label={t("Schließen", "Close")}>
            <X />
          </button>
          <span className="eyebrow">{t("Bestellung aufgegeben", "Order placed")}</span>
          <h2 style={{ fontSize: 40 }}>{t("Vielen Dank!", "Thank you!")}</h2>
          <p>
            {t("Ihre Bestellnummer ist", "Your order number is")} <b>#{success.orderNumber}</b>.{" "}
            {t("Eine Bestätigung wurde an Ihre E-Mail gesendet.", "A confirmation has been sent to your email.")}
          </p>
          <div className="checkout-box">
            <span>{t("Zu zahlen (bar)", "To pay (cash)")}</span>
            <b>€{success.total.toFixed(2)}</b>
          </div>
          <button className="primary-btn full" onClick={onSuccess}>
            {t("Fertig", "Done")} <Check size={17} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <form className="checkout-modal" onSubmit={submit} style={{ maxHeight: "90vh", overflow: "auto" }}>
        <button type="button" className="close-modal" onClick={onClose} aria-label={t("Schließen", "Close")}>
          <X />
        </button>
        <span className="eyebrow">{t("Kasse", "Checkout")}</span>
        <h2 style={{ fontSize: 36 }}>{t("Bar bei Lieferung oder Abholung.", "Cash on delivery or pickup.")}</h2>
        <p>{t("Es wird keine Online-Zahlung durchgeführt. Sie zahlen bar bei Erhalt.", "No online payment is taken. You pay in cash when you receive your order.")}</p>

        <div className="fulfillment-toggle">
          <button type="button" className={fulfillment === "DELIVERY" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setFulfillment("DELIVERY")}>
            <Truck size={16} /> {t("Lieferung", "Delivery")}
          </button>
          <button type="button" className={fulfillment === "PICKUP" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setFulfillment("PICKUP")}>
            <Store size={16} /> {t("Abholung im Laden", "Pickup in store")}
          </button>
        </div>
        {fulfillment === "PICKUP" && (
          <p className="pickup-note">
            {t("Wir packen Ihre Bestellung und sie ist zur Abholung bereit: Landwehrstraße 12, 97421 Schweinfurt.", "We'll pack your order and it'll be ready for pickup at Landwehrstraße 12, 97421 Schweinfurt.")}
          </p>
        )}

        <div className="checkout-fields">
          <input required placeholder={t("Vollständiger Name", "Full name")} value={name} onChange={(e) => setName(e.target.value)} />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required placeholder={t("Telefonnummer", "Phone number")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {fulfillment === "DELIVERY" && (
            <>
              {savedAddresses.length > 0 && (
                <select onChange={(e) => setAddress(e.target.value)} defaultValue={address} style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8 }}>
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.address}>
                      {a.label} — {a.address}
                    </option>
                  ))}
                  <option value="">{t("Andere Adresse eingeben…", "Enter a different address…")}</option>
                </select>
              )}
              <input required placeholder={t("Lieferadresse", "Delivery address")} value={address} onChange={(e) => setAddress(e.target.value)} />
            </>
          )}
          <textarea placeholder={t("Hinweise zur Bestellung (optional)", "Order notes (optional)")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {error && (
          <div className="checkout-error">
            {error}
            {needsLogin && (
              <>
                {" "}
                <Link href="/account" className="text-btn" style={{ display: "inline-flex", padding: 0 }}>
                  {t("Jetzt anmelden", "Log in now")}
                </Link>
                {" — "}
                {t("Ihr Warenkorb bleibt dabei erhalten.", "your basket will still be here.")}
              </>
            )}
            {needsVerification && (
              <>
                {" "}
                <Link href="/account" className="text-btn" style={{ display: "inline-flex", padding: 0 }}>
                  {t("E-Mail jetzt bestätigen", "Verify your email now")}
                </Link>
                {" — "}
                {t("Ihr Warenkorb bleibt dabei erhalten.", "your basket will still be here.")}
              </>
            )}
          </div>
        )}

        <div className="checkout-box" style={{ flexDirection: "column", gap: 6, alignItems: "stretch" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{t("Zwischensumme", "Subtotal")}</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}</span>
            <span>{deliveryFee === 0 ? t("Kostenlos", "Free") : `€${deliveryFee.toFixed(2)}`}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            <span>{t("Gesamt (bar)", "Total (cash)")}</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>

        <button className="primary-btn full" disabled={submitting || cart.length === 0}>
          {submitting ? t("Wird gesendet…", "Placing order…") : t("Bestellung aufgeben — Bar bezahlen", "Place order — pay cash")} <Check size={17} />
        </button>
      </form>
    </div>
  );
}

type ReviewData = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  authorName: string;
};

function ProductDetailModal({
  product,
  account,
  liked,
  onLike,
  onClose,
  onAdd,
  onOpenRelated,
  t,
}: {
  product: Product;
  account: Account | null;
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
  onAdd: (size: ProductSize) => void;
  onOpenRelated: (id: string) => void;
  t: (de: string, en: string) => string;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];

  const [related, setRelated] = useState<{ id: string; name: string; image: string; category: string }[]>([]);

  useEffect(() => {
    fetch(`/api/products/${product.id}/related`)
      .then((res) => res.json())
      .then((data) => setRelated(Array.isArray(data) ? data : []));
  }, [product.id]);

  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [average, setAverage] = useState(product.ratingAverage);
  const [count, setCount] = useState(product.ratingCount);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [myRating, setMyRating] = useState(5);
  const [myTitle, setMyTitle] = useState("");
  const [myComment, setMyComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  function loadReviews() {
    setLoadingReviews(true);
    fetch(`/api/reviews?productId=${product.id}`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews ?? []);
        setAverage(data.average ?? 0);
        setCount(data.count ?? 0);
      })
      .finally(() => setLoadingReviews(false));
  }

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, rating: myRating, title: myTitle, comment: myComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || t("Bewertung konnte nicht gespeichert werden.", "Could not save your review."));
        setSubmitting(false);
        return;
      }
      setReviewSubmitted(true);
      setMyTitle("");
      setMyComment("");
      loadReviews();
    } catch {
      setReviewError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  if (!size) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflow: "auto", maxWidth: 640 }}>
        <button type="button" className="close-modal" onClick={onClose} aria-label={t("Schließen", "Close")}>
          <X />
        </button>

        <img src={product.image} alt={product.name} style={{ width: "100%", borderRadius: 14, marginBottom: 16, maxHeight: 260, objectFit: "cover" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <span className="eyebrow">{product.category}</span>
            <h2 style={{ fontSize: 28 }}>{product.name}</h2>
          </div>
          <button
            onClick={onLike}
            className={liked ? "heart liked" : "heart"}
            aria-label={liked ? t("Aus Wunschliste entfernen", "Remove from wishlist") : t("Zur Wunschliste hinzufügen", "Add to wishlist")}
            aria-pressed={liked}
            style={{ position: "static" }}
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 14px" }}>
          <StarRating value={average} size={16} />
          <span style={{ fontSize: 14, color: "rgba(24,32,27,.65)" }}>
            {count > 0
              ? `${average.toFixed(1)} · ${count} ${t(count === 1 ? "Bewertung" : "Bewertungen", count === 1 ? "review" : "reviews")}`
              : t("Noch keine Bewertungen", "No reviews yet")}
          </span>
        </div>

        {product.description && <p>{product.description}</p>}

        {product.sizes.length > 1 && (
          <div className="size-row" style={{ margin: "10px 0" }}>
            {product.sizes.map((s) => (
              <button key={s.id} className={s.id === size.id ? "size-pill active" : "size-pill"} onClick={() => setSizeId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="checkout-box" style={{ marginBottom: 20 }}>
          <div>
            <b>€{size.price.toFixed(2)}</b>
            {product.unitNote && <small> {product.unitNote}</small>}
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              onAdd(size);
              onClose();
            }}
          >
            <Plus size={17} /> {t("Hinzufügen", "Add to basket")}
          </button>
        </div>

        {related.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 10 }}>{t("Häufig zusammen gekauft", "Frequently bought together")}</h3>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpenRelated(r.id)}
                  style={{ flex: "0 0 auto", width: 96, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <img src={r.image} alt={r.name} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, marginBottom: 4 }} />
                  <small style={{ display: "block", lineHeight: 1.2 }}>{r.name}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ fontSize: 18, marginBottom: 10 }}>{t("Bewertungen", "Reviews")}</h3>


        {account ? (
          reviewSubmitted ? (
            <p style={{ color: "rgba(24,32,27,.7)" }}>
              <Check size={15} style={{ display: "inline", marginRight: 4 }} />
              {t("Danke für Ihre Bewertung!", "Thanks for your review!")}
            </p>
          ) : (
            <form onSubmit={submitReview} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMyRating(n)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    aria-label={`${n} stars`}
                  >
                    <Star size={22} fill={n <= myRating ? "currentColor" : "none"} style={{ color: "#d99a2b" }} />
                  </button>
                ))}
              </div>
              <input
                placeholder={t("Titel (optional)", "Title (optional)")}
                value={myTitle}
                onChange={(e) => setMyTitle(e.target.value)}
              />
              <textarea
                placeholder={t("Ihre Bewertung (optional)", "Your review (optional)")}
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                rows={3}
              />
              {reviewError && <div className="checkout-error">{reviewError}</div>}
              <button className="primary-btn" disabled={submitting}>
                {submitting ? t("Wird gesendet…", "Submitting…") : t("Bewertung abgeben", "Submit review")}
              </button>
            </form>
          )
        ) : (
          <p style={{ marginBottom: 20 }}>
            <a href="/account" style={{ textDecoration: "underline" }}>
              {t("Melden Sie sich an", "Sign in")}
            </a>{" "}
            {t("um eine Bewertung zu hinterlassen.", "to leave a review.")}
          </p>
        )}

        {loadingReviews && <div className="empty">{t("Bewertungen werden geladen…", "Loading reviews…")}</div>}
        {!loadingReviews && reviews.length === 0 && (
          <p style={{ color: "rgba(24,32,27,.5)" }}>{t("Seien Sie der Erste, der dieses Produkt bewertet.", "Be the first to review this product.")}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StarRating value={r.rating} size={13} />
                <b style={{ fontSize: 14 }}>{r.title || r.authorName}</b>
              </div>
              {r.comment && <p style={{ fontSize: 14, marginTop: 4 }}>{r.comment}</p>}
              <small style={{ color: "rgba(24,32,27,.5)" }}>
                {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}