import React, { useState } from "react";
import { KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";

type AuthAccessPanelProps = {
  isLoading: boolean;
  userEmail?: string | null;
  error: string | null;
  onSignIn: (email: string) => Promise<{ error: string | null }>;
  onPasswordSignIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
};

const AuthAccessPanel: React.FC<AuthAccessPanelProps> = ({
  isLoading,
  userEmail,
  error,
  onSignIn,
  onPasswordSignIn,
}) => {
  const [authMode, setAuthMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    const result = await onSignIn(email);
    if (result.error) {
      setFeedback(result.error);
    } else {
      setFeedback("Odkaz na prihlásenie sme odoslali na zadaný email.");
    }

    setIsSubmitting(false);
  };

  const handlePasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    const result = await onPasswordSignIn(email, password);
    if (result.error) {
      setFeedback(result.error);
    }

    setIsSubmitting(false);
  };

  return (
    <section className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(184,21,71,0.08),_transparent_32%),linear-gradient(180deg,#f8f5ef_0%,#ffffff_58%)] flex flex-col">
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-10 items-stretch">
          <div className="rounded-[2.4rem] border border-black/8 bg-white/85 backdrop-blur-sm shadow-[0_32px_120px_-48px_rgba(0,0,0,0.25)] px-7 py-8 md:px-10 md:py-12 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black text-white text-[10px] md:text-xs font-black uppercase tracking-widest">
                <ShieldCheck className="w-3 h-3 md:w-4 md:h-4" />
                Bezpečný vstup
              </div>
              <h1 className="mt-6 text-[clamp(2.4rem,5vw,4.9rem)] font-black tracking-tight leading-[0.95]">
                Vitajte v
                <span className="block text-brand">Libellius InsightHub</span>
              </h1>
              <p className="mt-6 text-black/58 font-semibold text-base md:text-xl max-w-2xl leading-relaxed">
                Prihláste sa do zabezpečeného prostredia, kde nájdete svoje
                dostupné analýzy, reporty a rozvojové dotazníky.
              </p>
            </div>
          </div>
          <div className="rounded-[2.4rem] border border-black/8 bg-white shadow-[0_32px_120px_-48px_rgba(0,0,0,0.25)] px-6 py-7 md:px-8 md:py-9 flex flex-col justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-black/38">
                Prihlásenie
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-black tracking-tight leading-tight">
                {authMode === "password" ? "Admin prihlásenie" : "Pokračujte cez email"}
              </h2>
              <p className="mt-3 text-black/56 font-semibold text-sm md:text-base leading-relaxed">
                {authMode === "password"
                  ? "Zadajte svoj administrátorský email a heslo."
                  : "Zadajte email, ktorý ste použili pri registrácii alebo ktorý vám bol pridelený organizátorom."}
              </p>
            </div>

            <div className="mt-8">
              <div className="mb-5 relative grid grid-cols-2 gap-2 rounded-2xl bg-[#fbfaf7] border border-black/10 p-1 overflow-hidden">
                <div
                  className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-black shadow-lg transition-transform duration-300 ease-out ${
                    authMode === "magic" ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("password");
                    setFeedback(null);
                  }}
                  className={`relative z-10 px-4 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-300 ${
                    authMode === "password"
                      ? "text-white"
                      : "text-black/45 hover:text-black"
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("magic");
                    setFeedback(null);
                  }}
                  className={`relative z-10 px-4 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-300 ${
                    authMode === "magic"
                      ? "text-white"
                      : "text-black/45 hover:text-black"
                  }`}
                >
                  Email odkaz
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-3 text-black/55 font-bold">
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                  Overujem stav prihlásenia...
                </div>
              ) : (
                <div
                  key={authMode}
                  className="animate-[authPanelIn_220ms_ease-out]"
                >
                  {authMode === "password" ? (
                <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor="auth-admin-email"
                      className="block text-[10px] md:text-xs uppercase tracking-widest font-black text-black/45 mb-3"
                    >
                      Emailová adresa
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-black/30 absolute left-5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-admin-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="meno@firma.sk"
                        className="w-full pl-14 pr-5 py-4 md:py-5 rounded-2xl bg-[#fbfaf7] border border-black/10 outline-none focus:ring-2 focus:ring-brand/25 text-base font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="auth-admin-password"
                      className="block text-[10px] md:text-xs uppercase tracking-widest font-black text-black/45 mb-3"
                    >
                      Heslo
                    </label>
                    <div className="relative">
                      <KeyRound className="w-5 h-5 text-black/30 absolute left-5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-admin-password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Zadajte heslo"
                        className="w-full pl-14 pr-5 py-4 md:py-5 rounded-2xl bg-[#fbfaf7] border border-black/10 outline-none focus:ring-2 focus:ring-brand/25 text-base font-semibold"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-7 py-4 md:py-5 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Prihlasujem..." : "Prihlásiť sa"}
                  </button>
                </form>
                  ) : (
                <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-[10px] md:text-xs uppercase tracking-widest font-black text-black/45 mb-3"
                    >
                      Emailová adresa
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-black/30 absolute left-5 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="meno@firma.sk"
                        className="w-full pl-14 pr-5 py-4 md:py-5 rounded-2xl bg-[#fbfaf7] border border-black/10 outline-none focus:ring-2 focus:ring-brand/25 text-base font-semibold"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-7 py-4 md:py-5 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Odosielam..." : "Poslať prihlasovací odkaz"}
                  </button>
                </form>
                  )}
                </div>
              )}

              {(feedback || error) && (
                <p className="mt-4 text-sm font-bold text-brand">{feedback || error}</p>
              )}

              {userEmail && (
                <p className="mt-4 text-sm font-bold text-black/45 break-all">{userEmail}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <footer className="w-full max-w-5xl mx-auto mt-auto pt-8 md:pt-10 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-6 text-black/40 pb-6 px-4 md:px-0">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Libellius"
            className="h-16 md:h-20 w-auto object-contain opacity-80"
          />
        </div>
        <div className="text-center md:text-right">
          <p className="text-xs font-bold text-black/60">
            © {new Date().getFullYear()} Libellius. Všetky práva vyhradené.
          </p>
        </div>
      </footer>
    </section>
  );
};

export default AuthAccessPanel;
