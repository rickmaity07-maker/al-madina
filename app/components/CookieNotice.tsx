"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

const STORAGE_KEY = "almadina_cookie_notice_ack";

// This site only sets strictly necessary cookies (login session, shopping
// cart) — no analytics or marketing cookies, so there's nothing to opt in
// or out of. This is a transparency notice, not a consent gate, and it
// never blocks the page or delays any cookie being set.
export function CookieNotice() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* localStorage unavailable — just don't show the banner */
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <div className="cookie-notice">
      <p>
        {t(
          "Diese Website verwendet ausschließlich technisch notwendige Cookies (Login, Warenkorb) — keine Analyse- oder Marketing-Cookies.",
          "This site only uses strictly necessary cookies (login, shopping cart) — no analytics or marketing cookies."
        )}{" "}
        <Link href="/cookie-einstellungen">{t("Mehr erfahren", "Learn more")}</Link>
      </p>
      <button onClick={dismiss} className="primary-btn">
        {t("Verstanden", "Got it")}
      </button>
    </div>
  );
}
