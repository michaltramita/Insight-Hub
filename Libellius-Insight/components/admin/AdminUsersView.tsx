import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  FolderKanban,
  KeyRound,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import type { AppModuleCode, AppUserRole } from "../../services/accessControl";
import {
  AdminAccessOverview,
  AdminCreateUserInput,
  AdminManagedUser,
  AdminTypologyTest,
  CompanyProject,
  CompanyProjectFormInput,
  CompanyProjectStatus,
  addCompanyProjectParticipant,
  archiveCompanyProject,
  createAdminOrganization,
  createCompanyProject,
  createAdminUser,
  deleteAdminOrganization,
  deleteAdminUser,
  deleteCompanyProject,
  loadAdminAccessOverview,
  removeCompanyProjectParticipant,
  resetAdminUserPassword,
  resetAdminTypologySession,
  updateCompanyProject,
  updateCompanyProjectResultAccessDate,
  updateAdminTypologyResultRelease,
  updateAdminUserAccess,
} from "../../services/adminAccess";
import StyledSelect from "../ui/StyledSelect";

type AdminUsersViewProps = {
  currentUserId: string;
  onBack: () => void;
  variant?: "full" | "projects";
};

type UserDraft = {
  fullName: string;
  companyName: string;
  role: AppUserRole;
  organizationId: string | null;
  moduleCodes: AppModuleCode[];
};

type CreateUserForm = AdminCreateUserInput;

type ProjectForm = CompanyProjectFormInput;

type ParticipantModalState = {
  projectId: string;
  selectedUserId: string;
};

type CreateOrganizationForm = {
  name: string;
};

type TypologyAnalysisStatus = "completed" | "in_progress" | "not_started";

const ROLE_OPTIONS: Array<{ value: AppUserRole; label: string }> = [
  { value: "participant", label: "Účastník" },
  { value: "manager", label: "Manažér" },
  { value: "consultant", label: "Konzultant" },
  { value: "admin", label: "Admin" },
];

const PROJECT_STATUS_OPTIONS: Array<{
  value: CompanyProjectStatus;
  label: string;
}> = [
  { value: "active", label: "Aktívny" },
  { value: "completed", label: "Dokončený" },
  { value: "archived", label: "Archivovaný" },
];

const ADMIN_FIELD_CLASS =
  "h-14 w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20";

const ADMIN_SELECT_BUTTON_CLASS =
  "h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-black text-black";

const ADMIN_SELECT_PANEL_CLASS = "rounded-2xl border-black/10";

const ADMIN_SELECT_SELECTED_CLASS = "bg-brand text-white";

const createDraftFromUser = (user: AdminManagedUser): UserDraft => ({
  fullName: user.fullName || "",
  companyName: user.companyName || "",
  role: user.role,
  organizationId: user.organizationId,
  moduleCodes: user.moduleCodes,
});

const getUserDisplayName = (user: AdminManagedUser) =>
  user.fullName?.trim() || "Bez mena";

const formatDate = (value: string | null) => {
  if (!value) return "Bez výsledku";
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatReleaseDate = (value: string | null) => {
  if (!value) return "Výsledky sú zamknuté bez nastaveného dátumu.";
  return `Výsledky sa účastníkom zobrazia od ${formatDate(value)}.`;
};

const formatShortDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const getProjectStatusLabel = (status: CompanyProjectStatus) =>
  PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const getTypologyAnalysisStatus = (
  user: Pick<AdminManagedUser, "typologyStatus">
): TypologyAnalysisStatus => {
  if (user.typologyStatus === "completed") return "completed";
  if (user.typologyStatus === "in_progress") return "in_progress";
  return "not_started";
};

const getTypologyAnalysisMeta = (
  status: TypologyAnalysisStatus,
  completedAt: string | null = null
) => {
  if (status === "completed") {
    return {
      label: "Ukončená analýza",
      shortLabel: "Ukončená",
      detail: `Dokončené ${formatDate(completedAt)}`,
      badgeClass: "border-brand/20 bg-brand/5 text-brand",
      dotClass: "bg-brand",
    };
  }

  if (status === "in_progress") {
    return {
      label: "V priebehu",
      shortLabel: "V priebehu",
      detail: "Účastník už začal vypĺňať analýzu.",
      badgeClass: "border-black/15 bg-black/[0.04] text-black/65",
      dotClass: "bg-black/55",
    };
  }

  return {
    label: "Ešte nezačal",
    shortLabel: "Nezačal",
    detail: "Účastník ešte nezačal vypĺňať analýzu.",
    badgeClass: "border-black/10 bg-black/[0.03] text-black/50",
    dotClass: "bg-black/25",
  };
};

const toDateTimeLocalValue = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value: string) =>
  value ? new Date(value).toISOString() : null;

const createEmptyProjectForm = (
  organizationId: string | null,
  moduleCodes: AppModuleCode[] = []
): ProjectForm => ({
  name: "",
  companyName: "",
  description: "",
  contactPersonName: "",
  contactPersonEmail: "",
  status: "active",
  organizationId,
  moduleCodes,
  resultAccessDate: null,
});

const createProjectFormFromProject = (project: CompanyProject): ProjectForm => ({
  name: project.name,
  companyName: project.companyName,
  description: project.description || "",
  contactPersonName: project.contactPersonName || "",
  contactPersonEmail: project.contactPersonEmail || "",
  status: project.status,
  organizationId: project.organizationId,
  moduleCodes: project.moduleCodes,
  resultAccessDate: project.resultAccessDate,
});

const hasModule = (modules: AppModuleCode[], code: AppModuleCode) =>
  modules.includes(code);

const toggleModule = (
  modules: AppModuleCode[],
  code: AppModuleCode
): AppModuleCode[] =>
  hasModule(modules, code)
    ? modules.filter((moduleCode) => moduleCode !== code)
    : [...modules, code];

const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  currentUserId,
  onBack,
  variant = "full",
}) => {
  const [overview, setOverview] = useState<AdminAccessOverview>({
    users: [],
    organizations: [],
    modules: [],
    typologyTests: [],
    projects: [],
  });
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: "",
    password: "",
    fullName: "",
    companyName: "",
    organizationId: null,
    moduleCodes: [],
    projectId: null,
  });
  const [projectForm, setProjectForm] = useState<ProjectForm>(
    createEmptyProjectForm(null)
  );
  const [projectModalMode, setProjectModalMode] = useState<"create" | "edit" | null>(
    null
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [participantModal, setParticipantModal] =
    useState<ParticipantModalState | null>(null);
  const [isCreateOrganizationOpen, setIsCreateOrganizationOpen] = useState(false);
  const [createOrganizationForm, setCreateOrganizationForm] =
    useState<CreateOrganizationForm>({ name: "" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [passwordResets, setPasswordResets] = useState<Record<string, string>>({});
  const [releaseDrafts, setReleaseDrafts] = useState<Record<string, string>>({});
  const [unassignedProjectDrafts, setUnassignedProjectDrafts] = useState<
    Record<string, string>
  >({});
  const isProjectsOnly = variant === "projects";

  const defaultOrganizationId = useMemo(
    () =>
      overview.organizations.find((organization) => organization.slug === "libellius")
        ?.id ||
      overview.organizations[0]?.id ||
      null,
    [overview.organizations]
  );

  const loadOverview = () => {
    setIsLoading(true);
    setError(null);

    void loadAdminAccessOverview()
      .then((nextOverview) => {
        setOverview(nextOverview);
        setDrafts(
          Object.fromEntries(
            nextOverview.users.map((user) => [user.id, createDraftFromUser(user)])
          )
        );
        setReleaseDrafts(
          Object.fromEntries(
            nextOverview.typologyTests.map((test) => [
              test.id,
              toDateTimeLocalValue(test.participantResultsAvailableAt),
            ])
          )
        );
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Admin prehľad sa nepodarilo načítať."
        );
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (
      (!isCreateOpen &&
        projectModalMode === null &&
        participantModal === null &&
        !isCreateOrganizationOpen) ||
      typeof document === "undefined"
    ) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateOpen, isCreateOrganizationOpen, participantModal, projectModalMode]);

  const usersById = useMemo(
    () => new Map(overview.users.map((user) => [user.id, user])),
    [overview.users]
  );

  const assignedUserIds = useMemo(
    () =>
      new Set(
        overview.projects.flatMap((project) => project.participantIds)
      ),
    [overview.projects]
  );

  const organizationUsageById = useMemo(() => {
    const usage = new Map<string, { usersCount: number; projectsCount: number }>();

    for (const organization of overview.organizations) {
      usage.set(organization.id, { usersCount: 0, projectsCount: 0 });
    }

    for (const user of overview.users) {
      if (!user.organizationId) continue;
      const current = usage.get(user.organizationId) || {
        usersCount: 0,
        projectsCount: 0,
      };
      usage.set(user.organizationId, {
        usersCount: current.usersCount + 1,
        projectsCount: current.projectsCount,
      });
    }

    for (const project of overview.projects) {
      if (!project.organizationId) continue;
      const current = usage.get(project.organizationId) || {
        usersCount: 0,
        projectsCount: 0,
      };
      usage.set(project.organizationId, {
        usersCount: current.usersCount,
        projectsCount: current.projectsCount + 1,
      });
    }

    return usage;
  }, [overview.organizations, overview.projects, overview.users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return overview.users;

    return overview.users.filter((user) =>
      [
        user.email,
        user.fullName || "",
        user.companyName || "",
        user.organizationName || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [overview.users, search]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return overview.projects;

    return overview.projects.filter((project) => {
      const participantText = project.participantIds
        .map((participantId) => {
          const participant = usersById.get(participantId);
          if (!participant) return "";

          const typologyMeta = getTypologyAnalysisMeta(
            getTypologyAnalysisStatus(participant),
            participant.typologyCompletedAt
          );

          return `${participant.fullName || ""} ${participant.email} ${
            typologyMeta.label
          } ${typologyMeta.shortLabel}`;
        })
        .join(" ");

      return [
        project.name,
        project.companyName,
        project.description || "",
        project.contactPersonName || "",
        project.contactPersonEmail || "",
        participantText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [overview.projects, search, usersById]);

  const unassignedUsers = useMemo(
    () =>
      filteredUsers.filter(
        (user) => !assignedUserIds.has(user.id) && user.role !== "admin"
      ),
    [assignedUserIds, filteredUsers]
  );

  const participantModalProject = useMemo(
    () =>
      participantModal
        ? overview.projects.find((project) => project.id === participantModal.projectId) ||
          null
        : null,
    [overview.projects, participantModal]
  );

  const participantAssignableUsers = useMemo(() => {
    if (!participantModalProject) return [];
    return overview.users.filter(
      (user) =>
        user.role !== "admin" && !participantModalProject.participantIds.includes(user.id)
    );
  }, [overview.users, participantModalProject]);

  const openCreateModal = (project?: CompanyProject) => {
    setCreateForm({
      email: "",
      password: "",
      fullName: "",
      companyName: project?.companyName || "",
      organizationId: project?.organizationId || defaultOrganizationId,
      moduleCodes: project?.moduleCodes || [],
      projectId: project?.id || null,
    });
    setError(null);
    setSuccess(null);
    setIsCreateOpen(true);
  };

  const openCreateProjectModal = () => {
    setProjectForm(createEmptyProjectForm(defaultOrganizationId));
    setEditingProjectId(null);
    setError(null);
    setSuccess(null);
    setProjectModalMode("create");
  };

  const openEditProjectModal = (project: CompanyProject) => {
    setProjectForm(createProjectFormFromProject(project));
    setEditingProjectId(project.id);
    setError(null);
    setSuccess(null);
    setProjectModalMode("edit");
  };

  const updateDraft = (userId: string, patch: Partial<UserDraft>) => {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...patch,
      },
    }));
  };

  const updateResetPassword = (userId: string, password: string) => {
    setPasswordResets((current) => ({
      ...current,
      [userId]: password,
    }));
  };

  const updateReleaseDraft = (testId: string, value: string) => {
    setReleaseDrafts((current) => ({
      ...current,
      [testId]: value,
    }));
  };

  const updateUnassignedProjectDraft = (userId: string, projectId: string) => {
    setUnassignedProjectDrafts((current) => ({
      ...current,
      [userId]: projectId,
    }));
  };

  const updateProjectForm = (patch: Partial<ProjectForm>) => {
    setProjectForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  const handleSaveResultRelease = async (typologyTest: AdminTypologyTest) => {
    const draftValue = releaseDrafts[typologyTest.id] || "";

    setBusyKey(`release:${typologyTest.id}`);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminTypologyResultRelease(
        typologyTest.id,
        fromDateTimeLocalValue(draftValue)
      );
      setSuccess("Dátum sprístupnenia výsledkov bol uložený.");
      loadOverview();
    } catch (releaseError: unknown) {
      setError(
        releaseError instanceof Error
          ? releaseError.message
          : "Dátum sprístupnenia výsledkov sa nepodarilo uložiť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleReleaseNow = async (typologyTest: AdminTypologyTest) => {
    const nowValue = new Date().toISOString();
    updateReleaseDraft(typologyTest.id, toDateTimeLocalValue(nowValue));

    setBusyKey(`release:${typologyTest.id}`);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminTypologyResultRelease(typologyTest.id, nowValue);
      setSuccess("Výsledky typológie sú sprístupnené účastníkom.");
      loadOverview();
    } catch (releaseError: unknown) {
      setError(
        releaseError instanceof Error
          ? releaseError.message
          : "Výsledky sa nepodarilo sprístupniť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveUser = async (user: AdminManagedUser) => {
    const draft = drafts[user.id];
    if (!draft) return;

    setBusyKey(`save:${user.id}`);
    setError(null);
    setSuccess(null);

    try {
      await updateAdminUserAccess({
        userId: user.id,
        fullName: draft.fullName,
        companyName: draft.companyName,
        role: user.id === currentUserId ? "admin" : draft.role,
        organizationId: draft.organizationId,
        moduleCodes: draft.moduleCodes,
      });
      setSuccess("Prístupy používateľa boli uložené.");
      loadOverview();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Prístupy používateľa sa nepodarilo uložiť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleResetTypology = async (user: AdminManagedUser) => {
    setBusyKey(`reset:${user.id}`);
    setError(null);
    setSuccess(null);

    try {
      await resetAdminTypologySession(user.id);
      setSuccess("Typologická analýza bola resetovaná.");
      loadOverview();
    } catch (resetError: unknown) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Typologickú analýzu sa nepodarilo resetovať."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleResetPassword = async (user: AdminManagedUser) => {
    if (user.id === currentUserId) {
      setError("Vlastné heslo si zmeňte v používateľskom menu.");
      setSuccess(null);
      return;
    }

    const nextPassword = (passwordResets[user.id] || "").trim();
    if (nextPassword.length < 8) {
      setError("Nové dočasné heslo musí mať aspoň 8 znakov.");
      setSuccess(null);
      return;
    }

    setBusyKey(`password:${user.id}`);
    setError(null);
    setSuccess(null);

    try {
      const resetResult = await resetAdminUserPassword({
        userId: user.id,
        password: nextPassword,
      });
      const authEmail = resetResult.email || user.email;
      updateResetPassword(user.id, "");
      setSuccess(
        `Heslo pre používateľa ${getUserDisplayName(
          user
        )} bolo resetované. Prihlásenie použite s emailom ${authEmail}.`
      );
    } catch (resetError: unknown) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Heslo používateľa sa nepodarilo resetovať."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyKey("create");
    setError(null);
    setSuccess(null);

    try {
      await createAdminUser(createForm);
      setSuccess("Používateľ bol vytvorený.");
      setIsCreateOpen(false);
      loadOverview();
    } catch (createError: unknown) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Používateľa sa nepodarilo vytvoriť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = projectModalMode === "edit" && editingProjectId;

    setBusyKey(isEditing ? `project:${editingProjectId}` : "project:create");
    setError(null);
    setSuccess(null);

    try {
      if (isEditing && editingProjectId) {
        await updateCompanyProject(editingProjectId, projectForm);
        setSuccess("Projekt bol upravený.");
      } else {
        const created = await createCompanyProject(projectForm);
        setExpandedProjectId(created.projectId);
        setSuccess("Projekt bol vytvorený.");
      }
      setProjectModalMode(null);
      setEditingProjectId(null);
      loadOverview();
    } catch (projectError: unknown) {
      setError(
        projectError instanceof Error
          ? projectError.message
          : "Projekt sa nepodarilo uložiť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleArchiveProject = async (project: CompanyProject) => {
    setBusyKey(`archive:${project.id}`);
    setError(null);
    setSuccess(null);

    try {
      await archiveCompanyProject(project.id);
      setSuccess("Projekt bol archivovaný.");
      loadOverview();
    } catch (archiveError: unknown) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Projekt sa nepodarilo archivovať."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteProject = async (project: CompanyProject) => {
    const participantCount = project.participantIds.length;
    const confirmed = window.confirm(
      participantCount > 0
        ? `Naozaj chcete odstrániť projekt "${project.name}"? Vymaže sa aj ${participantCount} priradení účastníkov v projekte.`
        : `Naozaj chcete odstrániť projekt "${project.name}"?`
    );

    if (!confirmed) return;

    setBusyKey(`delete-project:${project.id}`);
    setError(null);
    setSuccess(null);

    try {
      await deleteCompanyProject({ projectId: project.id });
      setExpandedProjectId((current) => (current === project.id ? null : current));
      setSuccess(`Projekt ${project.name} bol odstránený.`);
      loadOverview();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Projekt sa nepodarilo odstrániť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddExistingParticipant = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!participantModal?.selectedUserId) {
      setError("Vyberte používateľa, ktorého chcete pridať do projektu.");
      setSuccess(null);
      return;
    }

    setBusyKey(`participant:${participantModal.projectId}`);
    setError(null);
    setSuccess(null);

    try {
      await addCompanyProjectParticipant(
        participantModal.projectId,
        participantModal.selectedUserId
      );
      setParticipantModal(null);
      setSuccess("Účastník bol pridaný do projektu.");
      loadOverview();
    } catch (participantError: unknown) {
      setError(
        participantError instanceof Error
          ? participantError.message
          : "Účastníka sa nepodarilo pridať do projektu."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveParticipant = async (
    project: CompanyProject,
    user: AdminManagedUser
  ) => {
    setBusyKey(`participant-remove:${project.id}:${user.id}`);
    setError(null);
    setSuccess(null);

    try {
      await removeCompanyProjectParticipant(project.id, user.id);
      setSuccess("Účastník bol odstránený z projektu.");
      loadOverview();
    } catch (participantError: unknown) {
      setError(
        participantError instanceof Error
          ? participantError.message
          : "Účastníka sa nepodarilo odstrániť z projektu."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleProjectReleaseNow = async (project: CompanyProject) => {
    const nowValue = new Date().toISOString();
    setBusyKey(`project-release:${project.id}`);
    setError(null);
    setSuccess(null);

    try {
      await updateCompanyProjectResultAccessDate(project.id, nowValue);
      setSuccess("Projektový dátum sprístupnenia výsledkov bol nastavený.");
      loadOverview();
    } catch (releaseError: unknown) {
      setError(
        releaseError instanceof Error
          ? releaseError.message
          : "Projektový dátum sprístupnenia výsledkov sa nepodarilo nastaviť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteUser = async (user: AdminManagedUser) => {
    if (user.id === currentUserId) {
      setError("Vlastné konto nie je možné odstrániť.");
      setSuccess(null);
      return;
    }

    const confirmed = window.confirm(
      `Naozaj chcete odstrániť používateľa ${getUserDisplayName(user)} (${user.email})?`
    );
    if (!confirmed) return;

    setBusyKey(`delete-user:${user.id}`);
    setError(null);
    setSuccess(null);

    try {
      await deleteAdminUser({ userId: user.id });
      setExpandedUserId((current) => (current === user.id ? null : current));
      setSuccess(`Používateľ ${getUserDisplayName(user)} bol odstránený.`);
      loadOverview();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Používateľa sa nepodarilo odstrániť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleAssignUnassignedUser = async (user: AdminManagedUser) => {
    const projectId = (unassignedProjectDrafts[user.id] || "").trim();
    if (!projectId) {
      setError("Vyberte projekt, do ktorého chcete používateľa pridať.");
      setSuccess(null);
      return;
    }

    setBusyKey(`assign-unassigned:${user.id}`);
    setError(null);
    setSuccess(null);

    try {
      await addCompanyProjectParticipant(projectId, user.id);
      updateUnassignedProjectDraft(user.id, "");
      setSuccess(`Používateľ ${getUserDisplayName(user)} bol pridaný do projektu.`);
      loadOverview();
    } catch (assignError: unknown) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Používateľa sa nepodarilo pridať do projektu."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = createOrganizationForm.name.trim();

    if (!trimmedName) {
      setError("Zadajte názov organizácie.");
      setSuccess(null);
      return;
    }

    setBusyKey("create-organization");
    setError(null);
    setSuccess(null);

    try {
      await createAdminOrganization({ name: trimmedName });
      setCreateOrganizationForm({ name: "" });
      setIsCreateOrganizationOpen(false);
      setSuccess(`Organizácia ${trimmedName} bola vytvorená.`);
      loadOverview();
    } catch (createError: unknown) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Organizáciu sa nepodarilo vytvoriť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteOrganization = async (
    organizationId: string,
    organizationName: string
  ) => {
    const usage = organizationUsageById.get(organizationId) || {
      usersCount: 0,
      projectsCount: 0,
    };

    if (usage.usersCount > 0 || usage.projectsCount > 0) {
      setError(
        `Organizáciu ${organizationName} najprv odpojte od používateľov a projektov (používatelia: ${usage.usersCount}, projekty: ${usage.projectsCount}).`
      );
      setSuccess(null);
      return;
    }

    const confirmed = window.confirm(
      `Naozaj chcete odstrániť organizáciu "${organizationName}"?`
    );
    if (!confirmed) return;

    setBusyKey(`delete-organization:${organizationId}`);
    setError(null);
    setSuccess(null);

    try {
      await deleteAdminOrganization({ organizationId });
      setSuccess(`Organizácia ${organizationName} bola odstránená.`);
      loadOverview();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Organizáciu sa nepodarilo odstrániť."
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Späť na prehľad
          </button>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand mb-3">
            Admin rozhranie
          </p>
          <h1 className="text-[clamp(2.2rem,5vw,4.5rem)] font-black tracking-tight leading-tight">
            {isProjectsOnly ? "Projekty" : "Projekty a účastníci"}
          </h1>
          <p className="mt-5 text-black/55 font-semibold text-base md:text-xl leading-relaxed max-w-3xl">
            {isProjectsOnly
              ? "Zobrazenie a správa firemných projektov, účastníkov a projektových nastavení."
              : "Vytvárajte firemné projekty, pridávajte účastníkov, spravujte moduly, prístupy a výsledky typologických analýz."}
          </p>

          <div className="mt-7 rounded-[2rem] border border-brand/25 bg-black px-4 py-4 sm:px-5 sm:py-5 shadow-xl shadow-black/15">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={openCreateProjectModal}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-white/15 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-brand hover:text-white hover:border-brand transition-all"
              >
                <FolderKanban className="w-4 h-4" />
                Vytvoriť projekt
              </button>
              <button
                type="button"
                onClick={() => openCreateModal()}
                hidden={isProjectsOnly}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-brand text-white font-black text-xs uppercase tracking-widest hover:bg-[#9f103c] transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Vytvoriť používateľa
              </button>
              <button
                type="button"
                onClick={() => setIsCreateOrganizationOpen(true)}
                hidden={isProjectsOnly}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-white/20 bg-transparent text-white font-black text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all"
              >
                <Building2 className="w-4 h-4" />
                Vytvoriť organizáciu
              </button>
              <button
                type="button"
                onClick={loadOverview}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-white/20 bg-transparent text-white font-black text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Obnoviť
              </button>
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-white/15 bg-white px-5 py-4 shadow-sm flex items-center gap-3">
              <Search className="w-5 h-5 text-black/30" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Hľadať podľa názvu projektu, firmy, mena účastníka alebo emailu"
                className="w-full bg-transparent outline-none text-base font-bold placeholder:text-black/25"
              />
            </div>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 font-bold ${
            error
              ? "border-brand/20 bg-brand/5 text-brand"
              : "border-black/10 bg-black/[0.03] text-black/60"
          }`}
        >
          {error || success}
        </div>
      )}

      {isLoading ? (
        <div className="py-24 flex items-center justify-center gap-3 text-black/40 font-black uppercase tracking-widest text-sm">
          <LoaderCircle className="w-5 h-5 animate-spin" />
          Načítavam projekty a používateľov
        </div>
      ) : (
        <div className="space-y-5">
          {/* Global test-level release is intentionally disabled. Release is project-scoped. */}
          {false && overview.typologyTests.length > 0 && (
            <section className="rounded-[2rem] border border-black/5 bg-white px-5 py-5 md:px-6 md:py-6 shadow-xl shadow-black/5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                  <CalendarClock className="w-3 h-3" />
                  Výsledky účastníkov
                </div>
                <h2 className="mt-4 text-2xl md:text-3xl font-black tracking-tight">
                  Sprístupnenie výsledkov typológie
                </h2>
                <p className="mt-2 text-sm md:text-base font-semibold text-black/50 leading-relaxed max-w-2xl">
                  Účastník po odoslaní analýzy uvidí výsledok až po nastavenom
                  dátume. Dovtedy sa mu zobrazí zamknutá obrazovka.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {overview.typologyTests.map((typologyTest) => {
                  const draftValue = releaseDrafts[typologyTest.id] || "";
                  return (
                    <div
                      key={typologyTest.id}
                      className="rounded-2xl border border-black/5 bg-[#f9f9f9] px-4 py-4"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-black truncate">
                            {typologyTest.title}
                          </p>
                          <p className="mt-1 text-xs font-bold text-black/45">
                            {formatReleaseDate(
                              typologyTest.participantResultsAvailableAt
                            )}
                          </p>
                        </div>
                        <input
                          type="datetime-local"
                          value={draftValue}
                          onChange={(event) =>
                            updateReleaseDraft(typologyTest.id, event.target.value)
                          }
                          className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                          aria-label={`Dátum sprístupnenia výsledkov pre ${typologyTest.title}`}
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveResultRelease(typologyTest)}
                            disabled={busyKey !== null}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand disabled:opacity-50"
                          >
                            {busyKey === `release:${typologyTest.id}` ? (
                              <LoaderCircle className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Uložiť dátum
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReleaseNow(typologyTest)}
                            disabled={busyKey !== null}
                            className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-black hover:text-white disabled:opacity-50"
                          >
                            Sprístupniť hneď
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                  Firemné projekty
                </p>
                <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                  Zoznam projektov
                </h2>
              </div>
              <p className="text-sm font-bold text-black/40">
                {filteredProjects.length} z {overview.projects.length} projektov
              </p>
            </div>

            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => {
                const isExpanded = expandedProjectId === project.id;
                const participantUsers = project.participantIds
                  .map((participantId) => usersById.get(participantId))
                  .filter(
                    (participant): participant is AdminManagedUser =>
                      Boolean(participant)
                  );
                const analysisCounts = participantUsers.reduce(
                  (counts, participant) => {
                    const status = getTypologyAnalysisStatus(participant);
                    return {
                      ...counts,
                      [status]: counts[status] + 1,
                    };
                  },
                  {
                    completed: 0,
                    in_progress: 0,
                    not_started: 0,
                  } satisfies Record<TypologyAnalysisStatus, number>
                );

                return (
                  <article
                    key={project.id}
                    className="rounded-[2rem] border border-black/5 bg-white shadow-xl shadow-black/5 overflow-hidden"
                  >
                    <div className="px-5 py-5 md:px-6 md:py-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProjectId((current) =>
                              current === project.id ? null : project.id
                            )
                          }
                          className="min-w-0 flex-1 text-left group"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                              <Building2 className="w-3 h-3" />
                              {project.companyName}
                            </span>
                            <span className="rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand">
                              {getProjectStatusLabel(project.status)}
                            </span>
                          </div>
                          <h3 className="mt-4 text-2xl md:text-3xl font-black tracking-tight group-hover:text-brand transition-colors">
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="mt-2 text-sm md:text-base font-semibold text-black/50 leading-relaxed">
                              {project.description}
                            </p>
                          )}
                        </button>

                        <div className="flex items-center gap-2 lg:justify-end">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenActionsMenuId((current) =>
                                  current === project.id ? null : project.id
                                )
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-black hover:text-white"
                              aria-haspopup="menu"
                              aria-expanded={openActionsMenuId === project.id}
                            >
                              <MoreVertical className="w-4 h-4" />
                              Akcie
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  openActionsMenuId === project.id ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                            {openActionsMenuId === project.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setOpenActionsMenuId(null)}
                                  aria-hidden="true"
                                />
                                <div
                                  className="absolute right-0 top-full mt-2 z-20 min-w-[240px] rounded-2xl border border-black/10 bg-white shadow-xl overflow-hidden"
                                  role="menu"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenActionsMenuId(null);
                                      setParticipantModal({
                                        projectId: project.id,
                                        selectedUserId: "",
                                      });
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-black transition-colors hover:bg-black hover:text-white"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                    Pridať účastníka
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenActionsMenuId(null);
                                      openEditProjectModal(project);
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-black transition-colors hover:bg-black hover:text-white border-t border-black/5"
                                  >
                                    <Pencil className="w-4 h-4" />
                                    Upraviť
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenActionsMenuId(null);
                                      handleArchiveProject(project);
                                    }}
                                    disabled={busyKey !== null || project.status === "archived"}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-brand transition-colors hover:bg-brand hover:text-white border-t border-black/5 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-brand"
                                  >
                                    {busyKey === `archive:${project.id}` ? (
                                      <LoaderCircle className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Archive className="w-4 h-4" />
                                    )}
                                    Archivovať
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenActionsMenuId(null);
                                      handleDeleteProject(project);
                                    }}
                                    disabled={busyKey !== null}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-brand transition-colors hover:bg-brand hover:text-white border-t border-black/5 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-brand"
                                  >
                                    {busyKey === `delete-project:${project.id}` ? (
                                      <LoaderCircle className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                    Odstrániť
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProjectId((current) =>
                                current === project.id ? null : project.id
                              )
                            }
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-black transition-all hover:bg-black hover:text-white"
                            aria-label={
                              isExpanded ? "Zavrieť detail projektu" : "Otvoriť detail projektu"
                            }
                          >
                            <ChevronDown
                              className={`w-5 h-5 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(150px,0.7fr)_minmax(180px,0.9fr)_minmax(0,2fr)]">
                        <div className="rounded-2xl border border-black/5 bg-[#f9f9f9] px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-black/30">
                            Účastníci
                          </p>
                          <p className="mt-1 text-xl font-black text-black">
                            {participantUsers.length}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black/5 bg-[#f9f9f9] px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-black/30">
                            Zobrazenie výsledkov
                          </p>
                          <p className="mt-1 text-sm font-black text-black">
                            {project.resultAccessDate
                              ? formatShortDate(project.resultAccessDate)
                              : "Bez dátumu"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black/5 bg-[#f9f9f9] px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest font-black text-black/30">
                            Predvolené moduly
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {project.moduleCodes.length > 0 ? (
                              project.moduleCodes.map((moduleCode) => (
                                <span
                                  key={moduleCode}
                                  className="rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand"
                                >
                                  {overview.modules.find(
                                    (module) => module.code === moduleCode
                                  )?.title || moduleCode}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm font-bold text-black/40">
                                Bez predvolených modulov
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-brand bg-brand px-4 py-4 text-white">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-white" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">
                              Ukončené
                            </p>
                          </div>
                          <p className="mt-3 text-3xl font-black text-white">
                            {analysisCounts.completed}
                          </p>
                          <p className="mt-1 text-xs font-bold text-white/65">
                            z {participantUsers.length} účastníkov
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-black/[0.04] px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-black/55" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/65">
                              V priebehu
                            </p>
                          </div>
                          <p className="mt-3 text-3xl font-black text-black/70">
                            {analysisCounts.in_progress}
                          </p>
                          <p className="mt-1 text-xs font-bold text-black/45">
                            rozpracované analýzy
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black bg-black px-4 py-4 text-white">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-white/65" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/75">
                              Nezačali
                            </p>
                          </div>
                          <p className="mt-3 text-3xl font-black text-white">
                            {analysisCounts.not_started}
                          </p>
                          <p className="mt-1 text-xs font-bold text-white/55">
                            čakajú na vyplnenie
                          </p>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-black/5 bg-[#fbfaf7] px-5 py-5 md:px-6 md:py-6 animate-fade-in">
                        <div className="space-y-5">
                          <div className="rounded-2xl bg-white border border-black/5 overflow-hidden w-full">
                            <div className="px-4 py-4 border-b border-black/5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                                    Účastníci projektu
                                  </p>
                                  <h4 className="mt-1 text-xl font-black tracking-tight">
                                    {participantUsers.length} účastníkov
                                  </h4>
                                </div>
                                <UsersRound className="w-5 h-5 shrink-0 text-black/25" />
                              </div>
                            </div>

                            {participantUsers.length > 0 ? (
                              <div className="divide-y divide-black/5">
                                {participantUsers.map((participant) => {
                                  const analysisStatus =
                                    getTypologyAnalysisStatus(participant);
                                  const analysisMeta = getTypologyAnalysisMeta(
                                    analysisStatus,
                                    participant.typologyCompletedAt
                                  );

                                  return (
                                    <div
                                      key={participant.id}
                                      className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-center"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-black text-black truncate">
                                          {getUserDisplayName(participant)}
                                        </p>
                                        <p className="mt-1 text-xs font-bold text-black/45 truncate">
                                          {participant.email}
                                        </p>
                                        <p className="mt-2 text-xs font-bold text-black/45">
                                          {analysisMeta.detail}
                                        </p>
                                      </div>
                                      <div className="lg:justify-self-start">
                                        <span
                                          className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest sm:w-auto lg:w-[240px] ${analysisMeta.badgeClass}`}
                                        >
                                          <span
                                            className={`h-2 w-2 rounded-full ${analysisMeta.dotClass}`}
                                          />
                                          {analysisMeta.label}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveParticipant(project, participant)
                                          }
                                          disabled={busyKey !== null}
                                          className="inline-flex items-center justify-center gap-2 rounded-full border border-brand/20 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition-all hover:bg-brand hover:text-white disabled:opacity-50"
                                        >
                                          {busyKey ===
                                          `participant-remove:${project.id}:${participant.id}` ? (
                                            <LoaderCircle className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-4 h-4" />
                                          )}
                                          Odstrániť
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="px-4 py-10 text-center">
                                <p className="font-black uppercase tracking-widest text-black/30">
                                  Projekt zatiaľ nemá účastníkov
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setParticipantModal({
                                      projectId: project.id,
                                      selectedUserId: "",
                                    })
                                  }
                                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Pridať účastníka
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-6 py-12 text-center shadow-xl shadow-black/5">
                <p className="font-black uppercase tracking-widest text-black/35">
                  {overview.projects.length === 0
                    ? "Zatiaľ neexistuje žiadny projekt"
                    : "Nenašli sa žiadne projekty"}
                </p>
                <p className="mt-3 text-sm font-semibold text-black/45">
                  Vytvorte firemný projekt a následne do neho pridajte
                  existujúcich alebo nových účastníkov.
                </p>
                <button
                  type="button"
                  onClick={openCreateProjectModal}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand"
                >
                  <FolderKanban className="w-4 h-4" />
                  Vytvoriť prvý projekt
                </button>
              </div>
            )}
          </section>

          {!isProjectsOnly && (
            <>
          <section className="rounded-[2rem] border border-black/5 bg-white px-5 py-5 md:px-6 md:py-6 shadow-xl shadow-black/5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                  Organizácie
                </p>
                <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                  Správa organizácií
                </h2>
              </div>
              <p className="text-sm font-bold text-black/40">
                {overview.organizations.length} organizácií
              </p>
            </div>

            {overview.organizations.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {overview.organizations.map((organization) => {
                  const usage = organizationUsageById.get(organization.id) || {
                    usersCount: 0,
                    projectsCount: 0,
                  };
                  const isBlocked =
                    usage.usersCount > 0 || usage.projectsCount > 0;

                  return (
                    <article
                      key={organization.id}
                      className="rounded-2xl border border-black/5 bg-[#f9f9f9] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-black text-black truncate">
                            {organization.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-black/40 truncate">
                            {organization.slug}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteOrganization(organization.id, organization.name)
                          }
                          disabled={busyKey !== null || isBlocked}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-brand/20 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition-all hover:bg-brand hover:text-white disabled:opacity-50"
                        >
                          {busyKey === `delete-organization:${organization.id}` ? (
                            <LoaderCircle className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Odstrániť
                        </button>
                      </div>
                      <p className="mt-3 text-xs font-bold text-black/50">
                        Používatelia: {usage.usersCount} · Projekty: {usage.projectsCount}
                      </p>
                      {isBlocked && (
                        <p className="mt-2 text-[11px] font-bold text-black/40">
                          Pre odstránenie najprv presuňte používateľov a projekty mimo
                          tejto organizácie.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-black/5 bg-[#f9f9f9] px-5 py-8 text-center">
                <p className="font-black uppercase tracking-widest text-black/35">
                  Zatiaľ neexistuje žiadna organizácia
                </p>
              </div>
            )}
          </section>

          {unassignedUsers.length > 0 && (
            <section className="rounded-[2rem] border border-black/5 bg-white px-5 py-5 md:px-6 md:py-6 shadow-xl shadow-black/5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                    Nezaradení používatelia
                  </p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                    Používatelia bez projektu
                  </h2>
                </div>
                <p className="text-sm font-bold text-black/40">
                  {unassignedUsers.length} používateľov
                </p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {unassignedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-black/5 bg-[#f9f9f9] px-4 py-4"
                  >
                    <p className="font-black text-black">{getUserDisplayName(user)}</p>
                    <p className="mt-1 text-xs font-bold text-black/45">
                      {user.email}
                    </p>
                    <p className="mt-2 text-xs font-bold text-black/40">
                      {user.companyName || "Bez firmy"}
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <StyledSelect
                        value={unassignedProjectDrafts[user.id] || ""}
                        onChange={(value) =>
                          updateUnassignedProjectDraft(user.id, value)
                        }
                        options={[
                          { value: "", label: "Vyberte projekt" },
                          ...overview.projects.map((project) => ({
                            value: project.id,
                            label: `${project.name} · ${project.companyName}`,
                          })),
                        ]}
                        wrapperClassName="w-full"
                        buttonClassName="h-11 rounded-2xl border border-black/10 bg-white px-4 text-xs font-black text-black"
                        panelClassName={ADMIN_SELECT_PANEL_CLASS}
                        selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
                      />
                      <button
                        type="button"
                        onClick={() => handleAssignUnassignedUser(user)}
                        disabled={busyKey !== null || overview.projects.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-brand disabled:opacity-50"
                      >
                        {busyKey === `assign-unassigned:${user.id}` ? (
                          <LoaderCircle className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Pridať
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="!mt-12 md:!mt-16 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                  Používatelia
                </p>
                <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                  Všetci používatelia
                </h2>
              </div>
              <p className="text-sm font-bold text-black/40">
                {filteredUsers.length} z {overview.users.length} používateľov
              </p>
            </div>

          {filteredUsers.map((user) => {
            const draft = drafts[user.id] || createDraftFromUser(user);
            const isSelf = user.id === currentUserId;
            const isExpanded = expandedUserId === user.id;
            const resetPasswordValue = passwordResets[user.id] || "";
            const analysisStatus = getTypologyAnalysisStatus(user);
            const analysisMeta = getTypologyAnalysisMeta(
              analysisStatus,
              user.typologyCompletedAt
            );

            return (
              <section
                key={user.id}
                className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] shadow-xl shadow-black/5 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedUserId((current) =>
                      current === user.id ? null : user.id
                    )
                  }
                  className="w-full px-5 py-3.5 md:px-6 md:py-4 flex items-center justify-between gap-4 text-left hover:bg-white transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span className="min-w-0 text-lg md:text-xl font-black tracking-tight truncate">
                    {getUserDisplayName(user)}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-black/35 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t border-black/5 p-5 md:p-6 animate-fade-in">
                    <div className="space-y-5">
                      <aside className="rounded-[1.75rem] border border-black/5 bg-white p-5 md:p-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                              Profil používateľa
                            </p>
                            <h3 className="mt-3 text-2xl md:text-4xl font-black tracking-tight leading-tight break-words">
                              {getUserDisplayName(user)}
                            </h3>
                            <p className="mt-2 text-sm md:text-base font-bold text-black/45 break-all">
                              {user.email}
                            </p>
                          </div>
                          <div className="shrink-0 rounded-full bg-black text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3" />
                            {user.role}
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl bg-[#f9f9f9] border border-black/5 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest font-black text-black/30 mb-1">
                              Firma
                            </p>
                            <p className="text-sm font-black text-black/60 truncate">
                              {user.companyName || "-"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#f9f9f9] border border-black/5 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest font-black text-black/30 mb-1">
                              Typológia
                            </p>
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${analysisMeta.badgeClass}`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${analysisMeta.dotClass}`}
                              />
                              {analysisMeta.label}
                            </span>
                            <p className="mt-2 text-xs font-bold text-black/45">
                              {analysisMeta.detail}
                            </p>
                          </div>
                        </div>
                      </aside>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <section className="rounded-[1.75rem] border border-black/5 bg-white p-5">
                          <div className="flex flex-col gap-1">
                            <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                              Profil a zaradenie
                            </p>
                            <p className="text-xs font-bold text-black/40">
                              Základné údaje, rola a organizácia používateľa.
                            </p>
                          </div>

                          <div className="mt-4 grid md:grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={draft.fullName}
                              onChange={(event) =>
                                updateDraft(user.id, { fullName: event.target.value })
                              }
                              placeholder="Meno a priezvisko"
                              className={ADMIN_FIELD_CLASS}
                            />
                            <input
                              type="text"
                              value={draft.companyName}
                              onChange={(event) =>
                                updateDraft(user.id, { companyName: event.target.value })
                              }
                              placeholder="Spoločnosť"
                              className={ADMIN_FIELD_CLASS}
                            />
                            <StyledSelect
                              value={draft.role}
                              disabled={isSelf}
                              onChange={(value) =>
                                updateDraft(user.id, {
                                  role: value as AppUserRole,
                                })
                              }
                              options={ROLE_OPTIONS}
                              wrapperClassName="w-full"
                              buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                              panelClassName={ADMIN_SELECT_PANEL_CLASS}
                              selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
                            />
                            <StyledSelect
                              value={draft.organizationId || ""}
                              onChange={(value) =>
                                updateDraft(user.id, {
                                  organizationId: value || null,
                                })
                              }
                              options={[
                                { value: "", label: "Bez organizácie" },
                                ...overview.organizations.map((organization) => ({
                                  value: organization.id,
                                  label: organization.name,
                                })),
                              ]}
                              wrapperClassName="w-full"
                              buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                              panelClassName={ADMIN_SELECT_PANEL_CLASS}
                              selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
                            />
                          </div>
                        </section>

                        <section className="rounded-[1.75rem] border border-black/5 bg-white p-5">
                          <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                            Priradené moduly
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {overview.modules.map((module) => {
                              const isActive = hasModule(draft.moduleCodes, module.code);
                              return (
                                <button
                                  key={module.code}
                                  type="button"
                                  onClick={() =>
                                    updateDraft(user.id, {
                                      moduleCodes: toggleModule(
                                        draft.moduleCodes,
                                        module.code
                                      ),
                                    })
                                  }
                                  className={`px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    isActive
                                      ? "bg-brand text-white border-brand"
                                      : "bg-[#fbfaf7] text-black/45 border-black/10 hover:text-black hover:bg-white"
                                  }`}
                                >
                                  {module.title}
                                </button>
                              );
                            })}
                          </div>
                        </section>

                        {!isSelf && (
                          <section className="rounded-[1.75rem] border border-black/5 bg-white p-5 xl:col-span-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest font-black text-brand">
                                Bezpečnosť
                              </p>
                              <h4 className="mt-2 text-lg font-black tracking-tight">
                                Reset hesla
                              </h4>
                              <p className="mt-1 text-xs font-bold text-black/45 leading-relaxed">
                                Nastavte používateľovi nové dočasné heslo. Po resetovaní
                                ho odovzdajte bezpečným kanálom.
                              </p>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                type="password"
                                value={resetPasswordValue}
                                onChange={(event) =>
                                  updateResetPassword(user.id, event.target.value)
                                }
                                placeholder="Nové dočasné heslo"
                                aria-label={`Nové dočasné heslo pre ${getUserDisplayName(user)}`}
                                className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                              />
                              <button
                                type="button"
                                onClick={() => handleResetPassword(user)}
                                disabled={busyKey !== null}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-brand/20 bg-white text-brand font-black text-[10px] uppercase tracking-widest hover:bg-brand hover:text-white transition-all disabled:opacity-50"
                              >
                                {busyKey === `password:${user.id}` ? (
                                  <LoaderCircle className="w-4 h-4 animate-spin" />
                                ) : (
                                  <KeyRound className="w-4 h-4" />
                                )}
                                Resetovať heslo
                              </button>
                            </div>
                          </section>
                        )}

                        <section className="rounded-[1.75rem] border border-black/5 bg-white p-4 xl:col-span-2">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <button
                              type="button"
                              onClick={() => handleResetTypology(user)}
                              disabled={busyKey !== null}
                              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-black/10 bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50"
                            >
                              {busyKey === `reset:${user.id}` ? (
                                <LoaderCircle className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              Resetovať analýzu
                            </button>

                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                type="button"
                                onClick={() => handleSaveUser(user)}
                                disabled={busyKey !== null}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
                              >
                                {busyKey === `save:${user.id}` ? (
                                  <LoaderCircle className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                                Uložiť
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={busyKey !== null}
                                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-brand/20 bg-white text-brand font-black text-[10px] uppercase tracking-widest hover:bg-brand hover:text-white transition-all disabled:opacity-50"
                                >
                                  {busyKey === `delete-user:${user.id}` ? (
                                    <LoaderCircle className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                  Odstrániť používateľa
                                </button>
                              )}
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="rounded-[2rem] border border-black/5 bg-[#f9f9f9] px-6 py-12 text-center shadow-xl shadow-black/5">
              <p className="font-black uppercase tracking-widest text-black/35">
                Nenašli sa žiadni používatelia
              </p>
            </div>
          )}
          </section>
            </>
          )}
        </div>
      )}

      {isCreateOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <form
              onSubmit={handleCreateUser}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-create-user-title"
              className="w-full max-w-3xl max-h-[min(720px,92vh)] overflow-y-auto bg-white rounded-[2rem] shadow-2xl border border-black/10 p-6 md:p-9 relative"
            >
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all flex items-center justify-center"
                aria-label="Zavrieť"
              >
                <X className="w-5 h-5" />
              </button>

            <div className="pr-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                <Plus className="w-3 h-3" />
                Nový účastník
              </div>
              <h2
                id="admin-create-user-title"
                className="mt-5 text-2xl md:text-4xl font-black tracking-tight"
              >
                Vytvoriť používateľa
              </h2>
              <p className="mt-3 text-black/55 font-semibold leading-relaxed">
                Účet bude vytvorený s rolou účastníka a dočasným heslom, ktoré
                môžete neskôr resetovať v detaile používateľa.
                {createForm.projectId
                  ? " Účastník bude zároveň pridaný do vybraného projektu."
                  : ""}
              </p>
            </div>

            <div className="mt-7 grid md:grid-cols-2 gap-4">
              <input
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="email@firma.sk"
                className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                required
              />
              <input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Dočasné heslo"
                className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                minLength={8}
                required
              />
              <input
                type="text"
                value={createForm.fullName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Meno a priezvisko"
                className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
              />
              <input
                type="text"
                value={createForm.companyName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    companyName: event.target.value,
                  }))
                }
                placeholder="Spoločnosť"
                className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
              />
              <StyledSelect
                value={createForm.organizationId || ""}
                onChange={(value) =>
                  setCreateForm((current) => ({
                    ...current,
                    organizationId: value || null,
                  }))
                }
                options={[
                  { value: "", label: "Bez organizácie" },
                  ...overview.organizations.map((organization) => ({
                    value: organization.id,
                    label: organization.name,
                  })),
                ]}
                wrapperClassName="md:col-span-2 w-full"
                buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                panelClassName={ADMIN_SELECT_PANEL_CLASS}
                selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
              />
              <StyledSelect
                value={createForm.projectId || ""}
                onChange={(value) => {
                  const projectId = value || null;
                  const project = overview.projects.find(
                    (candidate) => candidate.id === projectId
                  );
                  setCreateForm((current) => ({
                    ...current,
                    projectId,
                    companyName: project?.companyName || current.companyName,
                    organizationId:
                      project?.organizationId || current.organizationId,
                    moduleCodes:
                      project && project.moduleCodes.length > 0
                        ? project.moduleCodes
                        : current.moduleCodes,
                  }));
                }}
                options={[
                  { value: "", label: "Bez projektu" },
                  ...overview.projects.map((project) => ({
                    value: project.id,
                    label: `${project.name} · ${project.companyName}`,
                  })),
                ]}
                wrapperClassName="md:col-span-2 w-full"
                buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                panelClassName={ADMIN_SELECT_PANEL_CLASS}
                selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
              />
            </div>

            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-widest font-black text-black/35 mb-3">
                Priradené moduly
              </p>
              <div className="flex flex-wrap gap-2">
                {overview.modules.map((module) => {
                  const isActive = hasModule(createForm.moduleCodes, module.code);
                  return (
                    <button
                      key={module.code}
                      type="button"
                      onClick={() =>
                        setCreateForm((current) => ({
                          ...current,
                          moduleCodes: toggleModule(
                            current.moduleCodes,
                            module.code
                          ),
                        }))
                      }
                      className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                        isActive
                          ? "bg-brand text-white border-brand"
                          : "bg-black/5 text-black/45 border-black/10 hover:text-black"
                      }`}
                    >
                      {module.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={busyKey === "create"}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
            >
              {busyKey === "create" ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Vytvoriť používateľa
            </button>
            </form>
          </div>,
          document.body
        )}

      {projectModalMode &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <form
              onSubmit={handleSaveProject}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-project-modal-title"
              className="w-full max-w-3xl max-h-[min(760px,92vh)] overflow-y-auto bg-white rounded-[2rem] shadow-2xl border border-black/10 p-6 md:p-9 relative"
            >
              <button
                type="button"
                onClick={() => {
                  setProjectModalMode(null);
                  setEditingProjectId(null);
                }}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all flex items-center justify-center"
                aria-label="Zavrieť"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-12">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                  <FolderKanban className="w-3 h-3" />
                  {projectModalMode === "edit" ? "Úprava projektu" : "Nový projekt"}
                </div>
                <h2
                  id="admin-project-modal-title"
                  className="mt-5 text-2xl md:text-4xl font-black tracking-tight"
                >
                  {projectModalMode === "edit"
                    ? "Upraviť projekt"
                    : "Vytvoriť projekt"}
                </h2>
                <p className="mt-3 text-black/55 font-semibold leading-relaxed">
                  Projekt slúži ako firemná vrstva nad účastníkmi. Existujúce
                  používateľské prístupy ostávajú zachované.
                </p>
              </div>

              <div className="mt-7 grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(event) => updateProjectForm({ name: event.target.value })}
                  placeholder="Názov projektu"
                  className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
                <input
                  type="text"
                  value={projectForm.companyName}
                  onChange={(event) =>
                    updateProjectForm({ companyName: event.target.value })
                  }
                  placeholder="Názov firmy"
                  className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
                <input
                  type="text"
                  value={projectForm.contactPersonName}
                  onChange={(event) =>
                    updateProjectForm({ contactPersonName: event.target.value })
                  }
                  placeholder="Kontaktná osoba"
                  className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="email"
                  value={projectForm.contactPersonEmail}
                  onChange={(event) =>
                    updateProjectForm({ contactPersonEmail: event.target.value })
                  }
                  placeholder="kontakt@firma.sk"
                  className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                />
                <StyledSelect
                  value={projectForm.status}
                  onChange={(value) =>
                    updateProjectForm({
                      status: value as CompanyProjectStatus,
                    })
                  }
                  options={PROJECT_STATUS_OPTIONS}
                  wrapperClassName="w-full"
                  buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                  panelClassName={ADMIN_SELECT_PANEL_CLASS}
                  selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
                />
                <StyledSelect
                  value={projectForm.organizationId || ""}
                  onChange={(value) =>
                    updateProjectForm({
                      organizationId: value || null,
                    })
                  }
                  options={[
                    { value: "", label: "Bez organizácie" },
                    ...overview.organizations.map((organization) => ({
                      value: organization.id,
                      label: organization.name,
                    })),
                  ]}
                  wrapperClassName="w-full"
                  buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                  panelClassName={ADMIN_SELECT_PANEL_CLASS}
                  selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
                />
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(projectForm.resultAccessDate)}
                  onChange={(event) =>
                    updateProjectForm({
                      resultAccessDate: fromDateTimeLocalValue(event.target.value),
                    })
                  }
                  className="md:col-span-2 w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                  aria-label="Projektový dátum sprístupnenia výsledkov"
                />
                <textarea
                  value={projectForm.description}
                  onChange={(event) =>
                    updateProjectForm({ description: event.target.value })
                  }
                  placeholder="Popis projektu"
                  className="md:col-span-2 min-h-28 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-widest font-black text-black/35 mb-3">
                  Predvolené moduly projektu
                </p>
                <div className="flex flex-wrap gap-2">
                  {overview.modules.map((module) => {
                    const isActive = hasModule(projectForm.moduleCodes, module.code);
                    return (
                      <button
                        key={module.code}
                        type="button"
                        onClick={() =>
                          updateProjectForm({
                            moduleCodes: toggleModule(
                              projectForm.moduleCodes,
                              module.code
                            ),
                          })
                        }
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                          isActive
                            ? "bg-brand text-white border-brand"
                            : "bg-black/5 text-black/45 border-black/10 hover:text-black"
                        }`}
                      >
                        {module.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={busyKey?.startsWith("project:")}
                className="mt-8 w-full inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
              >
                {busyKey?.startsWith("project:") ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {projectModalMode === "edit" ? "Uložiť projekt" : "Vytvoriť projekt"}
              </button>
            </form>
          </div>,
          document.body
        )}

      {isCreateOrganizationOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <form
              onSubmit={handleCreateOrganization}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-create-organization-title"
              className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl border border-black/10 p-6 md:p-9 relative"
            >
              <button
                type="button"
                onClick={() => setIsCreateOrganizationOpen(false)}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all flex items-center justify-center"
                aria-label="Zavrieť"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-12">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                  <Building2 className="w-3 h-3" />
                  Nová organizácia
                </div>
                <h2
                  id="admin-create-organization-title"
                  className="mt-5 text-2xl md:text-4xl font-black tracking-tight"
                >
                  Vytvoriť organizáciu
                </h2>
                <p className="mt-3 text-black/55 font-semibold leading-relaxed">
                  Organizácia bude hneď dostupná pri tvorbe a úprave používateľov aj
                  projektov.
                </p>
              </div>

              <div className="mt-7">
                <input
                  type="text"
                  value={createOrganizationForm.name}
                  onChange={(event) =>
                    setCreateOrganizationForm({ name: event.target.value })
                  }
                  placeholder="Názov organizácie"
                  className="w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={busyKey === "create-organization"}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
              >
                {busyKey === "create-organization" ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <Building2 className="w-4 h-4" />
                )}
                Vytvoriť organizáciu
              </button>
            </form>
          </div>,
          document.body
        )}

      {participantModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-add-participant-title"
              className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-black/10 p-6 md:p-9 relative"
            >
              <button
                type="button"
                onClick={() => setParticipantModal(null)}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all flex items-center justify-center"
                aria-label="Zavrieť"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-12">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                  <UserPlus className="w-3 h-3" />
                  Účastník projektu
                </div>
                <h2
                  id="admin-add-participant-title"
                  className="mt-5 text-2xl md:text-4xl font-black tracking-tight"
                >
                  Pridať účastníka
                </h2>
                <p className="mt-3 text-black/55 font-semibold leading-relaxed">
                  {participantModalProject
                    ? `${participantModalProject.name} · ${participantModalProject.companyName}`
                    : "Vybraný projekt sa nepodarilo načítať."}
                </p>
              </div>

              <form onSubmit={handleAddExistingParticipant} className="mt-7">
                <label className="block text-[10px] uppercase tracking-widest font-black text-black/35 mb-3">
                  Priradiť existujúceho používateľa
                </label>
                <StyledSelect
                  value={participantModal.selectedUserId}
                  onChange={(value) =>
                    setParticipantModal((current) =>
                      current
                        ? { ...current, selectedUserId: value }
                        : current
                    )
                  }
                  options={[
                    { value: "", label: "Vyberte používateľa" },
                    ...participantAssignableUsers.map((user) => ({
                      value: user.id,
                      label: `${getUserDisplayName(user)} · ${user.email}`,
                    })),
                  ]}
                  wrapperClassName="w-full"
                  buttonClassName={ADMIN_SELECT_BUTTON_CLASS}
                  panelClassName={ADMIN_SELECT_PANEL_CLASS}
                  selectedOptionClassName={ADMIN_SELECT_SELECTED_CLASS}
                />

                <button
                  type="submit"
                  disabled={busyKey !== null || !participantModalProject}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
                >
                  {busyKey === `participant:${participantModal.projectId}` ? (
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Pridať do projektu
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-black/5 bg-[#f9f9f9] p-4">
                <p className="text-sm font-bold text-black/50 leading-relaxed">
                  Alebo vytvorte nového používateľa priamo v projekte. Firma a
                  predvolené moduly sa predvyplnia podľa projektu.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (participantModalProject) {
                      setParticipantModal(null);
                      openCreateModal(participantModalProject);
                    }
                  }}
                  disabled={!participantModalProject}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-black disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Vytvoriť nového účastníka
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AdminUsersView;
