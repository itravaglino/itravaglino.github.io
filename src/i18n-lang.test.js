import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoredLang } from "./i18n.js";

test("a first visit with no saved language is English", () => {
  assert.equal(resolveStoredLang(null), "en");
  assert.equal(resolveStoredLang(undefined), "en");
  assert.equal(resolveStoredLang(""), "en");
  assert.equal(resolveStoredLang("fr"), "en");
});

test("a saved ES or EN preference is kept", () => {
  assert.equal(resolveStoredLang("es"), "es");
  assert.equal(resolveStoredLang("en"), "en");
});
