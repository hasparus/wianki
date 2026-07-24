import { describe, expect, it } from "vitest";
import { classifySafeSearch } from "./moderation";

describe("SafeSearch policy", () => {
  it("approves possible and lower likelihoods", () => {
    expect(
      classifySafeSearch({
        adult: "POSSIBLE",
        racy: "UNLIKELY",
        violence: "VERY_UNLIKELY",
      }),
    ).toBe("approved");
  });

  it.each(["adult", "racy", "violence"] as const)(
    "flags LIKELY %s content",
    (field) => {
      expect(
        classifySafeSearch({
          adult: field === "adult" ? "LIKELY" : "UNLIKELY",
          racy: field === "racy" ? "LIKELY" : "UNLIKELY",
          violence: field === "violence" ? "LIKELY" : "UNLIKELY",
        }),
      ).toBe("flagged");
    },
  );
});
