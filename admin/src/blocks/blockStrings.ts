// UI-language strings for the project block editors (AboutUs / Catalogues).
//
// Why not react-i18next: the vendored admin-base BUNDLES its i18next instance
// (only react/react-dom/@mantine are externalized), so importing react-i18next
// here would create a second, unsynchronized instance. Instead we read the
// core's per-device UI-locale key on every render — the PageEditor re-renders
// its whole subtree (block editors included) when the sidebar language
// switches, so the value is always fresh without a subscription.

export type UiLang = "hr" | "en";

export function uiLang(): UiLang {
  try {
    return localStorage.getItem("cms-ui-locale") === "hr" ? "hr" : "en";
  } catch {
    return "en";
  }
}

const EN = {
    // shared
    change: "Change",
    remove: "Remove",
    setLink: "Set link",
    linkPage: "Page",
    linkEmail: "Email",
    linkFallback: "Link",
    // catalogues
    intro: "Introduction",
    subtitle: "Subtitle",
    subtitlePh: "Short intro text (shown under the page title)",
    documents: "Documents",
    noDocs: "No documents yet. Add the first one.",
    noFile: "No document selected",
    displayTitle: "Display title",
    displayTitlePh: "e.g. Product catalogue 2024",
    changeDoc: "Change document",
    pickDoc: "Choose document",
    pickerTitle: "Choose a document",
    addDoc: "Add document",
    moveUp: "Move up",
    moveDown: "Move down",
    removeDoc: "Remove document",
    contact: "Contact",
    contactBtn: "Contact button",
    // about us
    basicInfo: "Basic info",
    altTitle: "Alternative title",
    heroImage: "Hero image",
    pickHeroTitle: "Choose a hero image",
    pickImage: "Choose image",
    buttons: "Buttons",
    button1: "Button 1",
    button2: "Button 2",
    section2: "Section 2",
    section2Title: "Section 2 title",
    description: "Description",
    section3: "Section 3",
    section3Title: "Section 3 title",
    section3Subtitle: "Section 3 subtitle",
};

export type BlockStrings = { [K in keyof typeof EN]: string };

const STRINGS: Record<UiLang, BlockStrings> = {
  en: EN,
  hr: {
    change: "Promijeni",
    remove: "Ukloni",
    setLink: "Postavi poveznicu",
    linkPage: "Stranica",
    linkEmail: "E-mail",
    linkFallback: "Poveznica",
    intro: "Uvod",
    subtitle: "Podnaslov",
    subtitlePh: "Kratki uvodni tekst (prikazuje se ispod naslova stranice)",
    documents: "Dokumenti",
    noDocs: "Još nema dokumenata. Dodajte prvi dokument.",
    noFile: "Nije odabran dokument",
    displayTitle: "Naslov za prikaz",
    displayTitlePh: "npr. Katalog proizvoda 2024",
    changeDoc: "Promijeni dokument",
    pickDoc: "Odaberi dokument",
    pickerTitle: "Odaberi dokument",
    addDoc: "Dodaj dokument",
    moveUp: "Pomakni gore",
    moveDown: "Pomakni dolje",
    removeDoc: "Ukloni dokument",
    contact: "Kontakt",
    contactBtn: "Gumb za kontakt",
    basicInfo: "Osnovni podaci",
    altTitle: "Alternativni naslov",
    heroImage: "Hero slika",
    pickHeroTitle: "Odaberi hero sliku",
    pickImage: "Odaberi sliku",
    buttons: "Gumbi",
    button1: "Gumb 1",
    button2: "Gumb 2",
    section2: "Sekcija 2",
    section2Title: "Naslov sekcije 2",
    description: "Opis",
    section3: "Sekcija 3",
    section3Title: "Naslov sekcije 3",
    section3Subtitle: "Podnaslov sekcije 3",
  },
};

/** Call once per render — do NOT memoize (the value must track the sidebar
 *  language switch through parent re-renders). */
export function blockStrings(): BlockStrings {
  return STRINGS[uiLang()];
}
