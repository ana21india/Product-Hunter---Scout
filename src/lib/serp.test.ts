import { test } from "node:test";
import assert from "node:assert/strict";
import { pickProfile } from "./serp";

const r = (link: string, title: string, snippet = "") => ({ link, title, snippet });

test("keeps one clear match whose text mentions the product", () => {
  const out = pickProfile(
    [r("https://www.linkedin.com/in/ishu-darshan-123", "Ishu Darshan - Co-founder - Velozity | LinkedIn", "Co-founder at Velozity")],
    "Ishu Darshan", "Velozity", "https://getvelozity.com",
  );
  assert.equal(out.url, "https://www.linkedin.com/in/ishu-darshan-123");
});

test("two different profiles with the same name means nothing is shown", () => {
  const out = pickProfile(
    [r("https://www.linkedin.com/in/dylan-field", "Dylan Field - Figma"), r("https://www.linkedin.com/in/dylanfield2", "Dylan Field - Figma consultant")],
    "Dylan Field", "Figma", null,
  );
  assert.equal(out.url, null);
  assert.match(out.evidence, /ambiguous/);
});

test("a profile whose text does not mention the product is rejected", () => {
  const out = pickProfile([r("https://www.linkedin.com/in/brendan-odriscoll", "Brendan O'Driscoll - Unum Ireland | LinkedIn")], "Brendan O'Driscoll", "Figma Agent", "https://www.figma.com");
  assert.equal(out.url, null);
});

test("results for other people are ignored, and single-word names are never searched", () => {
  assert.equal(pickProfile([r("https://www.linkedin.com/in/someone-else", "Someone Else - Velozity")], "Ishu Darshan", "Velozity", null).url, null);
  assert.equal(pickProfile([r("https://www.linkedin.com/in/lmanchu", "lmanchu - IrisGo")], "lmanchu", "IrisGo", null).url, null);
});
