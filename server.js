#!/usr/bin/env node
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/refresh' && req.method === 'POST') {
    console.log('\n🔄 Refresh triggered from dashboard...');
    refreshDashboard(res);
  } else if (req.url === '/api/status' && req.method === 'GET') {
    getStatus(res);
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

function refreshDashboard(res) {
  console.log('🚀 Starting scraper...');

  let scraperOutput = '';
  const scraper = spawn('node', ['scraper.js']);

  scraper.stdout.on('data', (data) => {
    scraperOutput += data.toString();
  });

  scraper.stderr.on('data', (data) => {
    scraperOutput += data.toString();
  });

  scraper.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Scraper failed');
      res.writeHead(500);
      res.end(JSON.stringify({
        status: 'error',
        message: 'Scraper failed',
        output: scraperOutput
      }));
      return;
    }

    console.log('✅ Scraper completed, analyzing results...');

    // Run process-scraper-results
    let analysisOutput = '';
    const analyzer = spawn('node', ['process-scraper-results.js']);

    analyzer.stdout.on('data', (data) => {
      analysisOutput += data.toString();
    });

    analyzer.on('close', (code) => {
      console.log('✅ Results analyzed, updating dashboard...');

      // Run update-dashboard
      let updateOutput = '';
      const updater = spawn('node', ['update-dashboard.js']);

      updater.stdout.on('data', (data) => {
        updateOutput += data.toString();
      });

      updater.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Update failed');
          res.writeHead(500);
          res.end(JSON.stringify({
            status: 'error',
            message: 'Dashboard update failed'
          }));
          return;
        }

        // Read the update report
        try {
          const report = JSON.parse(fs.readFileSync('update-report.json', 'utf8'));
          const results = JSON.parse(fs.readFileSync('scraper-results.json', 'utf8'));

          console.log('✅ Dashboard updated successfully!');

          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'success',
            message: 'Dashboard refreshed and updated',
            data: {
              timestamp: report.timestamp,
              jobsVerified: report.updates.jobsWithRequirements,
              orgsFixed: report.updates.orgsWithFixedUrls,
              validJobs: report.updates.validJobs,
              validOrgs: report.updates.validOrgs,
              nextSteps: [
                'Review index.html changes',
                'git add index.html',
                'git commit -m "Auto-update: dashboard refresh"',
                'git push origin main'
              ]
            }
          }));
        } catch (err) {
          console.error('❌ Error reading report:', err.message);
          res.writeHead(500);
          res.end(JSON.stringify({
            status: 'error',
            message: 'Failed to read update report'
          }));
        }
      });
    });
  });

  // Set a timeout in case scraper hangs
  setTimeout(() => {
    scraper.kill();
    res.writeHead(408);
    res.end(JSON.stringify({
      status: 'timeout',
      message: 'Scraper took too long (10+ minutes)'
    }));
  }, 600000); // 10 minute timeout
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
