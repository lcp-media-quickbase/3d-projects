# LCP Media — 3D Projects Dashboard

Single-page tabbed dashboard for the LCP Media 3D production team. Manages resource scheduling, vacation requests, utilization reports, and project administration — all within one QuickBase Code Page.

## Architecture

```
QB Code Page (shell)          jsDelivr CDN                    GitHub
─────────────────────────────────────────────────────────────────────
dashboard shell (ID 20)  →  reads version.json (@main)  →  this repo
                         →  loads @{tag}/codepages/*     →  tagged release
```

**Shell:** Uploaded once to QB. Reads `version.json` from raw GitHub to get the current tag, then loads all code from jsDelivr at that tagged version. Never needs re-uploading.

**Deploy:** Push code → tag → update `version.json` → push. Users get the new version on next page load.

## QuickBase

- **App ID:** `bu8tkk77g`
- **Realm:** `lcpmedia.quickbase.com`
- **Dashboard Code Page ID:** 20

### Tables

| Table | ID | Purpose |
|---|---|---|
| Pods | `bu8tt69gx` | Production POD groups |
| People | `bu8ttwq2f` | Team members |
| Projects | `bvaitp9x5` | Project records |
| Assignments | `bvu4s9te6` | Resource scheduling (Gantt) |
| Draft Milestones | `bvu4tbpms` | Draft phase milestones |
| Vacations | `bvu7e3p7c` | Time-off requests |

### Cross-App: Ticket System

| App | Table | Purpose |
|---|---|---|
| `btnit6q26` | `btnit9gpf` | Support tickets (Submit Ticket button) |

### Roles

| Role ID | Name | Tabs Visible |
|---|---|---|
| 12, 15 | Administrator | All tabs |
| 13 | Poland Leadership | Scheduler, Pre-Production, Quotes, Reports, Timesheets, Vacations |
| 14 | Poland Seniors | Scheduler, Pre-Production, Quotes, Reports, Timesheets, Vacations |
| 10 | Viewer | Scheduler, Pre-Production, Quotes, Timesheets, Vacations |

## File Structure

```
codepages/
├── shared.css          Design system (Aileron font, LCP Blue #68B6E5)
├── shared.js           Auth, API client, role detection, data cache, tab framework
├── dashboard.html      Single-page shell — tab container + app header
├── version.json        Current tagged version pointer
└── tabs/
    ├── scheduler.js    Gantt resource calendar + drag/resize + vacation blocks
    ├── preproduction.js Pre-production asset pipeline (placeholder)
    ├── quotes.js       Quote management (placeholder)
    ├── reports.js      Utilization dashboards, capacity analytics
    ├── timesheets.js   Weekly time entry (placeholder)
    ├── vacations.js    Time-off requests, approvals, status dashboard
    └── admin.js        People/project/POD CRUD, overview stats

shells/
└── production/
    └── dashboard.html  QB Code Page shell (upload once, never touch again)
```

## Auth

The dashboard detects its environment automatically:

- **QB Code Page:** Session cookies via `credentials: 'include'`. QB enforces role permissions on all API calls.
- **Local dev:** Prompts for QB User Token. Open any HTML file in a browser.

## Branching

```
nick/feature-name  ──PR──→  main
diana/feature-name ──PR──→  main
```

- **main:** Always deployable. Poland team uses this.
- Feature branches prefixed with your name.

## Deploy Process

```bash
git add -A && git commit -m "description"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
# Update version.json to point to the new tag
echo '{"version":"vX.Y.Z"}' > codepages/version.json
git add codepages/version.json && git commit -m "bump version" && git push
```

Users get the new version within ~5 minutes (raw GitHub cache TTL on version.json).

## Local Development

```bash
git clone https://github.com/lcp-media-quickbase/3d-projects.git
cd 3d-projects/codepages
# Open dashboard.html in browser → prompts for QB User Token
```

## Brand

- **Font:** Aileron (Regular 400, SemiBold 600, Bold 700)
- **Primary Color:** `#68B6E5` (LCP Blue, Pantone 292 C)
- **Leading:** 125% proportion (per LCP Graphic Standards Manual)
- **Dark mode logo:** White/green horizontal lockup
- **Light mode logo:** Full color horizontal lockup
