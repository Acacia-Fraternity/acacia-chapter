import { PART1 } from "./source/part1";
import { PART2 } from "./source/part2";
import { PART3 } from "./source/part3";
import { PART4 } from "./source/part4";
import { PART5 } from "./source/part5";
import { PART6 } from "./source/part6";
import { PART7 } from "./source/part7";
import { PART8 } from "./source/part8";
import {
  OFFICE_HOLDERS,
  CONCLAVES,
  HEBREW_NAMES,
  MALCOLM_AWARD,
  GREEK_ALPHABET,
  FOUNDERS,
} from "./source/roster";

export type Question = {
  id: string;
  section: string;
  kind: "mc" | "tf";
  prompt: string;
  options: string[];
  answer: number;
  explanation?: string;
};

type Fact = { section: string; text: string };

// Questions are derived from the manual's own sentences rather than written
// one by one: every fact becomes a fill-in-the-blank, a true/false pair and a
// "which statement is accurate" item, plus structured questions off the
// officer/Conclave/award lists. Seeded RNG keeps ids and distractors stable
// between server renders.

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string | number) {
  let a = typeof seed === "number" ? seed : hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseFacts(): Fact[] {
  const facts: Fact[] = [];
  for (const part of [PART1, PART2, PART3, PART4, PART5, PART6, PART7, PART8]) {
    for (const block of part.split(/\n## /)) {
      const lines = block.replace(/^## /, "").trim().split("\n");
      const section = lines[0].trim();
      if (!section) continue;
      for (const para of lines.slice(1).join("\n").split(/\n\s*\n/)) {
        const text = para.replace(/\s+/g, " ").trim();
        if (text.length >= 25) facts.push({ section, text });
      }
    }
  }
  return facts;
}

const FACTS = parseFacts();

const NUMBER_WORDS = [
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "twelve", "fourteen", "twenty", "thirty", "forty", "fifty",
];
const PROPER_STOP = new Set([
  "The", "A", "An", "In", "On", "At", "It", "He", "She", "They", "This", "That",
  "These", "Those", "Each", "Every", "Acacia", "Acacian", "Acacians", "Fraternity",
  "If", "When", "While", "As", "His", "Her", "Their", "For", "And", "But", "Only",
  "No", "All", "One", "Not", "To", "By", "With", "Once", "After", "Before", "Also",
  "Some", "Many", "Most", "Both", "Such", "Because", "Although", "Within", "Upon",
  "Brother", "Chapter", "Council", "Conclave", "International", "National",
]);
const WORD_STOP = new Set([
  "because", "between", "through", "should", "without", "another", "against",
  "something", "everything", "therefore", "however", "whether", "himself",
  "themselves", "member", "members", "chapter", "chapters", "fraternity",
  "Acacian", "Acacians",
]);

const wordCounts = new Map<string, number>();
for (const f of FACTS) {
  for (const w of f.text.toLowerCase().match(/[a-z]{4,}/g) ?? []) {
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }
}

type Cand = {
  kind: "num" | "numword" | "proper" | "word";
  value: string;
  index: number;
};

function suffixClass(w: string): string {
  for (const s of ["tion", "sion", "ment", "ness", "ity", "ing", "ly", "ed", "al", "ous", "ive", "ship", "ers", "s"]) {
    if (w.endsWith(s)) return s;
  }
  return "";
}

// Pools are keyed by shape (word count / suffix) and by section, so a blank
// in the Pythagoras chapter draws its wrong answers from that chapter first.
const PROPER_POOL = new Map<string, string[]>();
const WORD_POOL = new Map<string, string[]>();
{
  const seen = new Set<string>();
  const addTo = (m: Map<string, string[]>, key: string, v: string) => m.set(key, [...(m.get(key) ?? []), v]);
  for (const f of FACTS) {
    for (const c of candidates(f.text)) {
      if (c.kind === "proper" || c.kind === "word") {
        const shape = c.kind === "proper" ? String(c.value.split(" ").length) : suffixClass(c.value);
        const map = c.kind === "proper" ? PROPER_POOL : WORD_POOL;
        for (const key of [`${shape}|${f.section}`, `${shape}|*`]) {
          const id = `${c.kind}|${key}|${c.value}`;
          if (seen.has(id)) continue;
          seen.add(id);
          addTo(map, key, c.value);
        }
      }
    }
  }
}

function candidates(text: string): Cand[] {
  const out: Cand[] = [];
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => taken.every(([a, b]) => e <= a || s >= b);
  const add = (c: Cand) => {
    if (!free(c.index, c.index + c.value.length)) return;
    taken.push([c.index, c.index + c.value.length]);
    out.push(c);
  };

  for (const m of text.matchAll(/\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\b/g)) {
    add({ kind: "num", value: m[0], index: m.index! });
  }
  for (const m of text.matchAll(new RegExp(`\\b(${NUMBER_WORDS.join("|")})\\b`, "g"))) {
    add({ kind: "numword", value: m[0], index: m.index! });
  }
  for (const m of text.matchAll(/\b[A-Z][A-Za-z'’]+(?:\s+(?:[A-Z][A-Za-z'’]+|[A-Z]\.))*/g)) {
    let value = m[0].replace(/^(The|A|An)\s+/, "");
    const index = m.index! + (m[0].length - value.length);
    if (m.index === 0 || /[.!?"“]\s*$/.test(text.slice(0, m.index!))) {
      // Sentence-initial capital: only a proper noun if multi-word and not a stop word.
      const words = value.split(" ");
      if (words.length < 2 || PROPER_STOP.has(words[0])) continue;
    }
    value = value.replace(/\s+[A-Z]\.$/, "");
    const words = value.split(" ");
    if (words.every((w) => PROPER_STOP.has(w))) continue;
    if (PROPER_STOP.has(words[0]) && words.length === 1) continue;
    if (words.length > 3 || value.length < 4) continue;
    if (wordCounts.get(value.toLowerCase()) && (wordCounts.get(value.toLowerCase()) ?? 0) > 40) continue;
    add({ kind: "proper", value, index });
  }
  for (const m of text.matchAll(/\b[a-z]{7,}\b/g)) {
    const w = m[0];
    if (WORD_STOP.has(w) || (wordCounts.get(w) ?? 0) > 25) continue;
    add({ kind: "word", value: w, index: m.index! });
  }
  return out;
}

function numberDistractors(value: string, text: string, rand: () => number): string[] {
  const n = Number(value.replace(/,/g, ""));
  const isYear = Number.isInteger(n) && n >= 1000 && n <= 2100 && !value.includes(",");
  const used = new Set([value]);
  const out: string[] = [];
  const offsets = isYear ? [-1, 1, -2, 2, -3, 3, -5, 5, -10, 10, -4, 4, -6, 6] : [-1, 1, -2, 2, -3, 3, 5, -5, 10, 4];
  for (const o of shuffle(offsets, rand)) {
    const cand = isYear ? n + o : value.includes(".") ? Math.round((n + o * 0.5) * 100) / 100 : n + o * (n > 40 ? Math.ceil(n / 10) : 1);
    if (cand <= 0) continue;
    const s = value.includes(",") ? cand.toLocaleString("en-US") : String(cand);
    if (used.has(s) || text.includes(s)) continue;
    used.add(s);
    out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

function distractors(c: Cand, text: string, section: string, rand: () => number): string[] | null {
  let picks: string[] = [];
  if (c.kind === "num") {
    picks = numberDistractors(c.value, text, rand);
  } else if (c.kind === "numword") {
    picks = shuffle(NUMBER_WORDS.filter((w) => w !== c.value && !text.includes(w)), rand).slice(0, 3);
  } else if (c.kind === "proper") {
    const n = String(c.value.split(" ").length);
    const ok = (p: string) => p !== c.value && !text.includes(p);
    const local = shuffle((PROPER_POOL.get(`${n}|${section}`) ?? []).filter(ok), rand);
    const global = shuffle((PROPER_POOL.get(`${n}|*`) ?? []).filter(ok), rand);
    picks = [...new Set([...local, ...global])].slice(0, 3);
  } else {
    const k = suffixClass(c.value);
    const ok = (w: string) => w !== c.value && !text.includes(w) && Math.abs(w.length - c.value.length) <= 3;
    const local = shuffle((WORD_POOL.get(`${k}|${section}`) ?? []).filter(ok), rand);
    const global = shuffle((WORD_POOL.get(`${k}|*`) ?? []).filter(ok), rand);
    picks = [...new Set([...local, ...global])].slice(0, 3);
  }
  return picks.length === 3 ? picks : null;
}

function blank(text: string, c: Cand, replacement: string): string {
  return text.slice(0, c.index) + replacement + text.slice(c.index + c.value.length);
}

function build(): Question[] {
  const questions: Question[] = [];
  const seen = new Set<string>();
  const push = (q: Question) => {
    if (seen.has(q.prompt)) return;
    seen.add(q.prompt);
    questions.push(q);
  };

  FACTS.forEach((fact, fi) => {
    const rand = rng(`fact-${fi}`);
    const cands = shuffle(candidates(fact.text), rand);
    // Prefer a spread of kinds so one fact doesn't yield four blanks of the same sort.
    const byKind = new Map<string, Cand[]>();
    for (const c of cands) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c]);
    const ordered: Cand[] = [];
    for (let round = 0; ordered.length < cands.length; round++) {
      for (const list of byKind.values()) if (list[round]) ordered.push(list[round]);
    }

    const usable: { c: Cand; wrong: string[] }[] = [];
    for (const c of ordered) {
      const wrong = distractors(c, fact.text, fact.section, rand);
      if (wrong) usable.push({ c, wrong });
    }

    usable.slice(0, 6).forEach(({ c, wrong }, k) => {
      const options = shuffle([c.value, ...wrong], rand);
      push({
        id: `c${fi}-${k}`,
        section: fact.section,
        kind: "mc",
        prompt: blank(fact.text, c, "_____"),
        options,
        answer: options.indexOf(c.value),
        explanation: fact.text,
      });
    });

    if (usable.length > 0) {
      const t = usable[0];
      push({
        id: `t${fi}-a`,
        section: fact.section,
        kind: "tf",
        prompt: fact.text,
        options: ["True", "False"],
        answer: 0,
        explanation: "This statement is accurate.",
      });
      for (let v = 0; v < Math.min(2, usable.length); v++) {
        const f = usable[(v + 1) % usable.length];
        push({
          id: `t${fi}-b${v}`,
          section: fact.section,
          kind: "tf",
          prompt: blank(fact.text, f.c, f.wrong[v % f.wrong.length]),
          options: ["True", "False"],
          answer: 1,
          explanation: `Correct statement: ${fact.text}`,
        });
      }

      if (fact.text.length <= 230) {
        const options = shuffle(
          [fact.text, ...t.wrong.map((w) => blank(fact.text, t.c, w))],
          rand,
        );
        push({
          id: `s${fi}`,
          section: fact.section,
          kind: "mc",
          prompt: `Which statement is accurate? (${fact.section})`,
          options,
          answer: options.indexOf(fact.text),
        });
      }
    }
  });

  // --- Structured questions off the lists in the back of the manual ---
  const ask = (
    id: string,
    section: string,
    prompt: string,
    answer: string,
    pool: string[],
    explanation?: string,
  ) => {
    const rand = rng(id);
    const wrong = shuffle([...new Set(pool)].filter((p) => p !== answer), rand).slice(0, 3);
    if (wrong.length < 3) return;
    const options = shuffle([answer, ...wrong], rand);
    push({ id, section, kind: "mc", prompt, options, answer: options.indexOf(answer), explanation });
  };

  for (const [office, holders] of Object.entries(OFFICE_HOLDERS)) {
    const section = `Officers: ${office}`;
    const names = holders.map((h) => h[1]);
    const chapters = holders.map((h) => h[2]);
    const allNames = Object.values(OFFICE_HOLDERS).flat().map((h) => h[1]);
    const allChapters = Object.values(OFFICE_HOLDERS).flat().map((h) => h[2]);
    const unique = (name: string) => holders.filter((h) => h[1] === name).length === 1;
    holders.forEach(([years, name, chapter], i) => {
      const [start, end] = years.split("-");
      const span = end ? `${start} to ${end}` : `${start} to the present (2016)`;
      const dupYears = holders.filter((h) => h[0] === years).length > 1;
      if (!dupYears) {
        ask(`o${office}-${i}-who`, section, `Who served as ${office} from ${span}?`, name, names.length >= 5 ? names : allNames, `${name} (${chapter}) served ${years}.`);
      }
      ask(`o${office}-${i}-ch`, section, `${name} served as ${office} (${years}). Which chapter was he from?`, chapter, chapters.length >= 5 ? chapters : allChapters);
      if (unique(name)) {
        ask(`o${office}-${i}-yr`, section, `In which years did ${name} serve as ${office}?`, years.endsWith("-") ? `${start} to present` : years, holders.map((h) => (h[0].endsWith("-") ? `${h[0].slice(0, 4)} to present` : h[0])), `${name} (${chapter}).`);
      }
    });
  }

  const cities = CONCLAVES.map((c) => c.city);
  const ordinal = (n: number) => `${n}${[, "st", "nd", "rd"][n % 10 > 3 || (n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10] ?? "th"}`;
  for (const c of CONCLAVES) {
    ask(`cv${c.n}-where`, "Conclaves", `Where was the ${ordinal(c.n)} International Conclave held?`, c.city, cities);
    if (c.year) {
      const years = CONCLAVES.filter((x) => x.year).map((x) => String(x.year));
      ask(`cv${c.n}-year`, "Conclaves", `In what year was the ${ordinal(c.n)} International Conclave (${c.city})?`, String(c.year), years);
      const sameCity = CONCLAVES.filter((x) => x.city === c.city && x.year);
      if (sameCity.length === 1) {
        ask(`cv${c.n}-num`, "Conclaves", `Which numbered Conclave was held in ${c.city} in ${c.year}?`, ordinal(c.n), CONCLAVES.map((x) => ordinal(x.n)));
      }
    }
  }

  const chaps = HEBREW_NAMES.map((h) => h[0]);
  const hebs = HEBREW_NAMES.map((h) => h[1]);
  for (const [chapter, hebrew] of HEBREW_NAMES) {
    ask(`hb-${chapter}-a`, "Original Hebrew Chapter Names", `What was the original Hebrew chapter name of ${chapter}?`, hebrew, hebs);
    ask(`hb-${chapter}-b`, "Original Hebrew Chapter Names", `Which chapter was originally named ${hebrew}?`, chapter, chaps);
  }

  const malcolmChapters = MALCOLM_AWARD.map((m) => m[1]);
  for (const [year, chapter] of MALCOLM_AWARD) {
    ask(`ma-${year}`, "Awards and Honors", `Which chapter won the Founders Achievement (Malcolm) Award in ${year}?`, chapter, malcolmChapters);
  }
  for (const chapter of new Set(malcolmChapters)) {
    const years = MALCOLM_AWARD.filter((m) => m[1] === chapter).map((m) => m[0]);
    if (years.length === 1) {
      ask(`ma-yr-${chapter}`, "Awards and Honors", `In which year did ${chapter} win the Founders Achievement (Malcolm) Award?`, String(years[0]), MALCOLM_AWARD.map((m) => String(m[0])));
    }
  }

  const letterNames = GREEK_ALPHABET.map((g) => g[0]);
  GREEK_ALPHABET.forEach(([name, upper], i) => {
    ask(`gk-${i}-pos`, "The Greek Alphabet", `Which letter is number ${i + 1} of the Greek alphabet?`, name, letterNames);
    ask(`gk-${i}-sym`, "The Greek Alphabet", `Which Greek letter is written ${upper}?`, name, letterNames);
    ask(`gk-${i}-num`, "The Greek Alphabet", `What position in the Greek alphabet does ${name} hold?`, String(i + 1), GREEK_ALPHABET.map((_, j) => String(j + 1)));
    if (i < GREEK_ALPHABET.length - 1) {
      ask(`gk-${i}-next`, "The Greek Alphabet", `Which Greek letter comes right after ${name}?`, GREEK_ALPHABET[i + 1][0], letterNames);
    }
  });

  FOUNDERS.forEach((name, i) => {
    ask(`fd-${i}`, "The Founding of Acacia", `Which of these was one of the fourteen founding members of Acacia?`, name, [
      ...Object.values(OFFICE_HOLDERS).flat().map((h) => h[1]).filter((n) => !FOUNDERS.includes(n)),
    ]);
  });

  return questions;
}

let bank: Question[] | null = null;

export function questionBank(): Question[] {
  return (bank ??= build());
}

export function sectionCounts(): { section: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const q of questionBank()) counts.set(q.section, (counts.get(q.section) ?? 0) + 1);
  return [...counts.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

export function drawQuiz(opts: { section?: string; count: number; seed: string }): Question[] {
  const pool = questionBank().filter((q) => !opts.section || q.section === opts.section);
  return shuffle(pool, rng(opts.seed)).slice(0, opts.count);
}
