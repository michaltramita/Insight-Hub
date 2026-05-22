import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";
import type { TypologyAdminResult } from "../../services/typologyTest";
import { buildTypologyReportModel } from "../../services/typologyReportModel";

type TypologyReportInteractiveProps = {
  result: TypologyAdminResult;
  onClose: () => void;
  onOpenPrint: () => void;
};

type TabId =
  | "PREHLAD"
  | "PROFIL"
  | "SILY_A_RIZIKA"
  | "KOMUNIKACIA"
  | "ROZVOJ"
  | "SEBAREFLEXIA";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "PREHLAD", label: "Prehľad" },
  { id: "PROFIL", label: "Profil" },
  { id: "SILY_A_RIZIKA", label: "Sily a riziká" },
  { id: "KOMUNIKACIA", label: "Komunikácia" },
  { id: "ROZVOJ", label: "Rozvoj" },
  { id: "SEBAREFLEXIA", label: "Sebareflexia" },
];

const BulletList: React.FC<{ items: string[]; tone?: "default" | "brand" }> = ({
  items,
  tone = "default",
}) => (
  <ul className="space-y-2.5">
    {items.map((item) => (
      <li
        key={item}
        className={`grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 text-sm font-semibold leading-relaxed ${
          tone === "brand" ? "text-white/90" : "text-black/65"
        }`}
      >
        <span className={tone === "brand" ? "text-white" : "text-brand"}>•</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const TypologyReportInteractive: React.FC<TypologyReportInteractiveProps> = ({
  result,
  onClose,
  onOpenPrint,
}) => {
  const model = useMemo(() => buildTypologyReportModel(result), [result]);
  const [activeTab, setActiveTab] = useState<TabId>("PREHLAD");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  if (!model) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case "PREHLAD":
        return (
          <section className="rounded-[1.8rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
            <p className="text-[10px] uppercase tracking-widest font-black text-brand">
              Rýchly prehľad
            </p>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight">
              {model.primary.name}
            </h2>
            <p className="mt-3 text-base md:text-lg font-semibold text-black/60 leading-relaxed">
              {model.summary}
            </p>

            <div className="mt-7 rounded-[1.3rem] border border-black/8 bg-gradient-to-br from-white via-[#fbfaf8] to-[#f4f1ec] p-3 md:p-4">
              <div className="grid gap-3">
              {model.scores.map((item) => (
                <div
                  key={item.code}
                  className={`grid grid-cols-[minmax(130px,210px)_minmax(0,1fr)_56px] items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                    item.isPrimary
                      ? "border-brand/25 bg-brand/10 shadow-lg shadow-brand/10"
                      : item.isSecondary
                        ? "border-black/10 bg-black/[0.04]"
                        : "border-black/8 bg-white/80"
                  }`}
                >
                  <p
                    className={`text-[10px] md:text-xs uppercase tracking-widest font-black ${
                      item.isPrimary ? "text-brand" : "text-black/45"
                    }`}
                  >
                    {item.name}
                  </p>
                  <div className="h-3.5 md:h-4 rounded-full bg-black/8 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.isPrimary ? "bg-brand" : "bg-black"}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <p className="text-right text-xl md:text-2xl font-black tabular-nums">
                    {item.score}
                  </p>
                </div>
              ))}
              </div>
            </div>
          </section>
        );
      case "PROFIL":
        return (
          <div className="grid md:grid-cols-2 gap-5 md:gap-7">
            <section className="rounded-[1.6rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                Dominantný profil
              </p>
              <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">
                {model.primary.title}
              </h3>
              <p className="mt-4 text-sm md:text-base font-semibold text-black/65 leading-relaxed">
                {model.primary.summary}
              </p>
              <div className="mt-5 rounded-2xl border border-black/8 bg-[#f8f6f3] p-4">
                <BulletList items={model.primary.manifests} />
              </div>
            </section>

            {model.secondary && (
              <section className="rounded-[1.6rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                  Druhý najsilnejší profil
                </p>
                <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">
                  {model.secondary.name}
                </h3>
                <p className="mt-4 text-sm md:text-base font-semibold text-black/65 leading-relaxed">
                  {model.secondary.summary}
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
              </section>
            )}
          </div>
        );
      case "SILY_A_RIZIKA":
        return (
          <div className="grid md:grid-cols-2 gap-5 md:gap-7">
            <section className="rounded-[1.6rem] border border-brand bg-gradient-to-br from-brand via-[#9f0f3d] to-[#4e0a23] text-white p-5 md:p-7 shadow-xl shadow-brand/20">
              <h3 className="text-xl md:text-2xl font-black tracking-tight">Čo ma poháňa</h3>
              <div className="mt-4">
                <BulletList items={model.drivers} tone="brand" />
              </div>
            </section>
            <section className="rounded-[1.6rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
              <h3 className="text-xl md:text-2xl font-black tracking-tight">Čo ma môže brzdiť</h3>
              <div className="mt-4 rounded-2xl bg-[#f8f6f3] border border-black/5 p-4">
                <BulletList items={model.blockers} />
              </div>
            </section>
          </div>
        );
      case "KOMUNIKACIA":
        return (
          <div className="grid md:grid-cols-2 gap-5 md:gap-7">
            <section className="rounded-[1.6rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                Spolupráca
              </p>
              <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">
                Ako so mnou efektívne komunikovať
              </h3>
              <div className="mt-4 rounded-2xl bg-[#f8f6f3] border border-black/5 p-4">
                <BulletList items={model.communication} />
              </div>
            </section>
            <section className="rounded-[1.6rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
              <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                Líderská prax
              </p>
              <h3 className="mt-2 text-xl md:text-2xl font-black tracking-tight">
                Na čo si potrebujem dať pozor
              </h3>
              <div className="mt-4 rounded-2xl bg-[#f8f6f3] border border-black/5 p-4">
                <BulletList items={model.leadershipFocus} />
              </div>
            </section>
          </div>
        );
      case "ROZVOJ":
        return (
          <section className="rounded-[1.8rem] border border-black/10 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
            <p className="text-[10px] uppercase tracking-widest font-black text-brand">
              Rozvoj
            </p>
            <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
              Odporúčané kroky do praxe
            </h3>
            <div className="mt-5 rounded-2xl bg-[#f8f6f3] border border-black/5 p-4 md:p-5">
              <BulletList items={model.developmentActions} />
            </div>
          </section>
        );
      case "SEBAREFLEXIA":
        return (
          <section className="rounded-[1.8rem] border border-brand/20 bg-white p-5 md:p-7 shadow-xl shadow-black/5">
            <p className="text-[10px] uppercase tracking-widest font-black text-brand">
              Sebareflexia
            </p>
            <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
              Otázky na sebareflexiu
            </h3>
            <div className="mt-6 grid md:grid-cols-2 gap-4">
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
            <div className="mt-5 rounded-2xl bg-black text-white p-4 md:p-5">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 shrink-0 text-brand mt-0.5" />
                <div>
                  <p className="text-sm font-black">Ako čítať tento profil</p>
                  <p className="mt-1.5 text-sm font-semibold text-white/65 leading-relaxed">
                    {model.profileReadingNote}
                  </p>
                </div>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  const preview = (
    <div className="fixed inset-0 z-[998] bg-black/45 backdrop-blur-sm print:hidden">
      <div className="h-screen w-screen overflow-y-auto p-4 md:p-8">
        <div className="w-full max-w-7xl mx-auto mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
            Zavrieť report
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-brand text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all"
          >
            <Download className="w-4 h-4" />
            Stiahnuť PDF
          </button>
        </div>

        <article className="w-full max-w-7xl min-h-[calc(100vh-6rem)] mx-auto bg-[#f8f6f3] text-black rounded-[2rem] overflow-hidden shadow-2xl shadow-black/20">
          <header className="bg-black text-white p-7 md:p-10">
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
                  {model.reportTypeLabel}
                </p>
                <h1 className="mt-4 text-[clamp(2.2rem,6vw,5rem)] font-black leading-[0.95] tracking-tight">
                  {model.reportTitle}
                </h1>
                <p className="mt-6 max-w-2xl text-base md:text-xl font-semibold text-white/70 leading-relaxed">
                  {model.reportSubtitle}
                </p>
              </div>
              <div className="w-full md:w-[320px] shrink-0 space-y-4">
                <div className="rounded-3xl bg-white text-black p-5">
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                    Účastník
                  </p>
                  <p className="mt-2 text-base md:text-lg font-black leading-tight break-words">
                    {model.personName}
                  </p>
                  {model.companyName && (
                    <p className="mt-2 text-sm font-black text-brand break-words">
                      {model.companyName}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-bold text-black/45 break-words">
                    {model.email}
                  </p>
                  <div className="mt-6 pt-5 border-t border-black/10">
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
                  <p className="mt-2 text-2xl md:text-3xl font-black leading-tight">
                    {model.dominantStyleName}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="p-5 md:p-8 space-y-6">
            <nav className="grid w-full grid-cols-2 gap-2 rounded-[1.4rem] border border-black/8 bg-white p-2 sm:grid-cols-3 lg:grid-cols-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full rounded-xl px-2 py-2.5 text-[10px] md:text-xs font-black uppercase tracking-wide transition-all ${
                    activeTab === tab.id
                      ? "bg-brand text-white"
                      : "bg-transparent text-black/50 hover:bg-black/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {renderTabContent()}
          </main>
        </article>
      </div>
    </div>
  );

  return createPortal(preview, document.body);
};

export default TypologyReportInteractive;
