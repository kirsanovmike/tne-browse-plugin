import { describe, it, expect } from "vitest";
import { crc32, columnName, matrixToXlsxBuffer } from "../../../src/content/office/xlsx-write";

describe("crc32", () => {
  it("matches the standard check value for '123456789'", () => {
    const bytes = new TextEncoder().encode("123456789");
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  it("is 0 for empty input", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("columnName", () => {
  it("maps 0-based index to Excel column letters", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    expect(columnName(26)).toBe("AA");
    expect(columnName(27)).toBe("AB");
    expect(columnName(51)).toBe("AZ");
    expect(columnName(701)).toBe("ZZ");
  });
});

describe("matrixToXlsxBuffer", () => {
  it("produces a ZIP package (PK signature) with EOCD", () => {
    const buf = new Uint8Array(matrixToXlsxBuffer([["a", "b"]], "Лист1"));
    // local file header signature 'PK\x03\x04'
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
    // EOCD signature present near the end
    expect(buf.length).toBeGreaterThan(22);
  });

  it("embeds cell values verbatim (store mode, no compression)", () => {
    const buf = matrixToXlsxBuffer([["Привет", "<b>&"], ["2", "3"]], "Лист1");
    const text = new TextDecoder().decode(buf);
    expect(text).toContain("<sheetData>");
    expect(text).toContain("Привет");
    // XML-escaping of special chars
    expect(text).toContain("&lt;b&gt;&amp;");
    expect(text).toContain('r="A1"');
    expect(text).toContain('r="B2"');
  });

  it("declares the required OOXML parts", () => {
    const text = new TextDecoder().decode(matrixToXlsxBuffer([["x"]]));
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
  });
});
