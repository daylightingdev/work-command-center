#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read scraper results
const results = JSON.parse(fs.readFileSync('scraper-results.json', 'utf8'));

console.log('\n📊 SCRAPER RESULTS ANALYSIS\n');
console.log('='.repeat(60));

// Analyze jobs
const validJobs = results.jobs.filter(j => j.status === 'valid');
const invalidJobs = results.jobs.filter(j => j.status !== 'valid');

console.log(`\n🔴 JOB URLS: ${validJobs.length}/${results.jobs.length} working`);
console.log('\n✅ VALID (URLs working + requirements extracted):\n');

validJobs.forEach(j => {
  const reqsStr = j.requirements.join(', ');
  console.log(`  [${j.id}] ${j.title}`);
  console.log(`      Company: ${j.company}`);
  console.log(`      Requires: ${reqsStr}`);
  console.log(`      URL: ${j.url}\n`);
});

console.log('\n❌ BROKEN (need manual fixes):\n');
invalidJobs.forEach(j => {
  console.log(`  [${j.id}] ${j.title}`);
  console.log(`      Company: ${j.company}`);
  console.log(`      Current URL: ${j.url}`);
  console.log(`      Status: ${j.statusCode === 404 ? '404 Not Found' : j.statusCode === 301 || j.statusCode === 302 ? '3xx Redirect' : j.statusCode === 403 ? '403 Forbidden' : 'Error'}`);
  console.log(`      Action: Manual lookup required\n`);
});

// Analyze orgs
const validOrgs = results.organizations.filter(o => o.status === 'valid');
const redirectOrgs = results.organizations.filter(o => o.status === 'redirect');
const errorOrgs = results.organizations.filter(o => o.status === 'unreachable' || o.status === 'error');

console.log('\n' + '='.repeat(60));
console.log(`\n🏢 ORG CAREER PAGES: ${validOrgs.length}/${results.organizations.length} working`);

console.log(`\n✅ VALID (${validOrgs.length}):\n`);
validOrgs.forEach(o => {
  console.log(`  ${o.name}`);
  console.log(`    → ${o.url}\n`);
});

console.log(`\n🔄 REDIRECTS (${redirectOrgs.length}) - URLs need updating:\n`);
redirectOrgs.forEach(o => {
  console.log(`  ${o.name}`);
  console.log(`    From: ${o.from}`);
  console.log(`    To:   ${o.to}\n`);
});

console.log(`\n⚠️  BROKEN (${errorOrgs.length}) - need manual investigation:\n`);
errorOrgs.forEach(o => {
  console.log(`  ${o.name} - ${o.status}\n`);
});

// Generate update instructions
console.log('\n' + '='.repeat(60));
console.log('\n📝 NEXT STEPS TO FIX DATA:\n');

console.log('1. FOR BROKEN JOB URLS (28 jobs):');
console.log('   - Visit each company\'s job board');
console.log('   - Search for the job title');
console.log('   - Copy the actual working URL');
console.log('   - Update jobs in jobs-fixes.json');

console.log('\n2. FOR ORG REDIRECTS (66 orgs):');
console.log('   - Update org URLs to follow redirects');
console.log('   - Use the "To:" URLs from above');
console.log('   - Update orgs in orgs-fixes.json');

console.log('\n3. RUN UPDATE SCRIPT:');
console.log('   node update-dashboard.js');

console.log('\n4. COMMIT AND PUSH:');
console.log('   git add index.html');
console.log('   git commit -m "Update dashboard with verified job URLs and requirements"');
console.log('   git push origin main\n');

// Generate fixes template
const jobsFixesTemplate = {
  "instruction": "For each broken job, find the actual working URL and add entry below",
  "brokenJobs": invalidJobs.map(j => ({
    id: j.id,
    title: j.title,
    company: j.company,
    currentUrl: j.url,
    correctUrl: "TODO: Find and paste actual working URL here",
    requirements: ["Resume", "Cover Letter"] // Default placeholder
  }))
};

const orgsFixesTemplate = {
  "instruction": "For each redirect, use the 'To:' URL from scraper results",
  "orgs": redirectOrgs.map(o => ({
    name: o.name,
    oldUrl: o.from,
    newUrl: o.to || "TODO: Verify and paste URL"
  }))
};

fs.writeFileSync('jobs-fixes.json', JSON.stringify(jobsFixesTemplate, null, 2));
fs.writeFileSync('orgs-fixes.json', JSON.stringify(orgsFixesTemplate, null, 2));

console.log('✅ Templates created:');
console.log('   - jobs-fixes.json (fill in broken job URLs)');
console.log('   - orgs-fixes.json (confirm org URL fixes)');
console.log('\n' + '='.repeat(60) + '\n');
