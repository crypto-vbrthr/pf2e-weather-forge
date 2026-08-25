import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const main = fs.readFileSync(path.join(here, "..", "scripts", "main.js"), "utf8");

test("ready hook re-checks Weather Forge setting registration before public API setup", () => {
  assert.match(main, /Hooks\.once\("ready", async \(\) => \{[\s\S]{0,500}registerWeatherForgeSettings\(\);[\s\S]{0,500}initializeCityForgeClimateSettings/);
});
