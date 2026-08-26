import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { installWeatherForgeLocalizationFallback, weatherForgeLocalize, weatherForgeFormat } from "../scripts/localization.js";

const localization = fs.readFileSync(new URL("../scripts/localization.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");

test("Foundry V14 localization object is never monkey-patched", () => {
  assert.doesNotMatch(localization, /game\.i18n\.localize\s*=/);
  assert.doesNotMatch(localization, /game\.i18n\.format\s*=/);
  assert.doesNotMatch(main, /installWeatherForgeLocalizationFallback\(MODULE_ID\)/);
});

test("fallback installer is safe with read-only Foundry Localization methods", () => {
  const i18n = { lang: "de" };
  Object.defineProperty(i18n, "localize", { value: key => key, writable: false, configurable: false });
  Object.defineProperty(i18n, "format", { value: key => key, writable: false, configurable: false });
  globalThis.game = { i18n };

  assert.doesNotThrow(() => installWeatherForgeLocalizationFallback("pf2e-weather-forge"));
  const fallback = installWeatherForgeLocalizationFallback("pf2e-weather-forge");
  assert.equal(fallback.localize("pf2e-weather-forge.app.title"), "PF2e Wetter Forge");
  assert.equal(weatherForgeLocalize("pf2e-weather-forge", "pf2e-weather-forge.app.title"), "PF2e Wetter Forge");
  assert.equal(weatherForgeFormat("pf2e-weather-forge", "pf2e-weather-forge.app.title"), "PF2e Wetter Forge");
});
