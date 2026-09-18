/**
 * "Codes groupés" — curated shortcuts that add several real tariff-catalog lines in one click
 * (e.g. picking "Composite 2 faces (molaire)" adds anesthésie + digue + mordançage + adhésif +
 * l'obturation elle-même as five separate, individually-priced lines). This is a UI convenience
 * only — it is NOT the same thing as the official tariff's own "Prestations groupées Plus" (LP+)
 * bundle codes (e.g. `4.5430.LP`), which bill as a single line at their own point value; picking a
 * preset here always adds the underlying individual positions, never an LP+ code.
 *
 * Codes referenced are real positions from the imported SSO/AA-AM-AI catalog
 * (packages/database/src/seed-tariff-catalog.ts) — verified to exist there, not invented.
 */
export interface TariffPresetLine {
  code: string;
  quantity?: number;
}

export interface TariffPreset {
  label: string;
  lines: TariffPresetLine[];
}

export const TARIFF_PRESETS: TariffPreset[] = [
  {
    label: "Composite 1 face (prémolaire/molaire)",
    lines: [
      { code: "4.0650" }, // Anesthésie par infiltration
      { code: "4.0940" }, // Pose d'une digue en caoutchouc, jusqu'à trois dents
      { code: "4.5800" }, // Mordançage de l'émail et application de l'adhésif
      { code: "4.5810" }, // Préparation de la dentine et application de l'adhésif dentinaire
      { code: "4.5350" }, // Obturation en composite, à une face
    ],
  },
  {
    label: "Composite 2 faces (molaire)",
    lines: [
      { code: "4.0650" },
      { code: "4.0940" },
      { code: "4.5800" },
      { code: "4.5810" },
      { code: "4.5430" }, // Obturation en composite d'une molaire, à deux faces
    ],
  },
  {
    label: "Composite 3 faces (molaire)",
    lines: [
      { code: "4.0650" },
      { code: "4.0940" },
      { code: "4.5800" },
      { code: "4.5810" },
      { code: "4.5470" }, // Obturation en composite d'une molaire, à trois faces
    ],
  },
  {
    label: "Composite interdentaire (dent antérieure)",
    lines: [
      { code: "4.0650" },
      { code: "4.0940" },
      { code: "4.5800" },
      { code: "4.5810" },
      { code: "4.5370" }, // Obturation interdentaire en composite, dent antérieure
    ],
  },
  {
    label: "Dévitalisation — 1 canal (séance unique)",
    lines: [
      { code: "4.0650" },
      { code: "4.0940" },
      { code: "4.4600" }, // Traitement radiculaire en une séance, endométrie incluse, un canal
    ],
  },
  {
    label: "Extraction simple",
    lines: [
      { code: "4.0650" },
      { code: "4.2000" }, // Extraction simple
    ],
  },
  {
    label: "Hygiène / détartrage (30 min)",
    lines: [
      { code: "4.1000" }, // Anamnèse de l'hygiène bucco-dentaire, instructions, motivation
      { code: "4.1110", quantity: 6 }, // Traitement par l'hygiéniste dentaire, par tranche de 5 min × 6 = 30 min
      { code: "4.1080" }, // Vernis fluorure, jusqu'à quatre dents
    ],
  },
];
