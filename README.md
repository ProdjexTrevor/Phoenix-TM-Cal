# Phoenix - Big Dawgs

React calendar combining Fall 2026 softball schedules for:

- Richmond HS
- Maysville HS
- Liberty HS
- Liberty North HS
- Staley HS
- Park Hill HS
- Kearney HS

## Run locally

```bash
cd softball-calendar
npm install
npm run dev
```

## Features

- Month / week / day / agenda views
- Toggle **Varsity** and **JV** independently
- Toggle schools on/off (events use each school’s colors; JV uses a dashed border)
- **Download .ics** for Google Calendar import
- Click a game → **Add to Google Calendar** (single event)

## Google Calendar import

1. Click **Download .ics**
2. Google Calendar → Settings → Import & export → Import
3. Select the file and a target calendar

## Data

Schedules were pulled from [MSHSAA](https://www.mshsaa.org/) for the 2026–27 fall season. Update `src/data/games.json` when schedules change.
