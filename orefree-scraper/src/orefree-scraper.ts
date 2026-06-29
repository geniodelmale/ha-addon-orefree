import playwright from 'playwright';
import { RETRIES, URL_TOP_PAGE } from './constant';
import { Logger, Usage } from './types';

// URL-decode a credential coming from the query string. Home Assistant passes
// the username percent-encoded (e.g. a leading "+" becomes "%2B"); the login
// form needs the decoded value ("+39..."). decodeURIComponent is idempotent for
// already-decoded values (it leaves a literal "+" untouched) and we fall back to
// the original string if decoding fails (e.g. a lone "%" in a password).
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function OreFreeScraper(
  username: string,
  password: string,
  logger: Logger,
) {

  const browser = await playwright.chromium.launch({
    executablePath: '/usr/bin/chromium-browser',
    // headless: false,
  });
  const context= await browser.newContext();
  const page = await context.newPage();


  return {
    async fetchHours(type: 'time' | 'timeslot', inputBooleanEntity: string, switchEntity: string) {
      var jsonOreFree = '';
      try {
        await page.goto(URL_TOP_PAGE);
        logger.info('Navigated to Enel residential area');

        // Dismiss the TrustArc cookie consent banner. Its overlay
        // (#trustarc-banner-overlay / #consent_blackbar) intercepts pointer
        // events, so we must wait for it to actually disappear before
        // interacting with the login form, otherwise clicks time out.
        try {
          const cookieButton = page.locator('#truste-consent-required');
          await cookieButton.waitFor({ state: 'visible', timeout: 10000 });
          await cookieButton.click();
          logger.info('Cookie consent banner dismissed');
        } catch (error) {
          logger.info('Cookie consent banner not shown');
        }
        try {
          await page
            .locator('#consent_blackbar, #trustarc-banner-overlay')
            .first()
            .waitFor({ state: 'hidden', timeout: 8000 });
        } catch (error) {
          logger.info('Cookie overlay still present, continuing');
        }

        // New Enel login page (SSO): stable element ids are more robust than
        // placeholders/labels.
        logger.info('Login page URL before submit: ' + page.url());
        const decodedUsername = safeDecode(username);
        const decodedPassword = safeDecode(password);
        logger.info('Login username (decoded): ' + decodedUsername);
        await page.locator('#txtLoginUsername').waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('#txtLoginUsername').fill(decodedUsername);
        await page.locator('#txtLoginPassword').fill(decodedPassword);
        const recaptchaBeforeSubmit = page.frames().some((f) => /recaptcha/i.test(f.url()));
        logger.info('reCAPTCHA frame present before submit: ' + recaptchaBeforeSubmit);
        await page.locator('#login-btn').click();
        logger.info('Submitted login credentials for ' + username);

        // Wait until we leave the SSO login page. If we stay, login failed
        // (wrong credentials, captcha challenge, or Enel system error).
        const isLoginPage = (u: string) => /\/login\b|samlsso/i.test(u);
        try {
          await page.waitForURL((u) => !isLoginPage(u.toString()), { timeout: 20000 });
          logger.info('Login successful, landed on: ' + page.url());
        } catch (waitError) {
          logger.error('Login did NOT complete - still on login page: ' + page.url());

          const messages = await page
            .locator('[role="alert"], .error, [class*="error"], p, span')
            .filter({
              hasText:
                /(credenzial|non corret|non valid|errat|errore|riprova|non disponibil|captcha|verifica|bloccat|troppi)/i,
            })
            .evaluateAll((els) =>
              Array.from(
                new Set(
                  els
                    .filter((el) => (el as HTMLElement).offsetParent !== null)
                    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
                    .filter((t) => t.length > 0 && t.length < 160),
                ),
              ),
            )
            .catch(() => [] as string[]);
          logger.error('Login page messages: ' + JSON.stringify(messages));

          const hasRecaptcha = page.frames().some((f) => /recaptcha/i.test(f.url()));
          logger.error('reCAPTCHA challenge still present: ' + hasRecaptcha);

          throw new Error(
            'Login did not complete (still on SSO login page). Messages: ' +
              JSON.stringify(messages),
          );
        }

        await page.waitForTimeout(3000);

        for (let attempt = 0; attempt < 1; attempt++) {
          try {
              await page.getByRole('button', { name: 'chiudi modale' }).click();
              break;
          } catch (error) { logger.error('No modal to close. Attempt: ' + attempt, error); }
        }


        logger.info('Closed any modal if present');

        // The link label is rendered uppercase via CSS but the DOM text is
        // "Gestisci le ore free". The anchor has no href, so it is NOT exposed
        // as a "link" role; match it by text instead (getByRole('link') fails).
        await page.getByText('Gestisci le ore free', { exact: true }).click();
        logger.info('Navigated to Manage Free Hours');

        await page.waitForTimeout(3000);

        let scrapedFreeHours = '';
        for (let attempt = 0; attempt < RETRIES; attempt++) {
          scrapedFreeHours = await page.locator('div#fasciaGiornalieraBase.info-value').innerText();
          if (scrapedFreeHours.trim() !== '') {
            break;
          }
          logger.info("Reading Scraped Free Hours: Retry n." + attempt);
          await page.waitForTimeout(1000);
        }

         logger.info("Hours: " + scrapedFreeHours);

        if (scrapedFreeHours.trim() === '') {
          throw new Error('Failed to retrieve the scraped free hours after multiple attempts');
        }

        if (type === 'time') {
          jsonOreFree=scrapedFreeHours.replace('24:00', '23:59').replace('00:00', '00:01');
          //jsonOreFree='21:00 - 23:59';
        } else {
          const words = scrapedFreeHours.split(' ');
          let startTime = words[0]; //.replace('24:00', '00:01');
          let endTime = words[2].replace('24:00', '23:59');

          jsonOreFree = '{ "timeslots":[{ "start": "' + startTime + '", "actions": [{ "service": "input_boolean.turn_on", "entity_id": "' + inputBooleanEntity + '" }] }, { "start": "' + endTime + '", "actions": [{ "service": "input_boolean.turn_off", "entity_id": "' + inputBooleanEntity + '" }] }], "entity_id": "' + switchEntity + '"}';
        }
        logger.info('Fetched free hours: ' + jsonOreFree);
      } catch (error) {
        logger.error('Error occurred while fetching free hours: ' + error);
        try {
          logger.error('Diagnostic - current URL: ' + page.url() + ' - title: ' + (await page.title()));
          await page.screenshot({ path: '/data/orefree-error.png', fullPage: true });
          logger.error('Diagnostic - saved screenshot to /data/orefree-error.png');
        } catch (diagError) {
          logger.error('Failed to capture diagnostics: ' + diagError);
        }
        throw error;
      } finally {
        await browser.close();
        logger.info('Closed browser');
      }

      return jsonOreFree;
    }
  };
}