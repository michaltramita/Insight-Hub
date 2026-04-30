import React, { Suspense, lazy, useState } from 'react';
import AuthAccessPanel from './components/AuthAccessPanel';
import FileUpload from './components/FileUpload';
import { AppStatus } from './types';
import { AlertCircle, Key, BarChart3, Users, ChevronLeft, Sparkles, BrainCircuit, LogOut, KeyRound, X, Lock, ShieldCheck } from 'lucide-react';
import { useAppWorkflow } from './hooks/useAppWorkflow';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { useModuleAssignments } from './hooks/useModuleAssignments';
import { useCurrentProfile } from './hooks/useCurrentProfile';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Feedback360Dashboard = lazy(
  () => import('./components/feedback360/Feedback360Dashboard')
);
const SatisfactionDashboard = lazy(
  () => import('./components/SatisfactionDashboard')
);
const TypologyTestView = lazy(
  () => import('./components/typology/TypologyTestView')
);
const TypologyAdminResultsView = lazy(
  () => import('./components/typology/TypologyAdminResultsView')
);
const AdminUsersView = lazy(() => import('./components/admin/AdminUsersView'));
const WelcomeGuide = lazy(() => import('./components/WelcomeGuide'));

const App: React.FC = () => {
  const { isConfigured, isLoading: isAuthLoading, user, error: authError, signInWithPassword, updatePassword, signOut } =
    useSupabaseAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showTypologyTest, setShowTypologyTest] = useState(false);
  const [showTypologyResults, setShowTypologyResults] = useState(false);
  const [showAdminUsers, setShowAdminUsers] = useState(false);
  const { profile, isAdminLike } = useCurrentProfile(user);
  const {
    assignments,
    isLoading: isLoadingAssignments,
    error: assignmentsError,
    hasModule,
  } = useModuleAssignments(user);
  const {
    status,
    selectedMode,
    result,
    error,
    needsKey,
    pendingEncryptedPayload,
    sharePassword,
    setSharePassword,
    shareDecryptError,
    isDecrypting,
    showSharedGoodbye,
    showWelcomeGuide,
    setShowWelcomeGuide,
    publicMeta,
    shouldShowSharedLoading,
    handleOpenKeyDialog,
    handleDecryptSharedReport,
    selectMode,
    handleFileSelect,
    handleReset,
    handleBackToMode,
    cancelPendingSharedReport,
  } = useAppWorkflow();

  const isSharedFlow =
    shouldShowSharedLoading ||
    Boolean(pendingEncryptedPayload) ||
    showSharedGoodbye ||
    publicMeta !== null;

  const shouldShowAuthGate = isConfigured && !isSharedFlow && !user;
  const shouldUseAssignments = isConfigured && Boolean(user) && !isSharedFlow;
  const canSeeFeedback360 = !shouldUseAssignments || hasModule('360_FEEDBACK');
  const canSeeSatisfaction =
    !shouldUseAssignments || hasModule('ZAMESTNANECKA_SPOKOJNOST');
  const canSeeTypology = !shouldUseAssignments || hasModule('TYPOLOGY_LEADERSHIP');
  const isGlobalAdmin = profile?.role === 'admin';
  const hasAnyAssignedModule =
    canSeeFeedback360 || canSeeSatisfaction || canSeeTypology;

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordFeedback(null);
    setIsUpdatingPassword(true);

    const result = await updatePassword(newPassword);
    if (result.error) {
      setPasswordFeedback(result.error);
    } else {
      setPasswordFeedback("Heslo bolo nastavené. Nabudúce sa môžete prihlásiť cez Admin.");
      setNewPassword("");
    }

    setIsUpdatingPassword(false);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans relative flex flex-col">
      {needsKey && (
        <button
          onClick={handleOpenKeyDialog}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] text-[10px] md:text-xs font-bold text-brand bg-white border border-brand/20 px-3 py-2 md:px-4 md:py-2 rounded-full flex items-center gap-2 shadow-xl hover:bg-brand/5"
        >
          <Key className="w-3 h-3 md:w-4 md:h-4" /> NASTAVIŤ API KĽÚČ
        </button>
      )}

      {isConfigured && user && !isSharedFlow && (
        <header className="sticky top-0 z-[55] w-full bg-black text-white border-b border-white/10">
          <div className="w-full max-w-5xl mx-auto px-4 md:px-0 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 h-12 overflow-hidden">
              <img
                src="/Libelius_logo_white_HQ-01-2.png"
                alt="Libellius"
                className="h-14 md:h-16 w-auto object-contain -ml-2"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:justify-end">
              <div className="min-w-0 rounded-full border border-white/10 bg-white/8 px-4 py-2">
                <p className="text-[10px] uppercase tracking-widest font-black text-white/40">
                  Prihlásený účet
                </p>
                <p className="text-xs font-bold text-white/85 truncate max-w-[260px]">
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isGlobalAdmin && (
                  <button
                    onClick={() => {
                      setShowTypologyTest(false);
                      setShowTypologyResults(false);
                      setShowAdminUsers(true);
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 text-white px-4 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Správa prístupov</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setPasswordFeedback(null);
                    setShowPasswordDialog(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white text-black px-4 text-[10px] font-black uppercase tracking-widest hover:bg-brand hover:text-white transition-all"
                >
                  <KeyRound className="w-4 h-4" />
                  <span className="hidden sm:inline">Nastaviť heslo</span>
                </button>
                <button
                  onClick={() => void signOut()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/8 text-white px-4 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Odhlásiť sa</span>
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {showPasswordDialog && (
        <div className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-black/10 p-6 md:p-8 relative">
            <button
              type="button"
              onClick={() => setShowPasswordDialog(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all flex items-center justify-center"
              aria-label="Zavrieť"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="pr-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                <KeyRound className="w-3 h-3" />
                Admin účet
              </div>
              <h2 className="mt-5 text-2xl md:text-3xl font-black tracking-tight">
                Nastaviť heslo
              </h2>
              <p className="mt-3 text-black/55 font-semibold leading-relaxed">
                Heslo sa uloží k aktuálne prihlásenému účtu {user.email}.
              </p>
            </div>
            <form onSubmit={handleUpdatePassword} className="mt-7 space-y-4">
              <div>
                <label
                  htmlFor="new-admin-password"
                  className="block text-[10px] md:text-xs uppercase tracking-widest font-black text-black/45 mb-3"
                >
                  Nové heslo
                </label>
                <input
                  id="new-admin-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Minimálne 8 znakov"
                  className="w-full px-5 py-4 rounded-2xl bg-[#fbfaf7] border border-black/10 outline-none focus:ring-2 focus:ring-brand/25 text-base font-semibold"
                />
              </div>
              {passwordFeedback && (
                <p className="text-sm font-bold text-brand">{passwordFeedback}</p>
              )}
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full px-7 py-4 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingPassword ? "Ukladám..." : "Uložiť heslo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {shouldShowAuthGate && (
        <AuthAccessPanel
          isLoading={isAuthLoading}
          userEmail={user?.email}
          error={authError}
          onPasswordSignIn={signInWithPassword}
        />
      )}

      {!shouldShowAuthGate && (
      <main className="w-full max-w-[1440px] xl:max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-grow flex flex-col">
        {showSharedGoodbye && (
          <div className="flex flex-col min-h-[calc(100vh-120px)]">
            <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in px-4 py-6 md:py-10">
              <div className="w-full max-w-6xl bg-white border border-black/5 rounded-[2rem] shadow-2xl p-8 sm:p-10 md:p-14 lg:p-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/5 text-brand rounded-full mb-6 md:mb-8 text-xs md:text-sm font-black tracking-widest uppercase">
                  ĎAKUJEME ZA VYUŽITIE LIBELLIUS INSIGHTHUB
                </div>
                <h2 className="text-[clamp(2rem,5vw,4rem)] font-black tracking-tight leading-[1.2] md:leading-[1.18] mb-8 md:mb-10 max-w-5xl mx-auto">
                  Veríme, že vizualizácia dát Vám priniesla jasnejší pohľad na ďalšie rozhodnutia.
                </h2>
                <p className="text-[clamp(1rem,2vw,1.3rem)] text-black/50 font-semibold leading-relaxed max-w-4xl mx-auto">
                  Ak budete potrebovať znovu otvoriť prehľad, použite zdieľaný odkaz.
                </p>
              </div>
            </div>
            <div className="w-full max-w-5xl mx-auto mt-auto pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-6 text-black/40 pb-4 px-4 md:px-0 animate-fade-in">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="Libellius" className="h-16 md:h-20 w-auto object-contain opacity-80" />
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs font-bold text-black/60">© {new Date().getFullYear()} Libellius. Všetky práva vyhradené.</p>
              </div>
            </div>
          </div>
        )}

        {pendingEncryptedPayload && status !== AppStatus.SUCCESS && (
          <div className="flex flex-col min-h-[calc(100vh-120px)]">
            <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in px-4 py-6 md:py-10">
              <div className="w-full max-w-5xl bg-white border border-black/5 rounded-[2rem] shadow-2xl px-6 sm:px-10 md:px-14 py-8 sm:py-10 md:py-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/5 text-brand rounded-full mb-6 text-xs font-black tracking-widest uppercase">
                  <Key className="w-3 h-3" /> Chránený report
                </div>
                <h1 className="text-sm sm:text-base font-black uppercase tracking-[0.24em] text-black/40 mb-5">
                  Libellius <span className="text-brand">InsightHub</span>
                </h1>
                <h2 className="text-[clamp(2rem,4vw,3.4rem)] font-black tracking-tight leading-[1.12] mb-8 md:mb-10">
                  Tento report je chránený heslom
                </h2>
                <div className="space-y-4 text-left max-w-4xl mx-auto">
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDecryptSharedReport(); }}
                    placeholder="Zadajte heslo"
                    className="w-full px-5 py-4 md:px-6 md:py-5 bg-black/5 border border-black/5 rounded-2xl outline-none focus:ring-2 focus:ring-brand/30 text-lg"
                  />
                  {shareDecryptError && <p className="text-sm font-bold text-brand">{shareDecryptError}</p>}
                  <div className="flex flex-col sm:flex-row gap-4 pt-2">
                    <button
                      onClick={handleDecryptSharedReport}
                      disabled={isDecrypting || !sharePassword.trim()}
                      className="flex-1 px-6 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDecrypting ? 'Odomykám...' : 'Odomknúť report'}
                    </button>
                    <button
                      onClick={cancelPendingSharedReport}
                      className="px-6 py-4 bg-black/5 text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black/10 transition-all min-w-[170px]"
                    >
                      Zrušiť
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* DUPLIKOVANÁ PÄTIČKA Z TOHTO MIESTA BOLA ÚSPEŠNE ODSTRÁNENÁ */}
          </div>
        )}

        {shouldShowSharedLoading && (
          <div className="flex flex-col min-h-[calc(100vh-120px)]">
            <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in px-4 py-6 md:py-10">
              <div className="w-full max-w-5xl bg-white border border-black/5 rounded-[2rem] shadow-2xl px-6 sm:px-10 md:px-14 py-8 sm:py-10 md:py-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/5 text-brand rounded-full mb-6 text-xs font-black tracking-widest uppercase">
                  <Key className="w-3 h-3" /> Chránený report
                </div>
                <h1 className="text-sm sm:text-base font-black uppercase tracking-[0.24em] text-black/40 mb-5">
                  Libellius <span className="text-brand">InsightHub</span>
                </h1>
                <h2 className="text-[clamp(2rem,4vw,3.4rem)] font-black tracking-tight leading-[1.12] mb-4">
                  Načítavam zdieľaný report
                </h2>
                <p className="text-black/50 font-semibold text-base md:text-lg">
                  Pripravujeme bezpečné odomknutie reportu.
                </p>
              </div>
            </div>
          </div>
        )}

        {showAdminUsers && user && isGlobalAdmin && !showSharedGoodbye && (
          <Suspense
            fallback={
              <div className="w-full py-20 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-black/40">
                  Načítavam admin rozhranie...
                </p>
              </div>
            }
          >
            <AdminUsersView
              currentUserId={user.id}
              onBack={() => setShowAdminUsers(false)}
            />
          </Suspense>
        )}

        {(showTypologyTest || showTypologyResults) && user && !showAdminUsers && !showSharedGoodbye && (
          <Suspense
            fallback={
              <div className="w-full py-20 text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-black/40">
                  Načítavam typológiu...
                </p>
              </div>
            }
          >
            {showTypologyResults ? (
              <TypologyAdminResultsView
                onBack={() => setShowTypologyResults(false)}
              />
            ) : (
              <TypologyTestView
                user={user}
                onBack={() => setShowTypologyTest(false)}
              />
            )}
          </Suspense>
        )}

        {!showAdminUsers && !showTypologyTest && !showTypologyResults && !shouldShowSharedLoading && !pendingEncryptedPayload && status === AppStatus.HOME && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-brand/5 text-brand rounded-full mb-6 md:mb-8 text-[10px] md:text-sm font-black tracking-widest uppercase">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4" /> Next-gen Analytics
            </div>
            <div className="w-full max-w-[360px] sm:max-w-3xl mx-auto px-2">
              <h1 className="text-center font-black tracking-tight leading-[0.95]">
                <span className="block text-[clamp(2rem,8vw,4.25rem)] text-black">Vitajte v</span>
                <span className="mt-1 flex flex-wrap justify-center items-baseline gap-x-2 sm:gap-x-3">
                  <span className="uppercase text-black text-[clamp(2.2rem,9vw,4.8rem)]">Libellius</span>
                  <span className="uppercase text-brand text-[clamp(2.2rem,9vw,4.8rem)]">InsightHub</span>
                </span>
              </h1>
            </div>
            <p className="text-base sm:text-lg md:text-2xl text-black/50 mb-10 md:mb-16 mt-6 md:mt-8 max-w-2xl font-medium px-4 leading-relaxed">
              PREHĽADNÁ VIZUALIZÁCIA VAŠICH VÝSLEDKOV.
            </p>
            {shouldUseAssignments && isLoadingAssignments && (
              <div className="w-full max-w-5xl border border-black/5 rounded-[2rem] bg-[#f9f9f9] px-6 py-10 md:py-12 shadow-xl shadow-black/5">
                <p className="text-sm md:text-base font-black uppercase tracking-widest text-black/40">
                  Načítavam vaše dostupné moduly...
                </p>
              </div>
            )}

            {shouldUseAssignments && !isLoadingAssignments && assignmentsError && (
              <div className="w-full max-w-5xl border border-brand/15 rounded-[2rem] bg-brand/5 px-6 py-10 md:py-12 shadow-xl shadow-black/5">
                <p className="text-sm md:text-base font-black uppercase tracking-widest text-brand">
                  Prístupové nastavenia sa nepodarilo načítať
                </p>
                <p className="mt-4 text-black/55 font-semibold max-w-2xl mx-auto">
                  Skúste sa odhlásiť a prihlásiť znova. Ak problém pretrváva, kontaktujte organizátora.
                </p>
              </div>
            )}

            {shouldUseAssignments && !isLoadingAssignments && !assignmentsError && assignments.length === 0 && (
              <div className="w-full max-w-5xl border border-black/5 rounded-[2rem] bg-[#f9f9f9] px-6 py-10 md:py-12 shadow-xl shadow-black/5">
                <p className="text-sm md:text-base font-black uppercase tracking-widest text-black/40">
                  Zatiaľ nemáte pridelený žiadny modul
                </p>
                <p className="mt-4 text-black/55 font-semibold max-w-2xl mx-auto">
                  Dostupný test alebo report sa zobrazí automaticky po priradení organizátorom.
                </p>
              </div>
            )}

            {!isLoadingAssignments && !assignmentsError && hasAnyAssignedModule && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-5xl px-0 sm:px-2">
              <button
                onClick={() => selectMode('360_FEEDBACK')}
                disabled={!canSeeFeedback360}
                aria-disabled={!canSeeFeedback360}
                className={`group p-6 sm:p-8 md:p-10 border-2 border-black/5 rounded-[2rem] md:rounded-[2.5rem] text-left flex flex-col items-start gap-5 md:gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9] transition-all ${
                  canSeeFeedback360
                    ? 'hover:border-black hover:bg-black/5'
                    : 'opacity-35 grayscale cursor-not-allowed'
                }`}
              >
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 pointer-events-none">
                  <Users className="w-24 h-24 md:w-32 md:h-32 text-black" />
                </div>
                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg">
                  <Users className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div className="z-10">
                  <span className="text-[28px] sm:text-[30px] md:text-[32px] font-black block mb-3 md:mb-4 tracking-tight uppercase leading-tight">Analýza 360° spätnej väzby</span>
                  <p className="text-black/50 font-bold text-base md:text-lg leading-relaxed max-w-md">Vidieť rozdiely. Pochopiť súvislosti. Rozvíjať potenciál.</p>
                </div>
                <div className={`z-10 mt-2 md:mt-4 w-full sm:w-auto px-6 sm:px-8 md:px-10 py-3.5 md:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest text-center shadow-lg transition-all flex items-center justify-center gap-2 ${
                  canSeeFeedback360
                    ? 'bg-black text-white transform active:scale-95'
                    : 'bg-black/10 text-black'
                }`}>
                  {!canSeeFeedback360 && <Lock className="w-4 h-4" />}
                  {canSeeFeedback360 ? 'VYBRAŤ TENTO MÓD' : 'BEZ PRÍSTUPU'}
                </div>
              </button>
              <button
                onClick={() => selectMode('ZAMESTNANECKA_SPOKOJNOST')}
                disabled={!canSeeSatisfaction}
                aria-disabled={!canSeeSatisfaction}
                className={`group p-6 sm:p-8 md:p-10 border-2 border-black/5 rounded-[2rem] md:rounded-[2.5rem] transition-all text-left flex flex-col items-start gap-5 md:gap-6 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9] ${
                  canSeeSatisfaction
                    ? 'hover:border-black hover:bg-black/5'
                    : 'opacity-35 grayscale cursor-not-allowed'
                }`}
              >
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 group-hover:opacity-10 pointer-events-none">
                  <BarChart3 className="w-24 h-24 md:w-32 md:h-32 text-black" />
                </div>
                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg">
                  <BarChart3 className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div className="z-10">
                  <span className="text-[28px] sm:text-[30px] md:text-[32px] font-black block mb-3 md:mb-4 tracking-tight uppercase leading-tight">Analýza spokojnosti zamestnancov</span>
                  <p className="text-black/50 font-bold text-base md:text-lg leading-relaxed max-w-md">Vidieť nálady. Pochopiť súvislosti. Zlepšovať prostredie.</p>
                </div>
                <div className={`z-10 mt-2 md:mt-4 w-full sm:w-auto px-6 sm:px-8 md:px-10 py-3.5 md:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest shadow-lg transition-all text-center flex items-center justify-center gap-2 ${
                  canSeeSatisfaction
                    ? 'bg-brand text-white transform active:scale-95'
                    : 'bg-black/10 text-black'
                }`}>
                  {!canSeeSatisfaction && <Lock className="w-4 h-4" />}
                  {canSeeSatisfaction ? 'VYBRAŤ TENTO MÓD' : 'BEZ PRÍSTUPU'}
                </div>
              </button>
              <div
                aria-disabled={!canSeeTypology}
                className={`group md:col-span-2 p-5 sm:p-6 md:p-7 border-2 border-black/5 rounded-[2rem] md:rounded-[2.25rem] text-left flex flex-col md:flex-row md:items-center gap-5 md:gap-7 shadow-xl shadow-black/5 relative overflow-hidden bg-[#f9f9f9] transition-all ${
                canSeeTypology
                  ? 'hover:border-black hover:bg-black/5'
                  : 'opacity-35 grayscale cursor-not-allowed'
              }`}>
                <div className="absolute top-1/2 right-0 -translate-y-1/2 p-6 md:p-8 opacity-5 group-hover:opacity-10 pointer-events-none">
                  <BrainCircuit className="w-24 h-24 md:w-36 md:h-36 text-black" />
                </div>
                <div className="p-4 md:p-5 bg-black text-white rounded-[1.5rem] md:rounded-[2rem] shadow-lg z-10 shrink-0">
                  <BrainCircuit className="w-8 h-8 md:w-10 md:h-10" />
                </div>
                <div className="z-10 flex-1">
                  <span className="text-[26px] sm:text-[28px] md:text-[32px] font-black block mb-2 md:mb-3 tracking-tight uppercase leading-tight">Test typológie pri vedení ľudí</span>
                  <p className="text-black/50 font-bold text-base md:text-lg leading-relaxed max-w-3xl">Spoznajte, ako sa rozhodujete, komunikujete a reagujete v spolupráci, pod tlakom aj pri zmene.</p>
                </div>
                <div className="z-10 w-full md:w-auto flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (canSeeTypology) setShowTypologyTest(true);
                    }}
                    disabled={!canSeeTypology}
                    className={`px-6 sm:px-8 md:px-10 py-3.5 md:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest text-center whitespace-nowrap flex items-center justify-center gap-2 transition-all ${
                    canSeeTypology ? 'bg-black text-white' : 'bg-black/10 text-black'
                  }`}
                  >
                    {!canSeeTypology && <Lock className="w-4 h-4" />}
                    {canSeeTypology ? 'VYPLNIŤ TEST' : 'BEZ PRÍSTUPU'}
                  </button>
                  {canSeeTypology && isAdminLike && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowTypologyResults(true);
                      }}
                      className="px-6 sm:px-8 md:px-10 py-3.5 md:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest text-center whitespace-nowrap bg-brand text-white hover:bg-black transition-all"
                    >
                      Výsledky
                    </button>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {status === AppStatus.READY_TO_UPLOAD && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow animate-fade-in px-4">
            <button onClick={handleBackToMode} className="mb-10 flex items-center gap-2 text-black/40 font-black uppercase tracking-widest text-xs hover:text-black transition-colors">
              <ChevronLeft className="w-4 h-4" /> Späť na výber módu
            </button>
            <FileUpload onFileSelect={handleFileSelect} isAnalyzing={false} mode={selectedMode} />
          </div>
        )}

        {status === AppStatus.ANALYZING && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow">
            <FileUpload onFileSelect={() => {}} isAnalyzing={true} mode={selectedMode} />
          </div>
        )}

        {status === AppStatus.SUCCESS && result && !showSharedGoodbye && (
          <div className="w-full relative">
            <Suspense
              fallback={
                <div className="w-full py-20 text-center">
                  <p className="text-sm font-bold uppercase tracking-widest text-black/40">
                    Načítavam dashboard...
                  </p>
                </div>
              }
            >
              {/* Vykreslenie Welcome modalu po úspešnom zadaní hesla */}
              {showWelcomeGuide && (
                <WelcomeGuide
                  onClose={() => setShowWelcomeGuide(false)}
                  clientName={publicMeta?.client}
                />
              )}

              {/* Plávajúce tlačidlo pre opätovné otvorenie sprievodcu */}
              {!showWelcomeGuide && (
                <button
                  onClick={() => setShowWelcomeGuide(true)}
                  className="fixed bottom-6 left-6 z-[50] flex items-center gap-2 px-4 py-3 bg-white text-black border border-black/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-black hover:text-white hover:scale-105 transition-all duration-300 group"
                >
                  <Sparkles className="w-4 h-4 text-brand group-hover:text-white transition-colors" />
                  <span className="hidden sm:inline">Sprievodca reportom</span>
                </button>
              )}

              {result.mode === '360_FEEDBACK' ? (
                result.feedback360 ? (
                  <Feedback360Dashboard result={result} onReset={handleReset} />
                ) : (
                  <Dashboard result={result} onReset={handleReset} />
                )
              ) : (
                <SatisfactionDashboard result={result} onReset={handleReset} />
              )}
            </Suspense>
          </div>
        )}

        {status === AppStatus.ERROR && !showSharedGoodbye && (
          <div className="flex flex-col items-center justify-center flex-grow gap-6 text-center px-6">
            <AlertCircle className="w-20 h-20 text-brand" />
            <h3 className="text-3xl font-black uppercase tracking-tighter">Chyba analýzy</h3>
            <p className="text-black/50 font-medium max-w-md">{error}</p>
            <button onClick={handleReset} className="px-12 py-4 bg-black text-white rounded-full font-bold uppercase tracking-widest text-sm">Skúsiť znova</button>
          </div>
        )}

        {status !== AppStatus.SUCCESS && !showSharedGoodbye && (
          <div className="w-full max-w-5xl mx-auto mt-12 md:mt-16 pt-16 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-6 text-black/40 pb-4 px-4 md:px-0 animate-fade-in">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Libellius" className="h-20 md:h-24 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-center md:text-right">
              <p className="text-xs font-bold text-black/60">© {new Date().getFullYear()} Libellius. Všetky práva vyhradené.</p>
            </div>
          </div>
        )}
      </main>
      )}
    </div>
  );
};

export default App;
