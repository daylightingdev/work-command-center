#!/usr/bin/env node
const fs = require('fs');
const https = require('https');
const http = require('http');

async function validateURL(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      resolve({ valid: false, status: 0 });
    }, 8000);

    const req = protocol.head(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      clearTimeout(timeout);
      resolve({
        valid: res.statusCode < 400,
        status: res.statusCode
      });
    });

    req.on('error', () => {
      clearTimeout(timeout);
      resolve({ valid: false, status: 0 });
    });
  });
}

async function processDiscoveredJobs() {
  console.log('\n📊 PROCESSING DISCOVERED JOBS');
  console.log('=============================\n');

  if (!fs.existsSync('discovered-jobs.json')) {
    console.error('❌ discovered-jobs.json not found. Run job-discovery-scraper.js first.\n');
    process.exit(1);
  }

  const discovered = JSON.parse(fs.readFileSync('discovered-jobs.json', 'utf8'));
  console.log(`Found ${discovered.jobs.length} jobs to validate...\n`);

  // Validate URLs
  const validated = [];
  for (const job of discovered.jobs) {
    process.stdout.write(`Validating: ${job.title.slice(0, 50)}... `);
    const result = await validateURL(job.url);
    if (result.valid) {
      console.log('✓');
      validated.push({ ...job, status: 'valid', statusCode: result.status });
    } else {
      console.log(`✗ (${result.status})`);
    }
  }

  console.log(`\n✅ Valid jobs: ${validated.length}/${discovered.jobs.length}\n`);

  if (validated.length === 0) {
    console.log('⚠️  No valid jobs found. Job boards may require login or have changed structure.\n');
    process.exit(0);
  }

  // Read current index.html
  const html = fs.readFileSync('index.html', 'utf8');
  const jobsMatch = html.match(/var JOBS=\[([\s\S]*?)\];/);

  if (!jobsMatch) {
    console.error('❌ Could not parse JOBS array from index.html\n');
    process.exit(1);
  }

  // Get highest current ID and number
  const currentJobs = jobsMatch[0];
  const idMatches = currentJobs.match(/id:(\d+)/g) || [];
  const maxId = idMatches.length > 0 ? Math.max(...idMatches.map(m => parseInt(m.match(/\d+/)[0]))) : 0;
  const numMatches = currentJobs.match(/num:(\d+)/g) || [];
  const maxNum = numMatches.length > 0 ? Math.max(...numMatches.map(m => parseInt(m.match(/\d+/)[0]))) : 0;

  console.log(`Current dashboard: ${maxNum} jobs (ID ${maxId})`);
  console.log(`Adding ${validated.length} new jobs\n`);

  // Build new job entries
  let newJobsStr = '';
  validated.forEach((job, idx) => {
    const num = maxNum + idx + 1;
    const id = maxId + idx + 1;
    const reqs = ['Resume', 'Cover Letter'];
    const reqsStr = reqs.map(r => `"${r}"`).join(',');

    newJobsStr += `,{num:${num},id:${id},t:"${job.title.replace(/"/g, '\\"')}",c:"${job.company.replace(/"/g, '\\"')}",s:"Competitive",l:"Remote",sec:"general",sc:${Math.max(30, 100-(num*3))},d:"${new Date().toISOString().split('T')[0]}",u:"${job.url}",r:[${reqsStr}],discovered:true}`;
  });

  // Update HTML
  let updated = html.replace(/var JOBS=\[([\s\S]*?)\];/, (match) => {
    return match.slice(0, -2) + newJobsStr + '\n];';
  });

  fs.writeFileSync('index.html', updated);

  console.log(`✅ Updated dashboard!`);
  console.log(`   New total: ${maxNum + validated.length} jobs`);
  console.log(`\n📝 New jobs added:\n`);

  validated.forEach((job, idx) => {
    console.log(`${maxNum + idx + 1}. ${job.title}`);
    console.log(`   @ ${job.company}`);
    console.log(`   ${job.url}\n`);
  });

  console.log('✨ Dashboard updated and ready to view!\n');
}

processDiscoveredJobs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
