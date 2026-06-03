import { MODULE_ID, defaultWeatherState } from "./weather-engine.js";
import { PF2eWeatherForgeApp } from "./weather-app.js";
import { defaultCalendarState, getCalendarState, setCalendarState, advanceTimeSegment, rewindTimeSegment, advanceCalendarDate } from "./calendar-engine.js";

let weatherForgeApp;

function openWeatherForge() {
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
  game.settings.register(MODULE_ID, "weatherState", {
    name: `${MODULE_ID}.settings.weatherState.name`,
    hint: `${MODULE_ID}.settings.weatherState.hint`,
    scope: "world",
    config: false,
    type: Object,
    default: defaultWeatherState()
  });

  game.settings.register(MODULE_ID, "weatherPreview", {
    name: `${MODULE_ID}.settings.weatherPreview.name`,
    hint: `${MODULE_ID}.settings.weatherPreview.hint`,
    scope: "world",
    config: false,
    type: Object,
    default: null
  });

  game.settings.register(MODULE_ID, "calendarState", {
    name: `${MODULE_ID}.settings.calendarState.name`,
    hint: `${MODULE_ID}.settings.calendarState.hint`,
    scope: "world",
    config: false,
    type: Object,
    default: defaultCalendarState()
  });
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
    previousDay: async () => setCalendarState(advanceCalendarDate(await getCalendarState(), -1))
  };

  console.log(`${MODULE_ID} | Ready`);
});
