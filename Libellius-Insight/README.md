# Libellius InsightHub

Frontend aplikácia pre:

- analýzu spokojnosti zamestnancov,
- analýzu 360° spätnej väzby,
- bezpečné zdieľanie reportov cez šifrované odkazy.

## Režimy aplikácie

1. `ZAMESTNANECKA_SPOKOJNOST`
  - upload: `.xlsx`, `.csv`, `.json` (príp. existujúce PDF workflow podľa historických dát)
  - dashboard: sekcie zapojenia, otvorené otázky, oblasti, odporúčania

2. `360_FEEDBACK` (v1)
  - upload: primárne `.xlsx` / `.csv`, fallback `.json`
  - dashboard: firemný pohľad + individuálny pohľad, vrátane detailu kompetencií, potenciálu a plánu implementácie

## Lokálne spustenie

Prerequisites:

- Node.js 20+

Spustenie z `Libellius-Insight/`:

```bash
npm install
npm run dev
```

Ak budete zapájať Supabase autentifikáciu, vytvorte si aj `.env.local`:

```bash
cp .env.example .env.local
```

Alternatívne z root workspace:

```bash
npm install
npm run dev
```

## Quality gates (lokálne aj CI)

Pred odovzdaním zmien:

```bash
npm run typecheck:strict:core
npm run typecheck:strict:ui:phase1
npm run test:run
npm run build
```

## 360 JSON fallback formát (v1)

Aplikácia akceptuje:

1. normalizovaný wrapper:
```json
{
  "mode": "360_FEEDBACK",
  "reportMetadata": { "date": "2026-04-10", "company": "Firma", "scaleMax": 6 },
  "feedback360": {
    "companyName": "Firma",
    "surveyName": "360 spätná väzba",
    "scaleMax": 6,
    "companyReport": { "respondentCounts": { "subordinate": 10, "manager": 3, "peer": 8 } },
    "individuals": []
  }
}
```

2. top-level variant:
```json
{
  "reportMetadata": { "date": "2026-04-10", "company": "Firma" },
  "companyName": "Firma",
  "surveyName": "360 spätná väzba",
  "companyReport": {},
  "individuals": []
}
```

3. legacy variant:
```json
{
  "mode": "360_FEEDBACK",
  "reportMetadata": { "date": "2026-04-10", "company": "Firma", "scaleMax": 6 },
  "employees": []
}
```

Parser zabezpečuje normalizáciu/fallbacky v:

- `services/feedback360Parser.ts`
- `services/feedback360Derivations.ts`

## Share API env premenné

Pre serverless share endpointy:

- povinné: `BLOB_READ_WRITE_TOKEN`
- voliteľné:
  - `SHARE_LINK_TTL_DAYS`
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
  - alebo `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

## Supabase env premenné

Pre pripravovanú login/databázovú vrstvu vo fronte:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Browser klient je pripravený v:

- `lib/supabase.ts`
