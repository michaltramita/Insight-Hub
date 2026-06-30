import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  ChevronLeft,
  FileBarChart,
  LoaderCircle,
  Lock,
  Users,
} from "lucide-react";
import type { FeedbackAnalysisResult } from "../../types";
import {
  loadFeedback360ReportResult,
  loadFeedback360Reports,
  type Feedback360ReportListItem,
} from "../../services/feedback360Reports";

type Feedback360ReportLibraryProps = {
  onBack: () => void;
  onOpenReport: (result: FeedbackAnalysisResult) => void;
};

const formatDate = (value: string | null) => {
  if (!value) return "Bez dátumu";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bez dátumu";

  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatRate = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "-";

const Feedback360ReportLibrary: React.FC<Feedback360ReportLibraryProps> = ({
  onBack,
  onOpenReport,
}) => {
  const [reports, setReports] = useState<Feedback360ReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publishedReports = useMemo(
    () => reports.filter((report) => report.status === "published"),
    [reports]
  );

  useEffect(() => {
    let isActive = true;

    const loadReports = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextReports = await loadFeedback360Reports();
        if (isActive) {
          setReports(nextReports);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "360 reporty sa nepodarilo načítať."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadReports();

    return () => {
      isActive = false;
    };
  }, []);

  const handleOpenReport = async (reportId: string) => {
    setOpeningReportId(reportId);
    setError(null);

    try {
      const result = await loadFeedback360ReportResult(reportId);
      onOpenReport(result);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Report sa nepodarilo otvoriť."
      );
    } finally {
      setOpeningReportId(null);
    }
  };

  return (
    <div className="w-full animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Späť na moduly
      </button>

      <section className="bg-white rounded-[2rem] md:rounded-[2.75rem] border border-black/5 shadow-2xl p-6 sm:p-8 md:p-12">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/5 text-brand border border-brand/10 text-[10px] font-black uppercase tracking-[0.22em]">
              <FileBarChart className="w-3.5 h-3.5" />
              360 SV
            </div>
            <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.5rem)] font-black tracking-tighter uppercase leading-none">
              Moje 360 reporty
            </h1>
            <p className="mt-5 text-base md:text-lg font-semibold text-black/50 leading-relaxed">
              Tu nájdete publikované výstupy, ku ktorým vám administrátor pridelil
              prístup. Po otvorení sa zobrazí kompletný dashboard reportu.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full lg:w-[420px]">
            <div className="rounded-[1.5rem] bg-black text-white p-5 shadow-xl shadow-black/10">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                Reporty
              </p>
              <p className="mt-5 text-5xl font-black leading-none">{reports.length}</p>
            </div>
            <div className="rounded-[1.5rem] bg-brand text-white p-5 shadow-xl shadow-brand/20">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                Publikované
              </p>
              <p className="mt-5 text-5xl font-black leading-none">
                {publishedReports.length}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-3xl border border-brand/15 bg-brand/5 px-5 py-4 flex items-start gap-3 text-brand">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="font-bold leading-relaxed">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="mt-12 rounded-[2rem] border border-black/5 bg-black/[0.02] p-12 text-center">
            <LoaderCircle className="w-8 h-8 mx-auto animate-spin text-brand" />
            <p className="mt-5 text-sm font-black uppercase tracking-widest text-black/40">
              Načítavam pridelené reporty...
            </p>
          </div>
        ) : reports.length === 0 ? (
          <div className="mt-12 rounded-[2rem] border border-dashed border-black/15 bg-black/[0.02] p-10 md:p-14 text-center">
            <Lock className="w-10 h-10 mx-auto text-black/25" />
            <h2 className="mt-5 text-2xl md:text-3xl font-black tracking-tight">
              Zatiaľ nemáte pridelený žiadny 360 report
            </h2>
            <p className="mt-3 text-black/50 font-semibold max-w-2xl mx-auto">
              Report sa tu zobrazí automaticky po publikovaní a priradení
              administrátorom.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-[2rem] border border-black/5 bg-[#fbfaf7] p-6 md:p-7 shadow-xl shadow-black/5 flex flex-col gap-6"
              >
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                      Publikovaný výstup
                    </p>
                    <h2 className="mt-3 text-2xl md:text-3xl font-black tracking-tight leading-tight">
                      {report.title}
                    </h2>
                    <p className="mt-3 text-sm font-bold text-black/45 uppercase tracking-widest">
                      {report.surveyName || "360° spätná väzba"}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-white border border-black/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-black/45">
                    {report.status === "published" ? "Aktívny" : report.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white border border-black/5 p-4">
                    <Building2 className="w-4 h-4 text-black/35" />
                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-black/35">
                      Organizácia
                    </p>
                    <p className="mt-1 text-sm font-black truncate">{report.companyName}</p>
                  </div>
                  <div className="rounded-2xl bg-white border border-black/5 p-4">
                    <CalendarClock className="w-4 h-4 text-black/35" />
                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-black/35">
                      Vydané
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {formatDate(report.reportDate || report.publishedAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-black/5 p-4">
                    <Users className="w-4 h-4 text-black/35" />
                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-black/35">
                      Hodnotené osoby
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {report.summary.evaluatedPersons}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/70 border border-black/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                      Účastníci
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {report.summary.participantsTotal ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-black/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                      Vyplnené
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {report.summary.completedResponses ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-black/5 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                      Účasť
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {formatRate(report.summary.successRate)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleOpenReport(report.id)}
                  disabled={openingReportId !== null}
                  className="mt-auto w-full rounded-2xl bg-black px-6 py-4 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                >
                  {openingReportId === report.id && (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  )}
                  Otvoriť report
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Feedback360ReportLibrary;
