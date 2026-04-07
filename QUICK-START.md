# 🚀 Quick Start Guide - Automated Dashboard Refresh

## Setup (One-Time)

### 1. Install Node.js (if not already installed)
Download from: https://nodejs.org/

### 2. Start the Automation Server
Open a terminal in your project directory:
```bash
cd "C:\Users\james\OneDrive\Desktop\Ashrita - Claude Code\Work Command Center"
node server.js
```

You should see:
```
🚀 Dashboard Automation Server running on http://localhost:3000

📡 API Endpoints:
   POST /api/refresh - Run scraper and update dashboard
   GET  /api/status  - Check server status
```

**Leave this terminal open while using the dashboard.**

---

## Usage - Update Dashboard

### Method 1: Dashboard Button (Easiest)
1. Open the dashboard in your browser
2. Click **[🔄 Refresh Dashboard]** button at the top
3. Watch for status messages:
   - ⏳ "Scraping jobs..." (takes 2-3 minutes)
   - ✅ "Dashboard updated! 22 jobs verified. Reload page to see changes."
4. Page reloads automatically with new data

### Method 2: Direct Server Call
```bash
# In another terminal:
curl -X POST http://localhost:3000/api/refresh
```

### Method 3: Check Server Status
```bash
# See what's running
curl http://localhost:3000/api/status
```

---

## What Happens When You Click Refresh

```
1. Dashboard sends refresh request to server
   ↓
2. Server runs: node scraper.js
   - Tests all 50 job URLs
   - Tests all 117 org URLs
   - Extracts requirements
   - Takes ~4 minutes
   ↓
3. Server runs: node process-scraper-results.js
   - Analyzes results
   - Identifies broken URLs
   ↓
4. Server runs: node update-dashboard.js
   - Applies verified URLs
   - Updates requirements
   - Regenerates index.html
   ↓
5. Dashboard reloads automatically
   - New jobs and requirements visible
   ↓
6. You push to GitHub (manually):
   git add index.html
   git commit -m "Auto-update: dashboard refresh"
   git push origin main
```

---

## 🔄 Full Workflow

### Quick Version (5 steps)
```bash
# Terminal 1: Start server (keep running)
node server.js

# Dashboard: Click [🔄 Refresh Dashboard]
# Wait 4-5 minutes for completion

# Terminal 2: Push to GitHub
git add index.html
git commit -m "Auto-update: dashboard refresh"
git push origin main
```

### With Manual Fixes
If the scraper finds broken job URLs:

```bash
# 1. Server refreshes (automatic)
# 2. Review jobs-fixes.json for broken URLs
# 3. Fix broken URLs manually:
#    - Visit company job board
#    - Find job posting URL
#    - Update jobs-fixes.json

# 4. Run again:
node server.js
# Click refresh button again

# 5. Push when satisfied
git add index.html
git commit -m "Update: verified job URLs"
git push origin main
```

---

## 📊 What Gets Updated

Each refresh verifies:

✅ **Job URLs** (50 jobs)
- Tests each link works
- Extracts: Resume, Cover Letter, Portfolio, Assessments, etc.
- Updates index.html with real requirements

✅ **Organization Career Pages** (117 orgs)
- Tests each careers page loads
- Fixes redirect URLs (auto-corrected)
- Updates org listings

✅ **Dashboard Stats**
- Job count
- Org count
- Last refresh timestamp

---

## ⚠️ Common Issues

### "Server not running"
**Error:** Dashboard shows "Server not running. Start with: node server.js"

**Fix:**
```bash
# In a new terminal:
node server.js
# Keep this terminal open
```

### "Refresh takes too long"
**Normal behavior:** First refresh takes 4-5 minutes (testing 167 URLs)

**After first run:** Subsequent refreshes are faster if fewer URLs changed

### "Some jobs still show broken"
**Expected:** Some job boards require manual lookup
- Edit `jobs-fixes.json`
- Add correct URLs
- Run refresh again

### "Page won't reload after refresh"
**Possible causes:**
- Server didn't complete (check server terminal)
- Browser cache (try Ctrl+F5 to hard refresh)
- Check browser console for errors (F12)

---

## 🛑 Stopping the Server

In the server terminal, press: **Ctrl+C**

You'll see:
```
🛑 Server stopped
```

---

## 📝 Manual Git Push

After each dashboard refresh, push changes:

```bash
git add index.html
git commit -m "Auto-update: dashboard refresh [date]"
git push origin main
```

Or with script:
```bash
# Create push-dashboard.sh
git add index.html && \
git commit -m "Auto-update: dashboard refresh" && \
git push origin main
```

---

## 🔐 Security Notes

- Server runs **locally** on your machine only (localhost:3000)
- Only accepts requests from your browser
- No data sent to external servers
- All job/org data stays on your machine
- Respects rate limits (500ms between requests)

---

## 📞 Troubleshooting

**Q: Dashboard doesn't find server?**
A: Make sure `node server.js` is running in a terminal

**Q: Refresh takes forever?**
A: Normal first time (testing 167 URLs). Check server terminal for progress.

**Q: Job URLs still broken?**
A: Some require manual lookup. Edit `jobs-fixes.json` with correct URLs.

**Q: Want to refresh on a schedule?**
A: See AUTOMATION-WORKFLOW.md for scheduled task setup

---

## Next Steps

1. ✅ Start server: `node server.js`
2. ✅ Open dashboard in browser
3. ✅ Click [🔄 Refresh Dashboard]
4. ✅ Watch for completion
5. ✅ Push to GitHub when satisfied

Done! Your dashboard is now automated. 🎉
