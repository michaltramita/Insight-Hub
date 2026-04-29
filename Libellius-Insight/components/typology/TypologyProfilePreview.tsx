import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, CheckCircle, FileText, LoaderCircle, Target, X } from "lucide-react";
import type {
  TypologyAdminResult,
  TypologyStyleCode,
} from "../../services/typologyTest";
import {
  buildCombinationSummary,
  getRankedTypologyStyles,
  TYPOLOGY_MAX_SCORE,
  TYPOLOGY_PROFILE_CONTENT,
} from "../../services/typologyProfile";

type TypologyProfilePreviewProps = {
  result: TypologyAdminResult;
  onClose: () => void;
};

const STYLE_ORDER: TypologyStyleCode[] = ["a", "b", "c", "d"];

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const SectionCard: React.FC<{
  eyebrow?: string;
  title: string;
  variant?: "default" | "brand";
  children: React.ReactNode;
}> = ({ eyebrow, title, variant = "default", children }) => {
  const isBrand = variant === "brand";

  return (
  <section
    className={`rounded-[1.6rem] border p-5 md:p-7 print:break-inside-avoid ${
      isBrand
        ? "border-brand bg-brand text-white shadow-xl shadow-brand/10"
        : "border-black/8 bg-white"
    }`}
  >
    {eyebrow && (
      <p
        className={`text-[10px] uppercase tracking-widest font-black mb-2 ${
          isBrand ? "text-white/60" : "text-brand"
        }`}
      >
        {eyebrow}
      </p>
    )}
    <h3 className="text-xl md:text-2xl font-black tracking-tight">{title}</h3>
    <div className="mt-4">{children}</div>
  </section>
  );
};

const BulletList: React.FC<{
  items: string[];
  variant?: "default" | "brand";
}> = ({ items, variant = "default" }) => {
  const isBrand = variant === "brand";

  return (
  <ul className="space-y-2.5">
    {items.map((item) => (
      <li
        key={item}
        className={`flex gap-3 text-sm md:text-base font-semibold leading-relaxed ${
          isBrand ? "text-white/90" : "text-black/65"
        }`}
      >
        <CheckCircle2
          className={`w-4 h-4 mt-1 shrink-0 ${
            isBrand ? "text-white" : "text-brand"
          }`}
        />
        <span>{item}</span>
      </li>
    ))}
  </ul>
  );
};

const TypologyProfilePreview: React.FC<TypologyProfilePreviewProps> = ({
  result,
  onClose,
}) => {
  const profileRef = useRef<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const rankedStyles = useMemo(() => {
    if (!result.scores) return [];
    return getRankedTypologyStyles(result.scores);
  }, [result.scores]);

  const primary = rankedStyles[0] || null;
  const secondary = rankedStyles[1] || null;
  const personName = result.fullName || result.userEmail;
  const companyName = result.companyName || null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!result.scores || !primary) {
    return null;
  }

  const exportProfilePdf = async () => {
    if (!profileRef.current || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const profileElement = profileRef.current;
      const canvas = await html2canvas(profileElement, {
        backgroundColor: "#f8f6f3",
        scale: 2,
        useCORS: true,
        windowWidth: profileElement.scrollWidth,
        windowHeight: profileElement.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const pageCanvasHeight = Math.floor((canvasWidth * pageHeight) / pageWidth);
      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < canvasHeight) {
        const nextPageHeight = Math.min(pageCanvasHeight, canvasHeight - renderedHeight);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvasWidth;
        pageCanvas.height = nextPageHeight;

        const pageContext = pageCanvas.getContext("2d");
        if (!pageContext) {
          throw new Error("Export PDF sa nepodarilo pripraviť.");
        }

        pageContext.drawImage(
          canvas,
          0,
          renderedHeight,
          canvasWidth,
          nextPageHeight,
          0,
          0,
          canvasWidth,
          nextPageHeight
        );

        const pageImage = pageCanvas.toDataURL("image/jpeg", 0.96);
        const imageHeight = (nextPageHeight * pageWidth) / canvasWidth;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(pageImage, "JPEG", 0, 0, pageWidth, imageHeight);
        renderedHeight += nextPageHeight;
        pageIndex += 1;
      }

      const safeName = personName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      pdf.save(`profil-stylu-vedenia-${safeName || "ucastnik"}.pdf`);
      setExportFeedback("PDF bolo pripravené.");
    } catch (error) {
      setExportFeedback(
        error instanceof Error ? error.message : "PDF sa nepodarilo vytvoriť."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const preview = (
    <div className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm print:static print:bg-white print:backdrop-blur-0">
      <div className="h-screen w-screen overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible">
        <div className="print-hidden w-full max-w-7xl mx-auto mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
            Zavrieť profil
          </button>
          <button
            type="button"
            onClick={exportProfilePdf}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-brand text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            {isExporting ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : exportFeedback ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? "Pripravujem PDF" : "Stiahnuť PDF"}
          </button>
        </div>

        {exportFeedback && (
          <p className="print-hidden max-w-7xl mx-auto mb-4 text-center text-xs font-black uppercase tracking-widest text-white">
            {exportFeedback}
          </p>
        )}

        <article
          ref={profileRef}
          className="print-profile w-full max-w-7xl min-h-[calc(100vh-6rem)] mx-auto bg-[#f8f6f3] text-black rounded-[2rem] overflow-hidden shadow-2xl shadow-black/20 print:shadow-none print:rounded-none print:bg-white"
        >
          <header className="bg-black text-white p-7 md:p-10 print:p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
              <div className="min-w-0">
                <div className="mb-8 inline-flex">
                  <img
                    src="/Libelius_logo_white_HQ-01.png"
                    alt="Libellius"
                    className="h-9 md:h-11 w-auto object-contain"
                  />
                </div>
                <p className="text-[10px] uppercase tracking-[0.28em] font-black text-white/55">
                  Individuálna správa
                </p>
                <h1 className="mt-4 text-[clamp(2.2rem,6vw,5rem)] font-black leading-[0.95] tracking-tight">
                  Profil štýlu vedenia ľudí
                </h1>
                <p className="mt-6 max-w-2xl text-base md:text-xl font-semibold text-white/70 leading-relaxed">
                  Správa sumarizuje preferovaný spôsob správania v pracovnom a
                  líderskom kontexte. Slúži ako podklad pre sebareflexiu,
                  rozhovor a ďalší rozvoj.
                </p>
              </div>
              <div className="rounded-3xl bg-white text-black p-5 w-full md:w-[320px] shrink-0">
                <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                  Účastník
                </p>
                <p className="mt-2 text-base md:text-lg font-black leading-tight break-words">
                  {personName}
                </p>
                {companyName && (
                  <p className="mt-2 text-sm font-black text-brand break-words">
                    {companyName}
                  </p>
                )}
                {result.fullName && (
                  <p className="mt-2 text-sm font-bold text-black/45 break-words">
                    {result.userEmail}
                  </p>
                )}
                <div className="mt-6 pt-5 border-t border-black/10">
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                    Dátum vyplnenia
                  </p>
                  <p className="mt-1 font-black">{formatDate(result.completedAt)}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="p-5 md:p-8 print:p-6 space-y-5 md:space-y-7">
            <section className="rounded-[1.8rem] bg-white border border-black/8 p-5 md:p-7 print:break-inside-avoid">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                    Rýchly prehľad
                  </p>
                  <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
                    {primary.content.name}
                  </h2>
                  <p className="mt-3 text-base md:text-lg font-semibold text-black/60 leading-relaxed max-w-3xl">
                    {buildCombinationSummary(primary, secondary)}
                  </p>
                </div>
                <div className="rounded-3xl bg-brand text-white px-6 py-5 min-w-[160px]">
                  <p className="text-[10px] uppercase tracking-widest font-black text-white/65">
                    Dominantný štýl
                  </p>
                  <p className="mt-1 text-5xl font-black">{primary.content.label}</p>
                </div>
              </div>

              <div className="mt-7 grid gap-3">
                {STYLE_ORDER.map((code) => {
                  const content = TYPOLOGY_PROFILE_CONTENT[code];
                  const score = result.scores?.[code] || 0;
                  const percentage = Math.min(
                    100,
                    Math.round((score / TYPOLOGY_MAX_SCORE) * 100)
                  );
                  const isPrimary = primary.code === code;

                  return (
                    <div key={code} className="grid grid-cols-[74px_1fr_54px] md:grid-cols-[120px_1fr_64px] items-center gap-3">
                      <div>
                        <p className="font-black">{content.label}</p>
                        <p className="text-[10px] uppercase tracking-widest font-black text-black/35 truncate">
                          {content.name}
                        </p>
                      </div>
                      <div className="h-4 rounded-full bg-black/8 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isPrimary ? "bg-brand" : "bg-black"}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-right text-xl font-black">{score}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-5 md:gap-7">
              <SectionCard
                eyebrow="Dominantný profil"
                title={primary.content.title}
              >
                <p className="text-sm md:text-base font-semibold text-black/65 leading-relaxed">
                  {primary.content.summary}
                </p>
                <div className="mt-5">
                  <BulletList items={primary.content.manifests} />
                </div>
              </SectionCard>

              {secondary && (
                <SectionCard
                  eyebrow="Druhý najsilnejší profil"
                  title={secondary.content.name}
                >
                  <p className="text-sm md:text-base font-semibold text-black/65 leading-relaxed">
                    {secondary.content.summary}
                  </p>
                  <div className="mt-5 rounded-2xl bg-[#f8f6f3] border border-black/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                      Ako dopĺňa dominantný štýl
                    </p>
                    <p className="mt-2 text-sm font-semibold text-black/65 leading-relaxed">
                      Tento štýl môže ovplyvňovať spôsob, akým komunikujete,
                      pracujete s tempom, rozhodujete sa a reagujete na tlak.
                    </p>
                  </div>
                </SectionCard>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-5 md:gap-7">
              <SectionCard title="Čo ma poháňa" variant="brand">
                <BulletList items={primary.content.drivers} variant="brand" />
              </SectionCard>
              <SectionCard title="Čo ma môže brzdiť" variant="brand">
                <BulletList items={primary.content.blockers} variant="brand" />
              </SectionCard>
              <SectionCard title="Silné stránky lídra" variant="brand">
                <BulletList items={primary.content.strengths} variant="brand" />
              </SectionCard>
            </div>

            <div className="grid md:grid-cols-2 gap-5 md:gap-7">
              <SectionCard
                eyebrow="Spolupráca"
                title="Ako so mnou efektívne komunikovať"
              >
                <BulletList items={primary.content.communication} />
              </SectionCard>

              <SectionCard
                eyebrow="Líderská prax"
                title="Na čo si potrebujem dať pozor"
              >
                <BulletList items={primary.content.leadershipFocus} />
              </SectionCard>
            </div>

            <div className="grid md:grid-cols-2 gap-5 md:gap-7">
              <SectionCard
                eyebrow="Tlak a záťaž"
                title="Riziká pod tlakom"
              >
                <BulletList items={primary.content.pressureRisks} />
              </SectionCard>

              <SectionCard
                eyebrow="Rozvoj"
                title="Odporúčané kroky do praxe"
              >
                <BulletList items={primary.content.developmentActions} />
              </SectionCard>
            </div>

            <section className="rounded-[1.8rem] border border-brand/20 bg-white p-5 md:p-7 print:break-inside-avoid">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                    Sebareflexia
                  </p>
                  <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                    Otázky pre rozvojový rozhovor
                  </h3>
                </div>
              </div>
              <div className="mt-6 grid md:grid-cols-2 gap-4">
                {[
                  "V čom sa v tomto profile najviac spoznávam?",
                  "Kedy mi môj prirodzený štýl pomáha vo vedení ľudí?",
                  "V akej situácii ma môže tento štýl brzdiť?",
                  "Čo chcem vedome robiť inak ako líder?",
                ].map((question) => (
                  <div
                    key={question}
                    className="rounded-2xl bg-[#f8f6f3] border border-black/5 p-4 min-h-[118px]"
                  >
                    <p className="text-sm font-black leading-snug">{question}</p>
                    <div className="mt-5 border-t border-black/10" />
                    <div className="mt-5 border-t border-black/10" />
                  </div>
                ))}
              </div>
            </section>

            <footer className="rounded-[1.6rem] bg-black text-white p-5 md:p-7 print:break-inside-avoid">
              <div className="flex items-start gap-4">
                <FileText className="w-6 h-6 shrink-0 text-brand" />
                <div>
                  <p className="text-sm md:text-base font-black">
                    Ako čítať tento profil
                  </p>
                  <p className="mt-2 text-sm md:text-base font-semibold text-white/65 leading-relaxed">
                    Profil nie je nálepka ani hodnotenie osobnosti. Popisuje
                    preferovaný štýl správania, ktorý sa môže meniť podľa
                    situácie, roly, skúseností a aktuálneho tlaku. Najväčšiu
                    hodnotu má v kombinácii so spätnou väzbou, rozhovorom a
                    konkrétnou rozvojovou praxou.
                  </p>
                </div>
              </div>
            </footer>
          </main>
        </article>
      </div>
    </div>
  );

  return createPortal(preview, document.body);
};

export default TypologyProfilePreview;
