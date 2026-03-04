# LCP Media — QuickBase Project Management

Resource scheduling and project management Code Pages for the LCP Media 3D production team. Replaces TeamDeck with a native QuickBase solution.

## Architecture

```
GitHub (this repo)                    jsDelivr CDN                    QuickBase Code Pages
──────────────────────────────────────────────────────────────────────────────────────────
main branch                       → @main/codepages/*              → Production (IDs 12-18)
staging branch                    → @staging/codepages/*           → Staging (IDs TBD)
feature branches (nick/*, etc.)   → localhost (local dev)          → N/A
```

**Local dev:** Open HTML files in browser → detects localhost → prompts for QB User Token.  
**Staging:** QB Code Pages load from `@staging` jsDelivr URLs → test with real QB session auth.  
**Production:** QB Code Pages load from `@main` jsDelivr URLs → live for the Poland team.

## QuickBase App

- **App ID:** `bu8tkk77g`
- **Realm:** `lcpmedia.quickbase.com`

### Code Page IDs (Production)

| Page | QB Page ID | Description |
|---|---|---|
| `shared.css` | 16 | Design system — dark theme, components |
| `shared.js` | 17 | QB API client, auth, nav, data loaders |
| `scheduler.html` | 15 | Gantt resource calendar |
| `admin.html` | 12 | People, projects, POD management |
| `reports.html` | 14 | Utilization dashboards, capacity analysis |
| `timesheets.html` | 18 | Weekly time entry (placeholder) |
| `leave.html` | 13 | PTO/sick leave management (placeholder) |

### Table IDs

| Table | ID | Purpose |
|---|---|---|
| Pods | `bu8tt69gx` | Production POD groups |
| People | `bu8ttwq2f` | Team members (key field: TeamDeck ID, FID 23) |
| Projects | `bvaitp9x5` | Full project records |
| Assignments | `bvu4s9te6` | Resource scheduling (replaces TeamDeck bookings) |
| Draft Milestones | `bvu4tbpms` | Draft phase milestones per project |

## Setup

### Local Development

```bash
git clone https://github.com/lcp-media-quickbase/3d-projects.git
cd project-management/codepages
# Open any HTML file in browser
# It will prompt for a QB User Token (get from QB > My Preferences > User Token)
```

### Deploy to QB

1. Edit files in a feature branch
2. PR → `staging` → test at staging QB Code Pages
3. PR → `main` → production auto-updates via jsDelivr CDN

### QB Code Page Setup (one-time)

Each QB Code Page is a thin HTML shell that loads from jsDelivr. Upload shell files from `shells/production/` to QB once — never touch again.

## Branching

```
nick/feature-name ──PR──→ staging ──PR──→ main
 her/feature-name ──PR──→ staging ──PR──→ main
```

- **main:** Always deployable. Poland team uses this.
- **staging:** Integration testing with real QB data/permissions.
- **Feature branches:** Prefixed with your name. Work independently.

## Auth

Code Pages detect their environment automatically:

- **QB Code Page (same-origin):** Uses logged-in user's session cookies. QB enforces role permissions — table, field, and row-level.
- **Local dev:** Prompts for QB User Token. Data access matches the token owner's permissions.

No tokens stored in the repo. No secrets in code.
