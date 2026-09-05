"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type CartItem = {
  key: string; // `${productId}:${sizeId}`
  productId: string;
  sizeId: string;
  name: string;
  sizeLabel: string;
  price: number;
  image: string;
  qty: number;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [language, setLanguage] = useState<"de" | "en">("de");
  const t = (de: string, en: string) => (language === "de" ? de : en);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .finally(() => setLoadingProducts(false));
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

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesCategory = category === "All" || p.category === category;
        const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      }),
    [products, category, query]
  );

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function addToCart(product: Product, size: ProductSize) {
    const key = `${product.id}:${size.id}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => (item.key === key ? { ...item, qty: item.qty + 1 } : item));
      return [
        ...current,
        { key, productId: product.id, sizeId: size.id, name: product.name, sizeLabel: size.label, price: size.price, image: product.image, qty: 1 },
      ];
    });
    showToast(t(`${product.name} (${size.label}) wurde hinzugefügt`, `${product.name} (${size.label}) added to your basket`));
  }

  function changeQty(key: string, delta: number) {
    setCart((current) => current.map((item) => (item.key === key ? { ...item, qty: item.qty + delta } : item)).filter((item) => item.qty > 0));
  }

  function toggleLike(id: string) {
    setLiked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function clearCartAfterOrder() {
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
            <button onClick={() => setLanguage(language === "de" ? "en" : "de")} className="language-btn" aria-label={t("Sprache wechseln", "Change language")}>
              {language === "de" ? "English" : "Deutsch"}
            </button>
            <a className="icon-btn hidden sm:flex" href={`tel:${PHONE.replace(/\s/g, "")}`} aria-label={t("Al-Madina anrufen", "Call Al-Madina")}>
              <Phone size={19} />
            </a>
            <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Open basket">
              <ShoppingBag size={19} />
              <span>{t("Warenkorb", "Basket")}</span>
              <i>{cartCount}</i>
            </button>
          </div>
        </div>
      </header>

      <section id="top" className="hero reveal mx-auto grid max-w-7xl gap-6 px-5 pb-8 pt-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pt-10">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> {t("Authentischer Geschmack. Jeden Tag frisch.", "Authentic taste. Fresh every day.")}
          </div>
          <h1>
            {t("Ihre türkische Speisekammer,", "Your Turkish pantry,")}
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
        <div className="category-row">
          {categories.map((c) => (
            <button key={c} className={category === c ? "category active" : "category"} onClick={() => setCategory(c)}>
              {c === "All" ? t("Alle", "All") : c}
            </button>
          ))}
        </div>
        <div className="mobile-search md:hidden">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Produkte suchen…", "Search products…")} />
        </div>

        {loadingProducts && <div className="empty">{t("Produkte werden geladen…", "Loading products…")}</div>}
        {!loadingProducts && (
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={() => toggleLike(p.id)} onAdd={(size) => addToCart(p, size)} t={t} />
            ))}
          </div>
        )}
        {!loadingProducts && filtered.length === 0 && <div className="empty">{t("Keine Produkte gefunden.", "No products found. Try another search or category.")}</div>}
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
            <p>{t("„Eine warme, großzügige Auswahl türkischer und mediterraner Favoriten.“", "“A warm, generous selection of Turkish and Mediterranean favourites.”")}</p>
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
              <p className="footer-note">{t("Türkische & mediterrane Lebensmittel für Ihren Alltag.", "Turkish & Mediterranean groceries for your everyday table.")}</p>
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
              <button onClick={() => setCartOpen(false)} className="icon-btn">
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
                          <button onClick={() => changeQty(item.key, -1)}>
                            <Minus size={13} />
                          </button>
                          <span>{item.qty}</span>
                          <button onClick={() => changeQty(item.key, 1)}>
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

      {checkoutOpen && <CheckoutModal cart={cart} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} onSuccess={clearCartAfterOrder} t={t} />}
    </main>
  );
}

function ProductCard({
  product,
  liked,
  onLike,
  onAdd,
  t,
}: {
  product: Product;
  liked: boolean;
  onLike: () => void;
  onAdd: (size: ProductSize) => void;
  t: (de: string, en: string) => string;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];
  if (!size) return null;

  return (
    <article className="product-card">
      <div className="product-image">
        <img src={product.image} alt={product.name} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button onClick={onLike} className={liked ? "heart liked" : "heart"} aria-label="Like">
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <h3>{product.name}</h3>

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
  onClose,
  onSuccess,
  t,
}: {
  cart: CartItem[];
  subtotal: number;
  onClose: () => void;
  onSuccess: () => void;
  t: (de: string, en: string) => string;
}) {
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ orderNumber: string; total: number } | null>(null);

  const deliveryFee = fulfillment === "PICKUP" ? 0 : subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
          <button className="close-modal" onClick={onSuccess}>
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
        <button type="button" className="close-modal" onClick={onClose}>
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
            <input required placeholder={t("Lieferadresse", "Delivery address")} value={address} onChange={(e) => setAddress(e.target.value)} />
          )}
          <textarea placeholder={t("Hinweise zur Bestellung (optional)", "Order notes (optional)")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {error && <div className="checkout-error">{error}</div>}

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
