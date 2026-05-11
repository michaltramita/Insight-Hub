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
      "Pôsobím energicky, komunikatívne a nadšene",
      "Rád zapájam ľudí a prinášam nové nápady",
      "Rýchlo sa nadchnem pre nové veci",
      "Prirodzene ovplyvňujem ostatných",
    ],
    drivers: [
      "Uznanie a spätná väzba",
      "Kontakt s ľuďmi",
      "Nové podnety a zaujímavé výzvy",
    ],
    blockers: [
      "Môžem preskakovať detaily",
      "Môžem strácať fokus",
      "Niekedy sľúbim viac, než viem splniť",
    ],
    communication: [
      "Daj mi priestor hovoriť a rozvíjať nápady",
      "Oceň moju energiu, iniciatívu a kreativitu",
      "Nezahlcuj ma detailmi hneď na začiatku",
      "Komunikuj energicky a vecne",
    ],
    leadershipFocus: [
      "Dotiahni veci do konca",
      "Nezabúdaj na detaily",
      "Dávaj priestor aj tichším členom tímu",
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
      "Pred novým záväzkom si over kapacitu a konkrétny ďalší krok",
      "Pri dôležitých témach si zapisuj dohody, vlastníkov a termíny",
      "Vedome prizvi do diskusie človeka, ktorý hovorí menej",
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
      "Som rozhodný, priamy a orientovaný na výsledok",
      "Rád preberám iniciatívu",
      "Konám rýchlo a efektívne",
      "Nebojím sa výziev",
    ],
    drivers: [
      "Dosahovanie cieľov",
      "Výzvy a merateľné výsledky",
      "Možnosť ovplyvniť smer a rozhodnutia",
    ],
    blockers: [
      "Môžem pôsobiť príliš priamo",
      "Môžem prehliadať ľudí",
      "Môžem tlačiť na rýchlosť aj tam, kde tím potrebuje čas",
    ],
    communication: [
      "Choď rýchlo k podstate",
      "Ukáž mi výsledok, prínos a riziká",
      "Daj mi priestor rozhodovať",
      "Buď pripravený a konkrétny",
    ],
    leadershipFocus: [
      "Vnímaj dopad rozhodnutí na ľudí",
      "Počúvaj, nie len rozhoduj",
      "Spomaľ v situáciách, ktoré vyžadujú zapojenie tímu",
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
      "Pred rozhodnutím sa opýtaj aspoň dve doplňujúce otázky",
      "Pri zadávaní úloh pomenuj nielen cieľ, ale aj dôvod",
      "Pri spätnej väzbe oddeľ vecný výkon od hodnotenia človeka",
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
      "Som systematický a premýšľavý",
      "Rád pracujem s dátami a faktami",
      "Rozhodujem sa premyslene",
      "Dbám na kvalitu",
    ],
    drivers: [
      "Presnosť a kvalita",
      "Logika a fakty",
      "Istota, poriadok a predvídateľnosť",
    ],
    blockers: [
      "Môžem sa zaseknúť v analýze",
      "Môžem odkladať rozhodnutia",
      "Môžem pôsobiť rezervovane",
    ],
    communication: [
      "Priprav si fakty, kontext a presné zadanie",
      "Daj mi čas na premyslenie",
      "Buď konkrétny a konzistentný",
      "Nevytváraj na mňa zbytočný tlak bez vysvetlenia dôvodu",
    ],
    leadershipFocus: [
      "Nečakaj vždy na dokonalosť",
      "Komunikuj závery skôr a častejšie",
      "Prijímaj aj rozhodnutia s primeranou mierou neistoty",
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
      "Nastav si hranicu, koľko informácií stačí na rozhodnutie.",
      "Zdieľaj priebežné závery aj vtedy, keď ešte nie sú finálne.",
      "Rozlišuj medzi rizikom, ktoré treba riešiť, a detailom, ktorý môže počkať.",
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
      "Som pokojný a empatický",
      "Dbám na vzťahy a atmosféru",
      "Rád pomáham druhým",
      "Preferujem stabilitu",
    ],
    drivers: [
      "Dobré vzťahy",
      "Istota a stabilita",
      "Spolupráca a vzájomná podpora",
    ],
    blockers: [
      "Vyhýbam sa konfliktom",
      "Ťažšie sa rozhodujem v napätí",
      "Môžem potláčať vlastný názor",
    ],
    communication: [
      "Vytvor bezpečný a rešpektujúci priestor",
      "Daj mi čas na vyjadrenie názoru",
      "Buď citlivý, ale úprimný",
      "Zapájaj ma",
    ],
    leadershipFocus: [
      "Neboj sa povedať aj nepríjemné veci",
      "Preber zodpovednosť za rozhodnutie aj pri neistote",
      "Nastav jasné hranice a očakávania",
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
      "Pomenuj vlastný názor skôr, než začneš hľadať kompromis",
      "Pri nejasnej dohode explicitne urč hranicu, vlastníka a termín",
      "V konfliktných témach oddeľ rešpekt k človeku od potreby jasného rozhodnutia",
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

  return `Dominantný štýl ${primary.content.name.toLowerCase()} ukazuje váš prirodzený spôsob fungovania, sekundárny štýl ${secondary.content.name.toLowerCase()} ho dopĺňa a pomáha lepšie pochopiť, ako sa prejavujete v rôznych situáciách.`;
};
