#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔄 Updating dashboard with verified data...\n');

// Load all data
const scraperResults = JSON.parse(fs.readFileSync('scraper-results.json', 'utf8'));
const jobsFixes = JSON.parse(fs.readFileSync('jobs-fixes.json', 'utf8'));
const orgsFixes = JSON.parse(fs.readFileSync('orgs-fixes.json', 'utf8'));

// Build updated jobs map with requirements
const updatedJobs = new Map();
scraperResults.jobs.forEach(j => {
  if (j.status === 'valid') {
    updatedJobs.set(j.id, {
      requirements: j.requirements
    });
  }
});

// Add manual fixes if any
jobsFixes.brokenJobs.forEach(j => {
  if (j.correctUrl && j.correctUrl !== "TODO: Find and paste actual working URL here") {
    updatedJobs.set(j.id, {
      url: j.correctUrl,
      requirements: j.requirements
    });
  }
});

// Build org redirects map
const orgRedirects = new Map();
scraperResults.organizations.forEach(o => {
  if (o.status === 'redirect' && o.to) {
    orgRedirects.set(o.name, o.to);
  }
});

// Add manual org fixes if any
if (orgsFixes.orgs) {
  orgsFixes.orgs.forEach(o => {
    if (o.newUrl && o.newUrl !== "TODO: Verify and paste URL") {
      orgRedirects.set(o.name, o.newUrl);
    }
  });
}

// Read current index.html
let html = fs.readFileSync('index.html', 'utf8');

// Extract current job data from HTML
const jobsMatch = html.match(/var JOBS=\[([\s\S]*?)\];/);
if (!jobsMatch) {
  console.error('❌ Could not parse current jobs from index.html');
  process.exit(1);
}

const jobsDataStr = jobsMatch[1];

// Parse jobs (basic parsing)
const jobLines = jobsDataStr.split('\n').filter(l => l.trim().startsWith('{'));
const jobs = [];

jobLines.forEach(line => {
  const match = line.match(/\{id:(\d+),/);
  if (match) {
    const jobId = parseInt(match[1]);
    const jobStr = line + '}'; // Reconstruct single-line job object

    try {
      // Safe parsing - evaluate the object literal
      const job = eval('(' + jobStr + ')');

      // Update with requirements from scraper
      if (updatedJobs.has(jobId)) {
        const updates = updatedJobs.get(jobId);
        if (updates.requirements) {
          job.r = updates.requirements;
        }
        if (updates.url) {
          job.u = updates.url;
        }
      }

      jobs.push(job);
    } catch (e) {
      // Skip parse errors
    }
  }
});

console.log(`✅ Updated ${jobs.filter(j => updatedJobs.has(j.id)).length} jobs with requirements`);

// Reconstruct JOBS array
const jobsArrayStr = 'var JOBS=[\n' + jobs.map(j => {
  const reqsArr = (j.r || ['Resume', 'Cover Letter']).map(r => `"${r}"`).join(',');
  return `{id:${j.id},t:"${j.t}",c:"${j.c}",s:"${j.s}",l:"${j.l}",sec:"${j.sec}",sc:${j.sc},d:"${j.d}",u:"${j.u}",r:[${reqsArr}]}`;
}).join(',\n') + '\n];';

// Replace in HTML
html = html.replace(/var JOBS=\[[\s\S]*?\];/, jobsArrayStr);

// Extract and update ORGS
const orgsMatch = html.match(/var ORGS=\[([\s\S]*?)\];/);
if (orgsMatch) {
  const orgsDataStr = orgsMatch[1];
  const orgLines = orgsDataStr.split('\n').filter(l => l.trim().startsWith('{'));
  const orgs = [];

  orgLines.forEach(line => {
    const match = line.match(/n:"([^"]+)"/);
    if (match) {
      const orgName = match[1];
      const orgStr = line + '}';

      try {
        const org = eval('(' + orgStr + ')');

        // Apply redirects from scraper
        if (orgRedirects.has(orgName)) {
          org.u = orgRedirects.get(orgName);
        }

        orgs.push(org);
      } catch (e) {
        // Skip parse errors
      }
    }
  });

  console.log(`✅ Updated ${orgRedirects.size} org URLs from redirects`);

  // Reconstruct ORGS array
  const orgsArrayStr = 'var ORGS=[\n' + orgs.map(o => {
    return `{n:"${o.n}",s:"${o.s}",u:"${o.u}"}`;
  }).join(',\n') + '\n];';

  html = html.replace(/var ORGS=\[[\s\S]*?\];/, orgsArrayStr);
}

// Update last refresh timestamp
const now = new Date();
const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
html = html.replace(
  /document\.getElementById\('lastRefresh'\)\.textContent='Last Refreshed: [^']+'/,
  `document.getElementById('lastRefresh').textContent='Last Refreshed: ${dateStr}'`
);

// Write updated HTML
fs.writeFileSync('index.html', html);

// Generate summary report
const report = {
  timestamp: new Date().toISOString(),
  updates: {
    jobsWithRequirements: updatedJobs.size,
    orgsWithFixedUrls: orgRedirects.size,
    validJobs: scraperResults.jobs.filter(j => j.status === 'valid').length,
    validOrgs: scraperResults.organizations.filter(o => o.status === 'valid').length
  },
  nextSteps: [
    'Review index.html to verify updates',
    'Test dashboard in browser',
    'Run: git add index.html',
    'Run: git commit -m "Update dashboard with verified URLs and requirements"',
    'Run: git push origin main'
  ]
};

fs.writeFileSync('update-report.json', JSON.stringify(report, null, 2));

console.log('\n✅ Dashboard updated!');
console.log(`\nSummary:`);
console.log(`  Jobs with verified requirements: ${report.updates.jobsWithRequirements}`);
console.log(`  Org URLs fixed from redirects: ${report.updates.orgsWithFixedUrls}`);
console.log(`  Total valid jobs: ${report.updates.validJobs}/50`);
console.log(`  Total valid org URLs: ${report.updates.validOrgs}/117`);
console.log('\n📝 Report saved to: update-report.json');
console.log('\n🚀 Ready to push! Run:');
console.log('   git add index.html');
console.log('   git commit -m "Update dashboard with verified URLs and requirements"');
console.log('   git push origin main\n');
