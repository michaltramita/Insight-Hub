import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  FileText,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  TypologyAdminProject,
  TypologyAdminProjectOverview,
  TypologyAdminResult,
  TypologyStyleCode,
  loadTypologyAdminResultsOverview,
} from "../../services/typologyTest";
import { TYPOLOGY_PROFILE_CONTENT } from "../../services/typologyProfile";
import StyledSelect from "../ui/StyledSelect";
import TypologyProfilePreview from "./TypologyProfilePreview";

type TypologyAdminResultsViewProps = {
  onBack: () => void;
};

type ChartDatum = {
  code: TypologyStyleCode;
  name: string;
  score: number;
  fill: string;
};

type ProjectResultGroup = {
  id: string;
  filterValue: string;
  name: string;
  companyName: string | null;
  status: TypologyAdminProject["status"] | "unassigned";
  resultAccessDate: string | null;
  results: TypologyAdminResult[];
  participantIds: string[];
  isUnassigned: boolean;
};

type TypologyResultsTableProps = {
  results: TypologyAdminResult[];
  onOpenGraph: (result: TypologyAdminResult) => void;
  onOpenReport: (result: TypologyAdminResult) => void;
};

const ALL_PROJECTS_FILTER = "all";
const UNASSIGNED_PROJECT_ID = "__unassigned";

const STYLE_NAMES: Record<TypologyStyleCode, string> = {
  a: TYPOLOGY_PROFILE_CONTENT.a.name,
  b: TYPOLOGY_PROFILE_CONTENT.b.name,
  c: TYPOLOGY_PROFILE_CONTENT.c.name,
  d: TYPOLOGY_PROFILE_CONTENT.d.name,
};

const PROJECT_STATUS_LABELS: Record<TypologyAdminProject["status"], string> = {
  active: "Aktívny",
  completed: "Ukončený",
  archived: "Archivovaný",
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

const getGroupCompletedCount = (group: ProjectResultGroup) =>
  group.results.filter((result) => result.status === "completed").length;

const getGroupParticipantCount = (group: ProjectResultGroup) =>
  Math.max(
    group.participantIds.length,
    new Set(group.results.map((result) => result.userId)).size
  );

const sortProjectGroups = (groups: ProjectResultGroup[]) =>
  [...groups].sort((left, right) => {
    if (left.isUnassigned) return 1;
    if (right.isUnassigned) return -1;

    const companyCompare = (left.companyName || "").localeCompare(
      right.companyName || "",
      "sk"
    );
    if (companyCompare !== 0) return companyCompare;
    return left.name.localeCompare(right.name, "sk");
  });

const buildProjectResultGroups = (
  results: TypologyAdminResult[],
  projects: TypologyAdminProjectOverview[]
): ProjectResultGroup[] => {
  const groupsByProjectId = new Map<string, ProjectResultGroup>();
  const unassignedResults: TypologyAdminResult[] = [];

  for (const project of projects) {
    groupsByProjectId.set(project.id, {
      id: project.id,
      filterValue: project.id,
      name: project.name,
      companyName: project.companyName,
      status: project.status,
      resultAccessDate: project.resultAccessDate,
      results: [],
      participantIds: project.participantIds,
      isUnassigned: false,
    });
  }

  for (const result of results) {
    if (result.projects.length === 0) {
      unassignedResults.push(result);
      continue;
    }

    for (const project of result.projects) {
      const existing = groupsByProjectId.get(project.id);
      if (existing) {
        existing.results.push(result);
        continue;
      }

      groupsByProjectId.set(project.id, {
        id: project.id,
        filterValue: project.id,
        name: project.name,
        companyName: project.companyName,
        status: project.status,
        resultAccessDate: project.resultAccessDate,
        results: [result],
        participantIds: [result.userId],
        isUnassigned: false,
      });
    }
  }

  const groups = sortProjectGroups(Array.from(groupsByProjectId.values()));

  if (unassignedResults.length > 0) {
    groups.push({
      id: UNASSIGNED_PROJECT_ID,
      filterValue: UNASSIGNED_PROJECT_ID,
      name: "Bez projektu",
      companyName: null,
      status: "unassigned",
      resultAccessDate: null,
      results: unassignedResults,
      participantIds: Array.from(
        new Set(unassignedResults.map((result) => result.userId))
      ),
      isUnassigned: true,
    });
  }

  return groups;
};

type TypologyGraphPreviewProps = {
  result: TypologyAdminResult;
  chartData: ChartDatum[];
  onClose: () => void;
  onOpenReport: () => void;
};

const TypologyGraphPreview: React.FC<TypologyGraphPreviewProps> = ({
  result,
  chartData,
  onClose,
  onOpenReport,
}) => {
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

  const dominantStyleName = result.dominantStyle
    ? STYLE_NAMES[result.dominantStyle]
    : "-";

  const preview = (
    <div className="fixed inset-0 z-[998] bg-black/45 backdrop-blur-sm print:hidden">
      <div className="h-screen w-screen overflow-y-auto p-3 sm:p-4 md:p-8">
        <div className="w-full max-w-5xl mx-auto mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
            Zavrieť graf
          </button>

          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-brand text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all"
          >
            <FileText className="w-4 h-4" />
            Otvoriť report
          </button>
        </div>

        <article className="w-full max-w-5xl mx-auto bg-white text-black rounded-[2rem] overflow-hidden shadow-2xl shadow-black/20">
          <header className="bg-black text-white p-5 md:p-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] font-black text-white/55">
                  Detail grafu
                </p>
                <h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight leading-none break-words">
                  {result.fullName || result.userEmail}
                </h2>
                <p className="mt-4 text-sm md:text-base font-semibold text-white/55 break-words">
                  {result.companyName || result.userEmail}
                </p>
                <p className="mt-2 text-sm font-semibold text-white/45">
                  Dokončené: {formatDate(result.completedAt)}
                </p>
              </div>

              <div className="w-full md:w-[260px] shrink-0 rounded-3xl bg-white text-black p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
                  Dominantný štýl
                </p>
                <p className="mt-2 text-2xl md:text-3xl font-black leading-tight text-brand">
                  {dominantStyleName}
                </p>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-5 md:p-7 space-y-5 md:space-y-7">
            <section
              className="rounded-[1.6rem] border border-black/5 bg-[#f9f9f9] p-4 sm:p-5 md:p-6"
              aria-label="Graf skóre typológie"
            >
              <div className="space-y-3.5 md:space-y-4">
                {chartData.map((item) => {
                  const percentage = Math.min(
                    100,
                    Math.max(0, (item.score / 96) * 100)
                  );

                  return (
                    <div
                      key={item.code}
                      className={`rounded-2xl border px-3 py-3 md:px-4 md:py-4 ${
                        result.dominantStyle === item.code
                          ? "border-brand/20 bg-white"
                          : "border-black/5 bg-white/70"
                      }`}
                    >
                      <div className="grid gap-2.5 md:grid-cols-[minmax(140px,220px)_minmax(0,1fr)_54px] md:items-center md:gap-4">
                        <div className="flex items-center justify-between gap-3 md:contents">
                          <p
                            className={`text-[10px] md:text-xs font-black uppercase tracking-wide leading-tight md:col-start-1 md:row-start-1 ${
                              result.dominantStyle === item.code
                                ? "text-brand"
                                : "text-black/55"
                            }`}
                          >
                            {item.name}
                          </p>
                          <p className="text-right text-xl md:text-2xl font-black tabular-nums md:col-start-3 md:row-start-1">
                            {item.score}
                          </p>
                        </div>
                        <div className="h-4 md:h-5 rounded-full bg-black/8 overflow-hidden md:col-start-2 md:row-start-1">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: item.fill,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {chartData.map((item) => (
                <div
                  key={item.code}
                  className={`rounded-2xl border px-4 py-4 ${
                    result.dominantStyle === item.code
                      ? "border-brand/25 bg-brand/5"
                      : "border-black/5 bg-[#f9f9f9]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest font-black text-black/35">
                    {item.name}
                  </p>
                  <p className="mt-2 text-2xl font-black">{item.score}</p>
                </div>
              ))}
            </div>
          </main>
        </article>
      </div>
    </div>
  );

  return createPortal(preview, document.body);
};

const TypologyResultsTable: React.FC<TypologyResultsTableProps> = ({
  results,
  onOpenGraph,
  onOpenReport,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[780px] text-left">
      <thead>
        <tr className="border-y border-black/5 text-[9px] uppercase tracking-widest text-black/35">
          <th className="px-3 py-3 font-black">Účastník</th>
          <th className="px-3 py-3 font-black">Stav</th>
          <th className="px-3 py-3 font-black">Dokončené</th>
          <th className="px-3 py-3 font-black">Štýl</th>
          <th className="px-3 py-3 font-black text-right">Profil</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => (
          <tr
            key={result.sessionId}
            className="border-b border-black/5 last:border-b-0 bg-white/60"
          >
            <td className="px-3 py-3 max-w-[190px]">
              <p className="text-[13px] font-black leading-tight break-words">
                {result.fullName || result.userEmail}
              </p>
              <p className="text-[11px] text-black/45 font-semibold mt-1 break-words">
                {result.companyName || result.userEmail}
              </p>
            </td>
            <td className="px-3 py-3">
              <span
                className={`inline-flex px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.14em] leading-none ${
                  result.status === "completed"
                    ? "bg-brand text-white"
                    : "bg-black/8 text-black/45"
                }`}
              >
                {result.status === "completed" ? "Dokončený" : "Rozpracovaný"}
              </span>
            </td>
            <td className="px-3 py-3 text-xs font-bold text-black/55 whitespace-nowrap">
              {formatDate(result.completedAt)}
            </td>
            <td className="px-3 py-3">
              <span className="inline-flex rounded-full bg-black/5 px-3 py-1.5 text-xs font-black leading-tight text-black">
                {result.dominantStyle ? STYLE_NAMES[result.dominantStyle] : "-"}
              </span>
            </td>
            <td className="px-3 py-3 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenGraph(result)}
                  disabled={!result.scores}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-full bg-black text-white font-black text-[8px] uppercase tracking-[0.14em] leading-none hover:bg-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <BarChart3 className="w-3 h-3" />
                  Zobraziť
                </button>
                <button
                  type="button"
                  onClick={() => onOpenReport(result)}
                  disabled={!result.scores}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-full bg-brand text-white font-black text-[8px] uppercase tracking-[0.14em] leading-none hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText className="w-3 h-3" />
                  Vytvoriť profil
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TypologyAdminResultsView: React.FC<TypologyAdminResultsViewProps> = ({
  onBack,
}) => {
  const [results, setResults] = useState<TypologyAdminResult[]>([]);
  const [projects, setProjects] = useState<TypologyAdminProjectOverview[]>([]);
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS_FILTER);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedResult, setSelectedResult] = useState<TypologyAdminResult | null>(null);
  const [profileResult, setProfileResult] = useState<TypologyAdminResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => results.filter((result) => result.status === "completed").length,
    [results]
  );

  const projectGroups = useMemo(
    () => buildProjectResultGroups(results, projects),
    [results, projects]
  );
  const projectCount = useMemo(
    () => projectGroups.filter((group) => !group.isUnassigned).length,
    [projectGroups]
  );
  const trackedParticipantCount = useMemo(() => {
    const participantIds = new Set<string>();
    for (const project of projects) {
      project.participantIds.forEach((userId) => participantIds.add(userId));
    }
    for (const result of results) {
      if (result.projects.length === 0) {
        participantIds.add(result.userId);
      }
    }

    return Math.max(participantIds.size, results.length);
  }, [projects, results]);
  const projectFilterOptions = useMemo(
    () => [
      { value: ALL_PROJECTS_FILTER, label: "Všetky projekty" },
      ...projectGroups
        .filter((group) => !group.isUnassigned)
        .map((group) => ({
          value: group.filterValue,
          label: group.companyName
            ? `${group.companyName} · ${group.name}`
            : group.name,
        })),
      ...(projectGroups.some((group) => group.isUnassigned)
        ? [{ value: UNASSIGNED_PROJECT_ID, label: "Bez projektu" }]
        : []),
    ],
    [projectGroups]
  );
  const visibleProjectGroups = useMemo(
    () =>
      projectFilter === ALL_PROJECTS_FILTER
        ? projectGroups
        : projectGroups.filter((group) => group.filterValue === projectFilter),
    [projectFilter, projectGroups]
  );

  const chartData = useMemo(() => {
    if (!selectedResult?.scores) return [];
    return (["a", "b", "c", "d"] as TypologyStyleCode[]).map((code) => ({
      code,
      name: STYLE_NAMES[code],
      score: selectedResult.scores?.[code] || 0,
      fill: selectedResult.dominantStyle === code ? "#B81547" : "#111111",
    }));
  }, [selectedResult]);

  const loadResults = () => {
    setIsLoading(true);
    setError(null);

    void loadTypologyAdminResultsOverview()
      .then(({ results: nextResults, projects: nextProjects }) => {
        setResults(nextResults);
        setProjects(nextProjects);
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
        setProjects([]);
      })
      .finally(() => setIsLoading(false));
  };

  const toggleProjectGroup = (groupId: string) => {
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
        return next;
      }
      next.add(groupId);
      return next;
    });
  };

  useEffect(() => {
    loadResults();
  }, []);

  useEffect(() => {
    if (projectFilter === ALL_PROJECTS_FILTER) return;
    if (projectGroups.some((group) => group.filterValue === projectFilter)) return;
    setProjectFilter(ALL_PROJECTS_FILTER);
  }, [projectFilter, projectGroups]);

  useEffect(() => {
    setExpandedProjectIds((current) => {
      const availableGroupIds = new Set(projectGroups.map((group) => group.id));
      const next = new Set(
        Array.from(current).filter((groupId) => availableGroupIds.has(groupId))
      );

      return next.size === current.size ? current : next;
    });
  }, [projectGroups]);

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
            Späť na analýzu
          </button>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand mb-3">
            Admin prehľad
          </p>
          <h1 className="text-[clamp(2rem,5vw,4.2rem)] font-black tracking-tight leading-tight">
            Výsledky typológie
          </h1>
          <p className="mt-5 text-black/55 font-semibold text-base md:text-xl leading-relaxed max-w-3xl">
            Tu vidíte dokončené analýzy účastníkov. Výsledky sú dostupné iba pre
            admina alebo konzultanta a účastník ich po odoslaní nevidí.
          </p>
        </div>
        <div className="rounded-2xl bg-[#f9f9f9] border border-black/5 px-5 py-4 text-left md:text-right shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/35">
            Dokončené
          </p>
          <p className="text-2xl font-black mt-1">
            {completedCount}/{trackedParticipantCount}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-black/35">
            Projekty: {projectCount}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-5 py-4 shadow-xl shadow-black/5 md:px-7 md:py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-lg md:text-xl font-black">Prehľad podľa projektov</p>
            <p className="text-sm font-semibold text-black/45 mt-1">
              Výsledky sú zoskupené podľa projektov. Nezaradení účastníci sú v samostatnej sekcii.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <StyledSelect
              value={projectFilter}
              onChange={setProjectFilter}
              options={projectFilterOptions}
              wrapperClassName="w-full sm:w-[360px] lg:w-[420px]"
              buttonClassName="h-11 rounded-full border border-black/10 bg-white px-4 text-xs font-black uppercase tracking-widest text-black shadow-sm hover:bg-black/5"
              panelClassName="rounded-2xl border-black/10 bg-white shadow-2xl"
              optionClassName="text-xs uppercase tracking-wider text-black/70 hover:bg-black/5 hover:text-black"
              selectedOptionClassName="bg-brand text-white"
              iconClassName="h-4 w-4 text-black/35"
              menuAlign="right"
            />
            <button
              type="button"
              onClick={loadResults}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Obnoviť
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-6 py-16 shadow-xl shadow-black/5 flex items-center justify-center gap-3 text-black/45 font-black uppercase tracking-widest text-sm">
            <LoaderCircle className="w-5 h-5 animate-spin" />
            Načítavam výsledky
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-6 py-12 text-center shadow-xl shadow-black/5">
            <p className="text-brand font-black">{error}</p>
          </div>
        ) : projectGroups.length === 0 ? (
          <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-6 py-14 text-center shadow-xl shadow-black/5">
            <p className="text-xl font-black">Zatiaľ nie sú vytvorené žiadne projekty ani výsledky.</p>
            <p className="mt-3 text-black/50 font-semibold">
              Po vytvorení projektu sa tu zobrazí aj vtedy, keď ešte nikto nedokončil analýzu.
            </p>
          </div>
        ) : visibleProjectGroups.length === 0 ? (
          <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-6 py-14 text-center shadow-xl shadow-black/5">
            <p className="text-xl font-black">Vo vybranom projekte zatiaľ nie sú výsledky.</p>
            <p className="mt-3 text-black/50 font-semibold">
              Skúste zvoliť všetky projekty alebo obnoviť prehľad.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleProjectGroups.map((group) => {
              const completedInGroup = getGroupCompletedCount(group);
              const participantCount = getGroupParticipantCount(group);
              const isExpanded = expandedProjectIds.has(group.id);
              const tableId = `typology-project-results-${group.id}`;

              return (
                <section
                  key={group.id}
                  className="overflow-hidden rounded-[2rem] border border-black/5 bg-[#f9f9f9] shadow-xl shadow-black/5"
                >
                  <button
                    type="button"
                    onClick={() => toggleProjectGroup(group.id)}
                    aria-expanded={isExpanded}
                    aria-controls={tableId}
                    className="group w-full px-5 py-5 text-left transition-all hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-brand/20 md:px-7 md:py-6"
                  >
                    <span className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              group.isUnassigned
                                ? "bg-black/8 text-black/45"
                                : "bg-brand text-white"
                            }`}
                          >
                            {group.isUnassigned
                              ? "Bez projektu"
                              : PROJECT_STATUS_LABELS[group.status]}
                          </span>
                          {!group.isUnassigned && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/35">
                              Sprístupnenie: {formatDate(group.resultAccessDate)}
                            </span>
                          )}
                        </span>
                        <span className="mt-3 block text-2xl md:text-3xl font-black tracking-tight leading-tight break-words">
                          {group.name}
                        </span>
                        {group.companyName && (
                          <span className="mt-1 block text-sm font-bold text-black/45 break-words">
                            {group.companyName}
                          </span>
                        )}
                      </span>

                      <span className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-stretch gap-2.5 lg:w-[360px]">
                        <span className="rounded-2xl border border-black/5 bg-white/55 px-4 py-3">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-black/35">
                            Účastníci
                          </span>
                          <span className="mt-1 block text-2xl font-black">
                            {participantCount}
                          </span>
                        </span>
                        <span className="rounded-2xl border border-black/5 bg-white/55 px-4 py-3">
                          <span className="block text-[9px] font-black uppercase tracking-widest text-black/35">
                            Dokončené
                          </span>
                          <span className="mt-1 block text-2xl font-black">
                            {completedInGroup}/{participantCount}
                          </span>
                        </span>
                        <span className="inline-flex h-full min-w-11 items-center justify-center rounded-2xl border border-black/5 bg-white/55 text-black/45 transition-all group-hover:bg-black group-hover:text-white">
                          <ChevronDown
                            className={`h-5 w-5 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </span>
                      </span>
                    </span>
                  </button>

                  {isExpanded && (
                    <div id={tableId} className="border-t border-black/5">
                      {group.results.length > 0 ? (
                        <TypologyResultsTable
                          results={group.results}
                          onOpenGraph={setSelectedResult}
                          onOpenReport={setProfileResult}
                        />
                      ) : (
                        <div className="px-5 py-8 md:px-7">
                          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white/60 px-5 py-7 text-center">
                            <p className="text-sm font-black text-black">
                              Projekt je načítaný, zatiaľ bez dokončených výsledkov.
                            </p>
                            <p className="mt-2 text-sm font-semibold text-black/45">
                              Po dokončení typologického testu sa účastník zobrazí v tejto sekcii.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {selectedResult && (
        <TypologyGraphPreview
          result={selectedResult}
          chartData={chartData}
          onClose={() => setSelectedResult(null)}
          onOpenReport={() => {
            setProfileResult(selectedResult);
            setSelectedResult(null);
          }}
        />
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
