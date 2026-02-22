export type PipelineStage =
  | "obs"
  | "questionnaire"
  | "bottom_line"
  | "final"
  | "rehash"
  | "contact_before_start"
  | "start"
  | "solo"
  | "promoted";

export type CandidateStatus = "Offered" | "Declined" | "Dropped" | "dropped";

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
  dropOffReason?: string | null;
  dropOffDate?: string | null;
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
  questionnaire: { label: "Questionnaire", colorVar: "--stage-questionnaire" },
  bottom_line: { label: "Bottom Line", colorVar: "--stage-bottom-line" },
  final: { label: "Final", colorVar: "--stage-final" },
  rehash: { label: "Rehash", colorVar: "--stage-rehash" },
  contact_before_start: { label: "Contact Before Start", colorVar: "--stage-contact-before-start" },
  start: { label: "Start", colorVar: "--stage-start" },
  solo: { label: "Solo", colorVar: "--stage-solo" },
  promoted: { label: "Promoted", colorVar: "--stage-promoted" },
};

export const STAGES_ORDER: PipelineStage[] = [
  "obs",
  "questionnaire",
  "bottom_line",
  "final",
  "rehash",
  "contact_before_start",
  "start",
  "solo",
  "promoted",
];

// Fixed KPI target percentages for stage-to-stage conversion
export const KPI_TARGETS: Record<string, number | null> = {
  "obs→questionnaire": 100,
  "questionnaire→bottom_line": 100,
  "bottom_line→final": 80,
  "final→rehash": 75,
  "rehash→contact_before_start": 100,
  "contact_before_start→start": 67,
  "start→solo": 50,
  "solo→promoted": null, // separate metric, no fixed target
};
