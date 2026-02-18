export type PipelineStage =
  | "2nd-round"
  | "final-round"
  | "rehash"
  | "sunday-call"
  | "start"
  | "bell"
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
}

export interface KPITarget {
  label: string;
  target: number;
  actual: number;
}

export interface LinkedInActivity {
  id: string;
  date: string;
  freeAdsUploaded: number;
  paidAdsUploaded: number;
  cvsDownloaded: number;
  candidatesAttending2ndRound: number;
}

export interface CrewMember {
  id: string;
  name: string;
  role: "leader" | "brand-ambassador";
  children: CrewMember[];
}

export const STAGE_CONFIG: Record<PipelineStage, { label: string; colorVar: string }> = {
  "2nd-round": { label: "2nd Round Interview", colorVar: "--stage-2nd-round" },
  "final-round": { label: "Final Round Interview", colorVar: "--stage-final-round" },
  rehash: { label: "Rehash Call", colorVar: "--stage-rehash" },
  "sunday-call": { label: "Sunday Call", colorVar: "--stage-sunday" },
  start: { label: "Start (Brand Ambassador)", colorVar: "--stage-start" },
  bell: { label: "Bell", colorVar: "--stage-bell" },
  promoted: { label: "Promoted (Leader)", colorVar: "--stage-promoted" },
};

export const STAGES_ORDER: PipelineStage[] = [
  "2nd-round",
  "final-round",
  "rehash",
  "sunday-call",
  "start",
  "bell",
  "promoted",
];
