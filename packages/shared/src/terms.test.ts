import { describe, expect, it } from "vitest";
import { APP_NAME, TERMS, term } from "./index";

describe("@notes/shared", () => {
  it("exposes the app name", () => {
    expect(APP_NAME).toBe("Notes");
  });

  it("resolves centralized container terms", () => {
    expect(term("tome")).toBe("Tome");
    expect(term("tower")).toBe("Tower");
    expect(TERMS.tomePlural).toBe("Tomes");
  });
});
