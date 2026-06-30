import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  Save,
  Send,
  UsersRound,
} from "lucide-react";
import type { FeedbackAnalysisResult } from "../../types";
import {
  loadAdminAccessOverview,
  type AdminAccessOverview,
} from "../../services/adminAccess";
import {
  buildFeedback360ReportSummary,
  saveFeedback360Report,
} from "../../services/feedback360Reports";
import StyledSelect from "../ui/StyledSelect";

type Feedback360ReportPublisherProps = {
  result: FeedbackAnalysisResult;
};

const SELECT_BUTTON_CLASS =
  "h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-black text-black";

const SELECT_PANEL_CLASS = "rounded-2xl border-black/10";

const SELECT_SELECTED_CLASS = "bg-brand text-white";

const buildDefaultTitle = (result: FeedbackAnalysisResult) => {
  const feedback360 = result.feedback360;
  const surveyName = feedback360?.surveyName || "360° spätná väzba";
  const companyName =
    feedback360?.companyName || result.reportMetadata.company || "organizácia";
  return `${surveyName} · ${companyName}`;
};

const Feedback360ReportPublisher: React.FC<Feedback360ReportPublisherProps> = ({
  result,
}) => {
  const [overview, setOverview] = useState<AdminAccessOverview>({
    users: [],
    organizations: [],
    modules: [],
    typologyTests: [],
    projects: [],
  });
  const [title, setTitle] = useState(() => buildDefaultTitle(result));
  const [projectId, setProjectId] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => buildFeedback360ReportSummary(result), [result]);

  const projects = useMemo(
    () =>
      overview.projects.filter(
        (project) =>
          project.status !== "archived" && project.moduleCodes.includes("360_FEEDBACK")
      ),
    [overview.projects]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) || null,
    [projectId, projects]
  );

  const availableUsers = useMemo(
    () =>
      overview.users.filter(
        (user) =>
          user.role !== "admin" && user.moduleCodes.includes("360_FEEDBACK")
      ),
    [overview.users]
  );

  const projectOptions = useMemo(
    () => [
      { value: "", label: "Bez projektu" },
      ...projects.map((project) => ({
        value: project.id,
        label: `${project.name} · ${project.companyName}`,
      })),
    ],
    [projects]
  );

  useEffect(() => {
    setTitle(buildDefaultTitle(result));
  }, [result]);

  useEffect(() => {
    let isActive = true;

    const loadOverview = async () => {
      setIsLoadingOverview(true);
      setError(null);

      try {
        const nextOverview = await loadAdminAccessOverview();
        if (isActive) {
          setOverview(nextOverview);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Admin dáta pre publikovanie reportu sa nepodarilo načítať."
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingOverview(false);
        }
      }
    };

    void loadOverview();

    return () => {
      isActive = false;
    };
  }, []);

  const handleProjectChange = (nextProjectId: string) => {
    const nextProject =
      projects.find((project) => project.id === nextProjectId) || null;

    setProjectId(nextProjectId);
    setOrganizationId(nextProject?.organizationId || null);
    setSelectedUserIds(nextProject?.participantIds || []);
    setFeedback(null);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
    setFeedback(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    setError(null);

    try {
      const saved = await saveFeedback360Report({
        result,
        title,
        projectId: projectId || null,
        organizationId,
        userIds: selectedUserIds,
        status: "published",
      });
      setFeedback(`Report bol publikovaný. ID: ${saved.reportId}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Report sa nepodarilo publikovať."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mb-8 rounded-[2rem] md:rounded-[2.5rem] border border-brand/10 bg-white p-5 sm:p-6 md:p-8 shadow-2xl print:hidden">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/5 border border-brand/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            <Send className="w-3.5 h-3.5" />
            Admin publikovanie
          </div>
          <h2 className="mt-4 text-2xl md:text-3xl font-black tracking-tight">
            Uložiť a sprístupniť 360 report
          </h2>
          <p className="mt-3 text-sm md:text-base font-semibold text-black/50 leading-relaxed">
            Tento panel vidí iba admin. Report sa uloží ako spracovaný výstup a
            pridelení používatelia ho uvidia v module 360 SV bez možnosti uploadu.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full xl:w-[520px]">
          <div className="rounded-2xl bg-black text-white p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/45">
              Osoby
            </p>
            <p className="mt-3 text-3xl font-black">{summary.evaluatedPersons}</p>
          </div>
          <div className="rounded-2xl bg-brand text-white p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/55">
              Účasť
            </p>
            <p className="mt-3 text-3xl font-black">
              {summary.successRate !== null ? `${Math.round(summary.successRate)}%` : "-"}
            </p>
          </div>
          <div className="rounded-2xl bg-black/[0.04] border border-black/5 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-black/35">
              Oblasti
            </p>
            <p className="mt-3 text-3xl font-black">{summary.competenciesCount}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-7 grid grid-cols-1 xl:grid-cols-[1.2fr_0.9fr] gap-5">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
              Názov reportu
            </label>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setFeedback(null);
              }}
              className="h-14 w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-black outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
              Projekt
            </label>
            <StyledSelect
              value={projectId}
              options={projectOptions}
              onChange={handleProjectChange}
              disabled={isLoadingOverview}
              buttonClassName={SELECT_BUTTON_CLASS}
              panelClassName={SELECT_PANEL_CLASS}
              selectedOptionClassName={SELECT_SELECTED_CLASS}
            />
            <p className="mt-2 text-xs font-bold text-black/40">
              {selectedProject
                ? "Používatelia v projekte získajú prístup k reportu."
                : "Bez projektu bude report dostupný iba priamo vybraným používateľom."}
            </p>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-black/5 bg-[#fbfaf7] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Priamy prístup
              </p>
              <p className="mt-1 text-xs font-bold text-black/45">
                {selectedUserIds.length} vybraných používateľov
              </p>
            </div>
            <UsersRound className="w-5 h-5 text-brand" />
          </div>

          <div className="mt-4 max-h-48 overflow-auto space-y-2 pr-1">
            {isLoadingOverview ? (
              <div className="rounded-2xl bg-white border border-black/5 p-4 flex items-center gap-3 text-black/45 font-bold">
                <LoaderCircle className="w-4 h-4 animate-spin" />
                Načítavam používateľov...
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="rounded-2xl bg-white border border-black/5 p-4 text-sm font-bold text-black/45">
                Zatiaľ nie sú dostupní používatelia s prístupom k modulu 360 SV.
              </div>
            ) : (
              availableUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-white border-brand/20 text-brand"
                        : "bg-white/70 border-black/5 text-black/65 hover:bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-black truncate">
                        {user.fullName || user.email}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-black/35 truncate">
                        {user.email}
                      </span>
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {(feedback || error) && (
          <div
            className={`xl:col-span-2 rounded-2xl px-5 py-4 text-sm font-bold ${
              error
                ? "border border-brand/15 bg-brand/5 text-brand"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || feedback}
          </div>
        )}

        <div className="xl:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs font-bold text-black/40">
            Report bude po uložení viditeľný iba publikovaným používateľom podľa
            RLS pravidiel a priradenia modulu.
          </p>
          <button
            type="submit"
            disabled={isSaving || isLoadingOverview || !title.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-7 py-4 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-black/10 hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Publikovať report
          </button>
        </div>
      </form>
    </section>
  );
};

export default Feedback360ReportPublisher;
