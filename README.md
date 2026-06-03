# PF2e Weather Forge

PF2e Weather Forge is a Foundry VTT module for Pathfinder Second Edition that generates persistent, climate-aware weather by time segment.

## Features

- GM-only toolbar button on the scene controls
- Three-column UI: current weather, settings/calendar, preview
- Climate zones including temperate, coastal, arctic, desert, tropical, mountain, swamp, mediterranean, and magically distorted
- Persistent weather state and preview state
- Internal Golarion Calendar Forge
  - Golarion weekdays
  - Golarion months
  - year, month day, season, moon phase
  - previous/next time segment
  - previous/next day
  - manual calendar editing
- Extreme weather that can persist and decay over multiple time segments
- German and English localization
- Small public API for macros and later module integration

## Macro API

```js
game.modules.get("pf2e-weather-forge").api.open();
await game.modules.get("pf2e-weather-forge").api.getCalendar();
await game.modules.get("pf2e-weather-forge").api.nextTime();
await game.modules.get("pf2e-weather-forge").api.nextDay();
```

## 0.2.2

- The settings column is wider to reduce line wrapping.
- Calendar form values are now applied before weather generation, reset, and calendar navigation actions.
- Added season-aware temperature ranges for every climate zone.
- Mediterranean summer temperatures are clamped to a believable range.
- Temperature generation now respects the current internal calendar season and time segment.
