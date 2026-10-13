import { rng, type Question } from "./curriculum/generator";

export interface HometownPerson {
  name: string;
  // "City, ST"
  hometown: string;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const stateOf = (hometown: string) => hometown.split(",").pop()?.trim() ?? "";

// Three distractors drawn from `pool`, never equal to anything in `exclude`.
function pick(pool: string[], exclude: Set<string>, rand: () => number, n = 3): string[] | null {
  const unique = [...new Set(pool)].filter((p) => !exclude.has(p));
  if (unique.length < n) return null;
  return shuffle(unique, rand).slice(0, n);
}

function mc(
  id: string,
  prompt: string,
  correct: string,
  distractors: string[],
  rand: () => number,
  explanation: string,
): Question {
  const options = shuffle([correct, ...distractors], rand);
  return {
    id,
    section: "Hometowns",
    kind: "mc",
    prompt,
    options,
    answer: options.indexOf(correct),
    explanation,
  };
}

// Three question shapes per person (where are they from, who is from there,
// which state). A pair of people from the same town never appear as each
// other's wrong answers.
export function hometownQuestions(people: HometownPerson[], seed: string): Question[] {
  const rand = rng(seed);
  const known = people.filter((p) => p.name && p.hometown);
  const towns = known.map((p) => p.hometown);
  const states = known.map((p) => stateOf(p.hometown));
  const out: Question[] = [];

  for (const p of known) {
    const sameTown = new Set(known.filter((k) => k.hometown === p.hometown).map((k) => k.name));
    const sameState = new Set(
      known.filter((k) => stateOf(k.hometown) === stateOf(p.hometown)).map((k) => k.hometown),
    );

    const wrongTowns = pick(towns, new Set([p.hometown]), rand);
    if (wrongTowns) {
      out.push(
        mc(`ht-where-${p.name}`, `Where is ${p.name} from?`, p.hometown, wrongTowns, rand, `${p.name} is from ${p.hometown}.`),
      );
    }

    const wrongNames = pick(known.map((k) => k.name), sameTown, rand);
    if (wrongNames) {
      out.push(
        mc(`ht-who-${p.name}`, `Who is from ${p.hometown}?`, p.name, wrongNames, rand, `${p.name} is from ${p.hometown}.`),
      );
    }

    const wrongStates = pick(states, new Set([stateOf(p.hometown)]), rand);
    if (wrongStates && sameState.size > 0) {
      out.push(
        mc(
          `ht-state-${p.name}`,
          `Which state is ${p.name} from?`,
          stateOf(p.hometown),
          wrongStates,
          rand,
          `${p.name} is from ${p.hometown}.`,
        ),
      );
    }
  }

  return shuffle(out, rand);
}
