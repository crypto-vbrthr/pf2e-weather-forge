# Changelog

## v1.0.0 – Final Release

Weather Forge 1.0.0 promotes the successfully tested 0.9.0-rc.1 release candidate to the first stable release.

### Final release status

* Calendar Forge integration is optional and uses Foundry world time as the canonical clock.
* Calendar-driven date, season, moon phase, regional context and daypart automation are release-ready.
* Skipped dayparts are resolved chronologically so weather continues to evolve across large time jumps.
* Manual current-daypart generation, prepared next-daypart previews and full automation are supported.
* Runtime hardening covers midnight transitions, season and moon changes, backward time movement, reload/catch-up, stale previews and provider changes.
* The original internal Golarion calendar remains available as a complete fallback when Calendar Forge is unavailable or disabled.
* Forecast, weather history, chat output, GM/player permissions and DE/EN localization are included in the stable release.

### RC promotion

No weather-generation, calendar-integration or runtime behavior was changed after the accepted 0.9.0-rc.1 candidate. This release only finalizes version, manifest, release-contract tests and documentation.

## v0.9.0-rc.1 – Release Candidate & Final Integration Review

### Review hardening

* Completed the final static integration review across Calendar Forge, internal calendar fallback, forecasting, history, chat output, localization, GM ownership, and ApplicationV2 templates.
* Removed placeholder author metadata from the module manifest.
* Calendar Forge provider selections now treat an empty available registry as authoritative, so a removed final region/moon id cannot linger as a stale setting.
* Added a read-only `getCalendarSourceStatus()` public API diagnostic for suite integrations.
* Added release-contract regression tests for manifest hygiene, optional Calendar Forge fallback behavior, localization parity, template actions, and provider-selection cleanup.

### Release posture

* Calendar Forge remains optional and is deliberately not a hard module dependency.
* Internal calendar operation remains available as the complete fallback path.
* No weather-generation balance tables or climate probabilities changed in this RC.

## v0.8.0 – Runtime & Edge-Case Hardening

### Hardened

* Restart-safe checkpoints after every fully resolved catch-up phase.
* Oversized world-time jumps abort before any partial weather timeline is written.
* Date, season and moon metadata refresh even when they change inside the same daypart, such as midnight during the night phase.
* Current previews are rejected after their calendar context becomes stale.
* Prepared next-daypart previews are bound to both source weather and target calendar context.
* Stale Calendar Forge region or moon selections are ignored if provider content disappears.
* Calendar Forge → internal fallback handoff preserves compatible Golarion dates and removes external-only metadata.
* Internal → Calendar Forge switching starts a clean runtime state.
* Reload resumes an unprocessed persisted world-time interval instead of silently moving the runtime cursor.
* Published weather reports use the currently reached Calendar Forge daypart/date even while manual weather for that phase is still open.
* Backward time movement clears future previews and carries current weather without rewriting history.

### Compatibility

* Calendar Forge remains optional.
* The existing internal calendar remains the fallback.
* Weather-generation and climate models are unchanged.

# 0.7.3 – Daypart Preview Presentation Fix

- Prepared weather for the next daypart is now shown as the full weather preview instead of a small summary below an empty-preview message.
- The preview panel clearly distinguishes between current and next-daypart previews.
- Empty-state text now distinguishes the current phase from the next phase.
- Prepared weather is explicitly marked as not active yet.

# 0.7.2 – Calendar Integration UI & Localization Fix

- Added complete internal DE/EN fallback translations for all Calendar Forge integration UI strings.
- Prevented raw i18n keys from appearing if Foundry has stale package-language cache data.
- Made Calendar Forge region/moon settings, daypart fields, status cards, and action buttons shrink- and wrap-safe.
- Improved responsive settings layout at medium and narrow window widths.
- Fixed a stray CSS brace in the history styles.

# Changelog

## v0.7.1 – ApplicationV2 Template Helper Fix

### Fixed

* Fixed Weather Forge failing to open on Foundry V14 with `Missing helper: "wf"`.
* Daypart boundary labels are now localized in the application context like the rest of the Weather Forge UI instead of relying on a custom Handlebars helper.
* Removed the obsolete custom `wf` / `wff` Handlebars helper registration.

---

## v0.7.0 – Calendar-Driven Weather & Daypart Automation

### Added

* Optional Calendar Forge integration for date, local time, season, and moon phase.
* Calendar source modes: Automatic, Calendar Forge, and Internal Calendar.
* Configurable Calendar Forge region and primary weather moon.
* Configurable daypart boundaries, defaulting to 05:00 / 11:00 / 14:00 / 18:00 / 22:00.
* Calendar-driven daypart state machine. Weather Forge no longer advances time while Calendar Forge is active.
* Manual and fully automatic current-daypart resolution modes.
* Prepared previews for the next daypart after the current daypart has been resolved.
* Automatic chronological catch-up for every skipped daypart during larger forward world-time jumps.
* Automatic resolution of an unresolved daypart when the world leaves it.
* Calendar Forge-aware forecasts using future Calendar Forge dates and seasons.
* Weather history metadata for canonical world time, calendar source, calendar, region, and resolution mode.

### Changed

* In Calendar Forge mode the old Weather Forge time navigation is hidden and disabled. Foundry world time remains the single authoritative clock.
* A prepared preview becomes the current preview when its target daypart is reached in manual mode. If that daypart is skipped, the prepared preview is used automatically as part of catch-up.
* Backward world-time movement does not regenerate past weather; the current weather is carried into the newly selected daypart and queued previews are cleared.
* The internal Weather Forge calendar remains the complete fallback when Calendar Forge is unavailable or explicitly disabled.

### Compatibility

* Calendar Forge is optional, not a hard dependency.
* Designed for Calendar Forge 0.6.2 and its public `getTemporalContext()` / `toWorldTime()` API.

---

## v0.6.7

### Fixed

* Fixed climate zone selections resetting to Temperate after actions in other tabs.
* Improved settings persistence across Weather, Forecast, History and Settings tabs.
* Added configurable extreme weather frequency settings:

  * Rare
  * Normal
  * Frequent
  * Very Frequent

### Improved

* Settings are now saved before actions are executed.
* Improved overall state persistence within the application.

---

## v0.6.6

### Fixed

* Active tab is now preserved after actions.
* Forecast updates no longer return the user to the Weather tab.

---

## v0.6.0

### Added

* Forecast system
* Forecast tab
* 1 / 3 / 5 / 7 day forecasts
* Rain probability
* Storm probability
* Confidence indicator
* Forecast chat cards

---

## v0.5.0

### Added

* Settings tab
* Weather chat cards
* GM weather reports
* Public weather reports

---

## v0.4.0

### Added

* Weather history system
* Configurable history limits
* Historical weather tracking

---

## v0.3.0

### Added

* Daily minimum and maximum temperatures
* Daily temperature curves
* Weather trends
* Multi-stage extreme weather events

---

## v0.2.0

### Added

* Calendar Forge
* Moon phases
* Seasons
* Day and month tracking

---

## v0.1.0

### Initial Release

* Weather generation
* Climate zones
* Weather descriptions
* Localization support
