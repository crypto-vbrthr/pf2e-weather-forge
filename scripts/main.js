import { MODULE_ID, defaultWeatherState } from "./weather-engine.js";
import { PF2eWeatherForgeApp } from "./weather-app.js";
import { defaultCalendarState, getCalendarState, setCalendarState, advanceTimeSegment, rewindTimeSegment, advanceCalendarDate, adoptWeatherIntoInternalCalendarFallback } from "./calendar-engine.js";
import { defaultWeatherHistory, getWeatherHistory, setWeatherHistory, clearWeatherHistory } from "./history-engine.js";
import { defaultForecastState, generateForecast, generateForecastFromCalendars, getForecastState, setForecastState } from "./forecast-engine.js";
import { installWeatherForgeLocalizationFallback } from "./localization.js";
import { DEFAULT_DAYPART_BOUNDARIES, effectiveCalendarSourceMode, getCalendarForgeApi, calendarForgeOptions, getCalendarForgeSnapshot, calendarForgeRuntimeStatus } from "./calendar-source.js";
import { defaultCalendarDrivenState, initializeCalendarDrivenWeather, processCalendarWorldTimeChange } from "./daypart-automation.js";


function isSettingRegistered(key) {
  return game.settings?.settings?.has(`${MODULE_ID}.${key}`) ?? false;
}

function registerWeatherForgeSettings() {
  if (!isSettingRegistered("weatherState")) {
    game.settings.register(MODULE_ID, "weatherState", {
      name: `${MODULE_ID}.settings.weatherState.name`,
      hint: `${MODULE_ID}.settings.weatherState.hint`,
      scope: "world",
      config: false,
      type: Object,
      default: defaultWeatherState()
    });
  }

  if (!isSettingRegistered("weatherPreview")) {
    game.settings.register(MODULE_ID, "weatherPreview", {
      name: `${MODULE_ID}.settings.weatherPreview.name`,
      hint: `${MODULE_ID}.settings.weatherPreview.hint`,
      scope: "world",
      config: false,
      type: Object,
      default: null
    });
  }

  if (!isSettingRegistered("calendarState")) {
    game.settings.register(MODULE_ID, "calendarState", {
      name: `${MODULE_ID}.settings.calendarState.name`,
      hint: `${MODULE_ID}.settings.calendarState.hint`,
      scope: "world",
      config: false,
      type: Object,
      default: defaultCalendarState()
    });
  }

  if (!isSettingRegistered("weatherHistory")) {
    game.settings.register(MODULE_ID, "weatherHistory", {
      name: `${MODULE_ID}.settings.weatherHistory.name`,
      hint: `${MODULE_ID}.settings.weatherHistory.hint`,
      scope: "world",
      config: false,
      type: Object,
      default: defaultWeatherHistory()
    });
  }

  if (!isSettingRegistered("forecastState")) {
    game.settings.register(MODULE_ID, "forecastState", {
      name: `${MODULE_ID}.settings.forecastState.name`,
      hint: `${MODULE_ID}.settings.forecastState.hint`,
      scope: "world",
      config: false,
      type: Object,
      default: defaultForecastState()
    });
  }

  if (!isSettingRegistered("forecastDays")) {
    game.settings.register(MODULE_ID, "forecastDays", {
      name: `${MODULE_ID}.settings.forecastDays.name`,
      hint: `${MODULE_ID}.settings.forecastDays.hint`,
      scope: "world",
      config: false,
      type: String,
      default: "3",
      choices: {
        "1": `${MODULE_ID}.forecast.days.1`,
        "3": `${MODULE_ID}.forecast.days.3`,
        "5": `${MODULE_ID}.forecast.days.5`,
        "7": `${MODULE_ID}.forecast.days.7`
      }
    });
  }

  if (!isSettingRegistered("chatOutputMode")) {
    game.settings.register(MODULE_ID, "chatOutputMode", {
      name: `${MODULE_ID}.settings.chatOutputMode.name`,
      hint: `${MODULE_ID}.settings.chatOutputMode.hint`,
      scope: "world",
      config: false,
      type: String,
      default: "gm",
      choices: {
        "gm": `${MODULE_ID}.chat.mode.gm`,
        "public": `${MODULE_ID}.chat.mode.public`,
        "ask": `${MODULE_ID}.chat.mode.ask`
      }
    });
  }

  if (!isSettingRegistered("allowExtreme")) {
    game.settings.register(MODULE_ID, "allowExtreme", {
      name: `${MODULE_ID}.settings.allowExtreme.name`,
      hint: `${MODULE_ID}.settings.allowExtreme.hint`,
      scope: "world",
      config: false,
      type: Boolean,
      default: true
    });
  }

  if (!isSettingRegistered("extremeFrequency")) {
    game.settings.register(MODULE_ID, "extremeFrequency", {
      name: `${MODULE_ID}.settings.extremeFrequency.name`,
      hint: `${MODULE_ID}.settings.extremeFrequency.hint`,
      scope: "world",
      config: false,
      type: String,
      default: "normal",
      choices: {
        "rare": `${MODULE_ID}.settings.extremeFrequency.rare`,
        "normal": `${MODULE_ID}.settings.extremeFrequency.normal`,
        "frequent": `${MODULE_ID}.settings.extremeFrequency.frequent`,
        "veryFrequent": `${MODULE_ID}.settings.extremeFrequency.veryFrequent`
      }
    });
  }

  if (!isSettingRegistered("historyLimit")) {
    game.settings.register(MODULE_ID, "historyLimit", {
      name: `${MODULE_ID}.settings.historyLimit.name`,
      hint: `${MODULE_ID}.settings.historyLimit.hint`,
      scope: "world",
      config: false,
      type: String,
      default: "90",
      choices: {
        "30": `${MODULE_ID}.settings.historyLimit.30`,
        "90": `${MODULE_ID}.settings.historyLimit.90`,
        "180": `${MODULE_ID}.settings.historyLimit.180`,
        "365": `${MODULE_ID}.settings.historyLimit.365`,
        "unlimited": `${MODULE_ID}.settings.historyLimit.unlimited`
      }
    });
  }

  if (!isSettingRegistered("calendarSourceMode")) {
    game.settings.register(MODULE_ID, "calendarSourceMode", {
      name: `${MODULE_ID}.settings.calendarSourceMode.name`,
      hint: `${MODULE_ID}.settings.calendarSourceMode.hint`,
      scope: "world", config: false, type: String, default: "auto"
    });
  }
  if (!isSettingRegistered("calendarForgeRegionId")) {
    game.settings.register(MODULE_ID, "calendarForgeRegionId", {
      name: `${MODULE_ID}.settings.calendarForgeRegionId.name`,
      hint: `${MODULE_ID}.settings.calendarForgeRegionId.hint`,
      scope: "world", config: false, type: String, default: ""
    });
  }
  if (!isSettingRegistered("calendarForgeMoonId")) {
    game.settings.register(MODULE_ID, "calendarForgeMoonId", {
      name: `${MODULE_ID}.settings.calendarForgeMoonId.name`,
      hint: `${MODULE_ID}.settings.calendarForgeMoonId.hint`,
      scope: "world", config: false, type: String, default: ""
    });
  }
  if (!isSettingRegistered("daypartAutomationMode")) {
    game.settings.register(MODULE_ID, "daypartAutomationMode", {
      name: `${MODULE_ID}.settings.daypartAutomationMode.name`,
      hint: `${MODULE_ID}.settings.daypartAutomationMode.hint`,
      scope: "world", config: false, type: String, default: "manual"
    });
  }
  if (!isSettingRegistered("daypartBoundaries")) {
    game.settings.register(MODULE_ID, "daypartBoundaries", {
      name: `${MODULE_ID}.settings.daypartBoundaries.name`,
      hint: `${MODULE_ID}.settings.daypartBoundaries.hint`,
      scope: "world", config: false, type: Object, default: { ...DEFAULT_DAYPART_BOUNDARIES }
    });
  }
  if (!isSettingRegistered("calendarDrivenState")) {
    game.settings.register(MODULE_ID, "calendarDrivenState", {
      name: `${MODULE_ID}.settings.calendarDrivenState.name`,
      hint: `${MODULE_ID}.settings.calendarDrivenState.hint`,
      scope: "world", config: false, type: Object, default: defaultCalendarDrivenState()
    });
  }
}

let weatherForgeApp;

function openWeatherForge() {
  registerWeatherForgeSettings();
  weatherForgeApp ??= new PF2eWeatherForgeApp();
  weatherForgeApp.render(true);
  return weatherForgeApp;
}

function createWeatherForgeTool() {
  return {
    name: "pf2e-weather-forge",
    title: game.i18n.localize(`${MODULE_ID}.app.title`),
    icon: "fas fa-cloud-sun-rain",
    button: true,
    visible: game.user?.isGM ?? false,
    onChange: () => openWeatherForge()
  };
}

function addWeatherForgeSceneControl(controls) {
  if (!game.user?.isGM) return;

  const tool = createWeatherForgeTool();

  if (Array.isArray(controls)) {
    const preferredControl =
      controls.find(c => c.name === "token")
      ?? controls.find(c => c.name === "measure")
      ?? controls.find(c => c.name === "regions")
      ?? controls[0];

    if (!preferredControl) return;
    preferredControl.tools ??= [];
    if (!preferredControl.tools.some(t => t.name === tool.name)) preferredControl.tools.push(tool);
    return;
  }

  const preferredControl = controls?.token ?? controls?.measure ?? controls?.regions ?? Object.values(controls ?? {})[0];
  if (!preferredControl) return;

  preferredControl.tools ??= [];
  if (Array.isArray(preferredControl.tools)) {
    if (!preferredControl.tools.some(t => t.name === tool.name)) preferredControl.tools.push(tool);
  } else if (typeof preferredControl.tools === "object") {
    preferredControl.tools[tool.name] = tool;
  }
}

Hooks.once("init", () => {
  installWeatherForgeLocalizationFallback(MODULE_ID);


  registerWeatherForgeSettings();
});

Hooks.on("getSceneControlButtons", addWeatherForgeSceneControl);

function isPrimaryActiveGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM;
  if (activeGM) return activeGM.id === game.user.id;
  const first = [...(game.users ?? [])].find(user => user.active && user.isGM);
  return !first || first.id === game.user.id;
}

let calendarUpdateQueue = Promise.resolve();
Hooks.on("updateWorldTime", (worldTime, delta) => {
  if (!isPrimaryActiveGM()) return;
  calendarUpdateQueue = calendarUpdateQueue.then(async () => {
    try {
      await processCalendarWorldTimeChange(worldTime, delta);
      if (weatherForgeApp?.rendered) weatherForgeApp.render();
    } catch (error) {
      console.error(`${MODULE_ID} | Calendar-driven weather update failed`, error);
      const key = error?.code === "WEATHER_FORGE_CATCHUP_LIMIT"
        ? `${MODULE_ID}.notification.catchupLimit`
        : `${MODULE_ID}.notification.calendarIntegrationError`;
      ui.notifications?.error?.(game.i18n.localize(key));
    }
  });
});

Hooks.on("calendarForgeReady", async () => {
  if (!isPrimaryActiveGM()) return;
  try { await processCalendarWorldTimeChange(game.time.worldTime, 0); }
  catch (error) { console.warn(`${MODULE_ID} | Calendar Forge initialization failed`, error); }
});

async function generateForecastForCurrentSource(days = 3) {
  const currentStored = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
  if (effectiveCalendarSourceMode() !== "calendarForge") return generateForecast(currentStored, days);
  const api = getCalendarForgeApi();
  if (!api) return generateForecast(currentStored, days);
  const context = await api.getTemporalContext(calendarForgeOptions());
  const time = context.raw?.calendar?.time ?? {};
  const secondsPerDay = Number(time.secondsPerMinute ?? 60) * Number(time.minutesPerHour ?? 60) * Number(time.hoursPerDay ?? 24);
  const currentCalendar = await getCalendarForgeSnapshot({ fallbackWeather: currentStored });
  const current = { ...currentStored, ...currentCalendar };
  const calendars = [];
  for (let day = 1; day <= Math.max(1, Math.min(7, Number(days) || 3)); day += 1) {
    calendars.push(await getCalendarForgeSnapshot({ worldTime: Number(game.time.worldTime) + day * secondsPerDay, fallbackWeather: current }));
  }
  return generateForecastFromCalendars(current, calendars);
}

Hooks.once("ready", async () => {
  game.modules.get(MODULE_ID).api = {
    open: openWeatherForge,
    app: () => weatherForgeApp,
    getWeather: () => game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState(),
    getCalendarSourceStatus: () => calendarForgeRuntimeStatus(),
    getCalendar: async () => effectiveCalendarSourceMode() === "calendarForge"
      ? (await getCalendarForgeSnapshot({ fallbackWeather: game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState() }))
      : getCalendarState(),
    setCalendar: setCalendarState,
    nextTime: async () => effectiveCalendarSourceMode() === "calendarForge" ? null : setCalendarState(advanceTimeSegment(await getCalendarState())),
    previousTime: async () => effectiveCalendarSourceMode() === "calendarForge" ? null : setCalendarState(rewindTimeSegment(await getCalendarState())),
    nextDay: async () => effectiveCalendarSourceMode() === "calendarForge" ? null : setCalendarState(advanceCalendarDate(await getCalendarState(), 1)),
    previousDay: async () => effectiveCalendarSourceMode() === "calendarForge" ? null : setCalendarState(advanceCalendarDate(await getCalendarState(), -1)),
    getHistory: getWeatherHistory,
    setHistory: setWeatherHistory,
    clearHistory: clearWeatherHistory,
    getForecast: getForecastState,
    setForecast: setForecastState,
    generateForecast: async (days = 3) => {
      const forecast = await generateForecastForCurrentSource(days);
      await setForecastState(forecast);
      return forecast;
    }
  };

  if (isPrimaryActiveGM()) {
    if (effectiveCalendarSourceMode() === "calendarForge") {
      try { await processCalendarWorldTimeChange(game.time.worldTime, 0); }
      catch (error) { console.warn(`${MODULE_ID} | Calendar Forge integration could not resume`, error); }
    } else {
      try {
        const weather = game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState();
        if (weather.weatherForgeCalendarSource === "calendarForge") {
          await adoptWeatherIntoInternalCalendarFallback(weather);
        }
      } catch (error) {
        console.warn(`${MODULE_ID} | Internal calendar fallback handoff failed`, error);
      }
    }
  }

  console.log(`${MODULE_ID} | Ready`);
});
