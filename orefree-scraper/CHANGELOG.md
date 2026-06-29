# Changelog

## 2026-06-29 - v0.0.38
Fixed the scraper getting stuck after a successful login. A cross-selling promo modal (`#crossSellingTarget`) pops up a few seconds after the dashboard loads and intercepts pointer events, blocking the click on "Gestisci le ore free" (which timed out). A Playwright `addLocatorHandler` is now registered so the modal is automatically closed (via its `.close` control) whenever it appears during an action, allowing the navigation to proceed. Verified end-to-end: login succeeds, modal is dismissed, and the free-hours value is read correctly.

## 2026-06-29 - v0.0.37
Fixed login failing because of a percent-encoded username. Home Assistant passes the username URL-encoded (the leading `+` of the phone number arrives as `%2B`), and the literal `%2B393...` was being typed into the login field, so Enel rejected the credentials and the page stayed on the SSO login (causing the later timeout). Username and password are now URL-decoded with a safe `decodeURIComponent` (idempotent: a real `+` is left untouched, and on malformed input it falls back to the original value) before filling the form. Verified end-to-end: with `%2B393316372674` the field now receives `+393316372674` and login succeeds.

## 2026-06-29 - v0.0.36
Added detailed login diagnostics. The reported timeout on `getByText('Gestisci le ore free')` happens because the page is **still on the SSO login page** (login did not complete). Now the scraper detects this explicitly instead of failing later on the link:
- Logs the URL before submit and whether a reCAPTCHA frame is present.
- After submit, waits for the page to leave the login/SSO URL. If it stays, it logs the actual visible login-page message (e.g. "Le credenziali che hai fornito non sono corrette." or "Al momento i sistemi risultano momentaneamente non disponibili"), whether reCAPTCHA is still present, and throws a clear `Login did not complete` error including those messages.

## 2026-06-29 - v0.0.35
Fixed the `/fetchHours` timeout, root-caused by reproducing the full flow with Playwright against the live Enel site:
- **Cookie overlay**: the TrustArc consent banner (`#trustarc-banner-overlay` / `#consent_blackbar`) stays on top of the page and intercepts pointer events, blocking the login button and the "Gestisci le ore free" link. Cookie dismissal is now reliable: wait for `#truste-consent-required`, click it, then wait for the overlay to become hidden before continuing.
- **New SSO login page**: the residential area now redirects to the Enel SSO login. Login fields are filled via stable ids `#txtLoginUsername` / `#txtLoginPassword` and submitted with `#login-btn` instead of placeholder/role locators.
- **"Gestisci le ore free" link**: reverted the broken `getByRole('link', ...)` locator introduced in v0.0.34. That anchor has no `href`, so it is not exposed with the `link` role and the locator never matched (timeout). It is matched by text again: `getByText('Gestisci le ore free', { exact: true })`.

## 2026-06-29 - v0.0.34
Reliability and diagnostics for the "Manage Free Hours" navigation:
- Replaced the brittle `getByText('GESTISCI LE ORE FREE')` locator with a case-insensitive role-based locator `getByRole('link', { name: /gestisci le ore free/i })`. The on-screen uppercase label comes from CSS `text-transform`; the actual DOM text is `Gestisci le ore free`. (The previous uppercase change in v0.0.32 had no functional effect since `getByText` is case-insensitive by default.)
- On any scraping error, the endpoint now logs the current URL and page title and saves a full-page screenshot to `/data/orefree-error.png` to help diagnose login/flow failures in the real environment.
- Security: stopped logging the password in plaintext on login (the log line now only reports the username).

## 2026-06-29 - v0.0.33
Added a 3-second wait after a successful login (before handling the modal/navigation) to give the OreFree page time to fully load, improving scraping reliability.

## 2026-06-29 - v0.0.32
Updated the navigation link text to match the OreFree page markup: the "Manage Free Hours" link is now matched as `GESTISCI LE ORE FREE` (uppercase) instead of `Gestisci le ore free`.

## 2026-06-27 - v0.0.31
Exposed `default_value` as an addon option (visible in the Configuration page), used as a fallback when the `default_value` query parameter is not provided. On a scraping timeout the configured value is returned with `200 OK` instead of an error. Added translations (en/it/ja).

## 2026-06-27 - v0.0.30
Added an optional `default_value` query parameter to `/fetchHours`. When scraping fails due to a timeout (Playwright `TimeoutError`, a message containing "timeout", or the "Failed to retrieve the scraped free hours" failure), the endpoint now returns the provided `default_value` with `200 OK` instead of an error. Login and other errors still return `401`/`502` as before.

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