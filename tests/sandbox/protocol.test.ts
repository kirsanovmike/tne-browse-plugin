import { describe, it, expect } from "vitest";
import { makeReqId } from "../../src/sandbox/protocol";

describe("makeReqId", () => {
  it("возвращает непустую строку с префиксом", () => {
    expect(makeReqId()).toMatch(/^pdfreq-/);
  });
  it("выдаёт разные значения при последовательных вызовах", () => {
    const a = makeReqId();
    const b = makeReqId();
    expect(a).not.toBe(b);
  });
});
