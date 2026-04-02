# Vitest Infra + Unit Testy + CI Test Integration

## Čo sa zlepšilo
- Bola zavedená minimálna test infra cez Vitest bez zásahu do business logiky.
- Pribudli prvé deterministické unit testy pre utility a service vrstvu.
- CI bolo rozšírené o automatické spúšťanie unit testov.
- Znížilo sa riziko regresií v kľúčových transformáciách, validáciách a API error handlingu.

## Ktoré hlavné súbory a oblasti sa menili
- Test infra:
  - `Libellius-Insight/package.json` (scripts: `test`, `test:run`)
  - `package-lock.json` (Vitest dependency)
- Nové unit testy:
  - `Libellius-Insight/utils/frequencyDistribution.test.ts`
  - `Libellius-Insight/services/gemini/shared.test.ts`
  - `Libellius-Insight/services/gemini/builders.test.ts`
  - `Libellius-Insight/api/share-report-storage.test.ts`
  - `Libellius-Insight/services/shareService.test.ts`
- CI integrácia testov:
  - `.github/workflows/libellius-ci.yml`

## Čo bolo overené
- `npm run test:run` prechádza (aktuálne 47 testov).
- `npm run build` prechádza po doplnení testov.
- Testy pokrývajú:
  - normalizácie/fallbacky utility funkcií,
  - mapovanie a výstupy builderov,
  - TTL/expiráciu a sanitizáciu v share storage,
  - success/error kontrakty a fallback správy v share service.

## Čo sa dnes automaticky kontroluje v CI
- `npm install`
- `npm run typecheck:strict:core`
- `npm run typecheck:strict:ui:phase1`
- `npm run test:run`
- `npm run build`

## Odporúčané ďalšie kroky podľa priority
1. Doplniť unit testy pre `utils/reportCrypto.ts` (happy path + error path).
2. Pridať testy pre API handlery (`share-report-create.ts`, `share-report-get.ts`) s jednoduchými mockmi request/response.
3. Postupne rozšíriť test coverage pre ďalšie čisté utility a service moduly.
4. Voliteľne doplniť coverage report v CI (najprv informatívne, bez blokovania merge).
