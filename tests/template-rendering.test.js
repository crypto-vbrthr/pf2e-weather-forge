import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");

test("ApplicationV2 template does not depend on custom wf Handlebars helpers", () => {
  assert.doesNotMatch(template, /\{\{\s*wf(?:f)?\b/);
});

test("daypart boundary labels are prepared in application context", () => {
  for (const key of ["morning", "noon", "afternoon", "evening", "night"]) {
    assert.match(app, new RegExp(`time_${key}\\", \"pf2e-weather-forge\.time\.${key}`));
    assert.match(template, new RegExp(`labels\.time_${key}`));
  }
});
