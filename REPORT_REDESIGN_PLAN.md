# REPORT_REDESIGN_PLAN

## Aktuálny stav (analýza)
1. **Generovanie PDF**: `Libellius-Insight/components/typology/TypologyProfilePreview.tsx`.
   - Report je React/HTML layout.
   - Export prebieha cez `html2canvas` + `jspdf` (nie je to priamy PDF layout engine).
2. **Zdroj textov profilu**: `Libellius-Insight/services/typologyProfile.ts`.
   - Obsahuje texty pre dominantné štýly: summary, prejavy, motivátory, brzdy, komunikácia, leadership focus, strengths, pressure risks, development actions.
   - Obsahuje helper pre kombinovaný summary (`buildCombinationSummary`).
3. **Dátový model účastníka**: `Libellius-Insight/services/typologyTest.ts` (typ `TypologyAdminResult`) + načítanie v `TypologyAdminResultsView.tsx`.
   - Dostupné polia: `fullName`, `companyName`, `userEmail`, `completedAt`, `dominantStyle`, `scores`.
   - Doplnkový štýl sa odvodzuje z ranked skóre (`getRankedTypologyStyles`).
4. **Dizajnové tokeny a print pravidlá**:
   - `tailwind.config.js`: `brand = #B81547`.
   - `styles.css`: globálny font `Inter`, print utility triedy, A4 print margin.
   - Aktuálny report už používa čierny hero, biele karty, brand akcent.

## Cieľ redizajnu
- Zachovať vizuálnu identitu (čierny hero, brand farba, Inter, radius/shadow rytmus).
- Zmeniť štruktúru na jasný **2-stranový leadership report** s vyššou diagnostickou a praktickou hodnotou.
- Nepoužívať hardcoded obsahové texty v prezentačných blokoch; obsah riadiť z konfigurácie.

## Súbory na úpravu
1. `Libellius-Insight/services/typologyProfile.ts`
   - Rozšíriť typy copy konfigurácie o nové bloky (situácie, team impact, action plan položky, coaching question, kombinované insighty, report static copy).
   - Doplniť mapovanie pre kombinácie štýlov (dominantný + doplnkový) s fallback logikou.
   - Pridať helpery na získanie copy pre report sekcie.
2. `Libellius-Insight/components/typology/TypologyProfilePreview.tsx`
   - Prebudovať layout na 2 explicitné stránky (Strana 1: profil a interpretácia, Strana 2: použitie v praxi).
   - Nahradiť monotónne karty novými blokmi: summary statement, fingerprint vizualizácia, kombinovaný interpretačný blok, strength-vs-risk matica, praktické situácie, komunikačný manuál (Robte/Nerobte), team impact, 3 priority akčného plánu, coaching otázka, worksheet.
   - Napojiť všetky obsahové texty na `typologyProfile.ts` helpery.
   - Upraviť PDF export flow pre stabilné 2 strany cez explicitné page sekcie.
3. `Libellius-Insight/styles.css`
   - Doplniť print-safe utility pre explicitné PDF stránky a fixné A4 správanie (bez animácií/interakcie pri exporte).

## Nové/rozšírené konfiguračné polia
V `typologyProfile.ts` rozšíriť copy systém o štruktúry podobné:
- `combinationInsight` (pre dominantný + doplnkový štýl):
  - summarySentence
  - decisionStyle
  - communicationStyle
  - underPressure
- `practicalSituations[]`:
  - situation
  - naturalReaction
  - consciousAdjustment
- `communicationManual`:
  - do[]
  - avoid[]
- `teamImpact`:
  - whenEffective[]
  - underPressure[]
- `developmentPriorities[]`:
  - title
  - behavior
  - situation
  - reflectionQuestion
- `coachingQuestion` (podľa kombinácie s fallbackom)
- `reflectionQuestions[]` (worksheet)
- `profileReadingNote` (footer text)

## Kompatibilita s existujúcim exportom
- Zachovať vstupný typ `TypologyAdminResult` bez zmeny scoring logiky.
- Zachovať existujúci spôsob spustenia preview z `TypologyAdminResultsView`.
- Zachovať `html2canvas + jspdf`, ale export optimalizovať na explicitné page-sections, aby bol výsledok konzistentne 2-stranový.
- Zachovať export menu (PDF/PNG), bezpečné fallback správanie a existujúce error handling hlášky.

## Ako udržíme report vo vizuálnej identite aplikácie
- Zachovať čierny hero charakter, brand akcent `#B81547`, Inter font, zaoblenia, border tón a shadow jazyk.
- Použiť rovnaký typografický rytmus (uppercase eyebrow, heavy headings, neutrálne podtexty).
- Nepoužiť externý template ani nový farebný systém.

## Overenie po implementácii
1. Spustiť:
   - `npm run typecheck:strict:core`
   - `npm run typecheck:strict:ui:phase1`
   - `npm run build`
2. Manuálne preveriť 2-stranový layout s dlhšími hodnotami (meno/firma/email).
3. Overiť, že všetky nové obsahové bloky berú text z `typologyProfile.ts` a nie z hardcoded JSX textov.
