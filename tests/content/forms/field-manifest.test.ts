import { describe, it, expect } from "vitest";
import { buildFieldManifest, buildFillPrompt } from "../../../src/content/forms/field-manifest";
import type { ManifestField } from "../../../src/content/forms/field-manifest";

const FIELDS: ManifestField[] = [
  { fieldId: "field1", type: "text", label: "ФИО" },
  { fieldId: "field2", type: "select", label: "Город", options: ["Москва", "Тюмень"] },
  { fieldId: "field3", type: "checkbox", label: "Согласие" },
];

describe("buildFieldManifest", () => {
  it("lists each field with id, type and label", () => {
    const out = buildFieldManifest(FIELDS);
    expect(out).toContain("field1");
    expect(out).toContain("ФИО");
    expect(out).toContain("Тип: text");
  });

  it("includes options for select/radio/checkbox fields", () => {
    const out = buildFieldManifest(FIELDS);
    expect(out).toContain("Москва");
    expect(out).toContain("Тюмень");
  });

  it("omits the options part for plain text fields", () => {
    const out = buildFieldManifest([{ fieldId: "field1", type: "text", label: "ФИО" }]);
    expect(out).not.toContain("Варианты");
  });
});

describe("buildFillPrompt", () => {
  it("asks for a JSON object only and embeds manifest + description", () => {
    const out = buildFillPrompt("Иван Петров из Тюмени", FIELDS);
    expect(out).toMatch(/JSON/i);
    expect(out).toContain("field2");
    expect(out).toContain("Иван Петров из Тюмени");
  });
});
