import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import type { AppModuleCode, AppUserRole } from "../../services/accessControl";
import {
  AdminAccessOverview,
  AdminCreateUserInput,
  AdminManagedUser,
  createAdminUser,
  loadAdminAccessOverview,
  resetAdminTypologySession,
  updateAdminUserAccess,
} from "../../services/adminAccess";

type AdminUsersViewProps = {
  currentUserId: string;
  onBack: () => void;
};

type UserDraft = {
  fullName: string;
  companyName: string;
  role: AppUserRole;
  organizationId: string | null;
  moduleCodes: AppModuleCode[];
};

type CreateUserForm = AdminCreateUserInput;

const ROLE_OPTIONS: Array<{ value: AppUserRole; label: string }> = [
  { value: "participant", label: "Účastník" },
  { value: "manager", label: "Manažér" },
  { value: "consultant", label: "Konzultant" },
  { value: "admin", label: "Admin" },
];

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
}) => {
  const [overview, setOverview] = useState<AdminAccessOverview>({
    users: [],
    organizations: [],
    modules: [],
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
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
    if (!isCreateOpen || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateOpen]);

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

  const openCreateModal = () => {
    setCreateForm({
      email: "",
      password: "",
      fullName: "",
      companyName: "",
      organizationId: defaultOrganizationId,
      moduleCodes: [],
    });
    setError(null);
    setSuccess(null);
    setIsCreateOpen(true);
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
      setSuccess("Typologický test bol resetovaný.");
      loadOverview();
    } catch (resetError: unknown) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Typologický test sa nepodarilo resetovať."
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
            Späť na prehľad
          </button>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-brand mb-3">
            Admin rozhranie
          </p>
          <h1 className="text-[clamp(2.2rem,5vw,4.5rem)] font-black tracking-tight leading-tight">
            Používatelia a prístupy
          </h1>
          <p className="mt-5 text-black/55 font-semibold text-base md:text-xl leading-relaxed max-w-3xl">
            Vytvárajte účastníkov, priraďujte im moduly a resetujte rozpracované
            alebo dokončené typologické testy.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={loadOverview}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-black/10 bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Obnoviť
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-brand text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Vytvoriť používateľa
          </button>
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

      <div className="mb-6 rounded-[1.5rem] border border-black/5 bg-white px-5 py-4 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-black/30" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hľadať podľa mena, emailu alebo firmy"
          className="w-full bg-transparent outline-none text-base font-bold placeholder:text-black/25"
        />
      </div>

      {isLoading ? (
        <div className="py-24 flex items-center justify-center gap-3 text-black/40 font-black uppercase tracking-widest text-sm">
          <LoaderCircle className="w-5 h-5 animate-spin" />
          Načítavam používateľov
        </div>
      ) : (
        <div className="space-y-5">
          {filteredUsers.map((user) => {
            const draft = drafts[user.id] || createDraftFromUser(user);
            const isSelf = user.id === currentUserId;
            const isExpanded = expandedUserId === user.id;

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
                  className="w-full px-5 py-5 md:px-6 md:py-6 flex items-center justify-between gap-4 text-left hover:bg-white transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span className="min-w-0 text-xl md:text-2xl font-black tracking-tight truncate">
                    {getUserDisplayName(user)}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-black/35 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t border-black/5 p-5 md:p-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] animate-fade-in">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xl md:text-2xl font-black tracking-tight truncate">
                          {getUserDisplayName(user)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-black/45 truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-full bg-black text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3" />
                        {user.role}
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold text-black/50">
                      <div className="rounded-2xl bg-white border border-black/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest font-black text-black/30 mb-1">
                          Firma
                        </p>
                        {user.companyName || "-"}
                      </div>
                      <div className="rounded-2xl bg-white border border-black/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-widest font-black text-black/30 mb-1">
                          Typológia
                        </p>
                        {user.typologyStatus === "completed"
                          ? `Dokončené ${formatDate(user.typologyCompletedAt)}`
                          : user.typologyStatus === "in_progress"
                            ? "Rozpracované"
                            : "Bez testu"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={draft.fullName}
                        onChange={(event) =>
                          updateDraft(user.id, { fullName: event.target.value })
                        }
                        placeholder="Meno a priezvisko"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                      />
                      <input
                        type="text"
                        value={draft.companyName}
                        onChange={(event) =>
                          updateDraft(user.id, { companyName: event.target.value })
                        }
                        placeholder="Spoločnosť"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand/20"
                      />
                      <select
                        value={draft.role}
                        disabled={isSelf}
                        onChange={(event) =>
                          updateDraft(user.id, {
                            role: event.target.value as AppUserRole,
                          })
                        }
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={draft.organizationId || ""}
                        onChange={(event) =>
                          updateDraft(user.id, {
                            organizationId: event.target.value || null,
                          })
                        }
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-brand/20"
                      >
                        <option value="">Bez organizácie</option>
                        {overview.organizations.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                              isActive
                                ? "bg-brand text-white border-brand"
                                : "bg-white text-black/45 border-black/10 hover:text-black"
                            }`}
                          >
                            {module.title}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleResetTypology(user)}
                        disabled={busyKey === `reset:${user.id}`}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-black/10 bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50"
                      >
                        {busyKey === `reset:${user.id}` ? (
                          <LoaderCircle className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        Resetovať test
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveUser(user)}
                        disabled={busyKey === `save:${user.id}`}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
                      >
                        {busyKey === `save:${user.id}` ? (
                          <LoaderCircle className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Uložiť
                      </button>
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
                Účet bude vytvorený s rolou účastníka a dočasným heslom.
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
              <select
                value={createForm.organizationId || ""}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    organizationId: event.target.value || null,
                  }))
                }
                className="md:col-span-2 w-full h-14 rounded-2xl border border-black/10 bg-[#fbfaf7] px-4 text-sm font-black outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Bez organizácie</option>
                {overview.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
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
    </div>
  );
};

export default AdminUsersView;
