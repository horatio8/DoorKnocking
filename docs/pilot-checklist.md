# Pilot Checklist — SC HD 115

## Before day one

- [ ] `districts` row seeded with `sc-hd-115` (via migration or admin UI)
- [ ] Airtable base `appz0KOPIaQFCxxw3` has `Households`, `Walkbooks`,
      `Users`, `Surveys`, `Survey Questions`, `Tags`, `Knock Events` tables
      (see `docs/airtable-schema.md`)
- [ ] `npm run import:district -- --district=sc-hd-115` complete
- [ ] Auto-generate walkbooks run (~23 clusters of 20)
- [ ] 3–5 knockers invited via `/admin/users`

## Success metrics

| Criterion | Target |
| --- | --- |
| Knock cycle (open map → submit) | < 90 seconds |
| Map pin propagation time | < 3 seconds |
| Offline tolerance | 4+ hours without data loss |
| Day-one reachable voters | 460 |

## Day of

- [ ] Morning: confirm knock events are flowing to `/admin` live feed
- [ ] Midday: check `/admin/conflicts` — resolve any flagged events
- [ ] Evening: run CSV export, confirm Airtable sync is current

## Post-pilot

- [ ] Interview knockers on friction points
- [ ] Review `audit_log` for outlier patterns
- [ ] Promote repeated ad-hoc tags to standard
