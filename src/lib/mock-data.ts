import { Candidate, LinkedInActivity, CrewMember, KPITarget } from "./types";

export const mockCandidates: Candidate[] = [
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
