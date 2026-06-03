import { describe, it, expect } from "vitest";
import { parseFillResponse } from "../../../src/content/forms/parse-fill";

const IDS = ["field1", "field2", "field3"];

describe("parseFillResponse", () => {
  it("parses a clean JSON object", () => {
    const out = parseFillResponse('{"field1":"Иван","field2":"Москва"}', IDS);
    expect(out).toEqual([
      { fieldId: "field1", value: "Иван" },
      { fieldId: "field2", value: "Москва" },
    ]);
  });

  it("extracts JSON from a ```json fenced block with surrounding text", () => {
    const text = "Вот значения:\n```json\n{ \"field1\": \"Иван\" }\n```\nГотово.";
    expect(parseFillResponse(text, IDS)).toEqual([{ fieldId: "field1", value: "Иван" }]);
  });

  it("extracts the first balanced object when text wraps it", () => {
    expect(parseFillResponse('бла {"field3": "да"} бла', IDS)).toEqual([
      { fieldId: "field3", value: "да" },
    ]);
  });

  it("filters out unknown field ids", () => {
    expect(parseFillResponse('{"field1":"x","fieldZ":"y"}', IDS)).toEqual([
      { fieldId: "field1", value: "x" },
    ]);
  });

  it("coerces number and boolean scalars to strings", () => {
    expect(parseFillResponse('{"field1":42,"field2":true}', IDS)).toEqual([
      { fieldId: "field1", value: "42" },
      { fieldId: "field2", value: "true" },
    ]);
  });

  it("drops non-scalar values (objects/arrays/null)", () => {
    expect(parseFillResponse('{"field1":{"a":1},"field2":[1],"field3":null}', IDS)).toEqual([]);
  });

  it("returns [] for non-JSON text", () => {
    expect(parseFillResponse("ничего не нашёл", IDS)).toEqual([]);
    expect(parseFillResponse("", IDS)).toEqual([]);
  });
});
