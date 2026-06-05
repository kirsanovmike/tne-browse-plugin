import { describe, it, expect } from "vitest";
import { nextVisibleIndex } from "../../../src/content/onboarding/tour";

// isVisible(i) — предикат «шаг i имеет видимый якорь».
describe("nextVisibleIndex", () => {
  const all = () => true;

  it("идёт вперёд к следующему видимому шагу", () => {
    expect(nextVisibleIndex(8, 0, +1, all)).toBe(1);
  });

  it("пропускает скрытые шаги вперёд", () => {
    const vis = (i: number) => i !== 1 && i !== 2; // 1 и 2 скрыты
    expect(nextVisibleIndex(8, 0, +1, vis)).toBe(3);
  });

  it("идёт назад и пропускает скрытые", () => {
    const vis = (i: number) => i !== 3 && i !== 4;
    expect(nextVisibleIndex(8, 5, -1, vis)).toBe(2);
  });

  it("возвращает -1, если впереди нет видимых шагов", () => {
    const vis = (i: number) => i === 0;
    expect(nextVisibleIndex(8, 0, +1, vis)).toBe(-1);
  });

  it("возвращает -1 при выходе за границы назад", () => {
    expect(nextVisibleIndex(8, 0, -1, all)).toBe(-1);
  });
});
