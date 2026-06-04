import { MODULE_ID, defaultWeatherState } from "./weather-engine.js";
import { PF2eWeatherForgeApp } from "./weather-app.js";
import { defaultCalendarState, getCalendarState, setCalendarState, advanceTimeSegment, rewindTimeSegment, advanceCalendarDate } from "./calendar-engine.js";
import { defaultWeatherHistory, getWeatherHistory, setWeatherHistory, clearWeatherHistory } from "./history-engine.js";
import { defaultForecastState, generateForecast, getForecastState, setForecastState } from "./forecast-engine.js";
import { installWeatherForgeLocalizationFallback, weatherForgeLocalize, weatherForgeFormat } from "./localization.js";


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

  // Foundry registers the built-in Handlebars localize helper early. In some
  // versions it keeps a reference to the original i18n function, so our fallback
  // would not be used inside templates. Re-registering the helper here makes
  // template localization use the patched game.i18n.localize as well.
  try {
    Handlebars.registerHelper("wf", (key) => weatherForgeLocalize(MODULE_ID, key));
    Handlebars.registerHelper("wff", (key, options) => weatherForgeFormat(MODULE_ID, key, options?.hash ?? {}));
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not register Weather Forge localization helpers`, error);
  }

  registerWeatherForgeSettings();
});

Hooks.on("getSceneControlButtons", addWeatherForgeSceneControl);

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = {
    open: openWeatherForge,
    app: () => weatherForgeApp,
    getWeather: () => game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState(),
    getCalendar: getCalendarState,
    setCalendar: setCalendarState,
    nextTime: async () => setCalendarState(advanceTimeSegment(await getCalendarState())),
    previousTime: async () => setCalendarState(rewindTimeSegment(await getCalendarState())),
    nextDay: async () => setCalendarState(advanceCalendarDate(await getCalendarState(), 1)),
    previousDay: async () => setCalendarState(advanceCalendarDate(await getCalendarState(), -1)),
    getHistory: getWeatherHistory,
    setHistory: setWeatherHistory,
    clearHistory: clearWeatherHistory,
    getForecast: getForecastState,
    setForecast: setForecastState,
    generateForecast: async (days = 3) => {
      const forecast = generateForecast(game.settings.get(MODULE_ID, "weatherState") ?? defaultWeatherState(), days);
      await setForecastState(forecast);
      return forecast;
    }
  };

  console.log(`${MODULE_ID} | Ready`);
});
