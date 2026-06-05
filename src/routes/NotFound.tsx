import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Package, FileText, Newspaper, Phone } from "lucide-react";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import { getSystemPageSlug } from "@/lib/api";
import "@/styles/linea-notfound.css";

export function NotFound() {
  const { locale: localeParam } = useParams<{ locale?: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [slugs, setSlugs] = useState({
    products: "svi-proizvodi",
    catalogues: "katalozi",
    news: "novosti",
    about: "o-nama",
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      getSystemPageSlug("all-products", locale),
      getSystemPageSlug("catalogues", locale),
      getSystemPageSlug("news", locale),
      getSystemPageSlug("about-us", locale),
    ])
      .then(([products, catalogues, news, about]) => {
        if (alive) setSlugs({ products, catalogues, news, about });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [locale]);

  const url = (slug: string) => `/${locale}/${slug}`;
  const home = `/${locale}/`;

  return (
    <div className="nf-view">
      <section className="nf">
        <div className="ln-container">
          <span className="nf__eyebrow">{tx("notfound.eyebrow", "Greška 404")}</span>
          <div className="nf__num"><span>4<span className="zero">0</span>4</span></div>
          <h1>{t("notfound.title")}</h1>
          <p>{tx("notfound.text", "Stranica koju tražite ne postoji, premještena je ili je uklonjena. Provjerite adresu ili krenite s jedne od poveznica u nastavku.")}</p>
          <div className="nf__cta">
            <Link to={home} className="ln-btn ln-btn--primary ln-btn--lg">{t("notfound.home")}</Link>
            <Link to={url(slugs.products)} className="ln-btn ln-btn--ghost ln-btn--lg">{tx("notfound.cta_products", "Pregledaj proizvode")}</Link>
          </div>

          <div className="nf__links">
            <div className="nf__links-h">{tx("notfound.links_heading", "Možda tražite")}</div>
            <div className="nf__links-grid">
              <Link to={url(slugs.products)} className="nf__link"><Package aria-hidden="true" />{tx("notfound.link_products", "Proizvodi")}</Link>
              <Link to={url(slugs.catalogues)} className="nf__link"><FileText aria-hidden="true" />{tx("notfound.link_catalogues", "Katalozi")}</Link>
              <Link to={url(slugs.news)} className="nf__link"><Newspaper aria-hidden="true" />{tx("notfound.link_news", "Novosti")}</Link>
              <Link to={`${url(slugs.about)}#kontakt`} className="nf__link"><Phone aria-hidden="true" />{tx("notfound.link_contact", "Kontakt")}</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
