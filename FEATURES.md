# PF2E Weather Forge - Features

This document provides a detailed overview of all major features available in PF2E Weather Forge.

---

# Weather Generation

PF2E Weather Forge generates persistent and evolving weather conditions for Pathfinder Second Edition Remastered campaigns.

Generated weather includes:

* Temperature
* Weather type
* Wind strength
* Cloud cover
* Humidity
* Seasonal effects
* Climate effects
* Extreme weather

Weather conditions evolve naturally over time instead of being generated independently.

---

# Climate Zones

Supported climate zones:

* Arctic
* Temperate
* Mediterranean
* Tropical
* Desert
* Mountain
* Coastal
* Swamp

Each climate zone influences:

* Temperature ranges
* Humidity
* Cloud formation
* Rainfall probability
* Extreme weather probability

---

# Time of Day System

Weather is generated for five dayparts:

* Morning
* Noon
* Afternoon
* Evening
* Night

With Calendar Forge active these are clock-driven intervals. Their start hours are configurable and default to 05:00, 11:00, 14:00, 18:00 and 22:00. Weather Forge observes Foundry world time rather than changing it. If a time jump crosses several dayparts, every completed intermediate daypart is generated in sequence so the weather model keeps its continuity.

---

# Dynamic Temperature Curves

Weather Forge simulates realistic daily temperature progression.

Each day generates:

* Daily minimum temperature
* Daily maximum temperature

Temperatures throughout the day are derived from those values.

Typical behavior:

* Coldest during the night
* Warmest during the afternoon
* Cooling during the evening

---

# Calendar Integration

Weather Forge supports two calendar sources:

* Calendar Forge, when installed and selected
* The original internal Golarion calendar as a complete fallback

Calendar Forge supplies date, local time, season and moon phase. Weather Forge can select a Calendar Forge region and a primary moon. The integration is optional; no external calendar module is required.

In manual mode the GM generates and accepts weather only for the currently reached daypart. Once resolved, the next daypart can be rolled repeatedly as a prepared preview without applying it early. In automatic mode the current daypart is generated and applied as soon as its boundary is reached.

---

# Moon Phases

Supported moon phases:

* New Moon
* Waxing Crescent
* First Quarter
* Waxing Gibbous
* Full Moon
* Waning Gibbous
* Last Quarter
* Waning Crescent

Moon phases progress automatically with time.

---

# Seasons

Weather Forge tracks:

* Spring
* Summer
* Autumn
* Winter

Seasons influence:

* Temperature ranges
* Weather patterns
* Climate behavior

---

# Extreme Weather

Weather Forge supports multi-stage extreme weather events.

Examples:

* Storms
* Thunderstorms
* Heatwaves
* Cold waves

Extreme weather develops gradually:

* Approaching
* Active
* Dissipating

Events can span multiple days.

Configurable frequency:

* Rare
* Normal
* Frequent
* Very Frequent

---

# Forecast System

Weather Forge provides realistic weather forecasting.

Supported forecast lengths:

* 1 day
* 3 days
* 5 days
* 7 days

Forecasts display:

* Expected conditions
* Temperature range
* Rain probability
* Storm probability
* Confidence level

Forecasts influence future weather generation.

Actual weather generally follows forecasts while still allowing realistic variation.

---

# Weather History

Weather Forge records historical weather data.

Stored information:

* Date
* Time of day
* Temperature
* Weather type
* Humidity
* Cloud cover
* Wind strength
* Trend information
* Extreme weather status

Configurable history limits:

* 30 days
* 90 days
* 180 days
* 365 days
* Unlimited

---

# Weather Trends

Weather Forge tracks ongoing atmospheric trends.

Examples:

* Warming trends
* Cooling trends
* Increasing cloud cover
* Dry periods
* Wet periods

These trends influence both forecasts and generated weather.

---

# Chat Integration

Weather can be published directly to Foundry chat.

Supported outputs:

### GM Weather Reports

Includes:

* Detailed weather information
* Daily minimum temperature
* Daily maximum temperature
* Forecast details
* Extreme weather information

### Public Weather Reports

Includes:

* Visible weather conditions
* Narrative descriptions
* Immersion-focused presentation

Hidden GM information is not revealed.

---

# Localization

Included languages:

* English
* German

All interface elements are localized.

Supported content includes:

* User interface
* Weather descriptions
* Forecast system
* Calendar information
* Chat cards
* History system

---

# User Interface

The Weather Forge interface contains four major sections.

## Weather

Current weather and weather generation controls.

## Forecast

Forecast information and weather outlooks.

## History

Historical weather records.

## Settings

Climate, forecast, history and output configuration.

---

# Foundry Integration

Weather Forge integrates directly into Foundry VTT.

Features:

* GM toolbar button
* ApplicationV2 support
* Persistent settings
* World-level weather storage
* Chat integration

---

# Pathfinder 2E Support

Weather Forge was designed specifically for Pathfinder Second Edition Remastered.

Included support:

* Golarion calendar
* Pathfinder-style weather presentation
* GM-focused world simulation
* Long-term campaign support

---

# Planned Features

Future versions may include:

* Sunrise and sunset calculations
* Regional weather profiles
* Weather statistics
* Seasonal event support
* Export tools
* Extended forecast models

Feature availability may change between releases.

## 0.8 Runtime hardening

* Restart-safe daypart catch-up checkpoints
* Safe abort for excessively large world-time jumps before partial weather is written
* Midnight/date/season/moon metadata refresh within an unchanged daypart
* Stale current-preview rejection
* Source-weather and target-context validation for prepared next-daypart previews
* Safe Calendar Forge provider-selection fallback
* Calendar Forge ↔ internal calendar handoff hardening
* Current Calendar Forge metadata in published weather reports

## 1.0 Stable release

* Optional Calendar Forge integration with internal-calendar fallback
* Calendar-driven date, season, moon phase and daypart context
* Manual, prepared-preview and automatic weather workflows
* Chronological catch-up across skipped dayparts
* Forecast, history and chat integration
* Runtime and edge-case hardening
* German and English localization


## City Forge Integration (1.1.0)

- Optional active-Scene context from City Forge
- Settlement → district → location resolution
- Automatic City climate mapping with manual fallback
- Climate and terrain mapping in German and English
- Normal, reset, forecast, queued, and automatic Calendar Forge generation all use the effective City climate
- Current-weather provenance
- Cross-Scene context mismatch warning
- Preview invalidation on Scene / City settlement changes
- Public climate/context API
- No automatic City Dynamic State mutations
