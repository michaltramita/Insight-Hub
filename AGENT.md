# AGENT.md

Tento dokument je pracovný manuál pre AI/coding agentov v repozitári `Insight-Hub`.

## 1. Kontext projektu

- Repo je npm workspace, hlavná aplikácia je v `Libellius-Insight/`.
- Stack:
  - Frontend: React 19 + TypeScript + Vite.
  - Serverless API: Vercel Functions v `Libellius-Insight/api/`.
  - Testy: Vitest.
- Doména:
  - Analýza spokojnosti zamestnancov.
  - Analýza 360° spätnej väzby (MVP).
  - Import dát, vizualizácie, zdieľanie šifrovaných reportov.

## 2. Dôležitá štruktúra

- `Libellius-Insight/App.tsx` - hlavný vstup UI.
- `Libellius-Insight/hooks/useAppWorkflow.ts` - hlavný workflow aplikácie.
- `Libellius-Insight/services/gemini/` - parsing + transformačná logika.
- `Libellius-Insight/services/feedback360Parser.ts` - normalizácia 360 JSON vstupu.
- `Libellius-Insight/services/feedback360Derivations.ts` - odvodené metriky pre 360 dashboard.
- `Libellius-Insight/services/shareService.ts` - klient pre `/api/share-report-*`.
- `Libellius-Insight/api/` - serverless handlery (share create/get, rate limit).
- `Libellius-Insight/utils/` - utility (napr. crypto, distribúcie).
- `Libellius-Insight/components/feedback360/` - nový 360 dashboard (firma + jednotlivec).
- `.github/workflows/libellius-ci.yml` - povinné CI gates.
- `docs/` - interné changelogy a technické poznámky.

## 3. Lokálne príkazy

### Z root priečinka repozitára

```bash
npm install
npm run dev
```

### Priamo v `Libellius-Insight/`

```bash
npm install
npm run dev
npm run test:run
npm run typecheck:strict:core
npm run typecheck:strict:ui:phase1
npm run build
```

## 4. CI definícia kvality (must-pass)

Pred odovzdaním zmien by mal agent spustiť minimálne:

1. `npm run typecheck:strict:core`
2. `npm run typecheck:strict:ui:phase1`
3. `npm run test:run`
4. `npm run build`

Všetko sa spúšťa v `Libellius-Insight/` (rovnako ako v CI).

## 5. Env premenné a tajomstvá

- Požadované pre share API:
  - `BLOB_READ_WRITE_TOKEN`
- Voliteľné:
  - `SHARE_LINK_TTL_DAYS` (default 30, clamp 1-365)
  - `KV_REST_API_URL` + `KV_REST_API_TOKEN`
  - alebo `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`

Pravidlá:

- Nikdy necommituj tajomstvá ani reálne tokeny.
- Neukladaj citlivé dáta do logov alebo test fixture.
- `.env.local` je len lokálny súbor.

## 6. Pravidlá práce pre agenta

1. Rob malé, izolované zmeny bez zbytočného refactoru.
2. Zachovávaj existujúce správanie, ak task výslovne nežiada behavior zmenu.
3. Drž TypeScript striktne typovaný; nepridávaj nové `any`, ak to nie je nevyhnutné.
4. Keď meníš logiku v `api/`, `services/` alebo `utils/`, uprav alebo doplň aj testy.
5. Sleduj existujúce limity a validácie:
   - max upload 12 MB,
   - share payload prefix `v1.`/`v2.`/`v3.`,
   - rate-limit guard v API.
6. Nemeň generované artefakty (`dist/`) manuálne, pokiaľ to task výslovne nevyžaduje.
7. Ak meníš endpoint kontrakt, aktualizuj aj klienta (`services/shareService.ts`) a testy.

## 7. 360 MVP pravidlá

1. 360 mód v tejto verzii podporuje primárne upload `.xlsx`/`.csv` a fallback `.json`.
2. Pri úpravách 360 dát vždy upravuj parser + derivácie + testy spolu:
   - `services/feedback360Parser.ts`
   - `services/feedback360Derivations.ts`
   - `services/feedback360Parser.test.ts`
   - `services/feedback360Derivations.test.ts`
3. UI pre 360 rozdeľuj podľa kontextu:
   - Firma: výsledky, detail, silné/slabé, účastníci
   - Jednotlivec: prehľad, detail, potenciál, plán
4. Pri nekompletných dátach používaj fail-safe fallbacky (prázdne sekcie, nie pád aplikácie).

## 8. Štýl a konzistentnosť

- Rešpektuj existujúci štýl súboru (uvozovky, pomenovanie, formát).
- Uprednostni explicitné, čitateľné typy a malé helper funkcie.
- Používateľské chyby a texty drž v slovenčine, pokiaľ daná časť už nie je v angličtine.
- Pri bezpečnostných alebo dátových validáciách preferuj fail-fast prístup.

## 9. Definition of done

Zmena je hotová, keď:

1. Je implementovaná v správnej vrstve (UI vs. workflow vs. API).
2. Má primerané testy alebo aktualizované existujúce testy.
3. Prejde lokálny build + strict typecheck + unit testy.
4. Neobsahuje tajomstvá, debug zvyšky ani nejasné TODO bez kontextu.
