import { MaskSession, restoreText } from "@maskit/core";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { maskFile, parseCsv, hintForHeader } from "../src/index.js";

const opts = (level: "basic" | "standard" | "strict" = "standard") => ({
  level,
  session: new MaskSession(),
});

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function makeDocx(documentBody: string, extra: Record<string, string> = {}): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/document.xml": strToU8(`<w:document ${NS}><w:body>${documentBody}</w:body></w:document>`),
    "docProps/core.xml": strToU8(
      "<cp:coreProperties><dc:creator>Jane Doe</dc:creator><cp:lastModifiedBy>Raj</cp:lastModifiedBy><dc:title>Q3 plan for Acme</dc:title></cp:coreProperties>",
    ),
    "docProps/app.xml": strToU8(
      "<Properties><Company>Acme Corp</Company><Pages>1</Pages></Properties>",
    ),
    "word/media/logo.png": new Uint8Array([1, 2, 3]),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
  });
}

const run = (text: string) => `<w:r><w:t>${text}</w:t></w:r>`;
const para = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;

describe("text files", () => {
  it("masks plain text and reports what was masked", () => {
    const r = maskFile("note.txt", strToU8("mail jane@example.com now"), opts());
    expect(strFromU8(r.data)).toBe("mail [EMAIL_1] now");
    expect(r.outputName).toBe("note.masked.txt");
    expect(r.tally.get("EMAIL")).toBe(1);
  });
  it("rejects unsupported and oversized files", () => {
    expect(() => maskFile("x.exe", new Uint8Array(1), opts())).toThrow(/Unsupported/);
    expect(() => maskFile("x.txt", new Uint8Array(26 * 1024 * 1024), opts())).toThrow(/larger/);
  });
});

describe("csv", () => {
  it("parses quotes, doubled quotes and newlines inside quotes", () => {
    expect(parseCsv('a,"b,1","c ""q"""\n"x\ny",2,3', ",")).toEqual([
      ["a", "b,1", 'c "q"'],
      ["x\ny", "2", "3"],
    ]);
  });
  it("masks cells, keeps the header and quoting, and reuses tokens", () => {
    const csv = 'id,notes,contact\n1,"call (415) 555-2671, urgent",a@x.com\n2,ok,A@X.com\n';
    const r = maskFile("people.csv", strToU8(csv), opts());
    expect(strFromU8(r.data)).toBe(
      'id,notes,contact\n1,"call [PHONE_1], urgent",[EMAIL_1]\n2,ok,[EMAIL_1]\n',
    );
    expect(r.tally.get("EMAIL")).toBe(2);
  });
  it("uses header names to mask values that look harmless", () => {
    const r = maskFile("p.csv", strToU8("Name,DOB,Age\nJane Doe,15 Mar 80,44\n"), opts());
    const out = strFromU8(r.data);
    expect(out).toBe("Name,DOB,Age\n[PERSON_1],[DATE_OF_BIRTH_1],44\n");
  });
  it("respects the level when applying header hints", () => {
    const r = maskFile("p.csv", strToU8("Name,Email\nJane Doe,a@x.com\n"), opts("basic"));
    expect(strFromU8(r.data)).toBe("Name,Email\nJane Doe,[EMAIL_1]\n");
  });
  it("detects semicolons and tabs and keeps CRLF", () => {
    const r = maskFile("e.csv", strToU8("a;b\r\n1;x@y.com\r\n"), opts());
    expect(strFromU8(r.data)).toBe("a;b\r\n1;[EMAIL_1]\r\n");
    expect(strFromU8(maskFile("e.tsv", strToU8("a\tb\n1\tx@y.com\n"), opts()).data)).toBe(
      "a\tb\n1\t[EMAIL_1]\n",
    );
  });
  it("drops a byte order mark but never strips ordinary text", () => {
    const bom = String.fromCharCode(0xfeff);
    const bomCsv = `${bom}a,b\n1,x@y.com\n`;
    expect(strFromU8(maskFile("b.csv", strToU8(bomCsv), opts()).data)).toBe("a,b\n1,[EMAIL_1]\n");
    const plain = "FEFF,b\n1,2\n";
    expect(strFromU8(maskFile("c.csv", strToU8(plain), opts()).data)).toBe(plain);
  });
  it("recognizes header variants", () => {
    expect(hintForHeader("E-mail")).toBe("EMAIL");
    expect(hintForHeader("Phone Number")).toBe("PHONE");
    expect(hintForHeader("Patient ID")).toBe("MEDICAL_RECORD_NUMBER");
    expect(hintForHeader("Notes")).toBeUndefined();
  });
});

describe("docx", () => {
  it("masks text split across several runs", () => {
    const docx = makeDocx(para(run("Write to jane@exa"), run("mple.com today")));
    const r = maskFile("a.docx", docx, opts());
    const xml = strFromU8(unzipSync(r.data)["word/document.xml"] as Uint8Array);
    expect(xml).toContain("Write to [EMAIL_1]");
    expect(xml).not.toContain("example.com");
    expect(xml).not.toContain("mple");
    expect(xml).toContain(" today");
    expect(r.tally.get("EMAIL")).toBe(1);
  });
  it("masks tracked deletions, which still hold the original text", () => {
    const docx = makeDocx(
      `<w:p><w:del><w:r><w:delText xml:space="preserve">card 4111 1111 1111 1111</w:delText></w:r></w:del></w:p>`,
    );
    const xml = strFromU8(
      unzipSync(maskFile("a.docx", docx, opts()).data)["word/document.xml"] as Uint8Array,
    );
    expect(xml).toContain("card [CREDIT_CARD_1]");
    expect(xml).not.toContain("4111");
  });
  it("escapes XML entities in the original and the result", () => {
    const docx = makeDocx(para(run("R&amp;D mail a@x.com &lt;ok&gt;")));
    const xml = strFromU8(
      unzipSync(maskFile("a.docx", docx, opts()).data)["word/document.xml"] as Uint8Array,
    );
    expect(xml).toContain("R&amp;D mail [EMAIL_1] &lt;ok&gt;");
  });
  it("leaves paragraphs without findings byte-identical", () => {
    const body = para(run("Nothing sensitive here"));
    const xml = strFromU8(
      unzipSync(maskFile("a.docx", makeDocx(body), opts()).data)["word/document.xml"] as Uint8Array,
    );
    expect(xml).toContain(body);
  });
  it("blanks document properties and reviewer names", () => {
    const docx = makeDocx(para(run("hi")), {
      "word/comments.xml": `<w:comments ${NS}><w:comment w:author="Dr. Raj Patel" w:initials="RP"><w:p><w:r><w:t>call 415-555-2671 phone</w:t></w:r></w:p></w:comment></w:comments>`,
    });
    const files = unzipSync(maskFile("a.docx", docx, opts()).data);
    const core = strFromU8(files["docProps/core.xml"] as Uint8Array);
    expect(core).toContain("<dc:creator></dc:creator>");
    expect(core).toContain("<cp:lastModifiedBy></cp:lastModifiedBy>");
    expect(core).toContain("<dc:title></dc:title>");
    expect(strFromU8(files["docProps/app.xml"] as Uint8Array)).toContain("<Company></Company>");
    const comments = strFromU8(files["word/comments.xml"] as Uint8Array);
    expect(comments).toContain('w:author="Author"');
    expect(comments).not.toContain("Raj Patel");
    expect(comments).toContain("[PHONE_1]");
  });
  it("keeps other files untouched and warns about images", () => {
    const r = maskFile("a.docx", makeDocx(para(run("a@x.com"))), opts());
    expect(Array.from(unzipSync(r.data)["word/media/logo.png"] as Uint8Array)).toEqual([1, 2, 3]);
    expect(r.warnings.join(" ")).toMatch(/Images/);
    expect(r.outputName).toBe("a.masked.docx");
  });
  it("supports restore through the shared session", () => {
    const o = opts();
    maskFile("a.docx", makeDocx(para(run("mail jane@example.com"))), o);
    expect(restoreText("Reply to [EMAIL_1]", o.session)).toBe("Reply to jane@example.com");
  });
  it("rejects files that are not a valid docx", () => {
    expect(() => maskFile("a.docx", zipSync({ "x.txt": strToU8("hi") }), opts())).toThrow(
      /Not a valid/,
    );
    expect(() => maskFile("a.docx", strToU8("not a zip"), opts())).toThrow();
  });
});
