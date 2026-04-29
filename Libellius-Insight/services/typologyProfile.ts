import type { TypologyStyleCode } from "./typologyTest";

export type TypologyProfileContent = {
  code: TypologyStyleCode;
  label: string;
  name: string;
  title: string;
  summary: string;
  manifests: string[];
  drivers: string[];
  blockers: string[];
  communication: string[];
  leadershipFocus: string[];
  strengths: string[];
  pressureRisks: string[];
  developmentActions: string[];
};

export type RankedTypologyStyle = {
  code: TypologyStyleCode;
  score: number;
  rank: number;
  percentage: number;
  content: TypologyProfileContent;
};

export const TYPOLOGY_MAX_SCORE = 96;

export const TYPOLOGY_PROFILE_CONTENT: Record<
  TypologyStyleCode,
  TypologyProfileContent
> = {
  a: {
    code: "a",
    label: "A",
    name: "Pôsobivý štýl",
    title: "Energický komunikátor a tvorca zapojenia",
    summary:
      "Tento štýl prináša do tímu energiu, nápady a schopnosť prirodzene zapájať ľudí. Človek s týmto profilom často pracuje cez nadšenie, vzťah a schopnosť presvedčiť ostatných.",
    manifests: [
      "pôsobí otvorene, spontánne a komunikatívne",
      "rýchlo sa nadchne pre nové témy a možnosti",
      "prirodzene vplýva na atmosféru v skupine",
      "má tendenciu hovoriť vo víziách, príbehoch a možnostiach",
    ],
    drivers: [
      "uznanie a spätná väzba",
      "kontakt s ľuďmi",
      "nové podnety a zaujímavé výzvy",
    ],
    blockers: [
      "preskakovanie detailov",
      "strata fokusu pri dlhých alebo rutinných úlohách",
      "sľuby, ktoré môžu byť väčšie než reálna kapacita",
    ],
    communication: [
      "dajte priestor hovoriť a rozvíjať nápady",
      "oceňte energiu, iniciatívu a kreativitu",
      "detaily prinášajte postupne a v jasnej štruktúre",
      "komunikujte živo, ale vecne",
    ],
    leadershipFocus: [
      "dotiahnuť veci do konca",
      "pracovať s prioritami a detailmi",
      "dávať priestor aj tichším členom tímu",
    ],
    strengths: [
      "motivuje ľudí cez energiu a nadšenie",
      "vie pomenovať príležitosť zrozumiteľným jazykom",
      "ľahko vytvára kontakt a psychologické zapojenie",
    ],
    pressureRisks: [
      "môže zrýchľovať skôr, než je dohoda jasná",
      "môže podceniť praktické obmedzenia",
      "pri odpore môže skákať do ďalších nápadov namiesto doťahovania",
    ],
    developmentActions: [
      "pred novým záväzkom si overte kapacitu a konkrétny ďalší krok",
      "pri dôležitých témach si zapisujte dohody, vlastníkov a termíny",
      "vedome prizvite do diskusie človeka, ktorý hovorí menej",
    ],
  },
  b: {
    code: "b",
    label: "B",
    name: "Vedúci štýl",
    title: "Rozhodný líder orientovaný na výsledok",
    summary:
      "Tento štýl prináša jasnosť, tempo a schopnosť preberať iniciatívu. Človek s týmto profilom rád posúva veci dopredu, pomenúva cieľ a očakáva konkrétny výsledok.",
    manifests: [
      "pôsobí priamo, rozhodne a cieľavedome",
      "rýchlo preberá iniciatívu",
      "vyhľadáva výzvy, súťaž a zodpovednosť",
      "preferuje efektivitu a jasné rozhodnutia",
    ],
    drivers: [
      "dosahovanie cieľov",
      "výzvy a merateľné výsledky",
      "možnosť ovplyvniť smer a rozhodnutia",
    ],
    blockers: [
      "prílišná priamosť",
      "prehliadanie dopadu na ľudí",
      "tlak na rýchlosť aj tam, kde tím potrebuje čas",
    ],
    communication: [
      "choďte rýchlo k podstate",
      "ukážte výsledok, prínos a riziká",
      "buďte pripravení, konkrétni a vecní",
      "nechajte priestor na rozhodnutie a voľbu",
    ],
    leadershipFocus: [
      "vnímať dopad rozhodnutí na ľudí",
      "počúvať pred tým, než príde záver",
      "spomaliť v situáciách, ktoré vyžadujú zapojenie tímu",
    ],
    strengths: [
      "vie vytvoriť smer a posunúť tím do akcie",
      "vnáša rozhodnosť do nejasných situácií",
      "drží pozornosť na výsledku a zodpovednosti",
    ],
    pressureRisks: [
      "môže tlačiť viac, než je tím schopný uniesť",
      "môže zameniť rýchlosť za kvalitu dohody",
      "pri odpore môže pôsobiť konfrontačne",
    ],
    developmentActions: [
      "pred rozhodnutím sa opýtajte aspoň dve doplňujúce otázky",
      "pri zadávaní úloh pomenujte nielen cieľ, ale aj dôvod",
      "pri spätnej väzbe oddeľte vecný výkon od hodnotenia človeka",
    ],
  },
  c: {
    code: "c",
    label: "C",
    name: "Analytický štýl",
    title: "Systematický tvorca kvality a istoty",
    summary:
      "Tento štýl prináša presnosť, štruktúru a schopnosť premýšľať do hĺbky. Človek s týmto profilom sa opiera o fakty, kvalitu a premyslený postup.",
    manifests: [
      "pôsobí premýšľavo, pokojne a systematicky",
      "pracuje s faktami, dátami a overenými informáciami",
      "dbá na kvalitu, presnosť a logiku",
      "rozhoduje sa až po vyhodnotení podstatných súvislostí",
    ],
    drivers: [
      "presnosť a kvalita",
      "logika a fakty",
      "istota, poriadok a predvídateľnosť",
    ],
    blockers: [
      "zaseknutie v analýze",
      "odkladanie rozhodnutí",
      "rezervované pôsobenie navonok",
    ],
    communication: [
      "prineste fakty, kontext a presné zadanie",
      "dajte čas na premyslenie",
      "buďte konkrétni a konzistentní",
      "nevytvárajte zbytočný tlak bez vysvetlenia dôvodu",
    ],
    leadershipFocus: [
      "nečakať vždy na dokonalosť",
      "komunikovať závery skôr a častejšie",
      "prijímať aj rozhodnutia s primeranou mierou neistoty",
    ],
    strengths: [
      "zvyšuje kvalitu rozhodnutí a riešení",
      "odhaľuje riziká, ktoré by tím mohol prehliadnuť",
      "prináša štruktúru do zložitých tém",
    ],
    pressureRisks: [
      "môže príliš spomaľovať tempo",
      "môže komunikovať málo, kým nemá istotu",
      "pri nejasnosti môže hľadať ďalšie dáta namiesto rozhodnutia",
    ],
    developmentActions: [
      "nastavte si hranicu, koľko informácií stačí na rozhodnutie",
      "zdieľajte priebežné závery aj vtedy, keď ešte nie sú finálne",
      "rozlišujte medzi rizikom, ktoré treba riešiť, a detailom, ktorý môže počkať",
    ],
  },
  d: {
    code: "d",
    label: "D",
    name: "Priateľský štýl",
    title: "Pokojný podporovateľ tímovej stability",
    summary:
      "Tento štýl prináša empatiu, trpezlivosť a cit pre vzťahy. Človek s týmto profilom prirodzene podporuje spoluprácu, bezpečnú atmosféru a stabilitu v tíme.",
    manifests: [
      "pôsobí pokojne, vnímavo a podporujúco",
      "dbá na atmosféru, vzťahy a spoluprácu",
      "rád pomáha druhým a hľadá súlad",
      "preferuje stabilitu a postupné zmeny",
    ],
    drivers: [
      "dobré vzťahy",
      "istota a stabilita",
      "spolupráca a vzájomná podpora",
    ],
    blockers: [
      "vyhýbanie sa konfliktom",
      "ťažšie rozhodovanie v napätí",
      "potláčanie vlastného názoru",
    ],
    communication: [
      "vytvorte bezpečný a rešpektujúci priestor",
      "dajte čas na vyjadrenie názoru",
      "buďte citliví, ale úprimní",
      "zapájajte do dohody a vysvetlite dopad zmeny",
    ],
    leadershipFocus: [
      "povedať aj nepríjemné veci",
      "prebrať rozhodnutie aj pri neistote",
      "nastavovať jasné hranice a očakávania",
    ],
    strengths: [
      "buduje dôveru a stabilnú atmosféru",
      "vníma ľudí, ktorí by inak zostali bokom",
      "pomáha tímu spolupracovať bez zbytočného napätia",
    ],
    pressureRisks: [
      "môže odkladať náročný rozhovor",
      "môže uprednostniť pokoj pred jasnosťou",
      "pri tlaku môže ustúpiť viac, než je užitočné",
    ],
    developmentActions: [
      "pomenujte vlastný názor skôr, než začnete hľadať kompromis",
      "pri nejasnej dohode explicitne určte hranicu, vlastníka a termín",
      "v konfliktných témach oddeľte rešpekt k človeku od potreby jasného rozhodnutia",
    ],
  },
};

export const getRankedTypologyStyles = (
  scores: Record<TypologyStyleCode, number>
): RankedTypologyStyle[] => {
  return (Object.entries(scores) as Array<[TypologyStyleCode, number]>)
    .map(([code, score]) => ({
      code,
      score,
      percentage: Math.min(100, Math.round((score / TYPOLOGY_MAX_SCORE) * 100)),
      content: TYPOLOGY_PROFILE_CONTENT[code],
    }))
    .sort((left, right) => right.score - left.score)
    .map((style, index) => ({
      ...style,
      rank: index + 1,
    }));
};

export const buildCombinationSummary = (
  primary: RankedTypologyStyle,
  secondary: RankedTypologyStyle | null
) => {
  if (!secondary) {
    return `Najvýraznejšie sa prejavuje ${primary.content.name.toLowerCase()}. Profil preto čítajte najmä cez jeho silné stránky, riziká pod tlakom a odporúčania pre líderskú prax.`;
  }

  return `Najvýraznejšie sa prejavuje ${primary.content.name.toLowerCase()}, ktorý dopĺňa ${secondary.content.name.toLowerCase()}. Prvý štýl ukazuje prirodzený spôsob fungovania, druhý často vysvetľuje, ako sa tento prejav mení v práci s ľuďmi, rozhodovaní a pod tlakom.`;
};
