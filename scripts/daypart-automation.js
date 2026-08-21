import { MODULE_ID, CLIMATE_ZONES, defaultWeatherState, generateWeatherForTarget } from "./weather-engine.js";
import { appendWeatherHistory } from "./history-engine.js";
import { getForecastState } from "./forecast-engine.js";
import {
  effectiveCalendarSourceMode,
  getCalendarForgePhaseInfo,
  enumerateCalendarForgePhaseBoundaries,
  getCalendarForgeSnapshot
} from "./calendar-source.js";

export function defaultCalendarDrivenState() {
  return {
    initialized: false,
    lastWorldTime: null,
    currentPhaseKey: null,
    resolvedPhaseKey: null,
    phaseBaseWeather: null,
    queuedPreview: null,
    sourceSignature: null
  };
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function getState() {
  const stored = game.settings.get(MODULE_ID, "calendarDrivenState");
  return { ...defaultCalendarDrivenState(), ...(stored && typeof stored === "object" ? stored : {}) };
}

async function setState(state) {
  await game.settings.set(MODULE_ID, "calendarDrivenState", state);
  return state;
}

function sourceSignature() {
  const source = String(game.settings.get(MODULE_ID, "calendarSourceMode") ?? "auto");
  const region = String(game.settings.get(MODULE_ID, "calendarForgeRegionId") ?? "");
  const moon = String(game.settings.get(MODULE_ID, "calendarForgeMoonId") ?? "");
  const boundaries = JSON.stringify(game.settings.get(MODULE_ID, "daypartBoundaries") ?? {});
  return `${source}|${region}|${moon}|${boundaries}`;
}

function generationSettings(weather) {
  return {
    climateZone: weather?.climateZone ?? "temperate",
    allowExtreme: game.settings.get(MODULE_ID, "allowExtreme") ?? true,
    extremeFrequency: game.settings.get(MODULE_ID, "extremeFrequency") ?? "normal",
    forceExtreme: false,
    forecast: getForecastState()
  };
}

function annotateWeather(weather, phase, resolution) {
  return {
    ...weather,
    weatherForgeCalendarSource: "calendarForge",
    weatherForgeWorldTime: phase.startWorldTime,
    weatherForgePhaseKey: phase.key,
    weatherForgeResolution: resolution,
    calendarLabels: clone(phase.calendar.calendarLabels ?? {})
  };
}

async function commitWeather(weather, phase, resolution, { history = true } = {}) {
  const committed = annotateWeather(weather, phase, resolution);
  await game.settings.set(MODULE_ID, "weatherState", committed);
  if (history) {
    await appendWeatherHistory(committed, {
      worldTime: phase.startWorldTime,
      calendarSource: "calendarForge",
      calendarId: phase.calendar.calendarId,
      regionId: phase.calendar.regionId,
      formattedDate: phase.calendar.formattedDate
    });
  }
  return committed;
}

async function generateForPhase(baseWeather, phase, resolution = "automatic", settingsOverride = {}) {
  const target = { ...phase.calendar, timeSegment: phase.segment };
  const generated = generateWeatherForTarget(baseWeather, target, {
    ...generationSettings(baseWeather),
    ...settingsOverride
  });
  return annotateWeather(generated, phase, resolution);
}

function automationMode() {
  const value = String(game.settings.get(MODULE_ID, "daypartAutomationMode") ?? "manual");
  return value === "automatic" ? "automatic" : "manual";
}

function notify(key, data = {}) {
  if (!game.user?.isGM) return;
  try { ui.notifications.info(game.i18n.format(`${MODULE_ID}.${key}`, data)); }
  catch (_) { ui.notifications.info(game.i18n.localize(`${MODULE_ID}.${key}`)); }
}

function currentWeather() {
  return game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
}

export async function initializeCalendarDrivenWeather({ force = false } = {}) {
  if (effectiveCalendarSourceMode() !== "calendarForge") return null;
  const phase = await getCalendarForgePhaseInfo(game.time.worldTime);
  if (!phase) return null;
  let state = getState();
  const signature = sourceSignature();
  if (!force && state.initialized && state.sourceSignature === signature) {
    state.lastWorldTime = Number(game.time.worldTime);
    state.currentPhaseKey = phase.key;
    await setState(state);
    return state;
  }

  const adopted = annotateWeather({ ...currentWeather(), ...phase.calendar, timeSegment: phase.segment }, phase, "carried");
  await game.settings.set(MODULE_ID, "weatherState", adopted);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  state = {
    ...defaultCalendarDrivenState(),
    initialized: true,
    lastWorldTime: Number(game.time.worldTime),
    currentPhaseKey: phase.key,
    resolvedPhaseKey: phase.key,
    phaseBaseWeather: clone(adopted),
    queuedPreview: null,
    sourceSignature: signature
  };
  await setState(state);
  return state;
}

async function resolvePhaseAutomatically(baseWeather, phase, resolution = "automatic") {
  const generated = await generateForPhase(baseWeather, phase, resolution);
  return commitWeather(generated, phase, resolution);
}

export async function processCalendarWorldTimeChange(worldTime, delta = 0) {
  if (effectiveCalendarSourceMode() !== "calendarForge") return { active: false };
  let state = getState();
  const signature = sourceSignature();
  if (!state.initialized || state.sourceSignature !== signature) state = await initializeCalendarDrivenWeather({ force: true });
  if (!state) return { active: false };

  const to = Number(worldTime);
  const from = Number.isFinite(Number(state.lastWorldTime)) ? Number(state.lastWorldTime) : to - Number(delta || 0);
  const targetPhase = await getCalendarForgePhaseInfo(to);

  if (to < from) {
    const carried = annotateWeather({ ...currentWeather(), ...targetPhase.calendar, timeSegment: targetPhase.segment }, targetPhase, "carried");
    await game.settings.set(MODULE_ID, "weatherState", carried);
    await game.settings.set(MODULE_ID, "weatherPreview", null);
    state = {
      ...state,
      lastWorldTime: to,
      currentPhaseKey: targetPhase.key,
      resolvedPhaseKey: targetPhase.key,
      phaseBaseWeather: clone(carried),
      queuedPreview: null,
      sourceSignature: signature
    };
    await setState(state);
    notify("notification.calendarTimeRewound");
    return { active: true, backward: true, phase: targetPhase };
  }

  const boundaries = await enumerateCalendarForgePhaseBoundaries(from, to);
  if (!boundaries.length) {
    state.lastWorldTime = to;
    state.currentPhaseKey = targetPhase.key;
    await setState(state);
    return { active: true, boundaries: 0, phase: targetPhase };
  }

  await game.settings.set(MODULE_ID, "weatherPreview", null);
  let weather = currentWeather();
  const fromPhase = await getCalendarForgePhaseInfo(from);
  if (state.resolvedPhaseKey !== fromPhase.key) {
    const base = state.phaseBaseWeather ?? weather;
    weather = await resolvePhaseAutomatically(base, fromPhase, "automatic-catchup");
    state.resolvedPhaseKey = fromPhase.key;
  }

  for (let index = 0; index < boundaries.length; index += 1) {
    const entered = boundaries[index];
    const isFinal = index === boundaries.length - 1;
    const queued = state.queuedPreview?.phaseKey === entered.key ? state.queuedPreview : null;
    state.phaseBaseWeather = clone(weather);
    state.currentPhaseKey = entered.key;

    if (isFinal && automationMode() === "manual") {
      await game.settings.set(MODULE_ID, "weatherPreview", queued?.weather ? annotateWeather(queued.weather, entered, "queued-preview") : null);
      state.queuedPreview = null;
      // Keep resolvedPhaseKey on the prior phase. The newly entered current phase is intentionally open.
      break;
    }

    if (queued?.weather) {
      weather = await commitWeather(queued.weather, entered, "queued-preview");
      state.queuedPreview = null;
    } else {
      weather = await resolvePhaseAutomatically(weather, entered, isFinal ? "automatic" : "automatic-catchup");
    }
    state.resolvedPhaseKey = entered.key;
  }

  state.lastWorldTime = to;
  state.sourceSignature = signature;
  await setState(state);

  if (automationMode() === "manual" && state.resolvedPhaseKey !== targetPhase.key) {
    notify("notification.daypartReached", { daypart: game.i18n.localize(`${MODULE_ID}.time.${targetPhase.segment}`) });
  }
  return { active: true, boundaries: boundaries.length, phase: targetPhase, resolved: state.resolvedPhaseKey === targetPhase.key };
}

export async function getCalendarDrivenUiState() {
  if (effectiveCalendarSourceMode() !== "calendarForge") return { active: false };
  let state = getState();
  if (!state.initialized || state.sourceSignature !== sourceSignature()) state = await initializeCalendarDrivenWeather({ force: true });
  const phase = await getCalendarForgePhaseInfo(game.time.worldTime);
  const resolved = state.resolvedPhaseKey === phase.key;
  const queued = state.queuedPreview;
  let nextPhase = null;
  try { nextPhase = await getCalendarForgePhaseInfo(phase.nextBoundaryWorldTime); } catch (_) {}
  return {
    active: true,
    phase,
    resolved,
    state,
    queuedPreview: queued,
    nextPhase,
    automationMode: automationMode()
  };
}

export async function generateCurrentPhasePreview({ climateZone = null, allowExtreme = null, extremeFrequency = null, forceExtreme = false, extremeType = null } = {}) {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active) return null;
  if (uiState.resolved) return null;
  const base = uiState.state.phaseBaseWeather ?? currentWeather();
  const settings = {
    ...generationSettings(base),
    climateZone: climateZone || base.climateZone,
    allowExtreme: allowExtreme ?? (game.settings.get(MODULE_ID, "allowExtreme") ?? true),
    extremeFrequency: extremeFrequency || game.settings.get(MODULE_ID, "extremeFrequency") || "normal",
    forceExtreme,
    extremeType
  };
  const preview = annotateWeather(generateWeatherForTarget(base, uiState.phase.calendar, settings), uiState.phase, "manual-preview");
  await game.settings.set(MODULE_ID, "weatherPreview", preview);
  return preview;
}

export async function acceptCurrentPhasePreview() {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active) return null;
  const preview = game.settings.get(MODULE_ID, "weatherPreview");
  if (!preview || preview.weatherForgePhaseKey !== uiState.phase.key) return null;
  const committed = await commitWeather(preview, uiState.phase, "manual");
  const state = getState();
  state.resolvedPhaseKey = uiState.phase.key;
  state.currentPhaseKey = uiState.phase.key;
  state.lastWorldTime = Number(game.time.worldTime);
  state.queuedPreview = null;
  await setState(state);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  return committed;
}

export async function prepareNextPhasePreview({ climateZone = null } = {}) {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active || !uiState.resolved || !uiState.nextPhase) return null;
  const base = currentWeather();
  const requestedClimate = climateZone && CLIMATE_ZONES[climateZone] ? climateZone : base.climateZone;
  const generated = await generateForPhase(base, uiState.nextPhase, "queued-preview", { climateZone: requestedClimate });
  const state = getState();
  state.queuedPreview = {
    phaseKey: uiState.nextPhase.key,
    targetWorldTime: uiState.nextPhase.startWorldTime,
    segment: uiState.nextPhase.segment,
    weather: generated,
    createdAt: Date.now()
  };
  await setState(state);
  return state.queuedPreview;
}

export async function clearQueuedPreview() {
  const state = getState();
  state.queuedPreview = null;
  await setState(state);
}

export async function resolveCurrentPhaseWithInitialWeather(climateZone = "temperate") {
  const uiState = await getCalendarDrivenUiState();
  if (!uiState.active) return null;
  const { createInitialWeatherState } = await import("./weather-engine.js");
  const weather = createInitialWeatherState(climateZone, uiState.phase.calendar);
  const committed = await commitWeather(weather, uiState.phase, "manual-reset", { history: false });
  const state = getState();
  state.currentPhaseKey = uiState.phase.key;
  state.resolvedPhaseKey = uiState.phase.key;
  state.phaseBaseWeather = clone(committed);
  state.queuedPreview = null;
  state.lastWorldTime = Number(game.time.worldTime);
  await setState(state);
  await game.settings.set(MODULE_ID, "weatherPreview", null);
  return committed;
}

export async function invalidateQueuedPreview() {
  const state = getState();
  if (!state.queuedPreview) return false;
  state.queuedPreview = null;
  await setState(state);
  return true;
}
