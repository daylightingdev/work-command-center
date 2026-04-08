#!/usr/bin/env node
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Vercel serverless function handler
module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/refresh' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    console.log('\n🔄 Refresh triggered from dashboard...');
    refreshDashboard(res);
  } else if (req.url === '/api/status' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    getStatus(res);
  } else if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html');
    const html = fs.readFileSync('index.html', 'utf8');
    res.writeHead(200);
    res.end(html);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
};

// Create server for local development
const server = http.createServer((req, res) => {
  module.exports(req, res);
});

function refreshDashboard(res) {
  console.log('🚀 Starting job discovery with Puppeteer...');

  let discoveryOutput = '';
  const discovery = spawn('node', ['job-discovery-puppeteer.js']);

  discovery.stdout.on('data', (data) => {
    discoveryOutput += data.toString();
    console.log(data.toString());
  });

  discovery.stderr.on('data', (data) => {
    discoveryOutput += data.toString();
    console.log(data.toString());
  });

  discovery.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Discovery failed');
      res.writeHead(500);
      res.end(JSON.stringify({
        status: 'error',
        message: 'Job discovery failed',
        output: discoveryOutput
      }));
      return;
    }

    console.log('✅ Discovery completed, adding new jobs...');

    // Run add-discovered-jobs to validate and add
    let addOutput = '';
    const adder = spawn('node', ['add-discovered-jobs.js']);

    adder.stdout.on('data', (data) => {
      addOutput += data.toString();
      console.log(data.toString());
    });

    adder.stderr.on('data', (data) => {
      console.log(data.toString());
    });

    adder.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Failed to add jobs');
        res.writeHead(500);
        res.end(JSON.stringify({
          status: 'error',
          message: 'Failed to add discovered jobs'
        }));
        return;
      }

      console.log('✅ Jobs added to dashboard!');

      try {
        // Get new job count
        const html = fs.readFileSync('index.html', 'utf8');
        const jobsMatch = html.match(/var JOBS=\[([\s\S]*?)\];/);
        const jobCount = (jobsMatch[0].match(/num:\d+/g) || []).length;

        const discovered = fs.existsSync('discovered-jobs.json')
          ? JSON.parse(fs.readFileSync('discovered-jobs.json', 'utf8'))
          : { total_found: 0 };

        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'success',
          message: 'Dashboard refreshed with new job opportunities',
          data: {
            timestamp: new Date().toISOString(),
            jobsDiscovered: discovered.total_found,
            totalJobsOnDashboard: jobCount,
            nextSteps: [
              'Review new jobs on dashboard',
              'git add index.html',
              'git commit -m "Auto-refresh: discovered new job opportunities"',
              'git push origin main'
            ]
          }
        }));
      } catch (err) {
        console.error('❌ Error reading results:', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({
          status: 'error',
          message: 'Dashboard updated but error reading results'
        }));
      }
    });
  });

  // Set a timeout in case discovery hangs
  setTimeout(() => {
    discovery.kill();
    res.writeHead(408);
    res.end(JSON.stringify({
      status: 'timeout',
      message: 'Discovery took too long (15+ minutes)'
    }));
  }, 900000); // 15 minute timeout
}

function getStatus(res) {
  try {
    const report = fs.existsSync('update-report.json')
      ? JSON.parse(fs.readFileSync('update-report.json', 'utf8'))
      : null;

    const results = fs.existsSync('scraper-results.json')
      ? JSON.parse(fs.readFileSync('scraper-results.json', 'utf8'))
      : null;

    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      server: 'Dashboard Automation Server',
      port: PORT,
      lastRefresh: report?.timestamp || 'Never',
      jobsStatus: results ? {
        valid: results.jobs.filter(j => j.status === 'valid').length,
        total: results.jobs.length
      } : null,
      orgsStatus: results ? {
        valid: results.organizations.filter(o => o.status === 'valid').length,
        total: results.organizations.length
      } : null,
      endpoints: {
        refresh: 'POST /api/refresh',
        status: 'GET /api/status'
      }
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({
      status: 'error',
      message: err.message
    }));
  }
}

server.listen(PORT, () => {
  console.log(`\n🚀 Dashboard Automation Server running on http://localhost:${PORT}`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   POST /api/refresh - Run scraper and update dashboard`);
  console.log(`   GET  /api/status  - Check server status\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Server stopped');
  process.exit(0);
});
