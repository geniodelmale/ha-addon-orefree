2025-08-12 - v0.0.9 - fixed CHANGELOG.MD

2025-08-12 - v0.0.8 - added type selection in querystring:
                            - type=time returns time like 4:00 - 7:00
                            - type=timeslot returns json in the format
                                { "timeslots":[{ "start": "4:00", "actions": [{ "service": "input_boolean.turn_on", "entity_id": "input_boolean.orefree" }] }, { "start": "7:00", "actions": [{ "service": "input_boolean.turn_off", "entity_id": "input_boolean.orefree" }] }], "entity_id": "switch.schedule_b6fc42"}