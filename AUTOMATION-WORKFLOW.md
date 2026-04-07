# Dashboard Automation Workflow

This workflow automates the process of updating your job search command center dashboard with verified, working job URLs and organization career pages.

## 📋 Overview

The automation consists of 4 scripts that work together:

1. **scraper.js** - Visits all job URLs and org careers pages to verify they work and extract data
2. **process-scraper-results.js** - Analyzes results and creates fix templates
3. **update-dashboard.js** - Applies fixes and regenerates the dashboard
4. **Manual fixes** - Update jobs-fixes.json and orgs-fixes.json with any needed corrections

## 🔄 Complete Workflow

### Step 1: Run the Scraper
```bash
node scraper.js
```

**What it does:**
- Tests all 50 job URLs (takes ~2-3 minutes)
- Tests all 117 organization career pages (takes ~2-3 minutes)
- Extracts application requirements from valid job postings
- Saves results to `scraper-results.json`
- Rate-limited (500ms between requests) to be respectful to servers

**Output:**
- `scraper-results.json` - Raw scraper results with status codes, requirements, redirects

---

### Step 2: Analyze Results
```bash
node process-scraper-results.js
```

**What it does:**
- Analyzes scraper results
- Prints colored report showing:
  - ✅ Valid job URLs with extracted requirements
  - ❌ Broken job URLs needing manual fixes
  - ✅ Valid org URLs
  - 🔄 Org redirects (auto-fixable)
  - ⚠️ Broken org URLs (may need investigation)
- Creates fix templates:
  - `jobs-fixes.json` - Template for broken job URLs
  - `orgs-fixes.json` - Template for org redirects

**What to do:**
1. Review the printed report
2. For each broken job (❌):
   - Open the company's job board/website
   - Search for the job title
   - Copy the actual working job posting URL
   - Open `jobs-fixes.json` and paste the correct URL
   - Add application requirements if visible
3. For org redirects (🔄):
   - Review `orgs-fixes.json`
   - Verify the "newUrl" is correct
   - If not, manually find the correct careers page URL

---

### Step 3: Manual Fixes (if needed)

#### Fix Broken Job URLs
Edit `jobs-fixes.json`:
```json
{
  "instruction": "For each broken job, find the actual working URL...",
  "brokenJobs": [
    {
      "id": 1,
      "title": "VP, Policy and Advocacy",
      "company": "Nonprofit New York",
      "currentUrl": "https://www.idealist.org/en/nonprofit-job/1001",
      "correctUrl": "https://www.idealist.org/en/nonprofit-job/12345",
      "requirements": ["Resume", "Cover Letter"]
    }
  ]
}
```

#### Fix Org URLs
Edit `orgs-fixes.json`:
```json
{
  "instruction": "For each redirect, use the 'To:' URL...",
  "orgs": [
    {
      "name": "HKS Inc",
      "oldUrl": "https://www.hksinc.com/careers",
      "newUrl": "https://www.hksinc.com/careers/"
    }
  ]
}
```

---

### Step 4: Update Dashboard
```bash
node update-dashboard.js
```

**What it does:**
- Reads verified job requirements from `scraper-results.json`
- Applies manual job fixes from `jobs-fixes.json`
- Applies org URL redirects from `scraper-results.json`
- Applies manual org fixes from `orgs-fixes.json`
- Updates `index.html` with:
  - All valid job URLs and requirements
  - All updated org career page URLs
  - Last refresh timestamp
- Generates `update-report.json` with summary

**Output:**
```
✅ Dashboard updated!

Summary:
  Jobs with verified requirements: 22
  Org URLs fixed from redirects: 52
  Total valid jobs: 22/50
  Total valid org URLs: 20/109

📝 Report saved to: update-report.json

🚀 Ready to push! Run:
   git add index.html
   git commit -m "Update dashboard with verified URLs and requirements"
   git push origin main
```

---

### Step 5: Commit and Push
```bash
git add index.html
git commit -m "Update dashboard with verified URLs and requirements"
git push origin main
```

The updated dashboard is now live at: https://daylightingdev.github.io/work-command-center/

---

## 🚀 Quick Command (All at Once)

Run all steps in sequence:
```bash
node scraper.js && node process-scraper-results.js
# Review output and fix jobs-fixes.json, orgs-fixes.json
node update-dashboard.js
git add index.html && git commit -m "Update dashboard" && git push origin main
```

---

## 📊 Current Status

From last scraper run:
- **Jobs:** 22/50 valid URLs (with requirements extracted)
- **Organizations:** 20/117 valid URLs, 52 auto-fixed redirects
- **Broken jobs:** 28 need manual URL verification
- **Broken orgs:** 37 need manual investigation

---

## 🔍 Understanding the Scraper Results

### Job Status Codes:
- **200 (valid)** - URL works, requirements extracted ✅
- **301/302 (redirect)** - URL redirects, may work but format changed
- **404 (not found)** - Job posting deleted or URL wrong ❌
- **403 (forbidden)** - Server blocks automated access
- **unreachable** - Server down or network error

### Org Status:
- **valid** - Career page loads successfully ✅
- **redirect** - URL redirects to new location (can be auto-fixed)
- **unreachable/error** - Connection failed or server error ❌

---

## 💡 Tips

1. **LinkedIn jobs always work** - 22 LinkedIn jobs all passed (platform-stable)
2. **CityJobs NYC has redirects** - Add correct redirect URLs to update
3. **Idealist.org fake IDs** - These were test IDs, find real job posting IDs
4. **Org careers pages** - Most have small URL variations (www, trailing slash, subdomain)
5. **Rate limiting** - Scraper uses 500ms delays (respectful, safe)

---

## 🔐 Security & Privacy

- Scraper runs locally on YOUR machine (not through Claude)
- No credentials or sensitive data stored
- No authentication required
- All web requests have proper User-Agent headers
- Respects rate limits (500ms between requests)

---

## 📝 Maintenance

When adding new jobs:
1. Add them to the appropriate job board
2. Get the direct job posting URL
3. Run `node scraper.js` to verify the URL works
4. Extract application requirements
5. Add to index.html JOBS array
6. Re-run full workflow to verify

---

## ❓ Troubleshooting

**Scraper hangs?**
- Check internet connection
- Some servers are slow to respond (10s timeout per request)
- Ctrl+C to stop and retry

**Can't find job URL?**
- Try searching the company careers page for the job title
- LinkedIn job search: site:linkedin.com "Company" "Job Title"
- Some jobs may have been filled/archived

**Org redirect looks wrong?**
- Follow the redirect URL in browser first
- Some may be relative paths (starting with /)
- Update only with full absolute URLs

**Dashboard won't load?**
- Check for syntax errors in index.html
- Verify JOBS and ORGS arrays are properly formatted
- Test in different browser

---

## 📞 Next Steps

1. Run `node scraper.js` to get current status
2. Review results and fix broken URLs
3. Run `node update-dashboard.js`
4. Push updated dashboard
5. Repeat weekly or when adding new jobs
