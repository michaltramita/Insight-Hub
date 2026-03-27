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

const readApiError = async (response: Response, fallbackMessage: string) => {
  try {
    const parsed = await response.json();
    if (parsed?.error && typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Ignorujeme parse chybu a použijeme fallback.
  }
  return fallbackMessage;
};

export const createSharedReport = async (
  encryptedPayload: string,
  publicMeta: SharedReportPublicMeta
) => {
  const response = await fetch('/api/share-report-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    throw new Error(error);
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
    throw new Error(error);
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
