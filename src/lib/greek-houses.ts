// Greek chapters at IU Bloomington, from Greekrank's IU Bloomington listing
// (greekrank.net/uni/71) — IU doesn't publish one machine-readable roster.
// Offered as the "house affiliation" dropdown on party guest lists. Anything
// missing can still be recorded under "Other"; add it here when it comes up.
export const FRATERNITIES = [
  "Acacia",
  "Alpha Epsilon Pi",
  "Alpha Kappa Lambda",
  "Alpha Phi Alpha (NPHC)",
  "Alpha Sigma Phi",
  "Alpha Tau Omega",
  "Beta Chi Theta",
  "Beta Sigma Psi",
  "Beta Theta Pi",
  "Beta Upsilon Chi",
  "Chi Phi",
  "Delta Chi",
  "Delta Kappa Epsilon",
  "Delta Sigma Phi",
  "Delta Tau Delta",
  "Delta Upsilon",
  "Iota Phi Theta (NPHC)",
  "Kappa Alpha Psi (NPHC)",
  "Kappa Delta Rho",
  "Kappa Sigma",
  "Lambda Chi Alpha",
  "Omega Psi Phi (NPHC)",
  "Phi Beta Sigma (NPHC)",
  "Phi Delta Theta",
  "Phi Gamma Delta (FIJI)",
  "Phi Kappa Psi",
  "Phi Kappa Sigma",
  "Phi Kappa Tau",
  "Phi Sigma Kappa",
  "Pi Kappa Alpha",
  "Pi Kappa Phi",
  "Pi Lambda Phi",
  "Sigma Alpha Epsilon",
  "Sigma Alpha Mu",
  "Sigma Chi",
  "Sigma Lambda Beta",
  "Sigma Nu",
  "Sigma Phi Beta",
  "Sigma Phi Epsilon",
  "Sigma Pi",
  "Tau Epsilon Phi",
  "Tau Kappa Epsilon",
  "Theta Chi",
  "Zeta Beta Tau",
] as const;

export const SORORITY_HOUSES = [
  "Alpha Chi Omega",
  "Alpha Delta Pi",
  "Alpha Epsilon Phi",
  "Alpha Gamma Delta",
  "Alpha Kappa Alpha (NPHC)",
  "Alpha Omicron Pi",
  "Alpha Phi",
  "Alpha Sigma Alpha",
  "Alpha Xi Delta",
  "Chi Omega",
  "Delta Delta Delta",
  "Delta Gamma",
  "Delta Phi Epsilon",
  "Delta Sigma Theta (NPHC)",
  "Delta Zeta",
  "Gamma Phi Beta",
  "Kappa Alpha Theta",
  "Kappa Delta",
  "Kappa Kappa Gamma",
  "Phi Mu",
  "Pi Beta Phi",
  "Sigma Delta Tau",
  "Sigma Gamma Rho (NPHC)",
  "Sigma Kappa",
  "Theta Phi Alpha",
  "Zeta Phi Beta (NPHC)",
  "Zeta Tau Alpha",
] as const;

export const NO_HOUSE = "Not in a Greek house";
export const OTHER_HOUSE = "Other / not listed";

export const GUEST_GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other / prefer not to say" },
] as const;

export const GUEST_RELATIONSHIPS = [
  "Friend",
  "Girlfriend / boyfriend",
  "Classmate",
  "Roommate",
  "Family",
  "Teammate / club",
  "Sorority sister",
  "Other",
] as const;

const LETTERS: Record<string, string> = {
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Epsilon: "Ε", Zeta: "Ζ",
  Eta: "Η", Theta: "Θ", Iota: "Ι", Kappa: "Κ", Lambda: "Λ", Mu: "Μ",
  Nu: "Ν", Xi: "Ξ", Omicron: "Ο", Pi: "Π", Rho: "Ρ", Sigma: "Σ",
  Tau: "Τ", Upsilon: "Υ", Phi: "Φ", Chi: "Χ", Psi: "Ψ", Omega: "Ω",
};

/**
 * Dropdown label: the Greek letters, then the full name in parentheses
 * ("Alpha Epsilon Pi" -> "ΑΕΠ (Alpha Epsilon Pi)"). The stored value stays the
 * plain name so analytics and past guests keep matching. Names that aren't
 * Greek letters (Acacia, the catch-all options) are shown as they are.
 */
export function houseOptionLabel(name: string): string {
  const m = name.match(/^(.*?) \((.+)\)$/);
  const base = m ? m[1] : name;
  const words = base.split(" ");
  if (!words.every((w) => LETTERS[w])) return name;
  const letters = words.map((w) => LETTERS[w]).join("");
  return `${letters} (${m ? `${base}, ${m[2]}` : base})`;
}
