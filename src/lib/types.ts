export type PipelineStage =
  | "prospect"
  | "obs"
  | "questionnaire"
  | "final"
  | "job_offered"
  | "rehash"
  | "contact_before_start"
  | "attended_induction"
  | "start"
  | "solo"
  | "first_bell"
  | "promoted";

export type CandidateStatus = "Offered" | "Declined" | "Dropped" | "dropped";

export type CandidateSource = "LinkedIn Ads" | "Office" | "Personal" | "LinkedIn Messages";

export interface StageChange {
  from: PipelineStage;
  to: PipelineStage;
  date: string;
  note?: string;
}

export interface Candidate {
  id: string;
  candidateId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  
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
  hasAccountLinked?: boolean;
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
  titleNumber: number;
  adNumber: number;
  closeDate: string | null;
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
  prospect: { label: "Prospect", colorVar: "--stage-obs" },
  obs: { label: "2nd Round", colorVar: "--stage-obs" },
  questionnaire: { label: "Form Sent Back", colorVar: "--stage-questionnaire" },
  final: { label: "Final", colorVar: "--stage-final" },
  job_offered: { label: "Job Offered", colorVar: "--stage-job-offered" },
  rehash: { label: "Rehash Call", colorVar: "--stage-rehash" },
  contact_before_start: { label: "Induction Confirmed", colorVar: "--stage-contact-before-start" },
  attended_induction: { label: "Attended Induction", colorVar: "--stage-attended-induction" },
  start: { label: "Start", colorVar: "--stage-start" },
  solo: { label: "First Solo Sale", colorVar: "--stage-solo" },
  first_bell: { label: "First Bell", colorVar: "--stage-first-bell" },
  promoted: { label: "Promoted", colorVar: "--stage-promoted" },
};

export const STAGES_ORDER: PipelineStage[] = [
  "obs",
  "questionnaire",
  "final",
  "job_offered",
  "rehash",
  "contact_before_start",
  "attended_induction",
  "start",
  "solo",
  "first_bell",
  "promoted",
];

// Fixed KPI target percentages for stage-to-stage conversion
export const KPI_TARGETS: Record<string, number | null> = {
  "obs→questionnaire": 100,
  "questionnaire→final": 80,
  "final→job_offered": 75,
  "job_offered→rehash": 50,
  "rehash→contact_before_start": 100,
  "contact_before_start→attended_induction": 90,
  "attended_induction→start": 95,
  "start→solo": 50,
  "solo→first_bell": 80,
  "first_bell→promoted": null, // separate metric, no fixed target
};
