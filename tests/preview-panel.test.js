import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const template = fs.readFileSync(new URL("../templates/weather-forge.hbs", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../scripts/weather-app.js", import.meta.url), "utf8");
test("queued next-daypart preview is rendered as the full preview card", () => {
  assert.match(template, /#if previewDisplay/);
  assert.match(template, /previewDisplay\.description/);
  assert.match(template, /previewDisplay\.temperature/);
  assert.match(template, /previewDisplay\.moonPhaseLabel/);
  assert.doesNotMatch(template, /queued-preview-summary/);
});
test("preview empty text distinguishes current and next dayparts", () => {
  assert.match(app, /calendarIntegration_noCurrentPreview/);
  assert.match(app, /calendarIntegration_noNextPreview/);
  assert.match(template, /previewEmptyLabel/);
});
