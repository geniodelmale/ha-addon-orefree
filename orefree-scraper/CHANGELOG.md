# Changelog

## 2026-06-27 - v0.0.29
Updated the scraped element selector: the daily free hours are now read from `div#fasciaGiornalieraBase.info-value` (previously `div#fasciaGiornalieraImpostata.info-value`) to match the updated OreFree page markup.

## 2026-06-27 - v0.0.28
Fixed login errors being masked as successful responses:
- The scraper no longer swallows errors and returns an empty `200 OK`. Errors are now rethrown after logging (browser close moved to `finally`).
- The `/fetchHours` endpoint now returns a proper HTTP error with the corresponding message: `401` for login errors, `502` for other scraping errors. The response body is `{ "error": "<message>" }`.

## 2026-05-28 - v0.0.27
Fixed changelog not shown in Home Assistant addon page: renamed `CHANGELOG.MD` to `CHANGELOG.md` (lowercase extension) because the Supervisor looks for the exact lowercase filename on a case-sensitive filesystem.

## 2026-05-28 - v0.0.26
Fixed Docker build failure `base name ($BUILD_FROM) should not be blank`:
- Added `build.yaml` declaring the Home Assistant base images for every supported architecture (`aarch64`, `amd64`, `armhf`, `armv7`, `i386`). Recent Supervisor versions require it for non-official addons, otherwise `BUILD_FROM` is not passed to `docker build`.

## 2026-05-28 - v0.0.25
Fixed missing logs in Home Assistant addon "Log" tab:
- Switched Fastify/Pino logger to `pino-pretty` transport with `sync: true` so log lines are flushed immediately when Node runs as PID 1 (`init: false`).
- Human-readable log format (no colors, timestamp `yyyy-mm-dd HH:MM:ss`, `pid`/`hostname` hidden).
- Added `SIGINT`/`SIGTERM` handlers for graceful shutdown and final log flush.
- Added `pino-pretty` to runtime `dependencies` so it survives `npm ci --production`.

## 2025-08-12 - v0.0.14
Added attempt when trying to close modal

## 2025-08-12 - v0.0.13 
Added input_boolean_entity and switch_entity as optional query parameters to be used when type=timeslot

{ "timeslots":[{ "start": "4:00", "actions": [{ "service": "input_boolean.turn_on", "entity_id": "INPUT_BOOLEAN_ENTITY" }] }, { "start": "7:00", "actions": [{ "service": "input_boolean.turn_off", "entity_id": "INPUT_BOOLEAN_ENTITY" }] }], "entity_id": "SWITCH_ENTITY"}

## 2025-08-12 - v0.0.12 
Added README.md

## 2025-08-12 - v0.0.11 
Added all architectures

## 2025-08-12 - v0.0.10 
Fixed CHANGELOG.md

## 2025-08-12 - v0.0.9
Fixed CHANGELOG.MD

## 2025-08-12 - v0.0.8

Added type selection in querystring:
- type=time returns time like 4:00 - 7:00
- type=timeslot returns json in the format
    { "timeslots":[{ "start": "4:00", "actions": [{ "service": "input_boolean.turn_on", "entity_id": "input_boolean.orefree" }] }, { "start": "7:00", "actions": [{ "service": "input_boolean.turn_off", "entity_id": "input_boolean.orefree" }] }], "entity_id": "switch.schedule_b6fc42"}