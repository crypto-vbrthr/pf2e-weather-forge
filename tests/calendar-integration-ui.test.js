import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const localization = fs.readFileSync(new URL("../scripts/localization.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/pf2e-weather-forge.css", import.meta.url), "utf8");

const requiredIntegrationKeys = [
  "pf2e-weather-forge.calendarIntegration.active",
  "pf2e-weather-forge.calendarIntegration.currentResolved",
  "pf2e-weather-forge.calendarIntegration.timeOwned",
  "pf2e-weather-forge.calendarIntegration.prepareNext",
  "pf2e-weather-forge.calendarIntegration.nextPhase",
  "pf2e-weather-forge.calendarIntegration.source.auto",
  "pf2e-weather-forge.calendarIntegration.automation.manual"
];

test("0.7 Calendar Forge UI strings have an internal DE/EN fallback", () => {
  for (const key of requiredIntegrationKeys) {
    const occurrences = localization.split(`\"${key}\"`).length - 1;
    assert.ok(occurrences >= 2, `${key} must exist in both fallback languages`);
  }
});

test("Calendar integration settings use shrink-safe responsive grids", () => {
  assert.match(css, /\.settings-section \.calendar-grid\s*\{[\s\S]*?minmax\(0, 1fr\)/);
  assert.match(css, /\.daypart-boundary-grid\s*\{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.settings-section input,[\s\S]*?min-width:\s*0/);
  assert.match(css, /\.generation-actions \.weather-actions button\s*\{[\s\S]*?white-space:\s*normal/);
});
