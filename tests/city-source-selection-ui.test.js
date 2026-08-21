import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");
const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");

test("City source changes persist dedicated settings directly instead of serializing the Application root", () => {
  assert.match(app, /game\.settings\.set\(MODULE_ID, "climateSourceMode", mode\)/);
  assert.match(app, /game\.settings\.set\(MODULE_ID, "cityForgeSettlementId", settlementId\)/);
  assert.match(app, /game\.settings\.set\(MODULE_ID, "climateSourceMode", "settlement"\)/);
  assert.doesNotMatch(app, /#persistUiSettings\(new FormData\(root\)\)/);
});

test("live City source changes keep the Settings tab active when rerendering", () => {
  const occurrences = app.match(/this\.activeTab = "settings";\s*this\.render\(\);/g) ?? [];
  assert.equal(occurrences.length, 2);
});

test("source and settlement controls each have their own live change handler", () => {
  assert.match(app, /sourceSelect\?\.addEventListener\("change", onSourceChange/);
  assert.match(app, /settlementSelect\?\.addEventListener\("change", onSettlementChange/);
});

test("settlement selector continues to explain explicit source activation", () => {
  assert.match(template, /cityIntegration_settlementHint/);
});
