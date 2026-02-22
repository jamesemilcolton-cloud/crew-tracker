// Hard-coded commission table
// Maps age_band → ask_amount → { isa, owner }

export type AgeBand = "30-35" | "36-44" | "45+";

export const AGE_BANDS: AgeBand[] = ["30-35", "36-44", "45+"];

export const COMMISSION_TABLE: Record<string, Record<number, { isa: number; owner: number }>> = {
  "30-35": {
    10: { isa: 22.00, owner: 18.25 },
  },
  "36-44": {
    10: { isa: 39.00, owner: 24.60 },
    12: { isa: 58.10, owner: 37.80 },
  },
  "45+": {
    10: { isa: 50.40, owner: 29.05 },
    12: { isa: 58.10, owner: 37.80 },
    15: { isa: 62.30, owner: 40.60 },
  },
};

export function getAskAmounts(ageBand: AgeBand): number[] {
  return Object.keys(COMMISSION_TABLE[ageBand] || {}).map(Number);
}

export function calculateCommission(ageBand: AgeBand, askAmount: number) {
  const entry = COMMISSION_TABLE[ageBand]?.[askAmount];
  if (!entry) return null;
  const totalWire = entry.isa + entry.owner;
  const qualityPending = +(totalWire * 0.30).toFixed(2);
  return {
    isa: entry.isa,
    owner: entry.owner,
    totalWire: +totalWire.toFixed(2),
    qualityPending,
  };
}
