/**
 * A small, hand-written set of messy, realistic documents. Unlike the generated set, none of
 * this was produced by code written to match the recognizers, so it is a fairer (still small,
 * author-labeled) check. Everything sensitive is marked inline as {{TYPE|value}}; the parser
 * removes the markup and records where each value sits. All people, numbers and addresses are
 * invented. Secrets are assembled from pieces so secret scanners do not flag this repository.
 */
import type { EntityType } from "@maskit/core";
import type { Case, Gold } from "./generators.js";

const GH = "ghp_" + "Zk3" + "a".repeat(33);
const AWS = "AKIA" + "QWERTYUIOPASDFGH";
const STRIPE = "sk_" + "live_" + "51Hq8wLmN0pQrStUvWxYz";
const JWT =
  "eyJhbGciOiJIUzI1NiJ9" +
  "." +
  "eyJ1aWQiOjQ0LCJyb2xlIjoiYWRtaW4ifQ" +
  "." +
  "dGhpc2lzbm90YXJlYWxzaWc";

export const REALISTIC_DOCS: string[] = [
  // 1 clinical note
  `Patient: {{PERSON|Maria Gonzalez}}, DOB {{DATE_OF_BIRTH|04/12/1957}}, MRN {{MEDICAL_RECORD_NUMBER|5503821}}. Seen at {{ORGANIZATION|St. Mary's Hospital}} on {{DATE|March 3, 2024}} for chest pain. Her daughter {{PERSON|Elena Gonzalez}} can be reached at {{PHONE|(312) 555-0187}}. BP 142/88, HR 76. Plan: continue metoprolol 50 mg, follow up in 2 weeks.`,
  // 2 business email
  `Hi {{PERSON|Priya}}, following up on the invoice for {{ORGANIZATION|Northwind Traders}}. Please wire the balance to IBAN {{IBAN|DE89 3704 0044 0532 0130 00}} by {{DATE|15 November 2025}}. You can reach me at {{EMAIL|tom.becker@northwind.example}} or {{PHONE|+49 30 1234 5678}}.\nRegards,\n{{PERSON|Tom Becker}}`,
  // 3 support chat
  `Customer: my card {{CREDIT_CARD|5500 0000 0000 0004}} was charged twice\nAgent: Sorry about that, can you confirm your billing address?\nCustomer: {{US_ADDRESS|742 Evergreen Terrace}}, {{LOCATION|Springfield}}\nAgent: Thanks. And the email on the account?\nCustomer: {{EMAIL|homer.j@springfield-power.example}}`,
  // 4 server log
  `{{DATE|2025-10-03}} 14:22:07 INFO login ok user={{EMAIL|alice@corp.example}} ip={{IP_ADDRESS|10.12.4.77}}\n{{DATE|2025-10-03}} 14:22:09 WARN failed login user=bob ip={{IP_ADDRESS|203.0.113.45}}\n{{DATE|2025-10-03}} 14:22:15 DEBUG upstream auth token={{SECRET|${GH}}} refreshed`,
  // 5 HR record
  `Employee: {{PERSON|Rahul Verma}}  SSN: {{US_SSN|536-22-4417}}  Hired: {{DATE|2019-06-17}}\nHome: {{US_ADDRESS|1450 Mission Street}}, {{LOCATION|San Francisco}}, CA 94103\nEmergency contact: {{PERSON|Anita Verma}} ({{PHONE|415-555-0132}})\nSalary band: L5. Manager: {{PERSON|Joan Whitfield}}.`,
  // 6 contract
  `This agreement is made on {{DATE|January 5, 2025}} between {{ORGANIZATION|Acme Holdings LLC}} and Dr. {{PERSON|Sarah Lin}}, residing at {{US_ADDRESS|88 Cedar Lane}}. Notices to {{EMAIL|legal@acme-holdings.example}}.`,
  // 7 lab report
  `LAB REPORT\nName: {{PERSON|Kenji Watanabe}}   Sex: M   Age: 67\nCollected: {{DATE|10/02/2025}}  Accession: {{MEDICAL_RECORD_NUMBER|A2291847}}\nGlucose 5.4 mmol/L (ref 3.9-5.6)`,
  // 8 shared credentials
  `Staging login, user: deploy, password: {{PASSWORD|Tr0ub4dor&3x}} - please change after the demo.`,
  // 9 env file
  `DATABASE_URL=postgres://{{URL_CREDENTIALS|app:s3cr3tPass}}@db.internal:5432/prod\nAWS_ACCESS_KEY_ID={{SECRET|${AWS}}}\nSTRIPE_KEY={{SECRET|${STRIPE}}}\nLOG_LEVEL=info`,
  // 10 elderly patient
  `{{AGE_OVER_89|92-year-old}} female admitted {{DATE|June 9, 2025}} with a fall at home. Lives alone. No known drug allergies.`,
  // 11 travel booking
  `Passenger: {{PERSON|Fatima Alsayed}}, passport {{PASSPORT|K8821934}}, flight BA117 on {{DATE|2025-12-02}}. Contact {{PHONE|+44 7700 900123}}.`,
  // 12 insurance
  `Policy holder {{PERSON|Daniel Obrien}}, member ID {{MEDICAL_RECORD_NUMBER|MBR-7731905}}, group 40021. Claim filed {{DATE|8 August 2025}}.`,
  // 13 casual chat
  `yo it's mike, new number is {{PHONE|646 555 0199}} text me, don't use the old one`,
  // 14 delivery pin
  `Delivery pin dropped at {{GPS_COORDINATES|40.712776, -74.005974}}, leave with the neighbour if no answer.`,
  // 15 negative: medical narrative
  `The patient has a history of hypertension and type 2 diabetes. Metformin 500 mg twice daily. No known drug allergies. Follow-up in 3 months.`,
  // 16 negative: code
  `def total(items):\n    return sum(i.price * i.qty for i in items)  # 12 items, release 2.3.1`,
  // 17 negative: meeting notes
  `Agenda: Q3 roadmap, hiring plan, budget review. Action items: finalize the spec by Friday and share the deck with the team. Room 304, ext 4421.`,
  // 18 email header
  `From: {{PERSON|Linda Park}} <{{EMAIL|linda.park@globex.example}}>\nTo: {{EMAIL|team@globex.example}}\nSent: Tuesday, {{DATE|September 9, 2025}}\nSubject: Offsite logistics`,
  // 19 shipping
  `Ship to: {{US_ADDRESS|1600 Pennsylvania Avenue}} NW, {{LOCATION|Washington}}, DC 20500. Leave at the front desk.`,
  // 20 UK phone in prose
  `Call me on {{PHONE|020 7946 0958}} after 6, or email {{EMAIL|j.smith@bluebird.example}}.`,
  // 21 bank details
  `Account number {{BANK_ACCOUNT|00123456789}}, routing {{BANK_ACCOUNT|021000021}}. Please confirm receipt.`,
  // 22 casual SSN
  `my social is {{US_SSN|078-05-1120}} if the form needs it`,
  // 23 DOB variants
  `Applicant born {{DATE_OF_BIRTH|12 May 1988}}. Previous record lists D.O.B.: {{DATE_OF_BIRTH|1988-05-12}}.`,
  // 24 Spanish
  `Paciente: {{PERSON|Carlos Mendoza}}, nacido el {{DATE_OF_BIRTH|3 de marzo de 1971}}, telefono {{PHONE|+34 612 345 678}}.`,
  // 25 signature
  `Thanks for your help.\n{{PERSON|Priya Nair}}\nSenior Engineer, {{ORGANIZATION|Initech}}\n{{PHONE|+1 (206) 555-0114}}`,
  // 26 JSON payload
  `{"user":{"email":"{{EMAIL|sam.rivera@example.org}}","phone":"{{PHONE|+1 202 555 0143}}","password":"{{PASSWORD|hunter42x}}"}}`,
  // 27 reset link
  `Reset link: https://app.example.com/reset?token={{URL_CREDENTIALS|9f8e7d6c5b4a39281706}}&uid=44 (valid 1 hour)`,
  // 28 negative: order numbers and times
  `Order 55123 shipped on {{DATE|2025-07-04}}, tracking 1Z999AA10123456784. The call is at 10:30 in room 12.`,
  // 29 title and name
  `Mrs. {{PERSON|Evelyn Hart}} called about her bill and asked for a callback tomorrow.`,
  // 30 card in prose
  `Please charge card {{CREDIT_CARD|4242-4242-4242-4242}} exp 09/27 cvv 123 for the renewal.`,
  // 31 JWT in header dump
  `Authorization: Bearer {{SECRET|${JWT}}}\nUser-Agent: curl/8.4.0\nAccept: */*`,
  // 32 patient narrative with several names
  `{{PERSON|Mr. Alan Brooks}} was referred by {{PERSON|Dr. Meera Iyer}} at {{ORGANIZATION|Riverside Clinic}}. He reports no changes since {{DATE|April 2, 2025}}.`,
];

const MARK = /\{\{([A-Z_0-9]+)\|([\s\S]*?)\}\}/g;

export function parseMarked(source: string): Case {
  let text = "";
  const gold: Gold[] = [];
  let last = 0;
  for (const m of source.matchAll(MARK)) {
    text += source.slice(last, m.index);
    const value = m[2] as string;
    gold.push({ type: m[1] as EntityType, start: text.length, end: text.length + value.length });
    text += value;
    last = m.index + m[0].length;
  }
  return { text: text + source.slice(last), gold };
}

export function realisticCases(): Case[] {
  return REALISTIC_DOCS.map(parseMarked);
}
