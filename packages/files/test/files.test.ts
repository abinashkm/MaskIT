import { MaskSession, restoreText, type Detector } from "@maskit/core";
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
  it("masks plain text and reports what was masked", async () => {
    const r = await maskFile("note.txt", strToU8("mail jane@example.com now"), opts());
    expect(strFromU8(r.data)).toBe("mail [EMAIL_1] now");
    expect(r.outputName).toBe("note.masked.txt");
    expect(r.tally.get("EMAIL")).toBe(1);
  });
  it("rejects unsupported and oversized files", async () => {
    await expect(maskFile("x.exe", new Uint8Array(1), opts())).rejects.toThrow(/Unsupported/);
    await expect(maskFile("x.txt", new Uint8Array(26 * 1024 * 1024), opts())).rejects.toThrow(
      /larger/,
    );
  });
});

describe("csv", () => {
  it("parses quotes, doubled quotes and newlines inside quotes", async () => {
    expect(parseCsv('a,"b,1","c ""q"""\n"x\ny",2,3', ",")).toEqual([
      ["a", "b,1", 'c "q"'],
      ["x\ny", "2", "3"],
    ]);
  });
  it("masks cells, keeps the header and quoting, and reuses tokens", async () => {
    const csv = 'id,notes,contact\n1,"call (415) 555-2671, urgent",a@x.com\n2,ok,A@X.com\n';
    const r = await maskFile("people.csv", strToU8(csv), opts());
    expect(strFromU8(r.data)).toBe(
      'id,notes,contact\n1,"call [PHONE_1], urgent",[EMAIL_1]\n2,ok,[EMAIL_1]\n',
    );
    expect(r.tally.get("EMAIL")).toBe(2);
  });
  it("uses header names to mask values that look harmless", async () => {
    const r = await maskFile("p.csv", strToU8("Name,DOB,Age\nJane Doe,15 Mar 80,44\n"), opts());
    const out = strFromU8(r.data);
    expect(out).toBe("Name,DOB,Age\n[PERSON_1],[DATE_OF_BIRTH_1],44\n");
  });
  it("respects the level when applying header hints", async () => {
    const r = await maskFile("p.csv", strToU8("Name,Email\nJane Doe,a@x.com\n"), opts("basic"));
    expect(strFromU8(r.data)).toBe("Name,Email\nJane Doe,[EMAIL_1]\n");
  });
  it("detects semicolons and tabs and keeps CRLF", async () => {
    const r = await maskFile("e.csv", strToU8("a;b\r\n1;x@y.com\r\n"), opts());
    expect(strFromU8(r.data)).toBe("a;b\r\n1;[EMAIL_1]\r\n");
    expect(strFromU8((await maskFile("e.tsv", strToU8("a\tb\n1\tx@y.com\n"), opts())).data)).toBe(
      "a\tb\n1\t[EMAIL_1]\n",
    );
  });
  it("drops a byte order mark but never strips ordinary text", async () => {
    const bom = String.fromCharCode(0xfeff);
    const bomCsv = `${bom}a,b\n1,x@y.com\n`;
    expect(strFromU8((await maskFile("b.csv", strToU8(bomCsv), opts())).data)).toBe(
      "a,b\n1,[EMAIL_1]\n",
    );
    const plain = "FEFF,b\n1,2\n";
    expect(strFromU8((await maskFile("c.csv", strToU8(plain), opts())).data)).toBe(plain);
  });
  it("recognizes header variants", async () => {
    expect(hintForHeader("E-mail")).toBe("EMAIL");
    expect(hintForHeader("Phone Number")).toBe("PHONE");
    expect(hintForHeader("Patient ID")).toBe("MEDICAL_RECORD_NUMBER");
    expect(hintForHeader("Notes")).toBeUndefined();
  });
});

describe("docx", () => {
  it("masks text split across several runs", async () => {
    const docx = makeDocx(para(run("Write to jane@exa"), run("mple.com today")));
    const r = await maskFile("a.docx", docx, opts());
    const xml = strFromU8(unzipSync(r.data)["word/document.xml"] as Uint8Array);
    expect(xml).toContain("Write to [EMAIL_1]");
    expect(xml).not.toContain("example.com");
    expect(xml).not.toContain("mple");
    expect(xml).toContain(" today");
    expect(r.tally.get("EMAIL")).toBe(1);
  });
  it("masks tracked deletions, which still hold the original text", async () => {
    const docx = makeDocx(
      `<w:p><w:del><w:r><w:delText xml:space="preserve">card 4111 1111 1111 1111</w:delText></w:r></w:del></w:p>`,
    );
    const xml = strFromU8(
      unzipSync((await maskFile("a.docx", docx, opts())).data)["word/document.xml"] as Uint8Array,
    );
    expect(xml).toContain("card [CREDIT_CARD_1]");
    expect(xml).not.toContain("4111");
  });
  it("escapes XML entities in the original and the result", async () => {
    const docx = makeDocx(para(run("R&amp;D mail a@x.com &lt;ok&gt;")));
    const xml = strFromU8(
      unzipSync((await maskFile("a.docx", docx, opts())).data)["word/document.xml"] as Uint8Array,
    );
    expect(xml).toContain("R&amp;D mail [EMAIL_1] &lt;ok&gt;");
  });
  it("leaves paragraphs without findings byte-identical", async () => {
    const body = para(run("Nothing sensitive here"));
    const xml = strFromU8(
      unzipSync((await maskFile("a.docx", makeDocx(body), opts())).data)[
        "word/document.xml"
      ] as Uint8Array,
    );
    expect(xml).toContain(body);
  });
  it("blanks document properties and reviewer names", async () => {
    const docx = makeDocx(para(run("hi")), {
      "word/comments.xml": `<w:comments ${NS}><w:comment w:author="Dr. Raj Patel" w:initials="RP"><w:p><w:r><w:t>call 415-555-2671 phone</w:t></w:r></w:p></w:comment></w:comments>`,
    });
    const files = unzipSync((await maskFile("a.docx", docx, opts())).data);
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
  it("keeps other files untouched and warns about images", async () => {
    const r = await maskFile("a.docx", makeDocx(para(run("a@x.com"))), opts());
    expect(Array.from(unzipSync(r.data)["word/media/logo.png"] as Uint8Array)).toEqual([1, 2, 3]);
    expect(r.warnings.join(" ")).toMatch(/Images/);
    expect(r.outputName).toBe("a.masked.docx");
  });
  it("supports restore through the shared session", async () => {
    const o = opts();
    await maskFile("a.docx", makeDocx(para(run("mail jane@example.com"))), o);
    expect(restoreText("Reply to [EMAIL_1]", o.session)).toBe("Reply to jane@example.com");
  });
  it("rejects files that are not a valid docx", async () => {
    await expect(maskFile("a.docx", zipSync({ "x.txt": strToU8("hi") }), opts())).rejects.toThrow(
      /Not a valid/,
    );
    await expect(maskFile("a.docx", strToU8("not a zip"), opts())).rejects.toThrow();
  });
});

describe("extra detectors (e.g. the name model)", () => {
  // Stand-in for the model: it "knows" one name that no rule would catch.
  const fake: Detector = {
    id: "fake",
    entityTypes: ["PERSON"],
    async detect(text) {
      const at = text.indexOf("Zebulon Pike");
      return at < 0
        ? []
        : [
            {
              entityType: "PERSON",
              start: at,
              end: at + 12,
              confidence: 0.95,
              recognizerId: "fake",
            },
          ];
    },
  };
  const withFake = () => ({ ...opts(), detectors: [fake] });

  it("masks names found by the detector in plain text", async () => {
    const r = await maskFile("n.txt", strToU8("Met Zebulon Pike today, mail a@x.com"), withFake());
    expect(strFromU8(r.data)).toBe("Met [PERSON_1] today, mail [EMAIL_1]");
    expect(r.tally.get("PERSON")).toBe(1);
  });
  it("masks a name split across DOCX runs", async () => {
    const docx = makeDocx(para(run("Call Zebulon "), run("Pike back")));
    const r = await maskFile("a.docx", docx, withFake());
    const xml = strFromU8(unzipSync(r.data)["word/document.xml"] as Uint8Array);
    expect(xml).toContain("Call [PERSON_1]");
    expect(xml).not.toContain("Pike");
  });
  it("asks the detector only about cells that read like text", async () => {
    const calls: string[] = [];
    const spy: Detector = { ...fake, detect: (t) => (calls.push(t), fake.detect(t)) };
    const csv = "id,notes\n1,Zebulon\n2,Spoke with Zebulon Pike about renewal\n3,ok\n";
    const r = await maskFile("c.csv", strToU8(csv), { ...opts(), detectors: [spy] });
    expect(strFromU8(r.data)).toBe(
      "id,notes\n1,Zebulon\n2,Spoke with [PERSON_1] about renewal\n3,ok\n",
    );
    expect(calls).toEqual(["Spoke with Zebulon Pike about renewal"]);
  });
  it("still masks with rules when a detector throws", async () => {
    const broken: Detector = { ...fake, detect: () => Promise.reject(new Error("model failed")) };
    const r = await maskFile("n.txt", strToU8("mail a@x.com"), { ...opts(), detectors: [broken] });
    expect(strFromU8(r.data)).toBe("mail [EMAIL_1]");
  });
});

describe("xlsx", () => {
  const sheet = (cells: string) =>
    `<worksheet><sheetData><row r="1">${cells}</row></sheetData></worksheet>`;
  function makeXlsx(extra: Record<string, string> = {}): Uint8Array {
    return zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "xl/workbook.xml": strToU8("<workbook/>"),
      "xl/sharedStrings.xml": strToU8(
        "<sst><si><t>Name</t></si>" +
          "<si><r><t>Write to jane@exa</t></r><r><t>mple.com today</t></r></si>" +
          "<si><t>R&amp;D card 4111 1111 1111 1111</t></si></sst>",
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        sheet(
          '<c t="s"><v>0</v></c><c t="s"><v>1</v></c><c t="inlineStr"><is><t>call (415) 555-2671 now</t></is></c><c><v>4155552671</v></c>',
        ),
      ),
      "xl/comments1.xml": strToU8(
        '<comments><authors><author>Dr. Raj Patel</author></authors><commentList><comment ref="A1"><text><r><t>ssn 123-45-6789</t></r></text></comment></commentList></comments>',
      ),
      "docProps/core.xml": strToU8(
        "<cp:coreProperties><dc:creator>Jane Doe</dc:creator><dc:title>Payroll</dc:title></cp:coreProperties>",
      ),
      "docProps/app.xml": strToU8("<Properties><Company>Acme</Company></Properties>"),
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
    });
  }
  const read = (data: Uint8Array, name: string) => strFromU8(unzipSync(data)[name] as Uint8Array);

  it("masks shared strings split across runs, inline strings and comments", async () => {
    const r = await maskFile("book.xlsx", makeXlsx(), opts());
    const shared = read(r.data, "xl/sharedStrings.xml");
    expect(shared).toContain("Write to [EMAIL_1]");
    expect(shared).not.toContain("example.com");
    expect(shared).toContain("R&amp;D card [CREDIT_CARD_1]");
    expect(shared).toContain("<t>Name</t>");
    expect(read(r.data, "xl/worksheets/sheet1.xml")).toContain("call [PHONE_1] now");
    expect(read(r.data, "xl/comments1.xml")).toContain("ssn [US_SSN_1]");
    expect(r.outputName).toBe("book.masked.xlsx");
    expect(r.tally.get("EMAIL")).toBe(1);
  });
  it("anonymizes comment authors and clears document properties", async () => {
    const r = await maskFile("book.xlsx", makeXlsx(), opts());
    expect(read(r.data, "xl/comments1.xml")).toContain("<author>Author</author>");
    expect(read(r.data, "xl/comments1.xml")).not.toContain("Raj Patel");
    expect(read(r.data, "docProps/core.xml")).toContain("<dc:creator></dc:creator>");
    expect(read(r.data, "docProps/core.xml")).toContain("<dc:title></dc:title>");
    expect(read(r.data, "docProps/app.xml")).toContain("<Company></Company>");
  });
  it("leaves numeric cells alone and says so", async () => {
    const r = await maskFile("book.xlsx", makeXlsx(), opts());
    expect(read(r.data, "xl/worksheets/sheet1.xml")).toContain("<v>4155552671</v>");
    expect(r.warnings.join(" ")).toMatch(/numeric cells/);
  });
  it("rejects a zip that is not a workbook", async () => {
    await expect(maskFile("a.xlsx", zipSync({ "x.txt": strToU8("hi") }), opts())).rejects.toThrow(
      /Not a valid/,
    );
  });
});
