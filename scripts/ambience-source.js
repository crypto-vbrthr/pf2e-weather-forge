import { MODULE_ID } from "./weather-engine.js";

export const AMBIENCE_FORGE_MODULE_ID = "ambience-forge";
export const AMBIENCE_OWNER_ID = MODULE_ID;
export const AMBIENCE_WEATHER_GROUP_DEFAULT = "weather";

export const AMBIENCE_WEATHER_KINDS = Object.freeze([
  "clear",
  "cloudy",
  "fog",
  "rain",
  "heavy-rain",
  "storm",
  "snow",
  "blizzard"
]);

export const DEFAULT_AMBIENCE_WEATHER_MAPPING = Object.freeze({
  clear: "clear",
  cloudy: "cloudy",
  fog: "fog",
  rain: "rain",
  "heavy-rain": "heavy-rain",
  storm: "storm",
  snow: "snow",
  blizzard: "heavy-snow"
});

function settingValue(key, fallback) {
  try {
    return game.settings.get(MODULE_ID, key) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function isPrimaryActiveGM() {
  if (!globalThis.game?.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  if (activeGM) return activeGM.id === game.user.id;
  const first = [...(game.users ?? [])].find(user => user.active && user.isGM);
  return !first || first.id === game.user.id;
}

export function normalizeAmbienceWeatherMapping(mapping = null) {
  const source = mapping && typeof mapping === "object" ? mapping : {};
  return Object.fromEntries(AMBIENCE_WEATHER_KINDS.map((key) => [
    key,
    String(source[key] ?? DEFAULT_AMBIENCE_WEATHER_MAPPING[key] ?? "").trim()
  ]));
}

export function resolveAmbienceWeatherKind(weather = {}) {
  const extremeType = String(weather?.extremeWeather?.type ?? "").trim();
  if (extremeType === "blizzard") return "blizzard";
  if (extremeType === "storm") return "storm";
  if (extremeType === "fog") return "fog";

  const precipitation = String(weather?.precipitation ?? "none");
  if (precipitation === "thunderstorm") return "storm";
  if (precipitation === "heavyRain") return "heavy-rain";
  if (["rain", "lightRain", "drizzle"].includes(precipitation)) return "rain";
  if (precipitation === "snow") return "snow";
  if (precipitation === "mist") return "fog";

  return Number(weather?.cloudDensity ?? 0) >= 70 ? "cloudy" : "clear";
}

export function configuredAmbienceIntegrationEnabled() {
  return Boolean(settingValue("ambienceIntegrationEnabled", false));
}

export function configuredAmbienceGroupKey() {
  return String(settingValue("ambienceStateGroupKey", AMBIENCE_WEATHER_GROUP_DEFAULT) || AMBIENCE_WEATHER_GROUP_DEFAULT).trim();
}

export function configuredAmbienceWeatherMapping() {
  return normalizeAmbienceWeatherMapping(settingValue("ambienceWeatherMapping", DEFAULT_AMBIENCE_WEATHER_MAPPING));
}

export function getAmbienceForgeApi() {
  const module = globalThis.game?.modules?.get?.(AMBIENCE_FORGE_MODULE_ID);
  if (!module?.active) return null;
  return module.api ?? null;
}

function capabilityList(api) {
  if (!api) return [];
  if (Array.isArray(api.capabilities)) return api.capabilities;
  if (api.capabilities && typeof api.capabilities === "object") {
    return Object.entries(api.capabilities).filter(([, value]) => Boolean(value)).map(([key]) => key);
  }
  return [];
}

export function ambienceForgeRuntimeStatus() {
  const module = globalThis.game?.modules?.get?.(AMBIENCE_FORGE_MODULE_ID);
  const api = module?.active ? module.api ?? null : null;
  const capabilities = capabilityList(api);
  const contextCompatible = Boolean(api?.setContextState) && capabilities.includes("context-states-v1");
  const discoveryCompatible = Boolean(api?.getStateCatalog) && capabilities.includes("state-discovery-v1");
  return {
    installed: Boolean(module),
    active: Boolean(module?.active),
    apiVersion: api?.version ?? null,
    compatible: contextCompatible,
    discovery: discoveryCompatible,
    capabilities
  };
}

export function getAmbienceStateCatalog() {
  const status = ambienceForgeRuntimeStatus();
  if (!status.discovery) return { compositions: [] };
  try {
    const catalog = getAmbienceForgeApi()?.getStateCatalog?.();
    return catalog && Array.isArray(catalog.compositions) ? catalog : { compositions: [] };
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not read Ambience Forge state catalog`, error);
    return { compositions: [] };
  }
}

export function aggregateAmbienceStateGroups(catalog = getAmbienceStateCatalog()) {
  const groups = new Map();
  for (const composition of catalog?.compositions ?? []) {
    for (const group of composition?.groups ?? []) {
      const key = String(group?.key ?? "").trim();
      if (!key) continue;
      let entry = groups.get(key);
      if (!entry) {
        entry = { key, names: new Set(), states: new Map(), compositionCount: 0 };
        groups.set(key, entry);
      }
      entry.compositionCount += 1;
      if (group?.name) entry.names.add(String(group.name));
      for (const state of group?.states ?? []) {
        const stateKey = String(state?.key ?? "").trim();
        if (!stateKey) continue;
        let stateEntry = entry.states.get(stateKey);
        if (!stateEntry) {
          stateEntry = { key: stateKey, names: new Set(), compositionCount: 0 };
          entry.states.set(stateKey, stateEntry);
        }
        stateEntry.compositionCount += 1;
        if (state?.name) stateEntry.names.add(String(state.name));
      }
    }
  }

  return [...groups.values()]
    .map((entry) => ({
      key: entry.key,
      names: [...entry.names],
      compositionCount: entry.compositionCount,
      states: [...entry.states.values()]
        .map((state) => ({ ...state, names: [...state.names] }))
        .sort((a, b) => a.key.localeCompare(b.key))
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

let lastPublishedSignature = null;
let lastPublishedGroupKey = null;

export async function clearAmbienceWeatherContext({ groupKey = configuredAmbienceGroupKey(), force = false } = {}) {
  if (!isPrimaryActiveGM()) return false;
  const api = getAmbienceForgeApi();
  const status = ambienceForgeRuntimeStatus();
  if (!api || !status.compatible || !groupKey) return false;

  const signature = `clear:${groupKey}`;
  if (!force && lastPublishedSignature === signature) return true;

  try {
    const result = await api.clearContextState({ group: groupKey, owner: AMBIENCE_OWNER_ID });
    if (result === false) return false;
    lastPublishedSignature = signature;
    lastPublishedGroupKey = groupKey;
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not clear Ambience Forge weather context`, error);
    return false;
  }
}

export async function syncAmbienceFromWeather(weather, {
  force = false,
  previousGroupKey = null
} = {}) {
  if (!isPrimaryActiveGM()) return false;

  const api = getAmbienceForgeApi();
  const status = ambienceForgeRuntimeStatus();
  if (!api || !status.compatible) return false;

  const groupKey = configuredAmbienceGroupKey();
  const staleGroupKey = previousGroupKey || lastPublishedGroupKey;
  if (staleGroupKey && staleGroupKey !== groupKey) {
    try {
      const cleared = await api.clearContextState({ group: staleGroupKey, owner: AMBIENCE_OWNER_ID });
      if (cleared === false) return false;
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not clear previous Ambience Forge weather group`, error);
    }
  }

  if (!configuredAmbienceIntegrationEnabled()) {
    await clearAmbienceWeatherContext({ groupKey, force: true });
    return true;
  }

  const kind = resolveAmbienceWeatherKind(weather);
  const mapping = configuredAmbienceWeatherMapping();
  const stateKey = String(mapping[kind] ?? "").trim();
  if (!groupKey || !stateKey) {
    await clearAmbienceWeatherContext({ groupKey, force: true });
    return false;
  }

  const signature = `${groupKey}:${stateKey}`;
  if (!force && lastPublishedSignature === signature) return true;

  try {
    const result = await api.setContextState({
      group: groupKey,
      state: stateKey,
      owner: AMBIENCE_OWNER_ID
    });
    if (result === false) return false;
    lastPublishedSignature = signature;
    lastPublishedGroupKey = groupKey;
    return true;
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not synchronize weather with Ambience Forge`, error);
    return false;
  }
}

export async function syncAmbienceFromCurrentWeather(options = {}) {
  const weather = settingValue("weatherState", null);
  if (!weather) return false;
  return syncAmbienceFromWeather(weather, options);
}

let ambienceSyncTimer = null;

export function scheduleAmbienceSync({ delayMs = 0 } = {}) {
  if (!isPrimaryActiveGM()) return;
  if (ambienceSyncTimer) clearTimeout(ambienceSyncTimer);
  ambienceSyncTimer = setTimeout(() => {
    ambienceSyncTimer = null;
    void syncAmbienceFromCurrentWeather({ force: true });
  }, Math.max(0, Number(delayMs) || 0));
}

export function resetAmbienceSyncSignature() {
  lastPublishedSignature = null;
  lastPublishedGroupKey = null;
}
