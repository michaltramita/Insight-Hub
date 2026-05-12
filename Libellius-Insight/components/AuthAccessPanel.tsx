import React, { useState } from "react";
import { KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";

type AuthAccessPanelProps = {
  isLoading: boolean;
  userEmail?: string | null;
  error: string | null;
  onPasswordSignIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
};

const AuthAccessPanel: React.FC<AuthAccessPanelProps> = ({
  isLoading,
  userEmail,
  error,
  onPasswordSignIn,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <div className="rounded-[2.4rem] border border-black/8 bg-white/85 backdrop-blur-sm shadow-[0_32px_120px_-48px_rgba(0,0,0,0.25)] px-7 py-10 md:px-10 md:py-16 flex flex-col">
            <div className="flex min-h-full flex-1 flex-col justify-center">
              <div className="self-start inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-white text-[10px] md:text-xs font-black uppercase tracking-[0.18em] shadow-[0_14px_32px_-22px_rgba(0,0,0,0.55)]">
                <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                <span className="whitespace-nowrap">Rozvoj začína porozumením</span>
              </div>
              <h1 className="mt-10 md:mt-12 text-[3rem] sm:text-[4.15rem] lg:text-[5.25rem] font-black tracking-tight leading-[0.95]">
                Vitajte v
                <span className="block text-brand">Libellius InsightHub</span>
              </h1>
              <p className="mt-8 md:mt-10 text-black/68 font-bold text-lg md:text-2xl max-w-3xl leading-relaxed">
                Miesto, kde sa dáta menia na jasné súvislosti, praktické
                odporúčania a lepšie rozhodnutia pre rozvoj ľudí aj tímov.
              </p>
            </div>
          </div>
          <div className="rounded-[2.4rem] border border-black/8 bg-white shadow-[0_32px_120px_-48px_rgba(0,0,0,0.25)] px-6 py-7 md:px-8 md:py-9 flex flex-col justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-black/38">
                Vstup do platformy
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-black tracking-tight leading-tight">
                Vstúpte do svojho InsightHubu
              </h2>
              <p className="mt-3 text-black/56 font-semibold text-sm md:text-base leading-relaxed">
                Prihláste sa a pokračujte v analýzach alebo výstupoch, ktoré
                boli pripravené pre vás alebo vašu organizáciu.
              </p>
            </div>

            <div className="mt-8">
              {isLoading ? (
                <div className="flex items-center gap-3 text-black/55 font-bold">
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                  Pripravujeme váš priestor...
                </div>
              ) : (
                <form
                  onSubmit={handlePasswordSignIn}
                  className="flex flex-col gap-4 animate-[authPanelIn_220ms_ease-out]"
                >
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
                        placeholder="Zadajte svoje heslo"
                        className="w-full pl-14 pr-5 py-4 md:py-5 rounded-2xl bg-[#fbfaf7] border border-black/10 outline-none focus:ring-2 focus:ring-brand/25 text-base font-semibold"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-7 py-4 md:py-5 rounded-2xl bg-black text-white font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Prihlasujeme vás..." : "Vstúpiť do InsightHubu"}
                  </button>
                </form>
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
