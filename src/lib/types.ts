export type PipelineStage =
  | "obs"
  | "final"
  | "offered"
  | "start"
  | "solo"
  | "promoted";

export type CandidateStatus = "Offered" | "Declined" | "Dropped";

export type CandidateSource = "LinkedIn" | "Office";

export interface StageChange {
  from: PipelineStage;
  to: PipelineStage;
  date: string;
  note?: string;
}

export interface Candidate {
  id: string;
  name: string;
  phone: string;
  notes: string;
  source: CandidateSource;
  stage: PipelineStage;
  status?: CandidateStatus;
  potentialStartDate?: string;
  hasSalesPitchAccess: boolean;
  hasEvoAppAccess: boolean;
  history: StageChange[];
  createdAt: string;
  recruitedBy?: string;
  archivedAt?: string | null;
}

export interface KPITarget {
  label: string;
  target: number;
  actual: number;
}

export interface AdUpload {
  id: string;
  date: string;
  type: "free" | "paid";
}

export interface CVDownloadEntry {
  id: string;
  downloadDate: string;
  adUploadId: string;
  count: number;
}

export interface LinkedInActivity {
  id: string;
  date: string;
  freeAdsUploaded: number;
  paidAdsUploaded: number;
  cvsDownloaded: number;
  candidatesAttending2ndRound: number;
}

export const STAGE_CONFIG: Record<PipelineStage, { label: string; colorVar: string }> = {
  obs: { label: "Obs", colorVar: "--stage-obs" },
  final: { label: "Final", colorVar: "--stage-final" },
  offered: { label: "Offered", colorVar: "--stage-offered" },
  start: { label: "Start", colorVar: "--stage-start" },
  solo: { label: "Solo", colorVar: "--stage-solo" },
  promoted: { label: "Promoted", colorVar: "--stage-promoted" },
};

export const STAGES_ORDER: PipelineStage[] = [
  "obs",
  "final",
  "offered",
  "start",
  "solo",
  "promoted",
];

// Fixed KPI target percentages for stage-to-stage conversion
export const KPI_TARGETS: Record<string, number | null> = {
  "obs→final": 80,
  "final→offered": 75,
  "offered→start": 67,
  "start→solo": 50,
  "solo→promoted": null, // dynamic, no fixed target
};
