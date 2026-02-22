import { Candidate, LinkedInActivity, KPITarget, AdUpload, CVDownloadEntry } from "./types";

export const mockCandidates: Candidate[] = [
  {
    id: "c1", name: "Sarah Mitchell", phone: "+44 7700 900123", notes: "Strong communicator, sales background. Very enthusiastic about the role.",
    source: "LinkedIn", stage: "obs", potentialStartDate: "2026-03-10",
    hasSalesPitchAccess: false, hasEvoAppAccess: false, history: [], createdAt: "2026-02-01",
  },
  {
    id: "c2", name: "James Carter", phone: "+44 7700 900456", notes: "Referred by team lead. Confident presenter.",
    source: "Office", stage: "obs", potentialStartDate: "2026-03-15",
    hasSalesPitchAccess: false, hasEvoAppAccess: false, history: [], createdAt: "2026-02-03",
  },
  {
    id: "c3", name: "Priya Sharma", phone: "+44 7700 900789", notes: "Great energy, needs some coaching on objection handling.",
    source: "LinkedIn", stage: "final",
    hasSalesPitchAccess: false, hasEvoAppAccess: false,
    history: [
      { from: "obs", to: "questionnaire", date: "2026-02-06" },
      { from: "questionnaire", to: "bottom_line", date: "2026-02-07" },
      { from: "bottom_line", to: "final", date: "2026-02-10", note: "Passed obs round easily" },
    ],
    createdAt: "2026-01-28",
  },
  {
    id: "c4", name: "Tom Williams", phone: "+44 7700 901234", notes: "Experienced in D2D. Ready for fast track.",
    source: "Office", stage: "final", potentialStartDate: "2026-03-03",
    hasSalesPitchAccess: true, hasEvoAppAccess: false,
    history: [
      { from: "obs", to: "questionnaire", date: "2026-02-04" },
      { from: "questionnaire", to: "bottom_line", date: "2026-02-05" },
      { from: "bottom_line", to: "final", date: "2026-02-08" },
    ],
    createdAt: "2026-01-25",
  },
  {
    id: "c5", name: "Emily Chen", phone: "+44 7700 901567", notes: "Unsure about hours. Needs follow-up call.",
    source: "LinkedIn", stage: "contact_before_start",
    hasSalesPitchAccess: false, hasEvoAppAccess: false,
    history: [
      { from: "obs", to: "questionnaire", date: "2026-01-16" },
      { from: "questionnaire", to: "bottom_line", date: "2026-01-17" },
      { from: "bottom_line", to: "final", date: "2026-01-20" },
      { from: "final", to: "rehash", date: "2026-01-28" },
      { from: "rehash", to: "contact_before_start", date: "2026-02-05", note: "Wanted time to think" },
    ],
    createdAt: "2026-01-15",
  },
  {
    id: "c6", name: "Marcus Johnson", phone: "+44 7700 902345", notes: "Contact confirmed. Very keen.",
    source: "Office", stage: "contact_before_start", potentialStartDate: "2026-03-08",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2026-01-12" },
      { from: "questionnaire", to: "bottom_line", date: "2026-01-13" },
      { from: "bottom_line", to: "final", date: "2026-01-18" },
      { from: "final", to: "rehash", date: "2026-02-01" },
      { from: "rehash", to: "contact_before_start", date: "2026-02-12" },
    ],
    createdAt: "2026-01-10",
  },
  {
    id: "c7", name: "Olivia Brown", phone: "+44 7700 903456", notes: "Started last week. Performing well in training.",
    source: "LinkedIn", stage: "start", potentialStartDate: "2026-02-10",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c9",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-12-22" },
      { from: "questionnaire", to: "bottom_line", date: "2025-12-23" },
      { from: "bottom_line", to: "final", date: "2026-01-05" },
      { from: "final", to: "rehash", date: "2026-01-08" },
      { from: "rehash", to: "contact_before_start", date: "2026-01-10" },
      { from: "contact_before_start", to: "start", date: "2026-02-10" },
    ],
    createdAt: "2025-12-20",
  },
  {
    id: "c8", name: "Daniel Lee", phone: "+44 7700 904567", notes: "Excellent first two weeks. Working solo.",
    source: "Office", stage: "solo",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2025-12-03" },
      { from: "questionnaire", to: "bottom_line", date: "2025-12-04" },
      { from: "bottom_line", to: "final", date: "2025-12-10" },
      { from: "final", to: "rehash", date: "2025-12-12" },
      { from: "rehash", to: "contact_before_start", date: "2025-12-14" },
      { from: "contact_before_start", to: "start", date: "2025-12-20" },
      { from: "start", to: "solo", date: "2026-01-15" },
    ],
    createdAt: "2025-12-01",
  },
  {
    id: "c9", name: "Rachel Adams", phone: "+44 7700 905678", notes: "Promoted to leader. Building her own team now.",
    source: "LinkedIn", stage: "promoted",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2025-10-05" },
      { from: "questionnaire", to: "bottom_line", date: "2025-10-06" },
      { from: "bottom_line", to: "final", date: "2025-10-15" },
      { from: "final", to: "rehash", date: "2025-10-18" },
      { from: "rehash", to: "contact_before_start", date: "2025-10-20" },
      { from: "contact_before_start", to: "start", date: "2025-11-01" },
      { from: "start", to: "solo", date: "2025-12-01" },
      { from: "solo", to: "promoted", date: "2026-01-10" },
    ],
    createdAt: "2025-10-01",
  },
  {
    id: "c12", name: "Nathan Price", phone: "+44 7700 908901", notes: "Strong sales pitch. Close to promotion.",
    source: "Office", stage: "start", potentialStartDate: "2026-01-20",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c9",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-12-12" },
      { from: "questionnaire", to: "bottom_line", date: "2025-12-13" },
      { from: "bottom_line", to: "final", date: "2025-12-15" },
      { from: "final", to: "rehash", date: "2025-12-18" },
      { from: "rehash", to: "contact_before_start", date: "2025-12-20" },
      { from: "contact_before_start", to: "start", date: "2026-01-20" },
    ],
    createdAt: "2025-12-10",
  },
  {
    id: "c13", name: "Lisa Morgan", phone: "+44 7700 909012", notes: "Waiting to hear back after final round.",
    source: "LinkedIn", stage: "final", status: "Offered", potentialStartDate: "2026-03-20",
    hasSalesPitchAccess: false, hasEvoAppAccess: false,
    history: [
      { from: "obs", to: "questionnaire", date: "2026-02-08" },
      { from: "questionnaire", to: "bottom_line", date: "2026-02-10" },
      { from: "bottom_line", to: "final", date: "2026-02-14" },
    ],
    createdAt: "2026-02-05",
  },
  {
    id: "c14", name: "Kevin Park", phone: "+44 7700 910123", notes: "Very interested. Following up Monday.",
    source: "LinkedIn", stage: "obs", potentialStartDate: "2026-04-01",
    hasSalesPitchAccess: false, hasEvoAppAccess: false, history: [], createdAt: "2026-02-16",
  },
  {
    id: "c15", name: "Sophie Turner", phone: "+44 7700 911000", notes: "Came through LinkedIn ad campaign. Solid interview.",
    source: "LinkedIn", stage: "start", potentialStartDate: "2026-01-06",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c19",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-12-12" },
      { from: "questionnaire", to: "bottom_line", date: "2025-12-13" },
      { from: "bottom_line", to: "final", date: "2025-12-18" },
      { from: "final", to: "rehash", date: "2025-12-20" },
      { from: "rehash", to: "contact_before_start", date: "2025-12-22" },
      { from: "contact_before_start", to: "start", date: "2026-01-06" },
    ],
    createdAt: "2025-12-10",
  },
  {
    id: "c17", name: "Hannah Clarke", phone: "+44 7700 911002", notes: "Fast-tracked through. Working solo in 3 weeks.",
    source: "LinkedIn", stage: "solo",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2025-12-02" },
      { from: "questionnaire", to: "bottom_line", date: "2025-12-03" },
      { from: "bottom_line", to: "final", date: "2025-12-08" },
      { from: "final", to: "rehash", date: "2025-12-10" },
      { from: "rehash", to: "contact_before_start", date: "2025-12-11" },
      { from: "contact_before_start", to: "start", date: "2025-12-16" },
      { from: "start", to: "solo", date: "2026-01-06" },
    ],
    createdAt: "2025-12-01",
  },
  {
    id: "c18", name: "Jake Robinson", phone: "+44 7700 911003", notes: "Office walk-in. Great first impression.",
    source: "Office", stage: "contact_before_start", potentialStartDate: "2026-01-27",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2026-01-03" },
      { from: "questionnaire", to: "bottom_line", date: "2026-01-04" },
      { from: "bottom_line", to: "final", date: "2026-01-08" },
      { from: "final", to: "rehash", date: "2026-01-12" },
      { from: "rehash", to: "contact_before_start", date: "2026-01-18" },
    ],
    createdAt: "2026-01-02",
  },
  {
    id: "c19", name: "Megan Scott", phone: "+44 7700 911004", notes: "Promoted fast. Now leading a small team.",
    source: "LinkedIn", stage: "promoted",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2025-11-02" },
      { from: "questionnaire", to: "bottom_line", date: "2025-11-03" },
      { from: "bottom_line", to: "final", date: "2025-11-10" },
      { from: "final", to: "rehash", date: "2025-11-12" },
      { from: "rehash", to: "contact_before_start", date: "2025-11-14" },
      { from: "contact_before_start", to: "start", date: "2025-11-20" },
      { from: "start", to: "solo", date: "2025-12-10" },
      { from: "solo", to: "promoted", date: "2025-12-28" },
    ],
    createdAt: "2025-11-01",
  },
  {
    id: "c21", name: "Zara Hussain", phone: "+44 7700 911006", notes: "LinkedIn outreach. Strong closer.",
    source: "LinkedIn", stage: "start", potentialStartDate: "2025-12-02",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c23",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-11-08" },
      { from: "questionnaire", to: "bottom_line", date: "2025-11-09" },
      { from: "bottom_line", to: "final", date: "2025-11-15" },
      { from: "final", to: "rehash", date: "2025-11-17" },
      { from: "rehash", to: "contact_before_start", date: "2025-11-18" },
      { from: "contact_before_start", to: "start", date: "2025-12-02" },
    ],
    createdAt: "2025-11-05",
  },
  {
    id: "c22", name: "Ben Walker", phone: "+44 7700 911007", notes: "Referred by Megan. Excellent attitude.",
    source: "Office", stage: "solo",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c19",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-11-03" },
      { from: "questionnaire", to: "bottom_line", date: "2025-11-04" },
      { from: "bottom_line", to: "final", date: "2025-11-08" },
      { from: "final", to: "rehash", date: "2025-11-10" },
      { from: "rehash", to: "contact_before_start", date: "2025-11-12" },
      { from: "contact_before_start", to: "start", date: "2025-11-18" },
      { from: "start", to: "solo", date: "2025-12-15" },
    ],
    createdAt: "2025-11-01",
  },
  {
    id: "c23", name: "Chloe Evans", phone: "+44 7700 911008", notes: "One of the first recruits. Now a top performer.",
    source: "LinkedIn", stage: "promoted",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2025-09-05" },
      { from: "questionnaire", to: "bottom_line", date: "2025-09-06" },
      { from: "bottom_line", to: "final", date: "2025-09-15" },
      { from: "final", to: "rehash", date: "2025-09-17" },
      { from: "rehash", to: "contact_before_start", date: "2025-09-18" },
      { from: "contact_before_start", to: "start", date: "2025-09-25" },
      { from: "start", to: "solo", date: "2025-10-20" },
      { from: "solo", to: "promoted", date: "2025-11-15" },
    ],
    createdAt: "2025-09-01",
  },
  {
    id: "c25", name: "Ella Nguyen", phone: "+44 7700 911010", notes: "Strong LinkedIn prospect. Great numbers.",
    source: "LinkedIn", stage: "solo",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c23",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-09-28" },
      { from: "questionnaire", to: "bottom_line", date: "2025-09-29" },
      { from: "bottom_line", to: "final", date: "2025-10-05" },
      { from: "final", to: "rehash", date: "2025-10-07" },
      { from: "rehash", to: "contact_before_start", date: "2025-10-08" },
      { from: "contact_before_start", to: "start", date: "2025-10-15" },
      { from: "start", to: "solo", date: "2025-11-10" },
    ],
    createdAt: "2025-09-25",
  },
  {
    id: "c26", name: "Sam Dixon", phone: "+44 7700 911011", notes: "Office referral. Quiet but effective.",
    source: "Office", stage: "start", potentialStartDate: "2025-10-20",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    recruitedBy: "c23",
    history: [
      { from: "obs", to: "questionnaire", date: "2025-10-02" },
      { from: "questionnaire", to: "bottom_line", date: "2025-10-03" },
      { from: "bottom_line", to: "final", date: "2025-10-08" },
      { from: "final", to: "rehash", date: "2025-10-10" },
      { from: "rehash", to: "contact_before_start", date: "2025-10-12" },
      { from: "contact_before_start", to: "start", date: "2025-10-20" },
    ],
    createdAt: "2025-10-01",
  },
  {
    id: "c28", name: "Oscar Hall", phone: "+44 7700 911013", notes: "Early recruit from September. Solid BA.",
    source: "Office", stage: "start", potentialStartDate: "2025-09-29",
    hasSalesPitchAccess: true, hasEvoAppAccess: true,
    history: [
      { from: "obs", to: "questionnaire", date: "2025-09-06" },
      { from: "questionnaire", to: "bottom_line", date: "2025-09-07" },
      { from: "bottom_line", to: "final", date: "2025-09-12" },
      { from: "final", to: "rehash", date: "2025-09-14" },
      { from: "rehash", to: "contact_before_start", date: "2025-09-16" },
      { from: "contact_before_start", to: "start", date: "2025-09-29" },
    ],
    createdAt: "2025-09-05",
  },
];

export const mockLinkedInActivity: LinkedInActivity[] = Array.from({ length: 56 }, (_, i) => {
  const date = new Date("2026-02-18");
  date.setDate(date.getDate() - (55 - i));
  const dayOfWeek = date.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  return {
    id: `la-${i}`,
    date: date.toISOString().split("T")[0],
    freeAdsUploaded: isWeekday ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * 2),
    paidAdsUploaded: isWeekday ? Math.floor(Math.random() * 2) : 0,
    cvsDownloaded: isWeekday ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 3),
    candidatesAttending2ndRound: Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 0,
  };
});

export const mockAdUploads: AdUpload[] = (() => {
  const ads: AdUpload[] = [];
  let adId = 0;
  mockLinkedInActivity.forEach((a) => {
    for (let i = 0; i < a.freeAdsUploaded; i++) {
      ads.push({ id: `ad-${adId++}`, date: a.date, type: "free" });
    }
    for (let i = 0; i < a.paidAdsUploaded; i++) {
      ads.push({ id: `ad-${adId++}`, date: a.date, type: "paid" });
    }
  });
  return ads;
})();

export const mockCVDownloads: CVDownloadEntry[] = (() => {
  const entries: CVDownloadEntry[] = [];
  let entryId = 0;
  mockLinkedInActivity.forEach((a) => {
    if (a.cvsDownloaded <= 0) return;
    const downloadDate = new Date(a.date);
    const candidateAds = mockAdUploads.filter((ad) => {
      const adDate = new Date(ad.date);
      const diffDays = (downloadDate.getTime() - adDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3;
    });
    if (candidateAds.length === 0) return;
    let remaining = a.cvsDownloaded;
    candidateAds.forEach((ad, idx) => {
      const count = idx === candidateAds.length - 1 ? remaining : Math.ceil(remaining / (candidateAds.length - idx));
      if (count > 0) {
        entries.push({ id: `cv-${entryId++}`, downloadDate: a.date, adUploadId: ad.id, count });
        remaining -= count;
      }
    });
  });
  return entries;
})();

export const mockKPITargets: KPITarget[] = [
  { label: "Obs → Questionnaire", target: 100, actual: 100 },
  { label: "Questionnaire → Bottom Line", target: 100, actual: 95 },
  { label: "Bottom Line → Final", target: 80, actual: 70 },
  { label: "Final → Rehash", target: 75, actual: 62 },
  { label: "Rehash → Contact Before Start", target: 100, actual: 90 },
  { label: "Contact Before Start → Start", target: 67, actual: 55 },
  { label: "Start → Solo", target: 50, actual: 40 },
  { label: "LinkedIn CVs / Week", target: 25, actual: 19 },
];
