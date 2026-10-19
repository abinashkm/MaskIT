import type { EntityType } from "@maskit/core";
import { Rng } from "./rng.js";

export interface Gold {
  type: EntityType;
  start: number;
  end: number;
}

export interface Case {
  text: string;
  gold: Gold[];
}

type Part = string | { t: EntityType; v: string };

/** Joins text and labeled values into one sentence and records where each value sits. */
export function build(parts: Part[]): Case {
  let text = "";
  const gold: Gold[] = [];
  for (const p of parts) {
    if (typeof p === "string") text += p;
    else {
      gold.push({ type: p.t, start: text.length, end: text.length + p.v.length });
      text += p.v;
    }
  }
  return { text, gold };
}

// ---------- checksum helpers (so generated numbers are genuinely valid) ----------

export function luhnComplete(prefix: string): string {
  // Append the check digit that makes the whole number pass Luhn.
  for (let d = 0; d <= 9; d++) {
    const candidate = prefix + String(d);
    let sum = 0;
    let dbl = false;
    for (let i = candidate.length - 1; i >= 0; i--) {
      let n = Number(candidate[i]);
      if (dbl) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      dbl = !dbl;
    }
    if (sum % 10 === 0) return candidate;
  }
  throw new Error("unreachable");
}

function mod97(numeric: string): number {
  let r = 0;
  for (const ch of numeric) r = (r * 10 + Number(ch)) % 97;
  return r;
}

export function makeIban(rng: Rng): string {
  const bank = rng.pick(["WEST", "NWBK", "BARC", "LOYD"]);
  const bban = bank + rng.digits(14);
  // Letters become 10..35; country "GB" = 1611, check digits placeholder "00".
  const numeric = [...(bban + "GB00")]
    .map((c) => (c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c))
    .join("");
  const check = String(98 - mod97(numeric)).padStart(2, "0");
  return `GB${check}${bban}`;
}

export function makeRouting(rng: Rng): string {
  const d = rng.digits(8).split("").map(Number) as number[];
  const sum =
    3 * ((d[0] ?? 0) + (d[3] ?? 0) + (d[6] ?? 0)) +
    7 * ((d[1] ?? 0) + (d[4] ?? 0) + (d[7] ?? 0)) +
    ((d[2] ?? 0) + (d[5] ?? 0));
  return d.join("") + String((10 - (sum % 10)) % 10);
}

// ---------- word lists ----------

const FIRST = [
  "Jane",
  "Raj",
  "Maria",
  "Chen",
  "Omar",
  "Priya",
  "Liam",
  "Sofia",
  "Aiko",
  "Noah",
  "Fatima",
  "Lucas",
  "Anika",
  "Diego",
  "Hana",
  "Ethan",
];
const LAST = [
  "Doe",
  "Patel",
  "Garcia",
  "Wang",
  "Hassan",
  "Sharma",
  "Murphy",
  "Rossi",
  "Tanaka",
  "Smith",
  "Khan",
  "Silva",
  "Mehta",
  "Lopez",
  "Kim",
  "Brown",
];
const STREETS = ["Baker", "Maple", "Oak", "Cedar", "Pine", "Elm", "Lake", "Hill", "Sunset", "Park"];
const SUFFIX = ["Street", "Avenue", "Road", "Boulevard", "Lane", "Drive", "Court", "Way"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const FILLER_BEFORE = [
  "Please note that ",
  "Hi team, ",
  "Reminder: ",
  "As discussed, ",
  "FYI ",
  "Update for the file. ",
  "",
];
const FILLER_AFTER = [" Thanks.", " Let me know.", " Please confirm.", " That is all.", ""];

export const fullName = (rng: Rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;

function wrap(rng: Rng, parts: Part[]): Case {
  return build([rng.pick(FILLER_BEFORE), ...parts, rng.pick(FILLER_AFTER)]);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function randomDate(rng: Rng): { y: number; m: number; d: number } {
  return { y: rng.int(1930, 2024), m: rng.int(1, 12), d: rng.int(1, 28) };
}

function formatDate(rng: Rng, { y, m, d }: { y: number; m: number; d: number }): string {
  switch (rng.int(0, 3)) {
    case 0:
      return `${y}-${pad2(m)}-${pad2(d)}`;
    case 1:
      return `${pad2(m)}/${pad2(d)}/${y}`;
    case 2:
      return `${MONTHS[m - 1]} ${d}, ${y}`;
    default:
      return `${d} ${MONTHS[m - 1]} ${y}`;
  }
}

// ---------- positive generators, one per entity type ----------

type Generator = (rng: Rng) => Case;

export const GENERATORS: Partial<Record<EntityType, Generator>> = {
  EMAIL: (rng) => {
    const user = rng
      .pick([
        `${rng.pick(FIRST)}.${rng.pick(LAST)}`,
        `${rng.pick(FIRST)}${rng.int(1, 99)}`,
        `${rng.pick(FIRST)}_${rng.pick(LAST)}+tag`,
      ])
      .toLowerCase();
    const email = `${user}@${rng.pick(["example.com", "mail.example.org", "corp.co.uk", "hospital.health"])}`;
    return wrap(rng, [
      rng.pick(["Contact ", "Send it to ", "Email: ", "Reach me at "]),
      { t: "EMAIL", v: email },
    ]);
  },
  PHONE: (rng) => {
    const a = rng.int(201, 989);
    const b = rng.int(200, 999);
    const c = rng.digits(4);
    const v = rng.pick([
      `(${a}) ${b}-${c}`,
      `${a}-${b}-${c}`,
      `${a}.${b}.${c}`,
      `+1 ${a} ${b} ${c}`,
      `+44 20 ${rng.digits(4)} ${rng.digits(4)}`,
      `+91 ${rng.digits(5)} ${rng.digits(5)}`,
    ]);
    return wrap(rng, [
      rng.pick(["Call ", "Phone: ", "Mobile ", "Reach us on "]),
      { t: "PHONE", v },
    ]);
  },
  US_SSN: (rng) => {
    const area = rng.int(1, 665);
    const v = rng.pick([
      `${String(area).padStart(3, "0")}-${pad2(rng.int(1, 99))}-${String(rng.int(1, 9999)).padStart(4, "0")}`,
    ]);
    return wrap(rng, [rng.pick(["SSN: ", "Social Security number ", "SSN "]), { t: "US_SSN", v }]);
  },
  CREDIT_CARD: (rng) => {
    const prefix = rng.pick(["4", "51", "37", "6011"]);
    const len = prefix === "37" ? 15 : 16;
    const num = luhnComplete(prefix + rng.digits(len - prefix.length - 1));
    const v = rng.pick([
      num,
      num.replace(/(\d{4})(?=\d)/g, "$1 "),
      num.replace(/(\d{4})(?=\d)/g, "$1-"),
    ]);
    return wrap(rng, [rng.pick(["Card ", "Pay with ", "Visa number "]), { t: "CREDIT_CARD", v }]);
  },
  IBAN: (rng) => {
    const iban = makeIban(rng);
    const v = rng.pick([iban, iban.replace(/(.{4})/g, "$1 ").trim()]);
    return wrap(rng, [rng.pick(["IBAN: ", "Transfer to ", "Account "]), { t: "IBAN", v }]);
  },
  BANK_ACCOUNT: (rng) => {
    if (rng.int(0, 1) === 0) {
      return wrap(rng, [
        rng.pick(["Account number: ", "Acct no. ", "account #"]),
        { t: "BANK_ACCOUNT", v: rng.digits(rng.int(8, 12)) },
      ]);
    }
    return wrap(rng, ["Routing number ", { t: "BANK_ACCOUNT", v: makeRouting(rng) }]);
  },
  IP_ADDRESS: (rng) => {
    const v4 = `${rng.int(1, 223)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
    const v6 = Array.from({ length: 8 }, () => rng.hex(4)).join(":");
    return wrap(rng, [
      rng.pick(["Server ", "Client IP ", "Logged from "]),
      { t: "IP_ADDRESS", v: rng.int(0, 3) === 0 ? v6 : v4 },
    ]);
  },
  MAC_ADDRESS: (rng) => {
    const sep = rng.pick([":", "-"]);
    const v = Array.from({ length: 6 }, () => rng.hex(2, true)).join(sep);
    return wrap(rng, ["Device MAC ", { t: "MAC_ADDRESS", v }]);
  },
  GPS_COORDINATES: (rng) => {
    const v = `${(rng.next() * 160 - 80).toFixed(rng.int(4, 6))}, ${(rng.next() * 340 - 170).toFixed(rng.int(4, 6))}`;
    return wrap(rng, ["Location ", { t: "GPS_COORDINATES", v }]);
  },
  SECRET: (rng) => {
    // Assembled from pieces so secret scanners do not flag this repository.
    const v = rng.pick([
      "AKIA" +
        rng
          .alnum(16)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "A"),
      "ghp_" + rng.alnum(36),
      "sk_" + "live_" + rng.alnum(24),
      "eyJ" + rng.alnum(17) + "." + "eyJ" + rng.alnum(24) + "." + rng.alnum(22),
      "sk-" + rng.alnum(40),
      "xox" + "b-" + rng.digits(11) + "-" + rng.alnum(24),
    ]);
    return wrap(rng, [rng.pick(["key ", "Use this: ", "token="]), { t: "SECRET", v }]);
  },
  PASSWORD: (rng) => {
    const v = rng.alnum(rng.int(8, 14));
    return wrap(rng, [
      rng.pick(["password: ", "Password = ", "the password is ", "pwd:"]),
      { t: "PASSWORD", v },
    ]);
  },
  URL_CREDENTIALS: (rng) => {
    if (rng.int(0, 1) === 0) {
      const v = `${rng.pick(["admin", "svc", "deploy"])}:${rng.alnum(10)}`;
      return build(["Clone https://", { t: "URL_CREDENTIALS", v }, "@git.example.com/repo.git"]);
    }
    return build([
      "Open https://app.example.com/report?id=7&token=",
      { t: "URL_CREDENTIALS", v: rng.alnum(20) },
      "&view=full",
    ]);
  },
  PERSON: (rng) => {
    const label = rng.pick([
      "Patient: ",
      "Name: ",
      "Dear ",
      "Mr. ",
      "Dr. ",
      "Client: ",
      "Employee: ",
    ]);
    return wrap(rng, [label, { t: "PERSON", v: fullName(rng) }]);
  },
  US_ADDRESS: (rng) => {
    const v = `${rng.int(1, 9999)} ${rng.pick(STREETS)} ${rng.pick(SUFFIX)}`;
    return wrap(rng, [
      "Ship to ",
      { t: "US_ADDRESS", v },
      rng.pick([", Springfield", ", Boston MA", ""]),
    ]);
  },
  DATE_OF_BIRTH: (rng) => {
    const v = formatDate(rng, randomDate(rng));
    return wrap(rng, [
      rng.pick(["DOB: ", "Date of birth: ", "born on ", "Birthdate "]),
      { t: "DATE_OF_BIRTH", v },
    ]);
  },
  DATE: (rng) => {
    const v = formatDate(rng, { y: rng.int(2015, 2025), m: rng.int(1, 12), d: rng.int(1, 28) });
    return wrap(rng, [
      rng.pick(["Admitted on ", "Visit date ", "Invoice dated ", "Seen "]),
      { t: "DATE", v },
    ]);
  },
  MEDICAL_RECORD_NUMBER: (rng) => {
    return wrap(rng, [
      rng.pick(["MRN: ", "Medical record number ", "Patient ID: ", "MRN#"]),
      { t: "MEDICAL_RECORD_NUMBER", v: rng.digits(rng.int(7, 10)) },
    ]);
  },
  PASSPORT: (rng) => {
    const v = rng.pick(["A", "X", "P"]) + rng.digits(8);
    return wrap(rng, [
      rng.pick(["Passport number: ", "Passport No ", "passport #"]),
      { t: "PASSPORT", v },
    ]);
  },
  AGE_OVER_89: (rng) => {
    const age = rng.int(90, 104);
    return rng.int(0, 1) === 0
      ? wrap(rng, ["A ", { t: "AGE_OVER_89", v: `${age}-year-old` }, " patient presented."])
      : wrap(rng, ["Patient ", { t: "AGE_OVER_89", v: `aged ${age}` }, " with fever."]);
  },
};

// ---------- known-gap set: things the rules layer is NOT expected to catch ----------

export const HARD_GENERATORS: Record<string, { type: EntityType; make: Generator }> = {
  "unlabeled person name": {
    type: "PERSON",
    make: (rng) =>
      build([
        rng.pick(["Yesterday ", "Later ", "Meanwhile "]),
        { t: "PERSON", v: fullName(rng) },
        rng.pick([" met the vendor in the lobby.", " approved the budget.", " left early."]),
      ]),
  },
  "phone digits without context": {
    type: "PHONE",
    make: (rng) =>
      build([
        "Noted ",
        { t: "PHONE", v: `${rng.int(201, 989)}${rng.int(200, 999)}${rng.digits(4)}` },
        " was handled by the desk.",
      ]),
  },
  "SSN digits without dashes or context": {
    type: "US_SSN",
    make: (rng) =>
      build([
        "Value ",
        { t: "US_SSN", v: `${rng.int(100, 665)}${pad2(rng.int(1, 99))}${rng.digits(4)}` },
        " was entered.",
      ]),
  },
  "date of birth without a label": {
    type: "DATE_OF_BIRTH",
    make: (rng) =>
      build([
        "Jane (",
        { t: "DATE_OF_BIRTH", v: formatDate(rng, randomDate(rng)) },
        ") is the applicant.",
      ]),
  },
  "non-US street address": {
    type: "US_ADDRESS",
    make: (rng) =>
      build([
        "Visit ",
        {
          t: "US_ADDRESS",
          v: `${rng.int(1, 99)} ${rng.pick(["Rue de la Paix", "Hauptstrasse", "Via Roma", "Calle Mayor"])}`,
        },
        " tomorrow.",
      ]),
  },
};

// ---------- negatives: ordinary text that must not be masked at the default level ----------

export function negatives(rng: Rng, count: number): string[] {
  const out: string[] = [];
  const makers: (() => string)[] = [
    () => `const total = items.reduce((a, b) => a + b.price, 0); // ${rng.int(1, 999)} items`,
    () =>
      `Released v${rng.int(0, 9)}.${rng.int(0, 20)}.${rng.int(0, 99)} with ${rng.int(2, 40)} fixes.`,
    () =>
      `Invoice ${rng.digits(9)} totals $${rng.int(10, 9999)}.${rng.digits(2)} (net ${rng.int(10, 60)} days).`,
    () =>
      `The meeting moved to ${rng.int(1, 12)}:${pad2(rng.int(0, 59))} on floor ${rng.int(1, 30)}, room ${rng.int(100, 999)}.`,
    () => `commit ${rng.hex(40)} fixes the cache bug`,
    () =>
      `uuid ${rng.hex(8)}-${rng.hex(4)}-${rng.hex(4)}-${rng.hex(4)}-${rng.hex(12)} was generated`,
    () =>
      `Quarterly revenue grew ${rng.int(1, 40)}% across ${rng.int(2, 9)} regions, led by operations.`,
    () =>
      `if (retries > ${rng.int(1, 9)}) { throw new Error("timeout after ${rng.int(100, 9000)}ms"); }`,
    () => `Order ${rng.digits(10)} shipped; tracking pending.`,
    () =>
      `Version ${rng.int(1, 9)}.${rng.int(0, 9)}.${rng.int(0, 9)}.${rng.int(0, 9)} of the library is out.`,
    () => `Please review pages ${rng.int(1, 20)}-${rng.int(21, 80)} and send comments by Friday.`,
    () => `SELECT id, name FROM users WHERE age > ${rng.int(18, 60)} LIMIT ${rng.int(10, 500)};`,
    () =>
      `Weather: ${rng.int(-10, 40)} degrees, wind ${rng.int(0, 60)} km/h, humidity ${rng.int(10, 99)}%.`,
    () => `Our password policy requires rotation; reset your password via the portal.`,
    () => `The team will meet the customer to discuss the roadmap and the next release.`,
  ];
  for (let i = 0; i < count; i++) out.push((makers[i % makers.length] as () => string)());
  return out;
}
