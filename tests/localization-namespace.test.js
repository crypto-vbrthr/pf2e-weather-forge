import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function loadLanguage(name) {
  return JSON.parse(fs.readFileSync(new URL(`../lang/${name}.json`, import.meta.url), "utf8"));
}

function namespaceCollisions(dictionary) {
  const keys = Object.keys(dictionary);
  const keySet = new Set(keys);
  const collisions = [];

  for (const key of keys) {
    const parts = key.split(".");
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join(".");
      if (keySet.has(parent)) collisions.push([parent, key]);
    }
  }

  return collisions;
}

for (const language of ["de", "en"]) {
  test(`${language} localization contains no Foundry namespace collisions`, () => {
    const collisions = namespaceCollisions(loadLanguage(language));
    assert.deepEqual(
      collisions,
      [],
      `Foundry expands dotted localization keys into nested objects. A string key may not also be the parent of another key: ${JSON.stringify(collisions)}`
    );
  });
}
