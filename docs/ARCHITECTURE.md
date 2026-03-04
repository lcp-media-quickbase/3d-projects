# Architecture

## Overview

The LCP 3D Resource Manager is a set of QuickBase Code Pages that replace TeamDeck for resource scheduling. Code Pages are served from QuickBase but load their source code from GitHub via jsDelivr CDN.

## Auth Flow

```
User logs into QuickBase
  → Opens Code Page (e.g. scheduler)
    → Shell page fetches CSS/JS/HTML from jsDelivr CDN
      → shared.js detects same-origin (lcpmedia.quickbase.com)
        → Sets auth mode to 'session'
          → All fetch() calls include credentials: 'include'
            → QB REST API authenticates via session cookie
              → Data access = user's role permissions
```

**Permissions enforced by QB automatically:**
- Table access (can't query tables not in your role)
- Field-level restrictions (hidden fields return empty)
- Row-level filters (e.g., "own POD only")
- Add/edit/delete rights per role
- 401 = session expired, 403 = permission denied

## Table Schema

### Assignments (`bvu4s9te6`)

| FID | Field | Type | Notes |
|---|---|---|---|
| 3 | Record ID# | Auto | Primary key |
| 6 | Related Person | FK → People | Lookup via TeamDeck ID (FID 23) |
| 7 | Person Name | Lookup | |
| 8 | Person Email | Lookup | |
| 9 | Person POD | Lookup | |
| 10 | Related Project | FK → Projects | Lookup via Record ID# |
| 11 | Project Name | Lookup | |
| 12 | Project Number | Lookup | |
| 13 | Project Stage | Lookup | |
| 14 | Project POD | Lookup | |
| 15 | Start Date | Date | |
| 16 | End Date | Date | |
| 17 | Hours Per Day | Numeric | Default 8 |
| 18 | Description | Text | e.g. "D1 MU B2" |
| 19 | Work Type | Text | Modelling, GreyScale, FloorPlans, Animatic, SiteMap, Extra |
| 20 | Draft Phase | Text | Draft 1, Draft 2, Final, Animation, Extra 1-4 |
| 21 | Priority | Text | High, Medium, Low |
| 22 | Weekend Booking | Checkbox | |
| 23 | TeamDeck Booking ID | Numeric | Migration reference |
| 24 | Color | Text | Hex color override |

### People (`bu8ttwq2f`)

| FID | Field | Type | Notes |
|---|---|---|---|
| 3 | Record ID# | Auto | |
| 7 | Name | Text | |
| 8 | Email | Email | |
| 11 | Role | Text | |
| 19 | Active | Checkbox | |
| 22 | POD Name | Lookup | From related POD |
| 23 | TeamDeck ID | Numeric | **Key field for Assignments FK** |
| 24 | Part Time | Checkbox | |

### Projects (`bvaitp9x5`)

| FID | Field | Type | Notes |
|---|---|---|---|
| 3 | Record ID# | Auto | |
| 19 | Name | Text | |
| 23 | Project Number | Numeric | |
| 26 | Type | Text | |
| 27 | Stage | Text | Pre-Production, In Production, Complete |
| 52 | Deal | FK | Related deal record |
| 82 | POD | Text/Lookup | Assigned production POD |

### Draft Milestones (`bvu4tbpms`)

| FID | Field | Type | Notes |
|---|---|---|---|
| 3 | Record ID# | Auto | |
| 6 | Related Project | FK → Projects | |
| 7 | Project Name | Lookup | |
| 8 | Project Number | Lookup | |
| 10 | Milestone Name | Text | |
| 11 | Draft Phase | Text | |
| 12 | Start Date | Date | |
| 13 | End Date | Date | |

### Pods (`bu8tt69gx`)

| FID | Field | Type | Notes |
|---|---|---|---|
| 3 | Record ID# | Auto | |
| 6 | Name | Text | e.g. "Max POD" |
| 11 | TeamDeck ID | Numeric | |

## POD Colors

| POD | Hex |
|---|---|
| Max POD | `#ff6b6b` |
| Polina POD | `#ffa94d` |
| Grzegorz POD | `#69db7c` |
| Evgeniy POD | `#6c8cff` |
| George POD | `#cc5de8` |
| Polish office | `#868e96` |
| TourBuilder | `#20c997` |

## File Structure

```
codepages/
├── shared.css          ← Design system (dark theme, components, layout)
├── shared.js           ← QB API client, auth detection, nav, data loaders, utilities
├── scheduler.html      ← Gantt resource calendar (POD filters, 2wk/month, create assignments)
├── admin.html          ← People/Projects/PODs management (CRUD, overview dashboard)
├── reports.html        ← Utilization analytics (per-person, per-POD, work type, project load)
├── timesheets.html     ← [Placeholder] Weekly time entry
└── leave.html          ← [Placeholder] PTO/sick leave management

shells/
├── production/         ← Thin QB Code Page shells loading from @main via jsDelivr
└── staging/            ← Same shells loading from @staging
```
