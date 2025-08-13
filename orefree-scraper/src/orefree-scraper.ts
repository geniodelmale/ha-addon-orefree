import playwright from 'playwright';
import { RETRIES, URL_TOP_PAGE } from './constant';
import { Logger, Usage } from './types';

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

        try {
            await page.getByRole('button', { name: 'Continua senza accettare' }).click();
        } catch (error) { }
        logger.info('Closed cookies panel if present');

        await page.getByPlaceholder('Email o numero di telefono').click();
        await page.getByPlaceholder('Email o numero di telefono').fill(username);
        await page.getByPlaceholder('Password').click();
        await page.getByPlaceholder('Password').fill(password);
        await page.getByRole('button', { name: 'Accedi', exact: true }).click();
        logger.info('Submitted login credentials ' + username + ' - ' + password);

        for (let attempt = 0; attempt < 1; attempt++) {
          try {
              await page.getByRole('button', { name: 'chiudi modale' }).click();
              break;
          } catch (error) { logger.error('No modal to close. Attempt: ' + attempt, error); }
        }

        const isInvalidCredentials =  await page.locator('#loginError').isVisible();
        if (isInvalidCredentials) {
          logger.error('Invalid credentials detected.');
          throw new Error('Invalid credentials detected.');
        }

        logger.info('Closed any modal if present');

        await page.getByText('Gestisci le ore free').click();
        logger.info('Navigated to Manage Free Hours');

        await page.waitForTimeout(3000);

        let scrapedFreeHours = '';
        for (let attempt = 0; attempt < RETRIES; attempt++) {
          scrapedFreeHours = await page.locator('div#fasciaGiornalieraImpostata.info-value').innerText();
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
          jsonOreFree=scrapedFreeHours;
          jsonOreFree='17:00 - 20:00';
        } else {
          const words = scrapedFreeHours.split(' ');
          let startTime = words[0]; //.replace('24:00', '00:01');
          let endTime = words[2].replace('24:00', '23:59');

          jsonOreFree = '{ "timeslots":[{ "start": "' + startTime + '", "actions": [{ "service": "input_boolean.turn_on", "entity_id": "' + inputBooleanEntity + '" }] }, { "start": "' + endTime + '", "actions": [{ "service": "input_boolean.turn_off", "entity_id": "' + inputBooleanEntity + '" }] }], "entity_id": "' + switchEntity + '"}';
        }
        logger.info('Fetched free hours: ' + jsonOreFree);
      } catch (error) {
        logger.error('Error occurred while fetching free hours: ' + error);
      }

    await browser.close();
    logger.info('Closed browser');

    return jsonOreFree;
    }
  };
}