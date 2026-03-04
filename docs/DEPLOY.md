# Deployment Guide

## Initial Setup (one-time)

### 1. Upload Production Shells to QB

For each file in `shells/production/`, upload to the corresponding QB Code Page:

| File | QB Page ID | How to upload |
|---|---|---|
| `scheduler.html` | 15 | QB App → Settings → Code Pages → Page 15 → Replace content |
| `admin.html` | 12 | Same |
| `reports.html` | 14 | Same |
| `timesheets.html` | 18 | Same |
| `leave.html` | 13 | Same |

**Do NOT upload shared.css (16) or shared.js (17) to QB.** The shells load these directly from jsDelivr. You can delete those QB Code Pages or leave them as unused.

### 2. Create Staging Code Pages in QB (optional)

Create 5 new Code Pages in the QB app. Upload the corresponding file from `shells/staging/`. Note the new Page IDs and update this doc.

### 3. Create `staging` Branch

```bash
git checkout main
git checkout -b staging
git push -u origin staging
```

## Day-to-Day Workflow

### Making Changes

```bash
# Start from latest main
git checkout main && git pull

# Create feature branch
git checkout -b nick/add-drag-drop

# Make changes to files in codepages/
# Test locally by opening HTML files in browser

# Commit and push
git add . && git commit -m "Add drag-and-drop to scheduler"
git push -u origin nick/add-drag-drop
```

### Testing in Staging

1. Open PR: `nick/add-drag-drop` → `staging`
2. Merge the PR
3. Wait ~5 min for jsDelivr cache (or purge manually)
4. Open staging QB Code Page to verify

**Manual jsDelivr cache purge:**
```
https://purge.jsdelivr.net/gh/lcp-media-quickbase/3d-projects@staging/codepages/scheduler.html
```

### Deploying to Production

1. Open PR: `staging` → `main`
2. Merge the PR
3. Wait ~5 min for jsDelivr cache (or purge)
4. Production QB Code Pages auto-update

**Purge production cache:**
```
https://purge.jsdelivr.net/gh/lcp-media-quickbase/3d-projects@main/codepages/scheduler.html
https://purge.jsdelivr.net/gh/lcp-media-quickbase/3d-projects@main/codepages/shared.js
https://purge.jsdelivr.net/gh/lcp-media-quickbase/3d-projects@main/codepages/shared.css
```

## Troubleshooting

### Page shows "Failed to load"
- Check that the GitHub repo is **public** (jsDelivr can't access private repos)
- Verify the branch exists (`main` or `staging`)
- Check jsDelivr status: https://status.jsdelivr.com

### Changes not showing up
- jsDelivr caches for up to 24 hours
- Use the purge URL above to force refresh
- Hard refresh in browser: Ctrl+Shift+R

### "Permission denied" toast in QB
- The logged-in user's QB role doesn't allow that action
- Check QB App → Settings → Roles for the user's permissions

### "Session expired" toast
- User's QB session timed out
- Refresh the page to re-authenticate

## Important Notes

- **The repo must be public** for jsDelivr CDN to access it
- Never commit QB tokens, passwords, or secrets to the repo
- Shell files in QB should never need updating after initial setup
- All code changes happen in `codepages/` directory only
