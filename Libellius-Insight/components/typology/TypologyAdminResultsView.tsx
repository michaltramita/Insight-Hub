import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, FileText, LoaderCircle, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  loadTypologyAdminResults,
  TypologyAdminResult,
  TypologyStyleCode,
} from "../../services/typologyTest";
import TypologyProfilePreview from "./TypologyProfilePreview";

type TypologyAdminResultsViewProps = {
  onBack: () => void;
};

const STYLE_LABELS: Record<TypologyStyleCode, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
};

const STYLE_NAMES: Record<TypologyStyleCode, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const readScore = (
  scores: Record<TypologyStyleCode, number> | null,
  code: TypologyStyleCode
) => scores?.[code] ?? "-";

const TypologyAdminResultsView: React.FC<TypologyAdminResultsViewProps> = ({
  onBack,
}) => {
  const [results, setResults] = useState<TypologyAdminResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TypologyAdminResult | null>(null);
  const [profileResult, setProfileResult] = useState<TypologyAdminResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => results.filter((result) => result.status === "completed").length,
    [results]
  );

  const chartData = useMemo(() => {
    if (!selectedResult?.scores) return [];
    return (["a", "b", "c", "d"] as TypologyStyleCode[]).map((code) => ({
      code: STYLE_LABELS[code],
      name: STYLE_NAMES[code],
      score: selectedResult.scores?.[code] || 0,
      fill: selectedResult.dominantStyle === code ? "#B81547" : "#111111",
    }));
  }, [selectedResult]);

  const loadResults = () => {
    setIsLoading(true);
    setError(null);

    void loadTypologyAdminResults()
      .then((nextResults) => {
        setResults(nextResults);
        setSelectedResult((current) => {
          if (!current) return null;
          return (
            nextResults.find((result) => result.sessionId === current.sessionId) ||
            null
          );
        });
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Výsledky sa nepodarilo načítať."
        );
        setResults([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadResults();
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Späť na test
          </button>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand mb-3">
            Admin prehľad
          </p>
          <h1 className="text-[clamp(2rem,5vw,4.2rem)] font-black tracking-tight leading-tight">
            Výsledky typológie
          </h1>
          <p className="mt-5 text-black/55 font-semibold text-base md:text-xl leading-relaxed max-w-3xl">
            Tu vidíte dokončené testy účastníkov. Výsledky sú dostupné iba pre
            admina alebo konzultanta a účastník ich po odoslaní nevidí.
          </p>
        </div>
        <div className="rounded-2xl bg-[#f9f9f9] border border-black/5 px-5 py-4 text-left md:text-right shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
            Dokončené
          </p>
          <p className="text-2xl font-black mt-1">
            {completedCount}/{results.length}
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] shadow-xl shadow-black/5 overflow-hidden">
        <div className="px-5 py-4 md:px-7 md:py-5 border-b border-black/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-lg md:text-xl font-black">Prehľad účastníkov</p>
            <p className="text-sm font-semibold text-black/45 mt-1">
              Z výsledku môžete otvoriť graf aj profil pripravený na uloženie do PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={loadResults}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Obnoviť
          </button>
        </div>

        {isLoading ? (
          <div className="px-6 py-16 flex items-center justify-center gap-3 text-black/45 font-black uppercase tracking-widest text-sm">
            <LoaderCircle className="w-5 h-5 animate-spin" />
            Načítavam výsledky
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-brand font-black">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-xl font-black">Zatiaľ nie sú odoslané žiadne testy.</p>
            <p className="mt-3 text-black/50 font-semibold">
              Výsledky sa tu zobrazia po odoslaní prvého účastníckeho testu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-black/5 text-[10px] uppercase tracking-widest text-black/35">
                  <th className="px-4 py-4 font-black">Účastník</th>
                  <th className="px-4 py-4 font-black">Stav</th>
                  <th className="px-4 py-4 font-black">Dokončené</th>
                  <th className="px-3 py-4 font-black text-center">A</th>
                  <th className="px-3 py-4 font-black text-center">B</th>
                  <th className="px-3 py-4 font-black text-center">C</th>
                  <th className="px-3 py-4 font-black text-center">D</th>
                  <th className="px-4 py-4 font-black">Dominantný</th>
                  <th className="px-4 py-4 font-black text-right">Profil</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.sessionId} className="border-b border-black/5 last:border-b-0 bg-white/60">
                    <td className="px-4 py-4 max-w-[220px]">
                      <p className="text-sm font-black leading-tight break-words">
                        {result.fullName || result.userEmail}
                      </p>
                      <p className="text-xs text-black/45 font-semibold mt-1 break-words">
                        {result.companyName || result.userEmail}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          result.status === "completed"
                            ? "bg-brand text-white"
                            : "bg-black/8 text-black/45"
                        }`}
                      >
                        {result.status === "completed" ? "Dokončený" : "Rozpracovaný"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-black/55 whitespace-nowrap">
                      {formatDate(result.completedAt)}
                    </td>
                    {(["a", "b", "c", "d"] as TypologyStyleCode[]).map((code) => (
                      <td key={code} className="px-3 py-4 text-center">
                        <span className="inline-flex min-w-8 h-8 items-center justify-center rounded-lg bg-black/5 text-sm font-black">
                          {readScore(result.scores, code)}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-4">
                      <span className="font-black text-base">
                        {result.dominantStyle
                          ? STYLE_LABELS[result.dominantStyle]
                          : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedResult(result)}
                          disabled={!result.scores}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-black text-white font-black text-[9px] uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          Zobraziť
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfileResult(result)}
                          disabled={!result.scores}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-brand text-white font-black text-[9px] uppercase tracking-widest hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Vytvoriť profil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedResult && (
        <section className="mt-8 rounded-[2rem] border border-black/5 bg-white shadow-xl shadow-black/5 overflow-hidden">
          <div className="px-5 py-4 md:px-7 md:py-5 border-b border-black/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                Detail výsledku
              </p>
              <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                {selectedResult.fullName || selectedResult.userEmail}
              </h2>
              <p className="mt-2 text-sm font-semibold text-black/45">
                Dokončené: {formatDate(selectedResult.completedAt)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#f9f9f9] border border-black/5 px-5 py-4 text-left md:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                Dominantný štýl
              </p>
              <p className="text-3xl font-black mt-1 text-brand">
                {selectedResult.dominantStyle
                  ? STYLE_LABELS[selectedResult.dominantStyle]
                  : "-"}
              </p>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <div className="h-[340px] md:h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
                  <XAxis
                    dataKey="code"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#111", fontWeight: 900 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, 96]}
                    tick={{ fill: "rgba(0,0,0,0.45)", fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    formatter={(value) => [`${value} bodov`, "Skóre"]}
                    labelFormatter={(label) => `Štýl ${label}`}
                  />
                  <Bar dataKey="score" radius={[14, 14, 4, 4]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.code} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {chartData.map((item) => (
                <div
                  key={item.code}
                  className={`rounded-2xl border px-4 py-4 ${
                    selectedResult.dominantStyle &&
                    STYLE_LABELS[selectedResult.dominantStyle] === item.code
                      ? "border-brand/25 bg-brand/5"
                      : "border-black/5 bg-[#f9f9f9]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                    Štýl {item.code}
                  </p>
                  <p className="mt-2 text-2xl font-black">{item.score}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {profileResult && (
        <TypologyProfilePreview
          result={profileResult}
          onClose={() => setProfileResult(null)}
        />
      )}
    </div>
  );
};

export default TypologyAdminResultsView;
