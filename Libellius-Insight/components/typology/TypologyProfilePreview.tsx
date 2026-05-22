import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Download, FileText, LoaderCircle, X } from "lucide-react";
import type { TypologyAdminResult } from "../../services/typologyTest";
import { buildTypologyReportModel } from "../../services/typologyReportModel";

type TypologyProfilePreviewProps = {
  result: TypologyAdminResult;
  onClose: () => void;
};

const PDF_EXPORT_BACKGROUND = "#f8f6f3";
const PDF_PAGE_SELECTOR = "[data-pdf-page='true']";

const getSafeProfileFileBaseName = (personName: string) => {
  const safeName = personName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `profil-stylu-vedenia-${safeName || "ucastnik"}`;
};

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

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
          className={`grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 text-sm font-semibold leading-relaxed ${
            isBrand ? "text-white/90" : "text-black/65"
          }`}
        >
          <span className={isBrand ? "text-white" : "text-brand"}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

const ScoreSvgChart: React.FC<{
  items: Array<{
    code: string;
    name: string;
    score: number;
    percentage: number;
    isPrimary: boolean;
  }>;
}> = ({ items }) => {
  const width = 640;
  const rowHeight = 56;
  const chartHeight = items.length * rowHeight + 28;

  return (
    <svg
      viewBox={`0 0 ${width} ${chartHeight}`}
      className="w-full h-auto"
      role="img"
      aria-label="Skóre štýlov"
    >
      <rect x="0" y="0" width={width} height={chartHeight} rx="18" fill="#ffffff" />
      {items.map((item, index) => {
        const y = 18 + index * rowHeight;
        const barWidth = 320;
        const fillWidth = Math.round((item.percentage / 100) * barWidth);

        return (
          <g key={item.code}>
            <text
              x="18"
              y={y + 14}
              fill={item.isPrimary ? "#B81547" : "rgba(0,0,0,0.52)"}
              fontSize="12"
              fontWeight="800"
              style={{ letterSpacing: "0.08em" }}
            >
              {item.name.toUpperCase()}
            </text>
            <rect
              x="210"
              y={y}
              width={barWidth}
              height="14"
              rx="7"
              fill="rgba(0,0,0,0.1)"
            />
            <rect
              x="210"
              y={y}
              width={fillWidth}
              height="14"
              rx="7"
              fill={item.isPrimary ? "#B81547" : "#111111"}
            />
            <text
              x="560"
              y={y + 13}
              fill="#111111"
              fontSize="26"
              fontWeight="900"
              textAnchor="end"
            >
              {item.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const TypologyProfilePreview: React.FC<TypologyProfilePreviewProps> = ({
  result,
  onClose,
}) => {
  const profileRef = useRef<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const model = useMemo(() => buildTypologyReportModel(result), [result]);

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

  if (!model) {
    return null;
  }

  const exportProfilePdf = async () => {
    if (!profileRef.current || isExporting) return;

    setIsExporting(true);
    setExportFeedback(null);

    const pageElements = Array.from(
      profileRef.current.querySelectorAll<HTMLElement>(PDF_PAGE_SELECTOR)
    );

    if (pageElements.length === 0) {
      setExportFeedback("PDF sa nepodarilo vytvoriť.");
      setIsExporting(false);
      return;
    }

    try {
      await waitForNextFrame();

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let index = 0; index < pageElements.length; index += 1) {
        const pageElement = pageElements[index];
        const canvas = await html2canvas(pageElement, {
          backgroundColor: PDF_EXPORT_BACKGROUND,
          scale: 2,
          useCORS: true,
          windowWidth: pageElement.scrollWidth,
          windowHeight: pageElement.scrollHeight,
        });
        const pageImage = canvas.toDataURL("image/jpeg", 0.96);

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(pageImage, "JPEG", 0, 0, pageWidth, pageHeight);
      }

      pdf.save(`${getSafeProfileFileBaseName(model.personName)}.pdf`);
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
        <div className="print-hidden w-full max-w-[840px] mx-auto mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
            Zavrieť tlačový report
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
          <p className="print-hidden max-w-[840px] mx-auto mb-4 text-center text-xs font-black uppercase tracking-widest text-white">
            {exportFeedback}
          </p>
        )}

        <article
          ref={profileRef}
          className="print-profile w-full max-w-[794px] mx-auto bg-[#f8f6f3] text-black rounded-[2rem] overflow-hidden shadow-2xl shadow-black/20 print:shadow-none print:rounded-none print:bg-white"
        >
          <section data-pdf-page="true" className="typology-pdf-page p-5 md:p-8">
            <header className="bg-black text-white p-7 md:p-8 rounded-[1.6rem]">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
                <div className="min-w-0">
                  <div className="mb-7 inline-flex">
                    <img
                      src="/Libelius_logo_white_HQ-01.png"
                      alt="Libellius"
                      className="h-9 md:h-11 w-auto object-contain"
                    />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.28em] font-black text-white/55">
                    {model.reportTypeLabel}
                  </p>
                  <h1 className="mt-3 text-[2.35rem] md:text-[3.3rem] font-black leading-[0.95] tracking-tight">
                    {model.reportTitle}
                  </h1>
                  <p className="mt-5 max-w-xl text-sm md:text-base font-semibold text-white/70 leading-relaxed">
                    {model.reportSubtitle}
                  </p>
                </div>
                <div className="w-full md:w-[290px] shrink-0 space-y-4">
                  <div className="rounded-3xl bg-white text-black p-5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                      Účastník
                    </p>
                    <p className="mt-2 text-base font-black leading-tight break-words">
                      {model.personName}
                    </p>
                    {model.companyName && (
                      <p className="mt-2 text-sm font-black text-brand break-words">
                        {model.companyName}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold text-black/45 break-words">{model.email}</p>
                    <div className="mt-4 pt-4 border-t border-black/10">
                      <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                        Dátum vyplnenia
                      </p>
                      <p className="mt-1 font-black">{model.completedAtLabel}</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-brand text-white px-6 py-5">
                    <p className="text-[10px] uppercase tracking-widest font-black text-white/65">
                      Dominantný štýl
                    </p>
                    <p className="mt-2 text-xl md:text-2xl font-black leading-tight">
                      {model.dominantStyleName}
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <main className="mt-5 space-y-5">
              <section className="rounded-[1.8rem] bg-white border border-black/8 p-5 md:p-6">
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">Rýchly prehľad</p>
                <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">{model.primary.name}</h2>
                <p className="mt-3 text-sm md:text-base font-semibold text-black/60 leading-relaxed">{model.summary}</p>
                <div className="mt-5 rounded-2xl border border-black/8 bg-[#f8f6f3] p-4">
                  <ScoreSvgChart items={model.scores} />
                </div>
              </section>

              <section className="grid md:grid-cols-2 gap-4">
                <section className="rounded-[1.6rem] border border-black/8 bg-white p-5 md:p-6">
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">Dominantný profil</p>
                  <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">{model.primary.title}</h3>
                  <p className="mt-3 text-sm font-semibold text-black/65 leading-relaxed">{model.primary.summary}</p>
                </section>

                {model.secondary ? (
                  <section className="rounded-[1.6rem] border border-black/8 bg-white p-5 md:p-6">
                    <p className="text-[10px] uppercase tracking-widest font-black text-brand">Druhý najsilnejší profil</p>
                    <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">{model.secondary.name}</h3>
                    <p className="mt-3 text-sm font-semibold text-black/65 leading-relaxed">{model.secondary.summary}</p>
                  </section>
                ) : (
                  <section className="rounded-[1.6rem] border border-black/8 bg-white p-5 md:p-6" />
                )}
              </section>

              <section className="grid md:grid-cols-2 gap-4">
                <section className="rounded-[1.6rem] border border-brand bg-brand text-white p-5 md:p-6">
                  <h3 className="text-xl md:text-2xl font-black tracking-tight">Čo ma poháňa</h3>
                  <div className="mt-4">
                    <BulletList items={model.drivers} variant="brand" />
                  </div>
                </section>
                <section className="rounded-[1.6rem] border border-black/8 bg-white p-5 md:p-6">
                  <h3 className="text-xl md:text-2xl font-black tracking-tight">Čo ma môže brzdiť</h3>
                  <div className="mt-4">
                    <BulletList items={model.blockers} />
                  </div>
                </section>
              </section>
            </main>
          </section>

          <section data-pdf-page="true" className="typology-pdf-page p-5 md:p-8">
            <main className="space-y-5">
              <section className="grid md:grid-cols-2 gap-4">
                <section className="rounded-[1.6rem] border border-black/8 bg-white p-5 md:p-6">
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">Spolupráca</p>
                  <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">Ako so mnou efektívne komunikovať</h3>
                  <div className="mt-4">
                    <BulletList items={model.communication} />
                  </div>
                </section>

                <section className="rounded-[1.6rem] border border-black/8 bg-white p-5 md:p-6">
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">Líderská prax</p>
                  <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">Na čo si potrebujem dať pozor</h3>
                  <div className="mt-4">
                    <BulletList items={model.leadershipFocus} />
                  </div>
                </section>
              </section>

              <section className="rounded-[1.8rem] border border-black/8 bg-white p-5 md:p-6">
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">Rozvoj</p>
                <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">Odporúčané kroky do praxe</h3>
                <div className="mt-4 rounded-2xl bg-[#f8f6f3] border border-black/5 p-4 md:p-5">
                  <BulletList items={model.developmentActions} />
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-brand/20 bg-white p-5 md:p-6">
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">Sebareflexia</p>
                <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">Otázky na sebareflexiu</h3>
                <div className="mt-5 grid md:grid-cols-2 gap-4">
                  {model.reflectionQuestions.map((question) => (
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

              <footer className="rounded-[1.6rem] bg-black text-white p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <FileText className="w-6 h-6 shrink-0 text-brand" />
                  <div>
                    <p className="text-sm md:text-base font-black">Ako čítať tento profil</p>
                    <p className="mt-2 text-sm md:text-base font-semibold text-white/65 leading-relaxed">
                      {model.profileReadingNote}
                    </p>
                  </div>
                </div>
              </footer>
            </main>
          </section>
        </article>
      </div>
    </div>
  );

  return createPortal(preview, document.body);
};

export default TypologyProfilePreview;
