#!/usr/bin/env node
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// Job board search URLs with built-in filtering
const JOB_BOARDS = [
  {
    name: 'LinkedIn - Urban Planning',
    url: 'https://www.linkedin.com/jobs/search/?keywords=urban%20planning&location=New%20York%2C%20United%20States&sortBy=DD',
  },
  {
    name: 'LinkedIn - Urban Designer',
    url: 'https://www.linkedin.com/jobs/search/?keywords=urban%20designer&location=Remote&sortBy=DD',
  },
  {
    name: 'LinkedIn - Climate Researcher',
    url: 'https://www.linkedin.com/jobs/search/?keywords=climate%20research&location=Remote&sortBy=DD',
  },
  {
    name: 'Indeed - Urban Planning',
    url: 'https://www.indeed.com/jobs?q=urban+planning&l=New+York',
  }
];

// Companies with dedicated job boards
const COMPANIES = [
  { name: 'Arup', url: 'https://jobs.arup.com', selector: 'a[href*="/job"]' },
  { name: 'Stantec', url: 'https://www.stantec.com/en/careers', selector: 'a[href*="job"]' },
  { name: 'WSP', url: 'https://www.wsp.com/en-us/careers', selector: 'a[href*="career"]' },
  { name: 'Gensler', url: 'https://www.gensler.com/careers', selector: 'a' },
];

let browser;

async function initBrowser() {
  console.log('🚀 Starting browser with stealth mode...');
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  console.log('✓ Browser ready\n');
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchJobBoard(board) {
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    page.setDefaultNavigationTimeout(30000);

    console.log(`   ${board.name}...`);
    await page.goto(board.url, { waitUntil: 'networkidle2', timeout: 25000 });

    // Random delay to avoid detection
    await delay(2000 + Math.random() * 3000);

    // Extract job listings
    const jobs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .filter(link => {
          const text = link.textContent.toLowerCase();
          const href = link.href;
          const keywords = ['urban', 'planner', 'designer', 'climate', 'sustainability', 'policy', 'research', 'design'];
          return keywords.some(k => text.includes(k)) && (href.includes('job') || href.includes('/jobs'));
        })
        .slice(0, 12)
        .map(link => ({
          title: link.textContent.trim(),
          url: link.href,
          source: 'job_board'
        }))
        .filter(j => j.title.length > 10 && j.title.length < 200);
    });

    await page.close();
    return jobs;
  } catch (err) {
    console.log(`   ⚠️  Failed: ${err.message}`);
    try {
      await page.close().catch(() => {});
    } catch (e) {}
    return [];
  }
}

async function searchCompanyJobs(company) {
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    page.setDefaultNavigationTimeout(25000);

    console.log(`   ${company.name}...`);
    await page.goto(company.url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Random delay
    await delay(1500 + Math.random() * 2500);

    // Wait for job listings
    await page.waitForSelector('a', { timeout: 5000 }).catch(() => {});

    // Extract job links
    const jobs = await page.evaluate((companyName, selector) => {
      const links = Array.from(document.querySelectorAll(selector || 'a'));
      return links
        .filter(link => {
          const text = link.textContent.toLowerCase();
          const keywords = ['designer', 'planner', 'researcher', 'analyst', 'manager', 'strategist', 'climate', 'urban', 'sustainability', 'design'];
          return keywords.some(k => text.includes(k)) && link.href && (link.href.includes('job') || link.href.includes('career'));
        })
        .slice(0, 15)
        .map(link => ({
          title: link.textContent.trim(),
          url: link.href,
          company: companyName,
          source: 'company'
        }))
        .filter(j => j.title.length > 10 && j.title.length < 200);
    }, company.name, company.selector);

    await page.close();
    return jobs;
  } catch (err) {
    console.log(`   ⚠️  ${company.name}: ${err.message.slice(0, 40)}`);
    try {
      await page.close().catch(() => {});
    } catch (e) {}
    return [];
  }
}

async function discoverJobs() {
  console.log('\n🚀 JOB DISCOVERY WITH PUPPETEER + STEALTH');
  console.log('=========================================\n');

  await initBrowser();

  const allJobs = [];

  try {
    // Search job boards
    console.log('📍 Searching job boards (LinkedIn, Indeed)...');
    for (const board of JOB_BOARDS) {
      const jobs = await searchJobBoard(board);
      allJobs.push(...jobs);
      await delay(1000);
    }

    // Search company career pages
    console.log('\n📍 Searching company career pages...');
    for (const company of COMPANIES) {
      const jobs = await searchCompanyJobs(company);
      allJobs.push(...jobs);
      await delay(1000);
    }

  } finally {
    await closeBrowser();
  }

  // Deduplicate by URL and filter
  const uniqueJobs = Array.from(
    new Map(allJobs.map(j => [j.url, j])).values()
  ).filter(j => j.title && j.url && j.url.length < 500);

  console.log(`\n✅ Discovery complete!`);
  console.log(`   Total opportunities found: ${uniqueJobs.length}`);

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    total_found: uniqueJobs.length,
    jobs: uniqueJobs.map((j, idx) => ({
      id: 200 + idx,
      title: j.title,
      company: j.company || 'Unknown',
      url: j.url,
      source: j.source,
      discovered: true
    }))
  };

  fs.writeFileSync('discovered-jobs.json', JSON.stringify(results, null, 2));
  console.log(`📝 Results saved to: discovered-jobs.json`);
  console.log('\nNext steps:');
  console.log('1. Review discovered-jobs.json');
  console.log('2. Run: node add-discovered-jobs.js');
  console.log('3. Dashboard will show new opportunities\n');
}

discoverJobs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
