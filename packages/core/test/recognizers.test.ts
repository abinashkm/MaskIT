import { describe, expect, it } from "vitest";
import { analyze, type EntityType } from "../src/index.js";

/** Returns the masked substrings of one type, using the strictest level with no threshold. */
function found(text: string, type: EntityType): string[] {
  return analyze(text, { level: "strict", minConfidence: 0 })
    .filter((f) => f.entityType === type)
    .map((f) => text.slice(f.start, f.end));
}

describe("email", () => {
  it("finds valid emails", () => {
    expect(found("mail jane.doe+x@example.co.uk now", "EMAIL")).toEqual([
      "jane.doe+x@example.co.uk",
    ]);
  });
  it("ignores non-emails", () => {
    expect(found("user@ or @handle or a@b", "EMAIL")).toEqual([]);
  });
});

describe("phone", () => {
  it("finds formatted US and international numbers", () => {
    expect(found("Call (415) 555-2671 or +44 20 7946 0958", "PHONE")).toEqual([
      "(415) 555-2671",
      "+44 20 7946 0958",
    ]);
  });
  it("needs context for bare digit runs", () => {
    const text = "noted 4155552671 today";
    expect(found(text, "PHONE")).toHaveLength(1); // found at low confidence (strict only)
    expect(analyze(text, { level: "standard" })).toEqual([]);
    expect(analyze("phone: 4155552671", { level: "standard" })).toHaveLength(1);
  });
  it("ignores numbers labeled as orders, invoices, tickets and the like", () => {
    expect(found("order 4155552671 shipped", "PHONE")).toEqual([]);
    expect(found("Invoice no. 4155552671", "PHONE")).toEqual([]);
    expect(found("tracking: 4155552671", "PHONE")).toEqual([]);
  });
  it("does not take IP addresses, MAC addresses or UUID pieces for phones", () => {
    expect(found("host 38.26.148.177", "PHONE")).toEqual([]);
    expect(found("mac 53-29-26-68-07-58", "PHONE")).toEqual([]);
    expect(found("id 89268724-1506-5e3c-267c-5077584d9283", "PHONE")).toEqual([]);
  });
  it("does not treat dates as phones", () => {
    expect(found("on 2024-03-15 12", "PHONE")).toEqual([]);
  });
});

describe("credit card", () => {
  it("accepts Luhn-valid cards with separators", () => {
    expect(found("card 4111 1111 1111 1111 ok", "CREDIT_CARD")).toEqual(["4111 1111 1111 1111"]);
    expect(found("card 4111-1111-1111-1111 ok", "CREDIT_CARD")).toEqual(["4111-1111-1111-1111"]);
  });
  it("rejects Luhn-invalid numbers", () => {
    expect(found("card 4111 1111 1111 1112", "CREDIT_CARD")).toEqual([]);
  });
  it("beats phone on overlap", () => {
    const f = analyze("pay 4111111111111111", { level: "strict" });
    expect(f.map((x) => x.entityType)).toEqual(["CREDIT_CARD"]);
  });
});

describe("iban", () => {
  it("accepts valid IBANs", () => {
    expect(found("send to GB82 WEST 1234 5698 7654 32 today", "IBAN")).toEqual([
      "GB82 WEST 1234 5698 7654 32",
    ]);
    expect(found("DE89370400440532013000", "IBAN")).toEqual(["DE89370400440532013000"]);
  });
  it("rejects bad checksum", () => {
    expect(found("GB82 WEST 1234 5698 7654 33", "IBAN")).toEqual([]);
  });
});

describe("US SSN", () => {
  it("accepts valid dashed SSNs", () => {
    expect(found("ssn 123-45-6789", "US_SSN")).toEqual(["123-45-6789"]);
  });
  it("rejects invalid structures", () => {
    expect(found("000-12-3456 666-12-3456 900-12-3456 123-00-4567 123-45-0000", "US_SSN")).toEqual(
      [],
    );
  });
  it("accepts bare nine digits only with context", () => {
    expect(found("SSN: 123456789", "US_SSN")).toEqual(["123456789"]);
    expect(found("id 123456789", "US_SSN")).toEqual([]);
  });
});

describe("bank account", () => {
  it("finds labeled account numbers and valid routing numbers", () => {
    expect(found("Account number: 12345678901", "BANK_ACCOUNT")).toEqual(["12345678901"]);
    expect(found("routing 021000021", "BANK_ACCOUNT")).toEqual(["021000021"]);
    expect(found("routing 021000022", "BANK_ACCOUNT")).toEqual([]);
  });
});

describe("secrets", () => {
  // Built by concatenation so source scanners do not flag fake keys in this repo.
  const aws = "AKIA" + "IOSFODNN7EXAMPLE";
  const github = "ghp_" + "a".repeat(36);
  const stripe = "sk_" + "live_" + "abcdefghijklmnop1234";
  const jwt =
    "eyJhbGciOiJIUzI1NiJ9" + "." + "eyJzdWIiOiIxMjM0NTY3ODkwIn0" + "." + "abcdefghijk12345";
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----";

  it.each([aws, github, stripe, jwt, pem])("detects %s", (secret) => {
    expect(found(`key ${secret} end`, "SECRET")).toEqual([secret]);
  });
  it("detects password and token after keywords, value only", () => {
    expect(found("password: hunter2!", "PASSWORD")).toEqual(["hunter2!"]);
    expect(found('api_key = "abcd1234"', "SECRET")).toEqual(["abcd1234"]);
    expect(found("the password is swordfish.", "PASSWORD")).toEqual(["swordfish."]);
  });
  it("ignores the word password alone", () => {
    expect(found("reset your password via email", "PASSWORD")).toEqual([]);
  });
  it("finds credentials inside URLs", () => {
    expect(found("https://user:pa55@host.com/x", "URL_CREDENTIALS")).toEqual(["user:pa55"]);
    expect(found("https://x.com/a?id=1&token=abc123&b=2", "URL_CREDENTIALS")).toEqual(["abc123"]);
  });
});

describe("network", () => {
  it("finds valid IPv4/IPv6 and rejects invalid", () => {
    expect(found("ip 192.168.1.10 and 999.1.1.1", "IP_ADDRESS")).toEqual(["192.168.1.10"]);
    expect(found("v6 2001:0db8:85a3:0000:0000:8a2e:0370:7334 and ::1", "IP_ADDRESS")).toEqual([
      "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      "::1",
    ]);
  });
  it("finds MAC addresses and GPS coordinates", () => {
    expect(found("mac 00:1A:2B:3C:4D:5E", "MAC_ADDRESS")).toEqual(["00:1A:2B:3C:4D:5E"]);
    expect(found("at 37.7749, -122.4194 now", "GPS_COORDINATES")).toEqual(["37.7749, -122.4194"]);
    expect(found("at 97.7749, -122.4194", "GPS_COORDINATES")).toEqual([]);
  });
});

describe("health identifiers and dates", () => {
  it("finds MRN and requires a digit", () => {
    expect(found("MRN: 00482913", "MEDICAL_RECORD_NUMBER")).toEqual(["00482913"]);
    expect(found("MRN: ABCDEFG", "MEDICAL_RECORD_NUMBER")).toEqual([]);
  });
  it("finds passport numbers", () => {
    expect(found("Passport No: X1234567", "PASSPORT")).toEqual(["X1234567"]);
  });
  it("labels DOB with context and other dates as DATE", () => {
    const text = "DOB: 03/15/1980, admitted March 20, 2024";
    expect(found(text, "DATE_OF_BIRTH")).toEqual(["03/15/1980"]);
    expect(found(text, "DATE")).toEqual(["March 20, 2024"]);
  });
  it("rejects impossible dates", () => {
    expect(found("on 2024-13-45", "DATE")).toEqual([]);
  });
  it("flags ages over 89 only", () => {
    expect(found("a 94-year-old man, aged 45", "AGE_OVER_89")).toEqual(["94-year-old"]);
  });
});

describe("contact details", () => {
  it("finds US street addresses", () => {
    expect(found("Lives at 221 Baker Street, Apt 4B.", "US_ADDRESS")).toEqual([
      "221 Baker Street, Apt 4B",
    ]);
  });
  it("finds names after labels and titles", () => {
    expect(found("Patient: Jane Doe was seen by Dr. Anil Kumar.", "PERSON")).toEqual([
      "Jane Doe",
      "Anil Kumar",
    ]);
  });
  it("ignores stop words after labels", () => {
    expect(found("Dear Customer, thanks", "PERSON")).toEqual([]);
  });
});

// Regressions found by the accuracy benchmark (packages/bench).
describe("benchmark regressions", () => {
  it("an IBAN wins over a chance Luhn match inside its digits", () => {
    const text = "Account GB11NWBK33354764468114 ok";
    const types = analyze(text, { level: "strict" }).map((f) => f.entityType);
    expect(types).toEqual(["IBAN"]);
    expect(
      analyze("Account GB54 NWBK 0507 6274 3072 19 ok", { level: "strict" }).map(
        (f) => f.entityType,
      ),
    ).toEqual(["IBAN"]);
  });
  it("labels addresses as IP or MAC, not phone", () => {
    expect(analyze("from 38.26.148.177", { level: "strict" }).map((f) => f.entityType)).toEqual([
      "IP_ADDRESS",
    ]);
    expect(analyze("mac 53-29-26-68-07-58", { level: "strict" }).map((f) => f.entityType)).toEqual([
      "MAC_ADDRESS",
    ]);
  });
  it("does not read a version number as an IP address", () => {
    expect(found("Version 7.5.3.7 of the library", "IP_ADDRESS")).toEqual([]);
    expect(found("released as v1.2.3.4", "IP_ADDRESS")).toEqual([]);
    expect(found("server 7.5.3.7", "IP_ADDRESS")).toEqual(["7.5.3.7"]);
  });
  it("stops a name before the next clause", () => {
    expect(found("Name: Priya Khan Thanks", "PERSON")).toEqual(["Priya Khan"]);
    expect(found("Patient: Jane Doe Phone: 555", "PERSON")).toEqual(["Jane Doe"]);
    expect(found("Client: Liam Khan Please confirm", "PERSON")).toEqual(["Liam Khan"]);
  });
});

// Regressions found by the hand-written realistic set (packages/bench/src/realistic.ts).
describe("realistic-set regressions", () => {
  it("recognizes dotted and colon-terminated date-of-birth labels", () => {
    expect(found("D.O.B.: 1988-05-12", "DATE_OF_BIRTH")).toEqual(["1988-05-12"]);
    expect(found("d.o.b 12 May 1988", "DATE_OF_BIRTH")).toEqual(["12 May 1988"]);
    expect(found("DOB: 03/15/1980", "DATE_OF_BIRTH")).toEqual(["03/15/1980"]);
    expect(found("dobby 03/15/1980", "DATE_OF_BIRTH")).toEqual([]);
  });
  it("finds a password inside JSON and keeps symbols such as & in it", () => {
    expect(found('{"password":"hunter42x"}', "PASSWORD")).toEqual(["hunter42x"]);
    expect(found('{"api_key": "abcd1234efgh"}', "SECRET")).toEqual(["abcd1234efgh"]);
    expect(found("password: Tr0ub4dor&3x ok", "PASSWORD")).toEqual(["Tr0ub4dor&3x"]);
  });
  it("still ends a URL query value at &", () => {
    // The same value is also a generic secret; the more specific URL finding wins the overlap.
    expect(found("https://x.com/a?token=abc123&b=2", "URL_CREDENTIALS")).toEqual(["abc123"]);
    expect(found("https://x.com/a?token=abc123&b=2", "SECRET")).toEqual([]);
  });
});
