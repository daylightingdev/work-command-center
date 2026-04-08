#!/usr/bin/env node
/**
 * build-dashboard.js
 * Work Command Center - Job Scraper & Dashboard Builder
 *
 * Scrapes jobs from public APIs (Greenhouse, Lever, Ashby, SmartRecruiters),
 * validates URLs, scores matches, and generates the dashboard HTML.
 *
 * Usage: node build-dashboard.js
 * Output: scraped-jobs.json, index.html
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OUTPUT_JSON = path.join(__dirname, 'scraped-jobs.json');
const OUTPUT_HTML = path.join(__dirname, 'index.html');
const REQUEST_DELAY_MS = 1000; // rate-limit delay between requests
const REQUEST_TIMEOUT_MS = 15000;
const URL_VALIDATE_TIMEOUT_MS = 10000;
const MAX_CONCURRENT_VALIDATIONS = 5;

// ---------------------------------------------------------------------------
// Organization definitions by platform
// ---------------------------------------------------------------------------

const GREENHOUSE_COMPANIES = [
  { slug: 'via', name: 'Via' },
  { slug: 'sidewalklabs', name: 'Sidewalk Labs' },
  { slug: 'lyft', name: 'Lyft' },
  { slug: 'uber', name: 'Uber' },
  { slug: 'lime', name: 'Lime' },
  { slug: 'revel', name: 'Revel' },
  { slug: 'cityblockhealth', name: 'Cityblock Health' },
  { slug: 'zencity', name: 'Zencity' },
  { slug: 'opengov', name: 'OpenGov' },
  { slug: 'fordfoundation', name: 'Ford Foundation' },
  { slug: 'opensocietyfoundations', name: 'Open Society Foundations' },
  { slug: 'rockefellerfoundation', name: 'Rockefeller Foundation' },
  { slug: 'knightfoundation', name: 'Knight Foundation' },
  { slug: 'surdnafoundation', name: 'Surdna Foundation' },
  { slug: 'chanzuckerberginitiative', name: 'Chan Zuckerberg Initiative' },
];

const LEVER_COMPANIES = [
  { slug: 'remix', name: 'Remix' },
  { slug: 'coord', name: 'Coord' },
  { slug: 'streetlightdata', name: 'StreetLight Data' },
  { slug: 'passport', name: 'Passport' },
  { slug: 'gehl', name: 'Gehl' },
  { slug: 'snohetta', name: 'Snohetta' },
  { slug: 'bjarkeingelsgroup', name: 'Bjarke Ingels Group (BIG)' },
  { slug: 'massdesigngroup', name: 'MASS Design Group' },
  { slug: 'studiogang', name: 'Studio Gang' },
  { slug: 'wxyarchitecture', name: 'WXY Architecture' },
  { slug: 'jamesfieldoperations', name: 'James Corner Field Operations' },
  { slug: 'west8', name: 'West 8' },
  { slug: 'practiceforarchitectureandurbanism', name: 'Practice for Architecture and Urbanism (PAU)' },
];

const MANUAL_CHECK_ORGS = [
  { name: 'NYC Government (Mayor\'s Office, DOT, DCP, EDC, Parks, NYCHA, DDC, TLC, DCLA, DOB)', url: 'https://cityjobs.nyc.gov', sector: 'government' },
  { name: 'MTA', url: 'https://new.mta.info/careers', sector: 'government' },
  { name: 'Port Authority of NY & NJ', url: 'https://www.panynj.gov/port-authority/en/careers.html', sector: 'government' },
  { name: 'Regional Plan Association', url: 'https://rpa.org/careers', sector: 'policy' },
  { name: 'HR&A Advisors', url: 'https://www.hraadvisors.com/careers/', sector: 'consulting' },
  { name: 'Gensler', url: 'https://www.gensler.com/careers', sector: 'design' },
  { name: 'SOM', url: 'https://www.som.com/culture/careers/', sector: 'design' },
  { name: 'HOK', url: 'https://www.hok.com/careers/', sector: 'design' },
  { name: 'Perkins&Will', url: 'https://perkinswill.com/careers/', sector: 'design' },
  { name: 'AECOM', url: 'https://aecom.jobs', sector: 'consulting' },
  { name: 'Arup', url: 'https://www.arup.com/careers', sector: 'consulting' },
  { name: 'Stantec', url: 'https://www.stantec.com/en/careers', sector: 'consulting' },
  { name: 'WSP', url: 'https://www.wsp.com/en-us/careers', sector: 'consulting' },
  { name: 'Arcadis', url: 'https://www.arcadis.com/en/careers', sector: 'consulting' },
  { name: 'Sasaki', url: 'https://www.sasaki.com/careers', sector: 'design' },
  { name: 'McKinsey', url: 'https://www.mckinsey.com/careers', sector: 'consulting' },
  { name: 'BCG', url: 'https://careers.bcg.com', sector: 'consulting' },
  { name: 'Deloitte', url: 'https://apply.deloitte.com', sector: 'consulting' },
  { name: 'PwC', url: 'https://www.pwc.com/us/en/careers.html', sector: 'consulting' },
  { name: 'EY', url: 'https://www.ey.com/en_us/careers', sector: 'consulting' },
  { name: 'Accenture', url: 'https://www.accenture.com/us-en/careers', sector: 'consulting' },
  { name: 'Idealist', url: 'https://www.idealist.org/en/nonprofit-jobs?q=urban+strategy+OR+placemaking&locationType=REMOTE', sector: 'nonprofit' },
  { name: 'Enterprise Community Partners', url: 'https://www.enterprisecommunity.org/careers', sector: 'nonprofit' },
  { name: 'LISC', url: 'https://www.lisc.org/careers/', sector: 'nonprofit' },
  { name: 'Urban Institute', url: 'https://www.urban.org/about/careers', sector: 'policy' },
  { name: 'Related Companies', url: 'https://rfrk.com/careers/', sector: 'design' },
  { name: 'JLL', url: 'https://jobs.jll.com', sector: 'consulting' },
  { name: 'CBRE', url: 'https://careers.cbre.com', sector: 'consulting' },
  { name: 'Brookfield', url: 'https://www.brookfieldproperties.com/en/careers.html', sector: 'consulting' },
  // Workday companies (special handling)
  { name: 'HKS (Workday)', url: 'https://hksinc.wd501.myworkdayjobs.com', sector: 'design', platform: 'workday' },
  { name: 'JLL (Workday)', url: 'https://jll.wd1.myworkdayjobs.com', sector: 'consulting', platform: 'workday' },
  // ApplyToJob
  { name: 'Replica', url: 'https://replicainc.applytojob.com', sector: 'urban', platform: 'applytojob' },
  // Additional organizations from original dashboard
  { name: 'Downtown Brooklyn Partnership', url: 'https://downtownbrooklyn.com/jobs-rfps/', sector: 'urban' },
  { name: 'Bloomberg Philanthropies', url: 'https://www.bloomberg.org/about/careers/', sector: 'nonprofit' },
  { name: 'Gates Foundation', url: 'https://www.gatesfoundation.org/about/careers', sector: 'nonprofit' },
  { name: 'Mellon Foundation', url: 'https://www.mellon.org/careers', sector: 'nonprofit' },
  { name: 'NACTO', url: 'https://nacto.org/job-board/', sector: 'policy' },
  { name: 'Odyssey', url: 'https://www.theodysseyapp.com/careers', sector: 'urban' },
  { name: 'IDEO', url: 'https://www.ideo.com/careers', sector: 'design' },
  { name: 'NBBJ', url: 'https://www.nbbj.com/careers', sector: 'design' },
  { name: 'RMI', url: 'https://rmi.org/careers', sector: 'climate' },
  { name: 'The Nature Conservancy', url: 'https://www.nature.org/en-us/about-us/careers/', sector: 'climate' },
  { name: 'Environmental Defense Fund', url: 'https://www.edf.org/environmental-careers', sector: 'climate' },
  { name: 'NRDC', url: 'https://www.nrdc.org/careers', sector: 'climate' },
  { name: 'Sierra Club', url: 'https://www.sierraclub.org/careers-jobs-employment', sector: 'climate' },
  { name: 'ACLU', url: 'https://www.aclu.org/careers/', sector: 'policy' },
  { name: 'Brookings Institution', url: 'https://www.brookings.edu/careers/', sector: 'policy' },
  { name: 'New America', url: 'https://www.newamerica.org/careers/', sector: 'policy' },
  { name: 'Carnegie Endowment', url: 'https://carnegieendowment.org/careers', sector: 'policy' },
  { name: 'Conservation International', url: 'https://www.conservation.org/about/careers', sector: 'climate' },
  { name: 'Trust for Public Land', url: 'https://www.tpl.org/careers', sector: 'climate' },
  { name: 'Audubon Society', url: 'https://www.audubon.org/about/careers', sector: 'climate' },
  { name: 'World Wildlife Fund', url: 'https://www.worldwildlife.org/about/careers', sector: 'climate' },
  { name: 'Clean Air Task Force', url: 'https://www.catf.us/careers/', sector: 'climate' },
  { name: 'GiveDirectly', url: 'https://www.givedirectly.org/careers', sector: 'nonprofit' },
  { name: 'Heritage Foundation', url: 'https://www.heritage.org/careers', sector: 'policy' },
  { name: 'Manhattan Institute', url: 'https://manhattan.institute/careers', sector: 'policy' },
  { name: 'Urban Land Institute', url: 'https://urbanland.uli.org/programs/career-center/', sector: 'urban' },
  { name: 'Buro Happold', url: 'https://www.burohappold.com/careers/', sector: 'consulting' },
  { name: 'ERA-Co', url: 'https://era-co.com/careers/', sector: 'urban' },
  { name: '350.org', url: 'https://350.org/careers?r=US&c=NA', sector: 'climate' },
  { name: 'Climate Reality Project', url: 'https://www.climaterealityproject.org/careers', sector: 'climate' },
  { name: 'Open Space Institute', url: 'https://www.openspaceinstitute.org/careers', sector: 'climate' },
  { name: 'NeighborWorks', url: 'https://www.neighborworks.org/', sector: 'nonprofit' },
  { name: 'Cushman & Wakefield', url: 'https://www.cushmanwakefield.com/en/careers', sector: 'consulting' },
  { name: 'Social Science Research Council', url: 'https://www.ssrc.org/about/employment/', sector: 'policy' },
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetchJSON(url, timeout = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout, headers: { 'User-Agent': 'WorkCommandCenter/1.0', 'Accept': 'application/json' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = parsed.protocol + '//' + parsed.host + redirectUrl;
        }
        fetchJSON(redirectUrl, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function validateUrl(url) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(false);
      return;
    }
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, {
      method: 'HEAD',
      timeout: URL_VALIDATE_TIMEOUT_MS,
      headers: { 'User-Agent': 'WorkCommandCenter/1.0' },
    }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Salary extraction
// ---------------------------------------------------------------------------

function extractSalary(text) {
  if (!text) return { salaryRange: 'Salary not listed', salaryMin: 0, salaryMax: 0 };

  // Pattern: $120,000 - $150,000 or $120,000-$150,000
  let match = text.match(/\$\s*([\d,]+)\s*[-–—to]+\s*\$\s*([\d,]+)/i);
  if (match) {
    const min = parseInt(match[1].replace(/,/g, ''), 10);
    const max = parseInt(match[2].replace(/,/g, ''), 10);
    if (min >= 20000 && max >= min) {
      return { salaryRange: `$${min.toLocaleString()}-$${max.toLocaleString()}`, salaryMin: min, salaryMax: max };
    }
  }

  // Pattern: $120k-$150k or $120K-$150K
  match = text.match(/\$\s*(\d+)\s*[kK]\s*[-–—to]+\s*\$?\s*(\d+)\s*[kK]/i);
  if (match) {
    const min = parseInt(match[1], 10) * 1000;
    const max = parseInt(match[2], 10) * 1000;
    if (min >= 20000 && max >= min) {
      return { salaryRange: `$${min.toLocaleString()}-$${max.toLocaleString()}`, salaryMin: min, salaryMax: max };
    }
  }

  // Pattern: salary range: $120,000
  match = text.match(/(?:salary|compensation|pay)[\s:]+\$\s*([\d,]+)/i);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ''), 10);
    if (val >= 20000) {
      return { salaryRange: `$${val.toLocaleString()}`, salaryMin: val, salaryMax: val };
    }
  }

  // Pattern: 120,000-150,000 (without $)
  match = text.match(/(?:salary|compensation|pay)[\s:]*(\d{2,3}),?(\d{3})\s*[-–—to]+\s*(\d{2,3}),?(\d{3})/i);
  if (match) {
    const min = parseInt(match[1] + match[2], 10);
    const max = parseInt(match[3] + match[4], 10);
    if (min >= 20000 && max >= min) {
      return { salaryRange: `$${min.toLocaleString()}-$${max.toLocaleString()}`, salaryMin: min, salaryMax: max };
    }
  }

  // Pattern: standalone $120,000 (single salary mention)
  match = text.match(/\$\s*([\d,]+)(?:\s*(?:per year|annually|\/yr|\/year))/i);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ''), 10);
    if (val >= 20000) {
      return { salaryRange: `$${val.toLocaleString()}`, salaryMin: val, salaryMax: val };
    }
  }

  return { salaryRange: 'Salary not listed', salaryMin: 0, salaryMax: 0 };
}

// ---------------------------------------------------------------------------
// Application requirements extraction
// ---------------------------------------------------------------------------

function extractRequirements(text) {
  if (!text) return ['Resume (standard)'];

  const reqs = new Set();
  const lower = text.toLowerCase();

  if (lower.includes('resume') || lower.includes('cv')) reqs.add('Resume');
  if (lower.includes('cover letter')) reqs.add('Cover Letter');
  if (lower.includes('portfolio')) reqs.add('Portfolio');
  if (lower.includes('writing sample')) reqs.add('Writing Sample');
  if (lower.includes('references') || lower.includes('reference list')) reqs.add('References');
  if (lower.includes('transcript')) reqs.add('Transcript');
  if (lower.includes('work sample')) reqs.add('Work Samples');
  if (lower.includes('design sample')) reqs.add('Design Samples');

  return reqs.size > 0 ? Array.from(reqs) : ['Resume (standard)'];
}

// ---------------------------------------------------------------------------
// Scoring algorithm
// ---------------------------------------------------------------------------

function calculateScore(job) {
  let score = 50;
  const titleLower = (job.title || '').toLowerCase();
  const descLower = (job.description || '').toLowerCase();

  // High-value title keywords (+10 each, max 30)
  const tier1 = ['strategy', 'policy', 'research', 'planning', 'design', 'operations'];
  let kwScore = 0;
  tier1.forEach(kw => { if (titleLower.includes(kw)) kwScore += 10; });
  score += Math.min(kwScore, 30);

  // Medium-value keywords (+5 each)
  const tier2 = ['sustainability', 'climate', 'urban', 'public space', 'placemaking', 'workplace', 'transit', 'mobility'];
  tier2.forEach(kw => { if (titleLower.includes(kw) || descLower.includes(kw)) score += 5; });

  // Salary bonus
  if (job.salaryMin >= 130000) score += 15;
  else if (job.salaryMin >= 110000) score += 10;
  else if (job.salaryMin >= 90000) score += 5;

  // NYC location bonus
  if ((job.location || '').match(/new york|brooklyn|manhattan|queens|bronx|nyc/i)) score += 10;

  // Remote bonus
  if ((job.location || '').match(/remote/i)) score += 5;

  // Recency bonus (posted in last 7 days)
  if (job.datePosted) {
    const daysOld = (Date.now() - new Date(job.datePosted)) / 86400000;
    if (daysOld <= 7) score += 5;
  }

  return Math.min(score, 100);
}

// ---------------------------------------------------------------------------
// Sector classification
// ---------------------------------------------------------------------------

function classifySector(job) {
  const text = ((job.title || '') + ' ' + (job.company || '') + ' ' + (job.description || '')).toLowerCase();

  if (text.match(/climate|sustainability|carbon|renewable|energy|environment/)) return 'climate';
  if (text.match(/urban|city|placemaking|public space|transit|mobility|transportation/)) return 'urban';
  if (text.match(/policy|government|public sector|civic|regulation/)) return 'policy';
  if (text.match(/nonprofit|foundation|philanthrop|ngo|advocacy/)) return 'nonprofit';
  if (text.match(/consult|advisory|strateg(?:y|ic)/)) return 'consulting';
  if (text.match(/design|architect|landscape|studio/)) return 'design';
  return 'general';
}

// ---------------------------------------------------------------------------
// Platform scrapers
// ---------------------------------------------------------------------------

async function scrapeGreenhouse(company) {
  const url = `https://api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`;
  try {
    const data = await fetchJSON(url);
    const jobs = (data.jobs || []).map(j => {
      const desc = (j.content || '');
      const salary = extractSalary(desc);
      const location = (j.location && j.location.name) || 'Not specified';
      const datePosted = j.updated_at || j.created_at || null;

      return {
        title: j.title,
        company: company.name,
        location,
        ...salary,
        datePosted: datePosted ? new Date(datePosted).toISOString().split('T')[0] : null,
        directJobUrl: j.absolute_url || `https://boards.greenhouse.io/${company.slug}/jobs/${j.id}`,
        description: desc,
        applicationRequirements: extractRequirements(desc),
        source: 'greenhouse',
      };
    });
    return jobs;
  } catch (err) {
    console.log(`  [WARN] ${company.name} (Greenhouse): ${err.message}`);
    return [];
  }
}

async function scrapeLever(company) {
  const url = `https://api.lever.co/v0/postings/${company.slug}`;
  try {
    const data = await fetchJSON(url);
    if (!Array.isArray(data)) return [];
    const jobs = data.map(j => {
      const desc = (j.descriptionPlain || j.description || '');
      const additionalText = (j.lists || []).map(l => (l.content || '')).join(' ');
      const fullText = desc + ' ' + additionalText;
      const salary = extractSalary(fullText);
      const cats = j.categories || {};
      const location = cats.location || cats.allLocations?.join(', ') || 'Not specified';
      const datePosted = j.createdAt ? new Date(j.createdAt).toISOString().split('T')[0] : null;

      return {
        title: j.text,
        company: company.name,
        location,
        ...salary,
        datePosted,
        directJobUrl: j.hostedUrl || j.applyUrl || `https://jobs.lever.co/${company.slug}/${j.id}`,
        description: fullText,
        applicationRequirements: extractRequirements(fullText),
        source: 'lever',
      };
    });
    return jobs;
  } catch (err) {
    console.log(`  [WARN] ${company.name} (Lever): ${err.message}`);
    return [];
  }
}

function buildManualCheckEntry(org) {
  return {
    title: 'Manual check needed',
    company: org.name,
    location: 'See career page',
    salaryRange: 'Salary not listed',
    salaryMin: 0,
    salaryMax: 0,
    datePosted: new Date().toISOString().split('T')[0],
    directJobUrl: org.url,
    description: '',
    applicationRequirements: ['Check career page'],
    source: org.platform || 'career-page',
    sector: org.sector || 'general',
    manualCheck: true,
  };
}

// ---------------------------------------------------------------------------
// Batch URL validation
// ---------------------------------------------------------------------------

async function validateUrlsBatch(jobs) {
  let validCount = 0;
  let invalidCount = 0;
  const total = jobs.filter(j => !j.manualCheck).length;

  // Process in batches to avoid overwhelming connections
  const toValidate = jobs.filter(j => !j.manualCheck);
  for (let i = 0; i < toValidate.length; i += MAX_CONCURRENT_VALIDATIONS) {
    const batch = toValidate.slice(i, i + MAX_CONCURRENT_VALIDATIONS);
    const results = await Promise.all(batch.map(async (job) => {
      const isValid = await validateUrl(job.directJobUrl);
      return { job, isValid };
    }));
    results.forEach(({ job, isValid }) => {
      job.urlValid = isValid;
      if (isValid) validCount++;
      else invalidCount++;
    });
    process.stdout.write(`\r  Validating URLs... ${validCount + invalidCount}/${total}`);
  }

  console.log(`\n  URL validation complete: ${validCount}/${total} valid, ${invalidCount} invalid`);
  return { validCount, invalidCount, total };
}

// ---------------------------------------------------------------------------
// Main scraping orchestrator
// ---------------------------------------------------------------------------

async function scrapeAllJobs() {
  const allJobs = [];
  const orgsSeen = new Set();

  // --- Greenhouse ---
  console.log('\n--- Greenhouse API ---');
  for (const company of GREENHOUSE_COMPANIES) {
    process.stdout.write(`  Scraping ${company.name} (Greenhouse)...`);
    const jobs = await scrapeGreenhouse(company);
    console.log(` ${jobs.length} jobs found`);
    allJobs.push(...jobs);
    orgsSeen.add(company.name);
    await delay(REQUEST_DELAY_MS);
  }

  // --- Lever ---
  console.log('\n--- Lever API ---');
  for (const company of LEVER_COMPANIES) {
    process.stdout.write(`  Scraping ${company.name} (Lever)...`);
    const jobs = await scrapeLever(company);
    console.log(` ${jobs.length} jobs found`);
    allJobs.push(...jobs);
    orgsSeen.add(company.name);
    await delay(REQUEST_DELAY_MS);
  }

  // --- Manual check organizations ---
  console.log('\n--- Career pages (manual check) ---');
  for (const org of MANUAL_CHECK_ORGS) {
    if (!orgsSeen.has(org.name)) {
      const entry = buildManualCheckEntry(org);
      allJobs.push(entry);
      orgsSeen.add(org.name);
      console.log(`  ${org.name}: career page stored for manual check`);
    }
  }

  return { allJobs, orgCount: orgsSeen.size };
}

// ---------------------------------------------------------------------------
// Score and finalize jobs
// ---------------------------------------------------------------------------

function scoreAndFinalize(allJobs) {
  // Score and classify each job
  allJobs.forEach(job => {
    if (!job.sector) job.sector = classifySector(job);
    job.score = calculateScore(job);
  });

  // Sort by score descending
  allJobs.sort((a, b) => b.score - a.score);

  // Assign IDs
  allJobs.forEach((job, idx) => {
    job.id = idx + 1;
  });

  return allJobs;
}

// ---------------------------------------------------------------------------
// Build organization list for the dashboard
// ---------------------------------------------------------------------------

function buildOrgList(jobs) {
  const orgsMap = new Map();

  // From scraped jobs
  jobs.forEach(job => {
    if (!orgsMap.has(job.company)) {
      orgsMap.set(job.company, {
        name: job.company,
        sector: job.sector || 'general',
        url: job.directJobUrl,
        jobCount: 0,
      });
    }
    if (!job.manualCheck) {
      orgsMap.get(job.company).jobCount++;
    }
  });

  // From manual check orgs (may already be in the map)
  MANUAL_CHECK_ORGS.forEach(org => {
    if (!orgsMap.has(org.name)) {
      orgsMap.set(org.name, {
        name: org.name,
        sector: org.sector || 'general',
        url: org.url,
        jobCount: 0,
      });
    } else {
      // Update URL to be the career page rather than a specific job
      const existing = orgsMap.get(org.name);
      existing.url = org.url;
      if (org.sector && org.sector !== 'general') existing.sector = org.sector;
    }
  });

  // From Greenhouse/Lever companies
  [...GREENHOUSE_COMPANIES, ...LEVER_COMPANIES].forEach(c => {
    if (!orgsMap.has(c.name)) {
      orgsMap.set(c.name, {
        name: c.name,
        sector: 'general',
        url: '#',
        jobCount: 0,
      });
    }
  });

  return Array.from(orgsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeJsString(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function generateDashboardHTML(jobs, orgs) {
  const realJobs = jobs.filter(j => !j.manualCheck);
  const topJobs = realJobs.slice(0, 50);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Build JOBS array for JS
  const jobsJsEntries = topJobs.map((j, idx) => {
    const salaryDisplay = j.salaryRange || 'Salary not listed';
    const reqs = (j.applicationRequirements || ['Resume (standard)']).map(r => `"${escapeJsString(r)}"`).join(',');
    return `{num:${idx + 1},id:${j.id},t:"${escapeJsString(j.title)}",c:"${escapeJsString(j.company)}",s:"${escapeJsString(salaryDisplay)}",l:"${escapeJsString(j.location)}",sec:"${j.sector}",sc:${j.score},d:"${j.datePosted || ''}",u:"${escapeJsString(j.directJobUrl)}",r:[${reqs}]}`;
  });

  // Build ORGS array for JS
  const orgsJsEntries = orgs.map(o => {
    return `{n:"${escapeJsString(o.name)}",s:"${o.sector}",u:"${escapeJsString(o.url)}"}`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ashrita's Work Command Center</title>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Host Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;background:#ffffff;color:#0f172a;line-height:1.6;font-size:16px;letter-spacing:0.3px}
header{background:#0066cc;color:#ffffff;padding:32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h1{font-size:32px;font-weight:700;margin-bottom:8px}
.subtitle{font-size:16px;opacity:0.95;font-weight:400}
.refresh{background:#f9fafb;border-bottom:1px solid #e2e8f0;padding:16px;font-size:14px;color:#64748b;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.tabs{display:flex;background:#ffffff;border-bottom:1px solid #e2e8f0;overflow-x:auto;position:sticky;top:0;z-index:100}
.tab{padding:16px;cursor:pointer;font-size:14px;font-weight:500;color:#64748b;border-bottom:3px solid transparent;white-space:nowrap;transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}
.tab:hover{color:#0066cc}
.tab.active{color:#0066cc;border-bottom-color:#0066cc;background:#f9fafb}
.content{display:none;padding:24px;max-width:1300px;margin:0 auto}
.content.active{display:block}
.card{background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:16px;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);box-shadow:0 1px 2px rgba(0,0,0,0.05)}
.card:hover{border-color:#0066cc;box-shadow:0 4px 6px rgba(0,0,0,0.07)}
.job-title{font-size:18px;font-weight:700;color:#0f172a}
.job-company{font-size:14px;color:#0066cc;font-weight:600;margin-top:4px}
.job-meta{font-size:14px;color:#64748b;margin-top:8px;display:flex;flex-wrap:wrap;gap:12px}
.badge{display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;margin-right:4px}
.badge-score{background:#0066cc;color:#ffffff}
.badge-salary{background:#f3f4f6;color:#0f172a;border:1px solid #e2e8f0}
.badge-tag{background:#f3f4f6;color:#0f172a;border:1px solid #e2e8f0}
.badge-new{background:#059669;color:#ffffff}
.badge-source{background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd}
.job-reqs{font-size:14px;color:#0f172a;margin:12px 0;padding:12px;background:#f9fafb;border-radius:6px;border-left:3px solid #0066cc;line-height:1.8}
.job-actions{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.thumb{display:inline-block;width:36px;height:36px;border:1.5px solid #e2e8f0;border-radius:6px;text-align:center;line-height:36px;cursor:pointer;font-size:16px;transition:all 0.3s;background:#ffffff}
.thumb:hover{border-color:#0066cc;background:#f9fafb;transform:scale(1.05)}
.btn{display:inline-block;padding:10px 16px;background:#0066cc;color:#ffffff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.3s;font-family:'Host Grotesk',sans-serif;text-decoration:none}
.btn:hover{background:#0052a3;box-shadow:0 4px 6px rgba(0,102,204,0.1)}
.btn-secondary{background:#ffffff;border:1px solid #e2e8f0;color:#0066cc}
.btn-secondary:hover{background:#f9fafb;border-color:#0066cc}
.btn-sm{padding:8px 12px;font-size:13px}
.filters{background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;border:1px solid #e2e8f0}
.filter{display:flex;flex-direction:column;gap:6px}
.filter label{font-size:12px;text-transform:uppercase;color:#0f172a;font-weight:600}
.filter select,.filter input{padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;background:#ffffff;color:#0f172a;font-family:inherit;transition:all 0.3s}
.filter select:focus,.filter input:focus{outline:none;border-color:#0066cc;box-shadow:0 0 0 3px rgba(0,102,204,0.1)}
.sort{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.sort-btn{padding:8px 14px;border-radius:6px;border:1px solid #e2e8f0;background:#ffffff;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.3s;color:#0f172a;font-family:inherit}
.sort-btn:hover{border-color:#0066cc;color:#0066cc}
.sort-btn.active{background:#0066cc;color:#ffffff;border-color:#0066cc}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-box{background:#ffffff;border-radius:8px;padding:24px;width:90%;max-width:450px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 25px rgba(0,0,0,0.15)}
.modal-close{position:absolute;top:16px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;transition:all 0.3s}
.modal-close:hover{color:#0f172a}
.modal h3{color:#0f172a;margin-bottom:12px;font-size:18px;font-weight:700}
.form-group{margin-bottom:16px}
.form-group label{display:block;margin-bottom:6px;color:#0f172a;font-weight:600;font-size:14px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:14px;color:#0f172a;transition:all 0.3s}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{outline:none;border-color:#0066cc;box-shadow:0 0 0 3px rgba(0,102,204,0.1)}
.form-group textarea{min-height:80px;resize:vertical}
.toast{position:fixed;bottom:24px;right:24px;background:#0f172a;color:#ffffff;padding:14px 20px;border-radius:6px;font-size:14px;z-index:1001;animation:slideIn 0.3s;box-shadow:0 10px 15px rgba(0,0,0,0.1)}
@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}
.app-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;transition:all 0.3s}
.app-card:hover{border-color:#0066cc;box-shadow:0 4px 6px rgba(0,0,0,0.07)}
.app-title{font-weight:700;color:#0f172a;font-size:15px}
.app-meta{font-size:13px;color:#64748b;margin-top:4px}
.status-pill{display:inline-block;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;background:#f3f4f6;color:#0f172a;transition:all 0.3s;border:1px solid #e2e8f0}
.status-pill.applied{background:#dbeafe;color:#0c4a6e;border-color:#0066cc}
.status-pill.interview{background:#dcfce7;color:#166534;border-color:#059669}
.status-pill.rejected{background:#fee2e2;color:#7f1d1d;border-color:#dc2626}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
.stat{background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:20px;text-align:center;transition:all 0.3s}
.stat:hover{border-color:#0066cc;background:#ffffff}
.stat-val{font-size:28px;font-weight:700;color:#0066cc}
.stat-label{font-size:12px;text-transform:uppercase;color:#94a3b8;margin-top:8px}
.table{width:100%;border-collapse:collapse;background:#ffffff;border-radius:8px;overflow:hidden;font-size:14px;border:1px solid #e2e8f0}
th{background:#f3f4f6;color:#0f172a;padding:14px;text-align:left;font-weight:700;border-bottom:1px solid #e2e8f0}
td{padding:14px;border-bottom:1px solid #e2e8f0;color:#0f172a}
tr:hover{background:#f9fafb}
a{color:#0066cc;text-decoration:none;font-weight:500;transition:all 0.3s}
a:hover{color:#0052a3;text-decoration:underline}
.tag{display:inline-block;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;margin:4px;background:#f3f4f6;color:#0f172a;border:1px solid #e2e8f0}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:14px}
.gen-output{background:#f9fafb;border-left:3px solid #0066cc;padding:16px;border-radius:6px;margin-top:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;font-family:monospace;color:#0f172a;max-height:300px;overflow-y:auto}
.copy-btn{background:#0066cc;color:#ffffff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer;margin-top:10px;font-weight:600;transition:all 0.3s;font-family:inherit}
.copy-btn:hover{background:#0052a3}
.url-invalid{opacity:0.6;border-left:3px solid #dc2626}
@media(max-width:768px){.stats{grid-template-columns:repeat(2,1fr)}.filters{flex-direction:column}.filter{width:100%}.table{font-size:12px}th,td{padding:10px}}
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:#f1f5f9}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:#94a3b8}
</style>
</head>
<body>

<header>
  <h1>Work Command Center</h1>
  <p class="subtitle">Ashrita Shetty &mdash; Urban Strategist & Design Researcher<br><small style="font-size:12px;opacity:0.8">${realJobs.length} Verified Job Opportunities from ${orgs.length} Organizations</small></p>
</header>

<div class="refresh">
  <span id="lastRefresh">Last Refreshed: ${dateStr}</span>
  <button class="btn btn-sm" onclick="refreshDashboard()" id="refreshBtn">Refresh</button>
  <span style="color:#e2e8f0">&bull;</span>
  <span id="totalJobs" style="color:#0066cc;font-weight:600">${topJobs.length} jobs loaded</span>
  <span style="color:#e2e8f0">&bull;</span>
  <span id="totalOrgs" style="color:#0066cc;font-weight:600">${orgs.length} organizations</span>
</div>

<div class="tabs">
  <div class="tab active" onclick="showTab(0)">Top 50 Jobs</div>
  <div class="tab" onclick="showTab(1)">Org Tracker (${orgs.length})</div>
  <div class="tab" onclick="showTab(2)">My Applications</div>
  <div class="tab" onclick="showTab(3)">AI Generator</div>
  <div class="tab" onclick="showTab(4)">Your Profile</div>
</div>

<div class="content active" id="tab0">
  <div class="sort">
    <span style="font-size:13px;font-weight:600;color:#0f172a;text-transform:uppercase">Sort:</span>
    <button class="sort-btn active" onclick="sortJobs('score')">Match Score</button>
    <button class="sort-btn" onclick="sortJobs('date')">Posted</button>
    <button class="sort-btn" onclick="sortJobs('salary')">Salary</button>
  </div>
  <div class="filters">
    <div class="filter">
      <label>Sector</label>
      <select id="filterSector" onchange="renderJobs()">
        <option value="">All</option>
        <option value="government">Government</option>
        <option value="policy">Policy</option>
        <option value="nonprofit">Nonprofit</option>
        <option value="consulting">Consulting</option>
        <option value="climate">Climate</option>
        <option value="urban">Urban Strategy</option>
        <option value="design">Design</option>
      </select>
    </div>
    <div class="filter">
      <label>Salary</label>
      <select id="filterSalary" onchange="renderJobs()">
        <option value="0">Any</option>
        <option value="90000">$90K+</option>
        <option value="120000">$120K+</option>
        <option value="140000">$140K+</option>
        <option value="160000">$160K+</option>
      </select>
    </div>
    <div class="filter">
      <label>Source</label>
      <select id="filterSource" onchange="renderJobs()">
        <option value="">All</option>
        <option value="greenhouse">Greenhouse</option>
        <option value="lever">Lever</option>
      </select>
    </div>
    <div class="filter">
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="filterLiked" onchange="renderJobs()" style="width:auto;margin:0"> Liked only</label>
    </div>
  </div>
  <div id="jobsList"></div>
</div>

<div class="content" id="tab1">
  <div style="margin-bottom:16px">
    <button class="btn" onclick="showModal('addJobModal')">+ Add Job</button>
    <button class="btn btn-secondary" style="margin-left:8px" onclick="exportCSV()">Export CSV</button>
  </div>
  <div style="overflow-x:auto">
    <table class="table">
      <thead>
        <tr>
          <th>Organization</th>
          <th>Sector</th>
          <th>Status</th>
          <th>Matching Roles</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody id="orgsList"></tbody>
    </table>
  </div>
</div>

<div class="content" id="tab2">
  <p style="font-size:13px;color:#94a3b8;margin-bottom:16px">Track applications you've submitted.</p>
  <div id="appsList"></div>
</div>

<div class="content" id="tab3">
  <div class="card">
    <h3 style="color:#0066cc;font-size:16px;font-weight:700;margin-bottom:8px">Resume Bullets & Cover Letter</h3>
    <p style="font-size:13px;color:#94a3b8;margin-bottom:12px">Adapts your existing content to each job.</p>
    <div style="background:#f9fafb;border-radius:6px;padding:12px;margin-bottom:12px;font-size:13px;color:#0f172a;border-left:3px solid #0066cc">
      <strong>Select a job from Tab 0</strong> and use [Generate] button to pre-fill, or fill manually.
    </div>
    <div class="form-group">
      <label>Job Title</label>
      <input type="text" id="genTitle" placeholder="e.g. Director of Strategy">
    </div>
    <div class="form-group">
      <label>Company</label>
      <input type="text" id="genCompany" placeholder="e.g. NYC Mayor's Office">
    </div>
    <div class="form-group">
      <label>Job Description</label>
      <textarea id="genDesc" placeholder="Paste job description..."></textarea>
    </div>
    <button class="btn" onclick="genBullets()">Generate Resume Bullets</button>
    <button class="btn btn-secondary" style="margin-left:8px" onclick="genLetter()">Generate Cover Letter</button>
    <div id="genOutput"></div>
  </div>
</div>

<div class="content" id="tab4">
  <div class="card">
    <h3 style="color:#0066cc;font-size:18px;font-weight:700;margin-bottom:16px">Your Profile</h3>
    <div class="stats">
      <div class="stat">
        <div class="stat-val">7+</div>
        <div class="stat-label">Years Experience</div>
      </div>
      <div class="stat">
        <div class="stat-val">${orgs.length}</div>
        <div class="stat-label">Organizations</div>
      </div>
      <div class="stat">
        <div class="stat-val">$120K+</div>
        <div class="stat-label">Target Salary</div>
      </div>
      <div class="stat">
        <div class="stat-val">NYC</div>
        <div class="stat-label">Location</div>
      </div>
    </div>
    <h4 style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px">Core Competencies</h4>
    <div style="margin-bottom:16px">
      <span class="tag">Urban Strategy</span>
      <span class="tag">Policy Research</span>
      <span class="tag">Stakeholder Engagement</span>
      <span class="tag">Design Thinking</span>
      <span class="tag">Project Management</span>
      <span class="tag">Climate Solutions</span>
      <span class="tag">Data Analysis</span>
    </div>
    <h4 style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px">Target Sectors</h4>
    <div style="margin-bottom:16px">
      <span class="tag">Government</span>
      <span class="tag">Policy</span>
      <span class="tag">Nonprofit</span>
      <span class="tag">Climate Tech</span>
      <span class="tag">Urban Design</span>
    </div>
    <h4 style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:10px">Education</h4>
    <div style="font-size:14px;color:#64748b;line-height:1.8">
      <div style="margin-bottom:10px"><strong style="color:#0f172a">Master of Science</strong> in Urban Planning, Columbia University</div>
      <div><strong style="color:#0f172a">Bachelor of Arts</strong> in Design & Environmental Studies, NYU</div>
    </div>
  </div>
</div>

<div id="jobAIModal" class="modal">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('jobAIModal')">&times;</button>
    <h3>AI Resume & Cover Letter Assistant</h3>
    <div class="form-group">
      <label>Job Title</label>
      <input type="text" id="aiTitle" readonly>
    </div>
    <div class="form-group">
      <label>Company</label>
      <input type="text" id="aiCompany" readonly>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn" onclick="genJobBullets()">Generate Resume Bullets</button>
      <button class="btn" onclick="genJobLetter()">Generate Cover Letter</button>
    </div>
    <div id="aiOutput"></div>
  </div>
</div>

<div id="removeJobModal" class="modal">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('removeJobModal')">&times;</button>
    <h3>Remove Job</h3>
    <p style="font-size:13px;color:#64748b;margin-bottom:12px">Why don't you want to see this job?</p>
    <div class="form-group">
      <textarea id="removeReason" placeholder="e.g., Not interested in corporate roles, requires relocation, etc." style="min-height:80px"></textarea>
    </div>
    <button class="btn" style="width:100%" onclick="confirmRemoveJob()">Remove Job</button>
  </div>
</div>

<div id="addJobModal" class="modal">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('addJobModal')">&times;</button>
    <h3>Add Application</h3>
    <div class="form-group">
      <label>Company & Position</label>
      <input type="text" id="appCompany" placeholder="e.g. NYC Mayor's Office - Senior Advisor">
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="appStatus">
        <option value="applied">Applied</option>
        <option value="interview">Interview</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <div class="form-group">
      <label>Date</label>
      <input type="date" id="appDate">
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="appNotes" placeholder="Contact info, interview dates, etc."></textarea>
    </div>
    <button class="btn" style="width:100%" onclick="saveApp()">Save Application</button>
  </div>
</div>

<div id="orgStatusModal" class="modal">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('orgStatusModal')">&times;</button>
    <h3 id="orgStatusTitle">Organization Status</h3>
    <div class="form-group">
      <label>Status</label>
      <select id="statusValue">
        <option value="">&mdash; Clear</option>
        <option value="applied">Applied</option>
        <option value="interview">Interview</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="statusNotes" placeholder="Contact info, dates, etc."></textarea>
    </div>
    <button class="btn" style="width:100%" onclick="saveStatus()">Save</button>
  </div>
</div>

<script>
var currentOrgName='',currentRemoveJobId='',currentSort='score';
var JOBS=[
${jobsJsEntries.join(',\n')}
];
var ORGS=[
${orgsJsEntries.join(',\n')}
];
function showTab(i){document.querySelectorAll('.content').forEach(function(c){c.classList.remove('active')});document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});document.getElementById('tab'+i).classList.add('active');document.querySelectorAll('.tab')[i].classList.add('active')}
function getRemovedJobs(){var r=localStorage.getItem('removed_jobs');return r?JSON.parse(r):[]}
function sortJobs(by){currentSort=by;document.querySelectorAll('.sort-btn').forEach(function(b){b.classList.remove('active')});event.target.classList.add('active');renderJobs()}
function renderJobs(){var removed=getRemovedJobs().map(function(x){return x.job_id});var sector=document.getElementById('filterSector').value;var salary=parseInt(document.getElementById('filterSalary').value||'0');var source=document.getElementById('filterSource')?document.getElementById('filterSource').value:'';var liked=document.getElementById('filterLiked').checked;var jobs=JOBS.filter(function(j){return !removed.includes(j.id)});if(sector)jobs=jobs.filter(function(j){return j.sec===sector});if(salary)jobs=jobs.filter(function(j){var m=j.s.match(/\\d[\\d,]*/);return m&&parseInt(m[0].replace(/,/g,''))>=salary});if(liked){var ratings=JSON.parse(localStorage.getItem('ratings')||'{}');jobs=jobs.filter(function(j){return ratings[j.id]==='up'})}if(currentSort==='date')jobs.sort(function(a,b){return new Date(b.d)-new Date(a.d)});else if(currentSort==='salary')jobs.sort(function(a,b){var ma=a.s.match(/\\d[\\d,]*/),mb=b.s.match(/\\d[\\d,]*/);return(mb?parseInt(mb[0].replace(/,/g,'')):0)-(ma?parseInt(ma[0].replace(/,/g,'')):0)});else jobs.sort(function(a,b){return b.sc-a.sc});document.getElementById('totalJobs').textContent=jobs.length+' jobs loaded';var html='';jobs.forEach(function(j,idx){var isNew=new Date()-new Date(j.d)<604800000;var reqsHtml=j.r.map(function(x){return '&#10003; '+x}).join('<br>');var jobNum=idx+1;var aiCall='showJobAIModal('+j.id+',"'+j.t.replace(/"/g,'&quot;')+'","'+j.c.replace(/"/g,'&quot;')+'")';html+='<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="display:inline-block;background:#0066cc;color:#ffffff;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-weight:700;font-size:12px">'+jobNum+'</span><span style="font-size:11px;text-transform:uppercase;color:#94a3b8;font-weight:600">Job #'+jobNum+'</span></div><div class="job-header"><div><div class="job-title">'+j.t+'</div><div class="job-company">'+j.c+'</div><div class="job-meta"><span class="badge badge-score">'+j.sc+'</span><span class="badge badge-salary">'+j.s+'</span><span class="badge badge-tag">'+j.l+'</span><span class="badge badge-tag">'+j.sec+'</span>'+(isNew?'<span class="badge badge-new">[NEW]</span>':'')+'</div></div><div style="display:flex;gap:6px;margin-top:10px"><span class="thumb" onclick="rateJob('+j.id+',\\'up\\')" title="Like">&#128077;</span><span class="thumb" onclick="showRemoveModal('+j.id+')" title="Remove">&#128078;</span></div></div><div class="job-actions"><a href="'+j.u+'" target="_blank" class="btn btn-sm">View Job &rarr;</a><button class="btn btn-sm" onclick="'+aiCall+'" style="background:#667eea">AI Assist</button></div><div class="job-reqs"><strong>Application Requirements:</strong><br>'+reqsHtml+'</div></div>'});document.getElementById('jobsList').innerHTML=html||'<div class="empty">No jobs match your filters.</div>'}
function showJobAIModal(id,title,company){document.getElementById('aiTitle').value=title;document.getElementById('aiCompany').value=company;document.getElementById('aiOutput').innerHTML='';showModal('jobAIModal')}
function genJobBullets(){var title=document.getElementById('aiTitle').value;if(!title){showToast('Job title required');return}var bullets='For this '+title+' role, tailor your resume to highlight:\\n- Strategic vision and measurable impact\\n- Leadership across teams and disciplines\\n- Direct experience in '+title.split(' ').slice(0,2).join(' ')+'\\n- Proven track record of [specific achievement]\\n\\nCustomize these bullets with your actual accomplishments and quantifiable results.';document.getElementById('aiOutput').innerHTML='<div class="gen-output"><strong>Resume Bullet Points:</strong><br>'+bullets.replace(/\\n/g,'<br>')+'</div><button class="copy-btn" onclick="copyText(\\'aiOutput\\')">Copy All</button>'}
function genJobLetter(){var title=document.getElementById('aiTitle').value;var company=document.getElementById('aiCompany').value;if(!title||!company){showToast('Job title and company required');return}var letter='Dear Hiring Manager,\\n\\nI am excited to apply for the '+title+' position at '+company+'. With my 7+ years of experience in urban strategy, policy research, and cross-sector collaboration, I bring both strategic vision and operational expertise to complex challenges.\\n\\nMy background has equipped me to understand the interconnected nature of this work. I am particularly drawn to '+company+"\\'s approach to [specific initiative], and I am confident I can contribute meaningfully to your mission.\\n\\nI would welcome the opportunity to discuss how my experience aligns with your needs.\\n\\nSincerely,\\nAshrita";document.getElementById('aiOutput').innerHTML='<div class="gen-output"><strong>Cover Letter:</strong><br>'+letter.replace(/\\n/g,'<br>')+'</div><button class="copy-btn" onclick="copyText(\\'aiOutput\\')">Copy All</button>'}
function showRemoveModal(id){currentRemoveJobId=id;document.getElementById('removeReason').value='';showModal('removeJobModal')}
function confirmRemoveJob(){var reason=document.getElementById('removeReason').value;var removed=getRemovedJobs();removed.push({job_id:currentRemoveJobId,reason:reason,timestamp:new Date().toISOString().split('T')[0]});localStorage.setItem('removed_jobs',JSON.stringify(removed));showToast('Job removed.');closeModal('removeJobModal');renderJobs()}
function rateJob(id,type){var ratings=JSON.parse(localStorage.getItem('ratings')||'{}');ratings[id]=type;localStorage.setItem('ratings',JSON.stringify(ratings));renderJobs()}
function renderOrgs(){var html='';ORGS.forEach(function(o){var matching=JOBS.filter(function(j){return j.c===o.n});var status=JSON.parse(localStorage.getItem('orgStatus')||'{}')[o.n]||'';var statusClass=status?'status-pill '+status:'status-pill';var rolesHtml=matching.length>0?'<span style="color:#0066cc;cursor:pointer" onclick="showRoles(\\''+o.n.replace(/'/g,"\\\\'")+'\\')">'+matching.length+' matching</span>':'No matching roles';html+='<tr><td><a href="'+o.u+'" target="_blank">'+o.n+'</a></td><td>'+o.s+'</td><td><span class="'+statusClass+'" onclick="showOrgStatus(\\''+o.n.replace(/'/g,"\\\\'")+'\\')>" style="cursor:pointer">'+(status||'&mdash;')+'</span></td><td>'+rolesHtml+'</td><td style="font-size:12px">'+((JSON.parse(localStorage.getItem('orgStatus')||'{}')[o.n])?new Date().toLocaleDateString():'&mdash;')+'</td></tr>'});document.getElementById('orgsList').innerHTML=html}
function showRoles(org){var roles=JOBS.filter(function(j){return j.c===org});var html='Matching Roles:\\n';roles.forEach(function(r){html+=r.t+' ('+r.c+')\\n'});alert(html)}
function showOrgStatus(org){currentOrgName=org;var status=JSON.parse(localStorage.getItem('orgStatus')||'{}')[org]||'';document.getElementById('orgStatusTitle').textContent='Status: '+org;document.getElementById('statusValue').value=status;document.getElementById('statusNotes').value='';showModal('orgStatusModal')}
function saveStatus(){var status=document.getElementById('statusValue').value;var orgStatus=JSON.parse(localStorage.getItem('orgStatus')||'{}');if(status)orgStatus[currentOrgName]=status;else delete orgStatus[currentOrgName];localStorage.setItem('orgStatus',JSON.stringify(orgStatus));closeModal('orgStatusModal');renderOrgs();showToast('Status updated')}
function renderApps(){var apps=JSON.parse(localStorage.getItem('applications')||'[]');var html='';if(apps.length===0)html='<div class="empty">No applications tracked yet. Add one using the form above.</div>';else apps.forEach(function(a){html+='<div class="app-card"><div class="app-title">'+a.company+'</div><div class="app-meta">Status: <span class="status-pill '+a.status+'">'+a.status+'</span></div><div class="app-meta">Date: '+a.date+'</div><div class="app-meta">Notes: '+a.notes+'</div></div>'});document.getElementById('appsList').innerHTML=html}
function saveApp(){var apps=JSON.parse(localStorage.getItem('applications')||'[]');apps.push({company:document.getElementById('appCompany').value,status:document.getElementById('appStatus').value,date:document.getElementById('appDate').value,notes:document.getElementById('appNotes').value});localStorage.setItem('applications',JSON.stringify(apps));closeModal('addJobModal');renderApps();showToast('Application saved')}
function genBullets(){var title=document.getElementById('genTitle').value;var desc=document.getElementById('genDesc').value;if(!title||!desc){showToast('Fill in job title and description');return}var bullets='Your resume should highlight:\\n- Strategic impact and measurable outcomes\\n- Cross-functional leadership and collaboration\\n- Problem-solving aligned with this role\\n- Relevant experience in '+title+'\\n\\nAdapt your existing bullet points to emphasize these elements.';document.getElementById('genOutput').innerHTML='<div class="gen-output">'+bullets.replace(/\\n/g,'<br>')+'</div><button class="copy-btn" onclick="copyText(\\'genOutput\\')">Copy</button>'}
function genLetter(){var company=document.getElementById('genCompany').value;var title=document.getElementById('genTitle').value;if(!company||!title){showToast('Fill in company and job title');return}var letter='Dear Hiring Manager,\\n\\nI am writing to express my strong interest in the '+title+' position at '+company+'. With my background in urban strategy, policy research, and cross-sector collaboration, I am confident I can contribute meaningfully to your team.\\n\\nMy experience has prepared me to understand both the strategic and operational dimensions of this work, and I am excited about the opportunity to apply my skills to [specific impact area].\\n\\nThank you for considering my application. I look forward to discussing how I can contribute to '+company+"\\'s mission.";document.getElementById('genOutput').innerHTML='<div class="gen-output">'+letter.replace(/\\n/g,'<br>')+'</div><button class="copy-btn" onclick="copyText(\\'genOutput\\')">Copy</button>'}
function copyText(id){var text=document.getElementById(id).textContent;navigator.clipboard.writeText(text);showToast('Copied!')}
function exportCSV(){var orgs=JSON.parse(localStorage.getItem('orgStatus')||'{}');var csv='Organization,Sector,Status,Date\\n';ORGS.forEach(function(o){if(orgs[o.n])csv+=o.n+','+o.s+','+orgs[o.n]+','+new Date().toLocaleDateString()+'\\n'});var blob=new Blob([csv],{type:'text/csv'});var url=window.URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='org-tracker-'+new Date().toISOString().split('T')[0]+'.csv';a.click()}
function showModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function showToast(msg){var toast=document.createElement('div');toast.className='toast';toast.textContent=msg;document.body.appendChild(toast);setTimeout(function(){toast.remove()},3000)}
function refreshDashboard(){var btn=document.getElementById('refreshBtn');btn.textContent='Scraping...';btn.disabled=true;showToast('Run: node build-dashboard.js to refresh data');setTimeout(function(){btn.textContent='Refresh';btn.disabled=false},3000)}
function init(){renderJobs();renderOrgs();renderApps();document.getElementById('totalOrgs').textContent=ORGS.length+' organizations'}
document.addEventListener('DOMContentLoaded',init);
</script>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();

  console.log('==========================================================');
  console.log('  Work Command Center - Job Scraper & Dashboard Builder');
  console.log('==========================================================');
  console.log(`  Started: ${new Date().toLocaleString()}`);
  console.log('');

  // Step 1: Scrape all jobs
  console.log('[1/4] Scraping jobs from public APIs and career pages...');
  const { allJobs, orgCount } = await scrapeAllJobs();

  const realJobs = allJobs.filter(j => !j.manualCheck);
  const manualJobs = allJobs.filter(j => j.manualCheck);
  console.log(`\n  API jobs found: ${realJobs.length}`);
  console.log(`  Manual check orgs: ${manualJobs.length}`);

  // Step 2: Validate URLs
  console.log('\n[2/4] Validating job URLs...');
  const validation = await validateUrlsBatch(allJobs);

  // Step 3: Score and finalize
  console.log('\n[3/4] Scoring and ranking jobs...');
  const finalJobs = scoreAndFinalize(allJobs);

  // Save JSON output
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    totalJobs: realJobs.length,
    totalOrgs: orgCount,
    manualCheckOrgs: manualJobs.length,
    urlValidation: validation,
    jobs: finalJobs.map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salaryRange: j.salaryRange,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      datePosted: j.datePosted,
      directJobUrl: j.directJobUrl,
      applicationRequirements: j.applicationRequirements,
      source: j.source,
      sector: j.sector,
      score: j.score,
      urlValid: j.urlValid !== undefined ? j.urlValid : null,
      manualCheck: j.manualCheck || false,
    })),
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonOutput, null, 2));
  console.log(`  Saved: ${OUTPUT_JSON}`);

  // Step 4: Generate dashboard HTML
  console.log('\n[4/4] Generating dashboard HTML...');
  const orgs = buildOrgList(finalJobs);
  const html = generateDashboardHTML(finalJobs, orgs);
  fs.writeFileSync(OUTPUT_HTML, html);
  console.log(`  Saved: ${OUTPUT_HTML}`);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const topScore = finalJobs.length > 0 ? finalJobs[0].score : 0;
  const topJob = finalJobs.length > 0 ? `${finalJobs[0].title} at ${finalJobs[0].company}` : 'N/A';

  console.log('\n==========================================================');
  console.log('  SUMMARY');
  console.log('==========================================================');
  console.log(`  Total: ${realJobs.length} jobs from ${orgCount} organizations`);
  console.log(`  Manual check: ${manualJobs.length} career pages`);
  console.log(`  URL validation: ${validation.validCount}/${validation.total} valid`);
  console.log(`  Top score: ${topScore} - ${topJob}`);
  console.log(`  Completed in ${elapsed}s`);
  console.log('==========================================================');
}

main().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
