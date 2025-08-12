
# OreFree Scraper for Home Assistant

([Based on TokyoGas Scraper for Home Assistant](https://github.com/hlchanad/ha-tokyo-gas/))

Custom add-on to scrape OreFree daily hours from Enel website.

> [!WARNING]
> This is still **under construction**. It might be unstable and use it on your
> own risk.

> [!WARNING]
> This is the first time I write TypeScript code and extend Home Assistant. The code might
> not be ideal.

## Installation

To install this add-on, manually add my HA-Addons repository to Home Assistant
using [this GitHub repository][ha-addons] or by clicking the button below.

[![Add Repository to HA][my-ha-badge]][my-ha-url]

By default, the server will be hosted at http://homeassistant.local:8000. 
But you can also update the port in the Configuration tab.

### Usage

Send a GET request to http://homeassistant.local:8000?username=YOUR_USERNAME&password=YOUR_PASSWORD&type=TYPE

TYPE can be:
- time to retrieve hours in the format 4:00 - 7:00
- timeslot to retrieve json data:
    { "timeslots":[{ "start": "4:00", "actions": [{ "service": "input_boolean.turn_on", "entity_id": "input_boolean.orefree" }] }, { "start": "7:00", "actions": [{ "service": "input_boolean.turn_off", "entity_id": "input_boolean.orefree" }] }], "entity_id": "switch.schedule_b6fc42"}

## Known Issues

The scraper occasionally fails to scrape because of timeout in playwright. 
There might be some funny handling in the website that I am not 
aware of. If the CPU/ memory of the addon goes high, restart it and run the 
custom service to fill the gaps.

[ha-addons]: https://github.com/geniodelmale/ha-addon-orefree
[my-ha-badge]: https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg
[my-ha-url]: https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fgeniodelmale%2Fha-addon-orefree