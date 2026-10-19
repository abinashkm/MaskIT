import { enabledEntityTypes, type EntityType } from "@maskit/core";
import { bump, maskString, replacementFor } from "./mask.js";
import type { FileMaskOptions, Tally } from "./types.js";

export type Delimiter = "," | ";" | "\t";

/** Picks the delimiter that appears most in the first line (outside quotes is overkill here). */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: [Delimiter, number][] = [",", ";", "\t"].map((d) => [
    d as Delimiter,
    firstLine.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0] && counts[0][1] > 0 ? counts[0][0] : ",";
}

/** RFC 4180 style parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"' && field === "") inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function stringifyCsv(rows: string[][], delimiter: Delimiter, eol = "\n"): string {
  const quote = (f: string) =>
    f.includes(delimiter) || /["\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f;
  return rows.map((r) => r.map(quote).join(delimiter)).join(eol) + (rows.length ? eol : "");
}

/** Column names that reveal what a cell holds even when the value alone looks harmless. */
const HEADER_HINTS: [RegExp, EntityType][] = [
  [/^(e?mail|emailaddress)$/, "EMAIL"],
  [/^(ssn|socialsecurity(number)?)$/, "US_SSN"],
  [/^(phone|tel|telephone|mobile|cell|fax)(number|no)?$/, "PHONE"],
  [
    /^(name|fullname|firstname|lastname|surname|givenname|patientname|customername|employeename)$/,
    "PERSON",
  ],
  [/^(dob|dateofbirth|birthdate|birthday)$/, "DATE_OF_BIRTH"],
  [/^(address|streetaddress|homeaddress)$/, "US_ADDRESS"],
  [/^(mrn|medicalrecordnumber|patientid)$/, "MEDICAL_RECORD_NUMBER"],
  [/^(password|passwd)$/, "PASSWORD"],
  [/^(secret|apikey|token|accesstoken)$/, "SECRET"],
  [/^(creditcard(number)?|cardnumber|ccnumber)$/, "CREDIT_CARD"],
  [/^iban$/, "IBAN"],
  [/^(accountnumber|bankaccount|bankaccountnumber)$/, "BANK_ACCOUNT"],
  [/^passport(number|no)?$/, "PASSPORT"],
];

export function hintForHeader(header: string): EntityType | undefined {
  const key = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_HINTS.find(([re]) => re.test(key))?.[1];
}

export function maskCsv(
  text: string,
  options: FileMaskOptions,
  tally: Tally,
): { text: string; delimiter: Delimiter } {
  const delimiter = detectDelimiter(text);
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // drop a byte order mark
  const rows = parseCsv(body, delimiter);
  const enabled = enabledEntityTypes({
    level: options.level,
    entityTypes: options.entityTypes,
  });
  const hints = (rows[0] ?? []).map((h) => {
    const hint = hintForHeader(h);
    return hint && enabled.has(hint) ? hint : undefined;
  });

  const masked = rows.map((row, r) =>
    row.map((cell, c) => {
      if (r === 0 || cell.trim() === "") return cell; // keep the header row readable
      const hint = hints[c];
      if (hint) {
        bump(tally, hint);
        return options.style === "redact"
          ? "[REDACTED]"
          : replacementFor(hint, cell.trim(), options);
      }
      return maskString(cell, options, tally);
    }),
  );
  return { text: stringifyCsv(masked, delimiter, eol), delimiter };
}
