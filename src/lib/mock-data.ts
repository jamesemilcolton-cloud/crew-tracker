import { Candidate, LinkedInActivity, CrewMember, KPITarget } from "./types";

export const mockCandidates: Candidate[] = [
  // --- Current pipeline (recent) ---
  {
    id: "c1", name: "Sarah Mitchell", phone: "+44 7700 900123", notes: "Strong communicator, sales background. Very enthusiastic about the role.",
    source: "LinkedIn", stage: "2nd-round", status: "Waiting", potentialStartDate: "2026-03-10",
    hasSalesPitchAccess: false, closeToPromotion: false, history: [], createdAt: "2026-02-01",
  },
  {
    id: "c2", name: "James Carter", phone: "+44 7700 900456", notes: "Referred by team lead. Confident presenter.",
    source: "Office", stage: "2nd-round", status: "Passed", potentialStartDate: "2026-03-15",
    hasSalesPitchAccess: false, closeToPromotion: false, history: [], createdAt: "2026-02-03",
  },
  {
    id: "c3", name: "Priya Sharma", phone: "+44 7700 900789", notes: "Great energy, needs some coaching on objection handling.",
    source: "LinkedIn", stage: "final-round", status: "Waiting",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [{ from: "2nd-round", to: "final-round", date: "2026-02-10", note: "Passed 2nd round easily" }],
    createdAt: "2026-01-28",
  },
  {
    id: "c4", name: "Tom Williams", phone: "+44 7700 901234", notes: "Experienced in D2D. Ready for fast track.",
    source: "Office", stage: "final-round", status: "Passed", potentialStartDate: "2026-03-03",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [{ from: "2nd-round", to: "final-round", date: "2026-02-08" }],
    createdAt: "2026-01-25",
  },
  {
    id: "c5", name: "Emily Chen", phone: "+44 7700 901567", notes: "Unsure about hours. Needs follow-up call.",
    source: "LinkedIn", stage: "rehash", status: "Waiting",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2026-01-20" },
      { from: "final-round", to: "rehash", date: "2026-02-05", note: "Wanted time to think" },
    ],
    createdAt: "2026-01-15",
  },
  {
    id: "c6", name: "Marcus Johnson", phone: "+44 7700 902345", notes: "Sunday call confirmed. Very keen.",
    source: "Office", stage: "sunday-call", status: "Waiting", potentialStartDate: "2026-03-08",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2026-01-18" },
      { from: "final-round", to: "sunday-call", date: "2026-02-12" },
    ],
    createdAt: "2026-01-10",
  },
  {
    id: "c7", name: "Olivia Brown", phone: "+44 7700 903456", notes: "Started last week. Performing well in training.",
    source: "LinkedIn", stage: "start", status: "Passed", potentialStartDate: "2026-02-10",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2026-01-05" },
      { from: "final-round", to: "sunday-call", date: "2026-01-15" },
      { from: "sunday-call", to: "start", date: "2026-02-10" },
    ],
    createdAt: "2025-12-20",
  },
  {
    id: "c8", name: "Daniel Lee", phone: "+44 7700 904567", notes: "Excellent first two weeks. Hit first bell.",
    source: "Office", stage: "bell", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: true,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-12-10" },
      { from: "final-round", to: "start", date: "2025-12-20" },
      { from: "start", to: "bell", date: "2026-01-15" },
    ],
    createdAt: "2025-12-01",
  },
  {
    id: "c9", name: "Rachel Adams", phone: "+44 7700 905678", notes: "Promoted to leader. Building her own team now.",
    source: "LinkedIn", stage: "promoted", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-10-15" },
      { from: "final-round", to: "start", date: "2025-11-01" },
      { from: "start", to: "bell", date: "2025-12-01" },
      { from: "bell", to: "promoted", date: "2026-01-10" },
    ],
    createdAt: "2025-10-01",
  },
  {
    id: "c10", name: "Chris Taylor", phone: "+44 7700 906789", notes: "Didn't show up to Sunday call twice.",
    source: "Office", stage: "dropped", status: "Dropped", dropReason: "No-show to Sunday calls",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2026-01-20" },
      { from: "final-round", to: "sunday-call", date: "2026-02-01" },
      { from: "sunday-call", to: "dropped", date: "2026-02-15", note: "No-showed twice" },
    ],
    createdAt: "2026-01-12",
  },
  {
    id: "c11", name: "Amy Foster", phone: "+44 7700 907890", notes: "Great attitude but took another offer.",
    source: "LinkedIn", stage: "dropped", status: "Declined", dropReason: "Accepted competing offer",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2026-01-25" },
      { from: "final-round", to: "dropped", date: "2026-02-08", note: "Declined - other offer" },
    ],
    createdAt: "2026-01-18",
  },
  {
    id: "c12", name: "Nathan Price", phone: "+44 7700 908901", notes: "Strong sales pitch. Close to promotion.",
    source: "Office", stage: "start", status: "Passed", potentialStartDate: "2026-01-20",
    hasSalesPitchAccess: true, closeToPromotion: true,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-12-15" },
      { from: "final-round", to: "start", date: "2026-01-20" },
    ],
    createdAt: "2025-12-10",
  },
  {
    id: "c13", name: "Lisa Morgan", phone: "+44 7700 909012", notes: "Waiting to hear back after final round.",
    source: "LinkedIn", stage: "final-round", status: "Offered", potentialStartDate: "2026-03-20",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [{ from: "2nd-round", to: "final-round", date: "2026-02-14" }],
    createdAt: "2026-02-05",
  },
  {
    id: "c14", name: "Kevin Park", phone: "+44 7700 910123", notes: "Very interested. Following up Monday.",
    source: "LinkedIn", stage: "2nd-round", status: "Waiting", potentialStartDate: "2026-04-01",
    hasSalesPitchAccess: false, closeToPromotion: false, history: [], createdAt: "2026-02-16",
  },

  // --- Older candidates (4-8 weeks ago) ---
  {
    id: "c15", name: "Sophie Turner", phone: "+44 7700 911000", notes: "Came through LinkedIn ad campaign. Solid interview.",
    source: "LinkedIn", stage: "start", status: "Passed", potentialStartDate: "2026-01-06",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-12-18" },
      { from: "final-round", to: "sunday-call", date: "2025-12-28" },
      { from: "sunday-call", to: "start", date: "2026-01-06" },
    ],
    createdAt: "2025-12-10",
  },
  {
    id: "c16", name: "Ryan Hughes", phone: "+44 7700 911001", notes: "Dropped after rehash. Couldn't commit to schedule.",
    source: "Office", stage: "dropped", status: "Dropped", dropReason: "Schedule conflict",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-12-22" },
      { from: "final-round", to: "rehash", date: "2026-01-05" },
      { from: "rehash", to: "dropped", date: "2026-01-12", note: "Couldn't do Saturdays" },
    ],
    createdAt: "2025-12-15",
  },
  {
    id: "c17", name: "Hannah Clarke", phone: "+44 7700 911002", notes: "Fast-tracked through. Hit bell in 3 weeks.",
    source: "LinkedIn", stage: "bell", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: true,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-12-08" },
      { from: "final-round", to: "start", date: "2025-12-16" },
      { from: "start", to: "bell", date: "2026-01-06" },
    ],
    createdAt: "2025-12-01",
  },
  {
    id: "c18", name: "Jake Robinson", phone: "+44 7700 911003", notes: "Office walk-in. Great first impression.",
    source: "Office", stage: "sunday-call", status: "Waiting", potentialStartDate: "2026-01-27",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2026-01-08" },
      { from: "final-round", to: "sunday-call", date: "2026-01-18" },
    ],
    createdAt: "2026-01-02",
  },

  // --- Older candidates (8-12 weeks ago) ---
  {
    id: "c19", name: "Megan Scott", phone: "+44 7700 911004", notes: "Promoted fast. Now leading a small team.",
    source: "LinkedIn", stage: "promoted", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-11-10" },
      { from: "final-round", to: "start", date: "2025-11-20" },
      { from: "start", to: "bell", date: "2025-12-10" },
      { from: "bell", to: "promoted", date: "2025-12-28" },
    ],
    createdAt: "2025-11-01",
  },
  {
    id: "c20", name: "Luke Bennett", phone: "+44 7700 911005", notes: "Dropped early — wasn't a good fit for D2D.",
    source: "Office", stage: "dropped", status: "Dropped", dropReason: "Not suited for D2D",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "dropped", date: "2025-11-18", note: "Poor interview performance" },
    ],
    createdAt: "2025-11-12",
  },
  {
    id: "c21", name: "Zara Hussain", phone: "+44 7700 911006", notes: "LinkedIn outreach. Strong closer.",
    source: "LinkedIn", stage: "start", status: "Passed", potentialStartDate: "2025-12-02",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-11-15" },
      { from: "final-round", to: "sunday-call", date: "2025-11-22" },
      { from: "sunday-call", to: "start", date: "2025-12-02" },
    ],
    createdAt: "2025-11-05",
  },
  {
    id: "c22", name: "Ben Walker", phone: "+44 7700 911007", notes: "Referred by Megan. Excellent attitude.",
    source: "Office", stage: "bell", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-11-08" },
      { from: "final-round", to: "start", date: "2025-11-18" },
      { from: "start", to: "bell", date: "2025-12-15" },
    ],
    createdAt: "2025-11-01",
  },

  // --- Even older (12-24 weeks ago) ---
  {
    id: "c23", name: "Chloe Evans", phone: "+44 7700 911008", notes: "One of the first recruits. Now a top performer.",
    source: "LinkedIn", stage: "promoted", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-09-15" },
      { from: "final-round", to: "start", date: "2025-09-25" },
      { from: "start", to: "bell", date: "2025-10-20" },
      { from: "bell", to: "promoted", date: "2025-11-15" },
    ],
    createdAt: "2025-09-01",
  },
  {
    id: "c24", name: "Aiden Murphy", phone: "+44 7700 911009", notes: "Dropped — relocated to another city.",
    source: "Office", stage: "dropped", status: "Dropped", dropReason: "Relocated",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-09-20" },
      { from: "final-round", to: "start", date: "2025-10-01" },
      { from: "start", to: "dropped", date: "2025-10-15", note: "Moving to Manchester" },
    ],
    createdAt: "2025-09-10",
  },
  {
    id: "c25", name: "Ella Nguyen", phone: "+44 7700 911010", notes: "Strong LinkedIn prospect. Great numbers.",
    source: "LinkedIn", stage: "bell", status: "Passed",
    hasSalesPitchAccess: true, closeToPromotion: true,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-10-05" },
      { from: "final-round", to: "start", date: "2025-10-15" },
      { from: "start", to: "bell", date: "2025-11-10" },
    ],
    createdAt: "2025-09-25",
  },
  {
    id: "c26", name: "Sam Dixon", phone: "+44 7700 911011", notes: "Office referral. Quiet but effective.",
    source: "Office", stage: "start", status: "Passed", potentialStartDate: "2025-10-20",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-10-08" },
      { from: "final-round", to: "start", date: "2025-10-20" },
    ],
    createdAt: "2025-10-01",
  },
  {
    id: "c27", name: "Grace Kim", phone: "+44 7700 911012", notes: "Dropped during rehash. Lost interest.",
    source: "LinkedIn", stage: "dropped", status: "Declined", dropReason: "Lost interest",
    hasSalesPitchAccess: false, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-10-12" },
      { from: "final-round", to: "rehash", date: "2025-10-22" },
      { from: "rehash", to: "dropped", date: "2025-11-01", note: "Stopped responding" },
    ],
    createdAt: "2025-10-05",
  },
  {
    id: "c28", name: "Oscar Hall", phone: "+44 7700 911013", notes: "Early recruit from September. Solid BA.",
    source: "Office", stage: "start", status: "Passed", potentialStartDate: "2025-09-29",
    hasSalesPitchAccess: true, closeToPromotion: false,
    history: [
      { from: "2nd-round", to: "final-round", date: "2025-09-12" },
      { from: "final-round", to: "sunday-call", date: "2025-09-20" },
      { from: "sunday-call", to: "start", date: "2025-09-29" },
    ],
    createdAt: "2025-09-05",
  },
];
// Generate weekly LinkedIn activity for past 8 weeks
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

export const mockKPITargets: KPITarget[] = [
  { label: "2nd Round Interviews / Week", target: 10, actual: 7 },
  { label: "Final Round Pass Rate", target: 75, actual: 62 },
  { label: "Sunday Call Attendance", target: 90, actual: 78 },
  { label: "Starts / Month", target: 6, actual: 4 },
  { label: "Promotion Rate", target: 30, actual: 22 },
  { label: "LinkedIn CVs / Week", target: 25, actual: 19 },
];

export const mockCrewTree: CrewMember = {
  id: "root",
  name: "You",
  role: "leader",
  closeToPromotion: false,
  children: [
    {
      id: "l1",
      name: "Rachel Adams",
      role: "leader",
      closeToPromotion: false,
      children: [
        { id: "ba1", name: "Olivia Brown", role: "brand-ambassador", closeToPromotion: false, children: [] },
        { id: "ba2", name: "Nathan Price", role: "brand-ambassador", closeToPromotion: true, children: [] },
      ],
    },
    {
      id: "ba3", name: "Daniel Lee", role: "brand-ambassador", closeToPromotion: true, children: [],
    },
    {
      id: "ba4", name: "Marcus Johnson", role: "brand-ambassador", closeToPromotion: false, children: [],
    },
  ],
};

export const mockPredictedCrewTree: CrewMember = {
  id: "root",
  name: "You",
  role: "leader",
  closeToPromotion: false,
  children: [
    {
      id: "l1",
      name: "Rachel Adams",
      role: "leader",
      closeToPromotion: false,
      children: [
        { id: "ba1", name: "Olivia Brown", role: "brand-ambassador", closeToPromotion: false, children: [] },
        {
          id: "l2",
          name: "Nathan Price",
          role: "leader",
          closeToPromotion: false,
          children: [
            { id: "ba-pred1", name: "New BA (Predicted)", role: "brand-ambassador", closeToPromotion: false, children: [] },
            { id: "ba-pred2", name: "New BA (Predicted)", role: "brand-ambassador", closeToPromotion: false, children: [] },
          ],
        },
      ],
    },
    {
      id: "l3",
      name: "Daniel Lee",
      role: "leader",
      closeToPromotion: false,
      children: [
        { id: "ba-pred3", name: "New BA (Predicted)", role: "brand-ambassador", closeToPromotion: false, children: [] },
      ],
    },
    { id: "ba4", name: "Marcus Johnson", role: "brand-ambassador", closeToPromotion: true, children: [] },
    { id: "ba-pred4", name: "New BA (Predicted)", role: "brand-ambassador", closeToPromotion: false, children: [] },
    { id: "ba-pred5", name: "New BA (Predicted)", role: "brand-ambassador", closeToPromotion: false, children: [] },
  ],
};
