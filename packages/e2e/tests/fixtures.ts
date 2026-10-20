import { strToU8, zipSync } from "fflate";

/** Minimal text PDF (one page) written by hand so the test needs no PDF library. */
export function makePdf(lines: string[]): Buffer {
  const stream =
    "BT /F1 12 Tf 20 150 Td " +
    lines.map((l, i) => `${i === 0 ? "" : "0 -18 Td "}(${l}) Tj`).join(" ") +
    " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  return assemble(objs);
}

/** A PDF page with no text at all, standing in for a scan. */
export function makeBlankPdf(): Buffer {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>",
  ];
  return assemble(objs);
}

function assemble(objs: string[]): Buffer {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/** Minimal DOCX with an email split across two runs and a creator in the properties. */
export function makeDocx(): Buffer {
  const body =
    "<w:p><w:r><w:t>Write to jane@exa</w:t></w:r><w:r><w:t>mple.com today</w:t></w:r></w:p>";
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8(`<w:document ${NS}><w:body>${body}</w:body></w:document>`),
      "docProps/core.xml": strToU8(
        "<cp:coreProperties><dc:creator>Jane Doe</dc:creator></cp:coreProperties>",
      ),
    }),
  );
}

/** A one-page PDF whose only content is an RGB bitmap, i.e. a scan with no text layer. */
export function makeScannedPdf(width: number, height: number, rgb: Buffer): Buffer {
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`;
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b;
    parts.push(buf);
    length += buf.length;
  };
  push("%PDF-1.4\n");
  const object = (n: number, body: Buffer | string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    push(body);
    push("\nendobj\n");
  };
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>`,
  );
  object(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(
    5,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgb.length} >>\nstream\n`,
        "latin1",
      ),
      rgb,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let n = 1; n <= 5; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.concat(parts);
}

/** Minimal XLSX: a shared string with an email split over two runs, plus an author to clear. */
export function makeXlsx(): Buffer {
  return Buffer.from(
    zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "xl/workbook.xml": strToU8("<workbook/>"),
      "xl/sharedStrings.xml": strToU8(
        "<sst><si><t>Name</t></si><si><r><t>Mail jane@exa</t></r><r><t>mple.com now</t></r></si></sst>",
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c t="s"><v>1</v></c></row></sheetData></worksheet>',
      ),
      "docProps/core.xml": strToU8(
        "<cp:coreProperties><dc:creator>Jane Doe</dc:creator></cp:coreProperties>",
      ),
    }),
  );
}
