import { useEffect, useState } from "react";
import { AppStatus, FeedbackAnalysisResult, AnalysisMode } from "../types";
import { decryptReportFromUrlPayload } from "../utils/reportCrypto";
import { resolveSharedReport } from "../services/shareService";

const MAX_UPLOAD_SIZE_BYTES = 12 * 1024 * 1024;

const extractShareIdFromPathname = (pathname: string): string | null => {
  const match = String(pathname || "").match(/\/r\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const stripSharePathSegment = (pathname: string) => {
  const sanitized = String(pathname || "").replace(/\/r\/[^/?#]+\/?$/, "");
  return sanitized.length > 0 ? sanitized : "/";
};

const hasShareEntryInWindow = () => {
  if (typeof window === "undefined") return false;
  return (
    extractShareIdFromPathname(window.location.pathname) !== null ||
    window.location.hash.includes("report=")
  );
};

type PublicMeta = {
  client?: string;
  survey?: string;
  issued?: string;
};

export const useAppWorkflow = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.HOME);
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(null);
  const [result, setResult] = useState<FeedbackAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState<boolean>(false);

  const [pendingEncryptedPayload, setPendingEncryptedPayload] = useState<string | null>(null);
  const [sharePassword, setSharePassword] = useState<string>("");
  const [shareDecryptError, setShareDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);

  const [showSharedGoodbye, setShowSharedGoodbye] = useState<boolean>(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState<boolean>(false);
  const [isResolvingSharedEntry, setIsResolvingSharedEntry] = useState<boolean>(
    () => hasShareEntryInWindow()
  );

  const [publicMeta, setPublicMeta] = useState<PublicMeta | null>(null);

  useEffect(() => {
    const handleUrlData = () => {
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      const shareIdFromPath = extractShareIdFromPathname(pathname);
      const hasHashReport = !!hash && hash.includes("report=");

      // KONTROLA REFRESHU: Ak nie je hash, pozrieme sa, či nemáme v pamäti uložené zobrazenie podakovania
      if (!hasHashReport && !shareIdFromPath) {
        setIsResolvingSharedEntry(false);
        const shouldShowGoodbye = sessionStorage.getItem("libellius_show_goodbye");
        if (shouldShowGoodbye === "true") {
          setShowSharedGoodbye(true);
          setStatus(AppStatus.HOME);
          return;
        }
      }

      if (shareIdFromPath) {
        setIsResolvingSharedEntry(true);
        sessionStorage.removeItem("libellius_show_goodbye");
        void (async () => {
          try {
            const resolved = await resolveSharedReport(shareIdFromPath);
            const meta = resolved.publicMeta || {};

            setPublicMeta({
              client: typeof meta.client === "string" ? meta.client : undefined,
              survey: typeof meta.survey === "string" ? meta.survey : undefined,
              issued: typeof meta.issued === "string" ? meta.issued : undefined,
            });

            setPendingEncryptedPayload(resolved.encryptedPayload);
            setShareDecryptError(null);
            setSharePassword("");
            setResult(null);
            setShowSharedGoodbye(false);
            setStatus(AppStatus.HOME);
          } catch (e: any) {
            console.error("Chyba pri načítaní short-link reportu", e);
            setShareDecryptError(e?.message || "Link reportu sa nepodarilo načítať.");
            setPendingEncryptedPayload(null);
            setShowSharedGoodbye(false);
            setPublicMeta(null);
            setResult(null);
            setStatus(AppStatus.HOME);
          } finally {
            setIsResolvingSharedEntry(false);
          }
        })();
        return;
      }

      if (hasHashReport) {
        try {
          setIsResolvingSharedEntry(true);
          sessionStorage.removeItem("libellius_show_goodbye");

          const raw = hash.slice(1);
          const params = new URLSearchParams(raw);
          const payload = params.get("report");
          const client = params.get("client") || params.get("company");
          const survey = params.get("survey") || params.get("surveyName");
          const issued = params.get("issued");

          if (!payload) throw new Error("Chýba payload reportu.");

          setPublicMeta({
            client: client || undefined,
            survey: survey || undefined,
            issued: issued || undefined,
          });

          if (
            payload.startsWith("v1.") ||
            payload.startsWith("v2.") ||
            payload.startsWith("v3.")
          ) {
            setPendingEncryptedPayload(payload);
            setShareDecryptError(null);
            setSharePassword("");
            setResult(null);
            setShowSharedGoodbye(false);
            setStatus(AppStatus.HOME);
            return;
          }

          throw new Error(
            "Tento zdieľaný link používa starý formát. Vygenerujte prosím nový zabezpečený link reportu."
          );
        } catch (e) {
          console.error("Chyba linku", e);
          setShareDecryptError(
            e instanceof Error ? e.message : "Link reportu sa nepodarilo načítať."
          );
          setPendingEncryptedPayload(null);
          setShowSharedGoodbye(false);
          setPublicMeta(null);
          setStatus(AppStatus.HOME);
        } finally {
          setIsResolvingSharedEntry(false);
        }
      }
    };

    handleUrlData();
    window.addEventListener("hashchange", handleUrlData);
    window.addEventListener("popstate", handleUrlData);

    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        try {
          const hasKey = await aistudio.hasSelectedApiKey();
          if (!hasKey) setNeedsKey(true);
        } catch (e) {
          console.debug(e);
        }
      }
    };

    checkKey();
    return () => {
      window.removeEventListener("hashchange", handleUrlData);
      window.removeEventListener("popstate", handleUrlData);
    };
  }, []);

  const handleOpenKeyDialog = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setNeedsKey(false);
    }
  };

  const handleDecryptSharedReport = async () => {
    if (!pendingEncryptedPayload) return;
    setIsDecrypting(true);
    setShareDecryptError(null);

    try {
      const jsonData: any = await decryptReportFromUrlPayload(
        pendingEncryptedPayload,
        sharePassword.trim()
      );
      if (!jsonData.mode) {
        jsonData.mode = jsonData.satisfaction
          ? "ZAMESTNANECKA_SPOKOJNOST"
          : "360_FEEDBACK";
      }
      setResult(jsonData);
      setPendingEncryptedPayload(null);
      setShowSharedGoodbye(false);
      setStatus(AppStatus.SUCCESS);

      // Ukážeme sprievodcu po úspešnom zadaní hesla
      setShowWelcomeGuide(true);
    } catch (err: any) {
      setShareDecryptError(err?.message || "Nepodarilo sa odomknúť report.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const selectMode = (mode: AnalysisMode) => {
    sessionStorage.removeItem("libellius_show_goodbye");
    setShowSharedGoodbye(false);
    setSelectedMode(mode);
    setStatus(AppStatus.READY_TO_UPLOAD);
  };

  const handleFileSelect = async (file: File) => {
    if (!selectedMode) return;
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".xls")) {
      setError("Starý formát .xls už nepodporujeme. Uložte súbor ako .xlsx alebo .csv.");
      setStatus(AppStatus.ERROR);
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError("Súbor je príliš veľký. Maximálna veľkosť je 12 MB.");
      setStatus(AppStatus.ERROR);
      return;
    }

    if (fileName.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          if (!jsonData || typeof jsonData !== "object" || Array.isArray(jsonData)) {
            throw new Error("Neplatná štruktúra JSON reportu.");
          }

          const hasKnownReportShape =
            "mode" in jsonData || "satisfaction" in jsonData || "employees" in jsonData;
          if (!hasKnownReportShape) {
            throw new Error("JSON neobsahuje podporovaný formát reportu.");
          }

          sessionStorage.removeItem("libellius_show_goodbye");
          setShowSharedGoodbye(false);
          setResult(jsonData);
          setStatus(AppStatus.SUCCESS);
        } catch (err: any) {
          setError(err?.message || "Chybný formát JSON.");
          setStatus(AppStatus.ERROR);
        }
      };
      reader.readAsText(file);
      return;
    }

    setStatus(AppStatus.ANALYZING);
    setError(null);

    try {
      const { analyzeDocument, fileToBase64, parseExcelFile } = await import(
        "../services/geminiService"
      );
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".csv");
      const processedData = isExcel
        ? await parseExcelFile(file)
        : await fileToBase64(file);
      const data = await analyzeDocument(processedData, selectedMode, isExcel, file.name);

      if (!data || (!data.employees && !data.satisfaction)) {
        throw new Error("Nepodarilo sa extrahovať dáta.");
      }

      sessionStorage.removeItem("libellius_show_goodbye");
      setShowSharedGoodbye(false);
      setResult(data);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || "Chyba spracovania.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReset = () => {
    const hasHashSharedLink =
      typeof window !== "undefined" && window.location.hash.includes("report=");
    const hasPathSharedLink =
      typeof window !== "undefined" &&
      extractShareIdFromPathname(window.location.pathname) !== null;
    const isSharedLink = hasHashSharedLink || hasPathSharedLink;

    window.location.hash = "";
    if (hasPathSharedLink) {
      const basePath = stripSharePathSegment(window.location.pathname);
      window.history.replaceState({}, "", basePath);
    }
    setResult(null);
    setSelectedMode(null);
    setError(null);
    setPendingEncryptedPayload(null);
    setSharePassword("");
    setShareDecryptError(null);
    setIsDecrypting(false);
    setPublicMeta(null);
    setShowWelcomeGuide(false);

    if (isSharedLink) {
      sessionStorage.setItem("libellius_show_goodbye", "true");
      setShowSharedGoodbye(true);
      setStatus(AppStatus.HOME);
      return;
    }

    sessionStorage.removeItem("libellius_show_goodbye");
    setShowSharedGoodbye(false);
    setStatus(AppStatus.HOME);
  };

  const handleBackToMode = () => {
    sessionStorage.removeItem("libellius_show_goodbye");
    setShowSharedGoodbye(false);
    setStatus(AppStatus.HOME);
    setSelectedMode(null);
  };

  const cancelPendingSharedReport = () => {
    window.location.hash = "";
    const shareIdFromPath = extractShareIdFromPathname(window.location.pathname);
    if (shareIdFromPath) {
      const basePath = stripSharePathSegment(window.location.pathname);
      window.history.replaceState({}, "", basePath);
    }
    setPendingEncryptedPayload(null);
    setSharePassword("");
    setShareDecryptError(null);
    setPublicMeta(null);
    setStatus(AppStatus.HOME);
  };

  const shouldShowSharedLoading =
    isResolvingSharedEntry &&
    !pendingEncryptedPayload &&
    status !== AppStatus.SUCCESS &&
    !showSharedGoodbye;

  return {
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
  };
};
