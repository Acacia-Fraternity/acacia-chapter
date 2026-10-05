// Fall 2026 Pledge Education Schedule (6-week condensed edition), transcribed
// from Acacia_Fall2026_6Week_Pledge_Schedule.docx. Update here when the
// chapter issues a new schedule — the Pledgeship page renders straight from it.

export const PILLARS = [
  "Scholarship",
  "New Member Ed",
  "Ritual & Identity",
  "Brotherhood",
  "Human Service",
  "Governance",
] as const;
export type Pillar = (typeof PILLARS)[number];

export interface PledgeWeek {
  week: number;
  /** Sunday the week begins, YYYY-MM-DD (Bloomington). */
  date: string;
  reading: string[];
  quiz: string[];
  activities: string[];
  pillars: Pillar[];
  goldBook: string;
}

export const PLEDGE_WEEKS: PledgeWeek[] = [
  {
    week: 1,
    date: "2026-09-13",
    reading: [
      "Pythagoras pp. 1-17 (Intro to Acacia)",
      "Greek Alphabet — p. 54",
      "Acacian's Code — p. 82",
      "Pathway pp. 35-39",
    ],
    quiz: ["Name Quiz 1 Night"],
    activities: [
      "Induction Ceremony & Name Night Quiz",
      "Pledge class elections (P, VP, Sec)",
      "Parliamentary procedure intro",
      "Big-Little program kickoff — pledges begin tracking brother conversations",
      "OmegaFi sign-up; dues expectations and semester pledge expectations reviewed",
    ],
    pillars: ["New Member Ed", "Ritual & Identity", "Governance", "Brotherhood"],
    goldBook:
      "Pledge Educator announces initiation date & hazing policy Week 1; elections held, parliamentary procedure taught; Big-Little tracking begins.",
  },
  {
    week: 2,
    date: "2026-09-20",
    reading: [
      "Pythagoras pp. 30-39, 68-80",
      "Preamble (1965 Constitution) — begin memorizing",
      "Pathway pp. 35-39 review",
      "Parliamentary procedure review",
    ],
    quiz: ["Quiz 2: Greek alphabet, Acacian's Code, Acacia intro"],
    activities: [
      "Study tables by major (Academics Chair)",
      "Brother meet-and-greet check-in (3 bros/wk)",
      "Gym check-in launches (3x/wk, photo encouraged)",
      "Chapter meeting (Sunday)",
    ],
    pillars: ["New Member Ed", "Scholarship", "Ritual & Identity"],
    goldBook:
      "Ritual Chair: preamble memorization begins. Academics Chair: major-based study tables launch.",
  },
  {
    week: 3,
    date: "2026-09-27",
    reading: [
      "Pythagoras pp. 55-67 & pp. 18-29, 40-46",
      "Indiana Chapter history — founding 5/22/1920, first Venerable Dean Robert Hatfield",
      "47th Proposition of Euclid — 11-step geometric proof",
      "Malcolm Award years: 1960, 1992, 1994, 1998, 2000, 2004",
    ],
    quiz: ["Quiz 3: Preamble, chapter org, Indiana history, colors, Malcolm Award, Little 500"],
    activities: [
      "Buddy system check",
      "Weekly grade & assignment check-in",
      "Major-based study tables",
      "Chapter meeting (Sunday)",
    ],
    pillars: ["Scholarship", "Ritual & Identity", "New Member Ed", "Brotherhood"],
    goldBook:
      "Indiana Local Manual pp. 7-12: chapter history, colors (Black & Gold), 47th Proposition, 702 E. Third St. as chapter home. Big-Little matching process completed administratively.",
  },
  {
    week: 4,
    date: "2026-10-04",
    reading: [
      "Preamble, Credo, and Code — memorization check",
      "Pythagorean history: birth, parents, travels, the Institute",
      "Acacia governance: supreme bodies, Grand Lodge, HQ address, motto, coat of arms",
      "Living as an Acacian — values in daily life",
    ],
    quiz: ["Quiz 4: official flower, publications, preamble year, last living founder, Credo"],
    activities: [
      "Philanthropy project planning check-in",
      "Community service hours tracking begins",
      "Weekly grade check",
      "Chapter meeting (Sunday)",
    ],
    pillars: ["Ritual & Identity", "New Member Ed", "Governance", "Human Service"],
    goldBook:
      "Ritual Chair: preamble and credo mastered. Senior Dean introduces governance structure.",
  },
  {
    week: 5,
    date: "2026-10-11",
    reading: [
      "Acacia governance continued: supreme executive body, officer count, AFF (non-profit)",
      "Lee Kearney Officer Summit; HQ address: 12721 Meeting House Rd, Carmel, IN 46032",
      "Pythagorean history: Miami Triad, Masonry levels, first sorority",
      "Full Pythagoras & ritual review — cumulative",
    ],
    quiz: [
      "Quiz 5 + cumulative review: governance, AFF, coat of arms, Lee Kearney Summit",
      "Quiz 6: Pythagorean/Miami Triad history",
    ],
    activities: [
      "Weekly grade check — 3.0 GPA verified; GPA recognition list started (3.45+)",
      "Community service hours check (target: 6 hrs by initiation)",
      "Final memorization deadline: Preamble, Credo, Code",
      "Chapter meeting (Sunday)",
    ],
    pillars: ["Governance", "Scholarship", "Ritual & Identity", "Human Service"],
    goldBook:
      "Awards Chair begins collecting data for Chapter Standards Program; Academics Chair formal grade check; all ritual texts due memorized.",
  },
  {
    week: 6,
    date: "2026-10-18",
    reading: [
      "Final content review and open Q&A",
      "47th Proposition of Euclid — final walkthrough",
      "Ritual significance discussion; \"What does brotherhood mean to you?\"",
      "National/International exam (75% required)",
    ],
    quiz: ["National Exam (75%+ required)"],
    activities: [
      "Open feedback session — pledges voice concerns, ideas, praise",
      "Final philanthropy project submission",
      "Formal dresswear check: red tie, white shirt, blue/black jacket, khakis",
      "Ritual rehearsal; final chapter review — actives vote on each pledge's readiness",
      "Initiation ceremony at Masonic lodge if available",
      "Post-initiation meeting: litany, Vault status update, active member expectations",
      "3.45+ GPA recognition dinner",
    ],
    pillars: ["Ritual & Identity", "Brotherhood", "Governance", "Scholarship"],
    goldBook:
      "Pledge Educator: open feedback collected, post-initiation meeting held; Ritual Chair: rehearsal held, degrees conducted as written; Academics Chair: final grade recognition.",
  },
];

export const COMPRESSION_NOTE =
  "Rush/bid week precedes this schedule and is not a formal pledge-education week. The Big-Little Reveal Event has been removed; Big and Little pairings are still made (ranking sheets collected, matches finalized in Week 3) but announced without a dedicated event — chapters may fold notification into a regular chapter meeting. All 4 quizzes, the cumulative review, and the National Exam are preserved.";

export const STANDING_EXPECTATIONS: { heading: string; items: string[] }[] = [
  {
    heading: "Brotherhood & Well-being",
    items: [
      "Buddy system encouraged at all times outside class",
      "Gym 3x per week with PC member (recommended) — photo documentation encouraged",
      "Meet and document 3+ brothers per week (name, hometown, major, fun fact)",
      "PC dinners together on weekends — send photo",
      "Sober driver rotation throughout the week",
      "Flare app: primary communication channel for all brothers and pledges",
      "Big-Little check-ins: Bigs expected to connect with Littles at least once per week after pairing",
    ],
  },
  {
    heading: "Governance & Accountability",
    items: [
      "Submit weekly schedules to Pledge committee",
      "Attend chapter every Sunday; actives first, then pledges",
      "Gold marks for overachievement; black marks for failing minimums or bylaw violations",
      "Three black marks warrants initiation review and potential drop",
      "Do not clean brothers' personal spaces, cars, or laundry",
      "House duties assigned weekly by House Manager",
      "Dues paid before initiation — communicated Week 1; those unable to pay may drop",
    ],
  },
];

export const INITIATION_CHECKLIST: { item: string; pillar: Pillar }[] = [
  { item: "3.0 GPA maintained throughout pledgeship", pillar: "Scholarship" },
  { item: "Dues paid in full", pillar: "Governance" },
  { item: "75%+ on National/International exam", pillar: "Scholarship" },
  { item: "All weekly quizzes completed", pillar: "New Member Ed" },
  { item: "6 hours community service completed", pillar: "Human Service" },
  { item: "Philanthropy project submitted", pillar: "Human Service" },
  { item: "Building/grounds project done", pillar: "Brotherhood" },
  { item: "New member class name selected", pillar: "Brotherhood" },
  { item: "Class shirt designed", pillar: "Brotherhood" },
  { item: "Grade check passed with Academics Chair", pillar: "Scholarship" },
  { item: "Big-Little pairing completed", pillar: "Brotherhood" },
  { item: "Formal dresswear obtained", pillar: "Ritual & Identity" },
];

export const KEY_DATES: { date: string; text: string }[] = [
  { date: "Sept 2–6", text: "Rush week / bid night (precedes program)" },
  { date: "Sept 6", text: "Induction Ceremony + Name Night / pledgeship begins (Week 1)" },
  { date: "Oct 11", text: "Final memorization deadline: Preamble, Credo, Code (Week 5)" },
  { date: "Oct 18", text: "Final review, National Exam, initiation, GPA recognition dinner (Week 6)" },
];

export const PHILOSOPHY: string[] = [
  "This semester's pledgeship will instill the standards and traditions moving forward in the house. To ensure our longevity on campus, we must have no hazing whatsoever within our pledgeship. This process is supposed to create more interpersonal relationships, teamwork skills, and be a good bonding experience — not only for pledges but for brothers as well.",
  "Pledges are expected to learn what separates Acacia from other fraternities: the history, the trials and tribulations documented in the Pythagoras Membership Handbook, and the sacrifice, financial contributions, and trust our alumni have given to get us back on campus.",
  "Pledges should be men of respect and dignity. One's actions speak for all in the fraternity. Control your emotions. Restrain from violence. This pledgeship will effectively turn these men into proud Acacians.",
  "Every family tree in this chapter starts now. The example you set — as a pledge, as a brother, as a Big — will be passed down for years through Littles you may never meet. Take that seriously.",
];

export const MOTTO = "Virtue, Knowledge & Truth";
export const THREE_AS = "Three A's: Academics → Acacia → All Other Commitments";
