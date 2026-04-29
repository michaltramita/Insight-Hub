import { getSupabaseBrowserClient, hasSupabaseEnv } from "../lib/supabase";

export interface SharedReportPublicMeta {
  client?: string;
  survey?: string;
  issued?: string;
}

interface CreateShareResponse {
  shareId: string;
}

interface ResolveShareResponse {
  encryptedPayload: string;
  publicMeta?: SharedReportPublicMeta;
}

type ShareServiceError = Error & { status?: number };

const readApiError = async (response: Response, fallbackMessage: string) => {
  try {
    const parsed = await response.json();
    const error =
      parsed?.error && typeof parsed.error === 'string' ? parsed.error : null;
    const details =
      parsed?.details && typeof parsed.details === 'string'
        ? parsed.details
        : null;

    if (error && details) {
      return `${error} ${details}`;
    }
    if (error) return error;
    if (details) return details;
  } catch {
    // Ignorujeme parse chybu a použijeme fallback.
  }
  return fallbackMessage;
};

export const createSharedReport = async (
  encryptedPayload: string,
  publicMeta: SharedReportPublicMeta
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (hasSupabaseEnv()) {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error('Pre vytvorenie zdieľaného odkazu sa prihláste.');
    }

    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch('/api/share-report-create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      encryptedPayload,
      publicMeta,
    }),
  });

  if (!response.ok) {
    const error = await readApiError(
      response,
      'Nepodarilo sa vytvoriť zdieľaný odkaz.'
    );
    const enrichedError = new Error(error) as ShareServiceError;
    enrichedError.status = response.status;
    throw enrichedError;
  }

  const parsed = (await response.json()) as CreateShareResponse;
  if (!parsed?.shareId || typeof parsed.shareId !== 'string') {
    throw new Error('Server nevrátil platné ID zdieľania.');
  }

  return parsed;
};

export const resolveSharedReport = async (shareId: string) => {
  const response = await fetch(
    `/api/share-report-get?id=${encodeURIComponent(shareId)}`,
    {
      method: 'GET',
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const error = await readApiError(
      response,
      'Link reportu sa nepodarilo načítať.'
    );
    const enrichedError = new Error(error) as ShareServiceError;
    enrichedError.status = response.status;
    throw enrichedError;
  }

  const parsed = (await response.json()) as ResolveShareResponse;
  if (
    !parsed?.encryptedPayload ||
    typeof parsed.encryptedPayload !== 'string'
  ) {
    throw new Error('V zdieľanom reporte chýba šifrovaný payload.');
  }

  return parsed;
};
