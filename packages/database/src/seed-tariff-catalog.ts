/**
 * Seed source-of-truth for a demo Swiss dental tariff catalog.
 *
 * ⚠️ IMPORTANT — these are NOT official SSO/DENTOTAR codes. The real DENTOTAR® catalog (~500
 * positions, the Swiss dental tariff used for private patients and, under the same point
 * structure, for accident/military/invalidity insurance — AA/AM/AI) is a licensed, copyrighted
 * product of the Société Suisse des Médecins-Dentistes (SSO). It could not be reproduced here:
 * this sandbox's network egress is blocked to sso.ch and every mirror hosting the official PDF
 * (confirmed directly — every fetch attempt returned an explicit EGRESS_BLOCKED error, not a
 * guess), and even with access, redistributing SSO's proprietary position list would not be
 * appropriate without a license.
 *
 * What's real: the *structure* of the pricing engine. Swiss dental tariffs are genuinely
 * point-based — each position carries a point count, multiplied by a point value the practice
 * sets (capped at CHF 1.70 for SSO members on DENTOTAR; fixed nationally at CHF 1.00 since
 * 1 January 2018 for AA/AM/AI — that CHF 1.00 figure is the one number here confirmed against a
 * live source, not invented). `TariffItem.points × TariffItem.pointValue` in
 * `services/tariff-pricing.ts` mirrors that exactly.
 *
 * What's a placeholder: every code below. They use short mnemonic strings (`ANE-01`, not a real
 * DENTOTAR number) specifically so nobody mistakes them for real, billable SSO codes. Before this
 * touches a real invoice: replace this file's contents with the clinic's actual, licensed
 * DENTOTAR export (SSO provides one to member practices; a CSV/Excel importer for it would be a
 * small, mechanical follow-up once that file is in hand — the `TariffCatalog`/`TariffVersion`
 * model here already supports swapping in a new version without any code change).
 */
export interface TariffItemSeed {
  code: string;
  description: string;
  category: string;
  points?: number;
  pointValue?: number;
  computedPrice?: number;
}

const DEFAULT_POINT_VALUE = 1;

export const DEMO_TARIFF_ITEMS: TariffItemSeed[] = [
  // 1. Examens & diagnostic
  { code: "EXA-01", description: "Consultation et examen initial", category: "1. Examens & diagnostic", points: 20 },
  { code: "EXA-02", description: "Contrôle périodique", category: "1. Examens & diagnostic", points: 10 },
  { code: "EXA-03", description: "Consultation d'urgence", category: "1. Examens & diagnostic", points: 15 },
  { code: "RX-01", description: "Radiographie rétro-alvéolaire (par cliché)", category: "1. Examens & diagnostic", points: 4 },
  { code: "RX-02", description: "Radiographie panoramique (OPT)", category: "1. Examens & diagnostic", points: 25 },
  { code: "RX-03", description: "Status radiologique complet (série rétro-alvéolaire)", category: "1. Examens & diagnostic", points: 35 },

  // 2. Prophylaxie & hygiène
  { code: "PROPH-01", description: "Détartrage (par séance)", category: "2. Prophylaxie & hygiène", points: 20 },
  { code: "PROPH-02", description: "Polissage et fluoration", category: "2. Prophylaxie & hygiène", points: 8 },
  { code: "PROPH-03", description: "Instruction d'hygiène bucco-dentaire", category: "2. Prophylaxie & hygiène", points: 10 },

  // 3. Anesthésie
  { code: "ANE-01", description: "Anesthésie locale (infiltration)", category: "3. Anesthésie", points: 14 },
  { code: "ANE-02", description: "Anesthésie locorégionale (tronculaire)", category: "3. Anesthésie", points: 18 },
  { code: "ANE-03", description: "Anesthésie de surface (topique)", category: "3. Anesthésie", points: 5 },

  // 4. Isolation du champ opératoire
  { code: "ISOL-01", description: "Pose de la digue (champ opératoire)", category: "4. Isolation du champ opératoire", points: 10 },
  { code: "ISOL-02", description: "Dépose de la digue", category: "4. Isolation du champ opératoire", points: 4 },

  // 5. Restaurations (obturations)
  { code: "RESTO-01", description: "Obturation composite — 1 face", category: "5. Restaurations", points: 30 },
  { code: "RESTO-02", description: "Obturation composite — 2 faces", category: "5. Restaurations", points: 45 },
  { code: "RESTO-03", description: "Obturation composite — 3 faces", category: "5. Restaurations", points: 58 },
  { code: "RESTO-04", description: "Obturation composite — 4 faces ou angle", category: "5. Restaurations", points: 72 },
  { code: "RESTO-05", description: "Reconstitution corono-radiculaire (faux-moignon)", category: "5. Restaurations", points: 55 },

  // 6. Endodontie
  { code: "ENDO-01", description: "Traitement de canal — 1 canal", category: "6. Endodontie", points: 90 },
  { code: "ENDO-02", description: "Traitement de canal — 2 canaux", category: "6. Endodontie", points: 130 },
  { code: "ENDO-03", description: "Traitement de canal — 3 canaux et plus", category: "6. Endodontie", points: 165 },
  { code: "ENDO-04", description: "Pulpotomie (dent temporaire)", category: "6. Endodontie", points: 35 },
  { code: "ENDO-05", description: "Obturation provisoire (pansement)", category: "6. Endodontie", points: 12 },

  // 7. Parodontologie
  { code: "PARO-01", description: "Surfaçage radiculaire — par sextant", category: "7. Parodontologie", points: 40 },
  { code: "PARO-02", description: "Curetage gingival — par dent", category: "7. Parodontologie", points: 8 },

  // 8. Chirurgie orale
  { code: "CHIR-01", description: "Extraction simple", category: "8. Chirurgie orale", points: 35 },
  { code: "CHIR-02", description: "Extraction chirurgicale (dent incluse ou impactée)", category: "8. Chirurgie orale", points: 90 },
  { code: "CHIR-03", description: "Alvéolectomie / régularisation osseuse", category: "8. Chirurgie orale", points: 40 },

  // 9. Prothèse
  { code: "PROTH-01", description: "Couronne céramo-métallique", category: "9. Prothèse", points: 220 },
  { code: "PROTH-02", description: "Couronne tout céramique", category: "9. Prothèse", points: 240 },
  { code: "PROTH-03", description: "Élément de bridge", category: "9. Prothèse", points: 200 },
  { code: "PROTH-04", description: "Empreinte optique ou physico-chimique", category: "9. Prothèse", points: 30 },

  // 10. Urgences & majorations
  { code: "URG-01", description: "Majoration urgence hors horaire d'ouverture", category: "10. Urgences & majorations", computedPrice: 60 },
];

export function resolveTariffItemSeed(item: TariffItemSeed): {
  code: string;
  description: string;
  category: string;
  points: number | null;
  pointValue: number | null;
  computedPrice: number | null;
} {
  return {
    code: item.code,
    description: item.description,
    category: item.category,
    points: item.points ?? null,
    pointValue: item.points !== undefined ? (item.pointValue ?? DEFAULT_POINT_VALUE) : null,
    computedPrice: item.computedPrice ?? null,
  };
}
