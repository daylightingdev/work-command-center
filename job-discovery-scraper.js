#!/usr/bin/env node
const https = require('https');
const http = require('http');
const fs = require('fs');
const { URL } = require('url');

// Keywords to match against
const KEYWORDS = {
  'urban': ['urban', 'planning', 'city', 'metropolitan', 'transit', 'transportation'],
  'climate': ['climate', 'sustainability', 'environment', 'carbon', 'renewable', 'green'],
  'design': ['design', 'designer', 'researcher', 'research', 'ux', 'ui'],
  'policy': ['policy', 'analyst', 'advocacy', 'government', 'public'],
  'research': ['research', 'analyst', 'research manager', 'research associate']
};

const EXCLUDE = ['finance', 'accounting', 'sales', 'marketing', 'hr', 'legal', 'financial'];

// Organizations to search
const ORGS = [
  { name: 'Metropolitan Transportation Authority', url: 'https://new.mta.info/careers', type: 'careers_page' },
  { name: 'NYC Department of City Planning', url: 'https://www1.nyc.gov/site/planning/careers/careers.page', type: 'careers_page' },
  { name: 'Environmental Defense Fund', url: 'https://www.edf.org/environmental-careers', type: 'careers_page' },
  { name: 'Waterfront Alliance', url: 'https://waterfront-alliance.org/careers', type: 'careers_page' },
  { name: 'Arup', url: 'https://jobs.arup.com', type: 'job_board' },
  { name: 'Gensler', url: 'https://www.gensler.com/careers', type: 'careers_page' },
  { name: 'Stantec', url: 'https://www.stantec.com/en/careers', type: 'careers_page' },
  { name: 'WSP', url: 'https://www.wsp.com/en-us/careers', type: 'careers_page' },
  { name: 'IDEO', url: 'https://www.ideo.com/careers', type: 'careers_page' },
  { name: 'Urban Land Institute', url: 'https://uli.org/careers', type: 'careers_page' },
  { name: 'Project for Public Spaces', url: 'https://www.pps.org/careers', type: 'careers_page' },
  { name: 'Regional Plan Association', url: 'https://rpa.org/careers', type: 'careers_page' },
  { name: 'NACTO', url: 'https://nacto.org/careers', type: 'careers_page' },
  { name: 'Code for America', url: 'https://codeforamerica.org/careers', type: 'careers_page' },
  { name: 'NRDC', url: 'https://careers.nrdc.org', type: 'job_board' }
];

// Rate limiting
const RATE_LIMIT_MS = 1000;
let lastRequestTime = 0;

async function fetchUrl(url) {
  const now = Date.now();
  const waitTime = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  }).catch(err => {
    return { status: 0, html: '', error: err.message };
  });
}

function isRelevantJob(title) {
  const t = title.toLowerCase();

  // Check if excluded
  if (EXCLUDE.some(word => t.includes(word))) return false;

  // Check if matches keywords
  for (const [sector, words] of Object.entries(KEYWORDS)) {
    if (words.some(word => t.includes(word))) return true;
  }

  return false;
}

function extractJobsFromHTML(html, orgName) {
  const jobs = [];

  // Only look for actual job board URLs or job-listing patterns
  const jobBoardPatterns = [
    /greenhouse\.io/i,           // Greenhouse
    /lever\.co/i,                // Lever
    /workday\.com/i,             // Workday
    /applicant\.workday\.com/i,  // Workday careers
    /jobs\.lever\.co/i,          // Lever
    /boards\.greenhouse\.io/i,   // Greenhouse
    /ats\.comparably\.com/i,     // Comparably
    /jobs\..+\.com/,             // jobs.company.com pattern
    /careers\..+\..+/,           // careers subdomain
  ];

  const linkPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let linkMatch;
  const foundUrls = new Set();

  while ((linkMatch = linkPattern.exec(html)) !== null) {
    let url = linkMatch[1];
    const text = linkMatch[2].trim();

    // Make URLs absolute
    if (url.startsWith('/')) {
      try {
        const baseUrl = new URL(`https://${orgName.toLowerCase().replace(/\s+/g, '')}.com`);
        // Skip relative paths for now - they're unreliable
        continue;
      } catch (e) {}
    }

    // Only accept if matches job board pattern and has relevant keywords
    const matchesJobBoard = jobBoardPatterns.some(pattern => pattern.test(url));
    const isRelevant = isRelevantJob(text);
    const isValidLength = text.length > 15 && text.length < 200;
    const isNotDuplicate = !foundUrls.has(url) && url.length < 500;

    if (matchesJobBoard && isRelevant && isValidLength && isNotDuplicate) {
      foundUrls.add(url);
      jobs.push({
        title: text,
        url: url,
        org: orgName
      });
    }
  }

  return jobs;
}

async function searchOrganization(org) {
  console.log(`🔍 Searching ${org.name}...`);

  try {
    const response = await fetchUrl(org.url);

    if (response.status !== 200) {
      console.log(`   ⚠️  Status ${response.status}`);
      return [];
    }

    const jobs = extractJobsFromHTML(response.html, org.name);
    console.log(`   ✓ Found ${jobs.length} potential matches`);

    return jobs.filter(j => isRelevantJob(j.title));
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return [];
  }
}

async function discoverJobs() {
  console.log('\n🚀 JOB DISCOVERY SCRAPER');
  console.log('========================\n');
  console.log(`Searching ${ORGS.length} organizations for new opportunities...\n`);

  const allJobs = [];

  for (const org of ORGS) {
    const jobs = await searchOrganization(org);
    allJobs.push(...jobs);
  }

  // Deduplicate by URL
  const uniqueJobs = Array.from(
    new Map(allJobs.map(j => [j.url, j])).values()
  );

  console.log(`\n✅ Discovery complete!`);
  console.log(`   Total opportunities found: ${uniqueJobs.length}`);

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    total_found: uniqueJobs.length,
    jobs: uniqueJobs.map((j, idx) => ({
      id: 100 + idx,
      title: j.title,
      company: j.org,
      url: j.url,
      discovered: true
    }))
  };

  fs.writeFileSync('discovered-jobs.json', JSON.stringify(results, null, 2));
  console.log(`\n📝 Results saved to: discovered-jobs.json`);
  console.log('\nNext steps:');
  console.log('1. Review discovered-jobs.json');
  console.log('2. Run: node add-discovered-jobs.js');
  console.log('3. Dashboard will show new opportunities\n');
}

discoverJobs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
