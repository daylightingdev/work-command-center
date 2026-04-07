#!/usr/bin/env node
const https = require('https');
const http = require('http');
const url = require('url');

// Job and org data from index.html
const JOBS = [
  {id:1,t:"VP, Policy and Advocacy",c:"Nonprofit New York",u:"https://www.idealist.org/en/nonprofit-job/1001"},
  {id:2,t:"Senior Advisor",c:"NYC Mayor's Office",u:"https://cityjobs.nyc.gov/job/12345"},
  {id:3,t:"Deputy Chief of Staff",c:"NYC Mayor's Office",u:"https://cityjobs.nyc.gov/job/12346"},
  {id:4,t:"VP Revenue Strategy",c:"Metropolitan Transportation Authority",u:"https://www.linkedin.com/jobs/view/4371310428"},
  {id:5,t:"Design Strategist – Data Analytics",c:"Gensler",u:"https://www.linkedin.com/jobs/view/4388232903"},
  {id:6,t:"Director of Organizing",c:"NYC Mayor's Office",u:"https://cityjobs.nyc.gov/job/12347"},
  {id:7,t:"AVP Operations Planning",c:"Metropolitan Transportation Authority",u:"https://www.linkedin.com/jobs/view/4368951257"},
  {id:8,t:"Senior Manager, Planning & Design",c:"Waterfront Alliance",u:"https://www.linkedin.com/jobs/view/4384056396"},
  {id:9,t:"Associate, Climate Strategy",c:"Buro Happold",u:"https://www.linkedin.com/jobs/view/4364961373"},
  {id:10,t:"Senior Policy Analyst",c:"NYC Dept of Transportation",u:"https://cityjobs.nyc.gov/job/12348"},
  {id:11,t:"VP, Programs & Capacity Building",c:"Nonprofit New York",u:"https://www.idealist.org/en/nonprofit-job/1002"},
  {id:12,t:"Policy Analyst",c:"NYC Dept of Social Services",u:"https://cityjobs.nyc.gov/job/12349"},
  {id:13,t:"Managing Director, Sustainable Finance",c:"Environmental Defense Fund",u:"https://www.linkedin.com/jobs/view/4383953988"},
  {id:14,t:"VP of Finance and Operations",c:"iMentor",u:"https://www.idealist.org/en/nonprofit-job/1003"},
  {id:15,t:"VP, External Relations",c:"Partnership To End Homelessness",u:"https://www.idealist.org/en/nonprofit-job/1004"},
  {id:16,t:"Senior Executive Director",c:"LISC",u:"https://www.idealist.org/en/nonprofit-job/1005"},
  {id:17,t:"Director of Supportive Housing",c:"NYC HRA",u:"https://cityjobs.nyc.gov/job/12350"},
  {id:18,t:"Consultant, Infrastructure Resilience",c:"WSP",u:"https://www.linkedin.com/jobs/view/4392034541"},
  {id:19,t:"Special Assistant & Research Analyst",c:"HR&A Advisors",u:"https://www.linkedin.com/jobs/view/4379148851"},
  {id:20,t:"Economic Development Fellow",c:"Bloomberg Philanthropies",u:"https://www.linkedin.com/jobs/view/4387481521"},
  {id:21,t:"Climate Finance & Policy Consultant",c:"GiveDirectly",u:"https://www.linkedin.com/jobs/view/4385605282"},
  {id:22,t:"Science & Planning Program Associate",c:"Open Space Institute",u:"https://www.linkedin.com/jobs/view/4390366073"},
  {id:23,t:"District Manager",c:"Brooklyn Community Board 7",u:"https://cityjobs.nyc.gov/job/12351"},
  {id:24,t:"Manager, Economic Consulting",c:"Hatch",u:"https://www.linkedin.com/jobs/view/4366015429"},
  {id:25,t:"Managing Director, Project Development",c:"WSP",u:"https://www.linkedin.com/jobs/view/4304467986"},
  {id:26,t:"Urban Designer & Planner – Transportation",c:"Stantec",u:"https://www.linkedin.com/jobs/view/4388251082"},
  {id:27,t:"Research Associate",c:"Social Science Research Council",u:"https://www.linkedin.com/jobs/view/4354015139"},
  {id:28,t:"Project Manager, Africa Initiative",c:"NRDC",u:"https://www.linkedin.com/jobs/view/4370724764"},
  {id:29,t:"Pursuit Manager, Community Development",c:"Stantec",u:"https://www.linkedin.com/jobs/view/4389395312"},
  {id:30,t:"Senior Sustainability Analyst",c:"Broadridge",u:"https://www.linkedin.com/jobs/view/4358338925"},
  {id:31,t:"Geographic Analyst",c:"City of New York",u:"https://cityjobs.nyc.gov/job/12352"},
  {id:32,t:"Senior Partner Success Manager",c:"Via",u:"https://job-boards.greenhouse.io/via/jobs/7562971002"},
  {id:33,t:"Strategy & Operations Lead",c:"Code for America",u:"https://codeforamerica.org/careers"},
  {id:34,t:"Research Manager",c:"Urban Institute",u:"https://www.urban.org/careers"},
  {id:35,t:"Policy Director",c:"Brookings Institution",u:"https://www.brookings.edu/careers"},
  {id:36,t:"Associate Director",c:"Regional Plan Association",u:"https://www.rpa.org/careers"},
  {id:37,t:"Senior Advisor, Climate & Communities",c:"NACTO",u:"https://nacto.org/careers"},
  {id:38,t:"Director of Partnerships",c:"Remix",u:"https://www.remix.com/careers"},
  {id:39,t:"Senior Product Manager",c:"Odyssey",u:"https://www.theodysseyapp.com/careers"},
  {id:40,t:"Strategy Consultant",c:"Project for Public Spaces",u:"https://www.pps.org/about/jobs"},
  {id:41,t:"Design Research Lead",c:"IDEO",u:"https://www.ideo.com/careers"},
  {id:42,t:"Senior Architect, Urban Design",c:"SOM",u:"https://www.som.com/careers"},
  {id:43,t:"Director of Strategy",c:"Gehl",u:"https://gehl.dk/about/careers"},
  {id:44,t:"Policy & Advocacy Manager",c:"80000hours.org",u:"https://jobs.80000hours.org/jobs/1234"},
  {id:45,t:"Director of Research",c:"ERA-Co",u:"https://www.era-co.com/careers"},
  {id:46,t:"Operations Manager",c:"The Nature Conservancy",u:"https://careers.nature.org"},
  {id:47,t:"Program Director",c:"Enterprise Community Partners",u:"https://www.enterprisecommunity.org/careers"},
  {id:48,t:"Senior Policy Fellow",c:"New America",u:"https://www.newamerica.org/careers"},
  {id:49,t:"Director of Programs",c:"NeighborWorks",u:"https://www.nw.org/careers"},
  {id:50,t:"Senior Strategist",c:"Center for American Progress",u:"https://www.americanprogress.org/careers"}
];

const ORGS = [
  {n:"Design Trust for Public Space",u:"https://designtrustnyc.org/careers"},
  {n:"Downtown Brooklyn Partnership",u:"https://downtownbrooklyn.com/about/jobs"},
  {n:"HKS Inc",u:"https://www.hksinc.com/careers"},
  {n:"Via",u:"https://www.ridewithvia.com/careers"},
  {n:"Replica",u:"https://replicahq.com/careers"},
  {n:"Nonprofit New York",u:"https://nonprofitnewyork.org/careers"},
  {n:"Metropolitan Transportation Authority",u:"https://new.mta.info/careers"},
  {n:"Gensler",u:"https://www.gensler.com/careers"},
  {n:"NYC Mayor's Office",u:"https://cityjobs.nyc.gov"},
  {n:"Buro Happold",u:"https://www.burohappold.com/careers"},
  {n:"Waterfront Alliance",u:"https://www.waterfront-alliance.org/careers"},
  {n:"HR&A Advisors",u:"https://www.hraadvisors.com/careers/"},
  {n:"NYC Dept of Transportation",u:"https://www.nyc.gov/site/dot/careers/careers.page"},
  {n:"NYC Dept of Social Services",u:"https://www1.nyc.gov/site/dss/careers/careers.html"},
  {n:"Environmental Defense Fund",u:"https://www.edf.org/careers"},
  {n:"iMentor",u:"https://imentor.org/careers"},
  {n:"Partnership To End Homelessness",u:"https://www.peh.org/careers"},
  {n:"LISC",u:"https://www.lisc.org/about-us/careers"},
  {n:"NYC HRA",u:"https://www1.nyc.gov/site/hra/careers/careers.html"},
  {n:"JLL",u:"https://careers.jll.com"},
  {n:"Cushman & Wakefield",u:"https://careers.cushmanwakefield.com"},
  {n:"CBRE",u:"https://careers.cbre.com"},
  {n:"WSP",u:"https://www.wsp.com/en-US/careers"},
  {n:"Bloomberg Philanthropies",u:"https://www.bloomberg.org/careers"},
  {n:"GiveDirectly",u:"https://www.givedirectly.org/careers"},
  {n:"Open Space Institute",u:"https://www.openspacesinstitute.org/careers"},
  {n:"Brooklyn Community Board 7",u:"https://www.nyc.gov/site/cau/community-boards/brooklyn.page"},
  {n:"Hatch",u:"https://www.wearehatch.com/careers"},
  {n:"Stantec",u:"https://www.stantec.com/en/careers"},
  {n:"Social Science Research Council",u:"https://www.ssrc.org/about/careers"},
  {n:"NRDC",u:"https://www.nrdc.org/careers"},
  {n:"Broadridge",u:"https://careers.broadridge.com"},
  {n:"City of New York",u:"https://www.nyc.gov/site/olr/careers/careers.page"},
  {n:"Urban Institute",u:"https://www.urban.org/careers"},
  {n:"Brookings Institution",u:"https://www.brookings.edu/careers"},
  {n:"Knight Foundation",u:"https://www.knightfoundation.org/careers"},
  {n:"Gates Foundation",u:"https://www.gatesfoundation.org/careers"},
  {n:"Mellon Foundation",u:"https://mellon.org/careers"},
  {n:"Regional Plan Association",u:"https://www.rpa.org/careers"},
  {n:"NACTO",u:"https://nacto.org/careers"},
  {n:"Code for America",u:"https://codeforamerica.org/careers"},
  {n:"Remix",u:"https://www.remix.com/careers"},
  {n:"Odyssey",u:"https://www.theodysseyapp.com/careers"},
  {n:"Gehl",u:"https://gehl.dk/about/careers"},
  {n:"Project for Public Spaces",u:"https://www.pps.org/about/jobs"},
  {n:"IDEO",u:"https://www.ideo.com/careers"},
  {n:"SOM",u:"https://www.som.com/careers"},
  {n:"NBBJ",u:"https://www.nbbj.com/careers"},
  {n:"Perkins & Will",u:"https://perkinswill.com/careers"},
  {n:"RMI",u:"https://www.rmi.org/careers"},
  {n:"The Nature Conservancy",u:"https://careers.nature.org"},
  {n:"80000hours.org",u:"https://jobs.80000hours.org"},
  {n:"ERA-Co",u:"https://www.era-co.com/careers"},
  {n:"Arc.dev",u:"https://arc.dev"},
  {n:"AngelList",u:"https://angel.co"},
  {n:"Glassdoor",u:"https://www.glassdoor.com"},
  {n:"Built.in",u:"https://builtin.com"},
  {n:"We Work Remotely",u:"https://weworkremotely.com"},
  {n:"Idealist",u:"https://www.idealist.org"},
  {n:"New York Jobs.com",u:"https://cityjobs.nyc.gov"},
  {n:"APA Job Board",u:"https://planning.org"},
  {n:"American Civil Liberties Union",u:"https://www.aclu.org/careers"},
  {n:"Planned Parenthood",u:"https://www.plannedparenthood.org/careers"},
  {n:"Sierra Club",u:"https://www.sierraclub.org/careers"},
  {n:"Conservation International",u:"https://www.conservation.org/careers"},
  {n:"The Wilderness Society",u:"https://www.wilderness.org/careers"},
  {n:"Trust for Public Land",u:"https://www.tpl.org/careers"},
  {n:"American Rivers",u:"https://www.americanrivers.org/careers"},
  {n:"Audubon Society",u:"https://www.audubon.org/careers"},
  {n:"World Wildlife Fund",u:"https://www.worldwildlife.org/careers"},
  {n:"The Climate Reality Project",u:"https://climaterealityproject.org/careers"},
  {n:"350.org",u:"https://350.org/careers"},
  {n:"Sunrise Movement",u:"https://www.sunrisemovement.org/careers"},
  {n:"Clean Air Task Force",u:"https://www.catf.us/careers"},
  {n:"Carbon Trust",u:"https://www.carbontrust.com/careers"},
  {n:"Carbon Disclosure Project",u:"https://www.cdp.net/careers"},
  {n:"Cities for Climate Protection",u:"https://icleiusa.org/careers"},
  {n:"Local Initiatives Support Corporation",u:"https://www.lisc.org/careers"},
  {n:"Enterprise Community Partners",u:"https://www.enterprisecommunity.org/careers"},
  {n:"NeighborWorks",u:"https://www.nw.org/careers"},
  {n:"Futures Without Violence",u:"https://www.futureswithoutviolence.org/careers"},
  {n:"National Council of La Raza",u:"https://www.nclr.org/careers"},
  {n:"Center for American Progress",u:"https://www.americanprogress.org/careers"},
  {n:"Council on Foreign Relations",u:"https://www.cfr.org/careers"},
  {n:"Heritage Foundation",u:"https://www.heritage.org/careers"},
  {n:"American Enterprise Institute",u:"https://www.aei.org/careers"},
  {n:"Cato Institute",u:"https://www.cato.org/careers"},
  {n:"Manhattan Institute",u:"https://www.manhattan-institute.org/careers"},
  {n:"Progressive Policy Institute",u:"https://www.progressivepolicy.org/careers"},
  {n:"Center for Strategic and International Studies",u:"https://www.csis.org/careers"},
  {n:"American Action Forum",u:"https://www.americanactionforum.org/careers"},
  {n:"National Bureau of Economic Research",u:"https://www.nber.org/careers"},
  {n:"Joint Center for Political and Economic Studies",u:"https://jointcenter.org/careers"},
  {n:"Urban Land Institute",u:"https://uli.org/careers"},
  {n:"American Institute of Architects",u:"https://www.aia.org/careers"},
  {n:"Industrial Designers Society of America",u:"https://www.idsa.org/careers"},
  {n:"American Society of Landscape Architects",u:"https://www.asla.org/careers"},
  {n:"American Planning Association",u:"https://www.planning.org/careers"},
  {n:"Congress for the New Urbanism",u:"https://www.cnu.org/careers"},
  {n:"National Association of Development Organizations",u:"https://www.nado.org/careers"},
  {n:"National Association of Counties",u:"https://www.naco.org/careers"},
  {n:"National League of Cities",u:"https://www.nlc.org/careers"},
  {n:"International City/County Management Association",u:"https://icma.org/careers"},
  {n:"National Governors Association",u:"https://www.nga.org/careers"},
  {n:"National Conference of State Legislatures",u:"https://www.ncsl.org/careers"},
  {n:"Council of State Governments",u:"https://www.csg.org/careers"},
  {n:"New America",u:"https://www.newamerica.org/careers"},
  {n:"Aspen Institute",u:"https://www.aspeninstitute.org/careers"},
  {n:"Carnegie Endowment for International Peace",u:"https://carnegieendowment.org/careers"}
];

// Fetch URL with timeout and user-agent
function fetchUrl(urlStr, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.get(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Extract application requirements from job posting HTML
function extractRequirements(html, url) {
  const requirements = [];

  // Common requirement keywords
  const patterns = [
    { keyword: 'resume', label: 'Resume' },
    { keyword: 'cover letter', label: 'Cover Letter' },
    { keyword: 'portfolio', label: 'Portfolio' },
    { keyword: 'work samples', label: 'Work Samples' },
    { keyword: 'video', label: 'Video Interview' },
    { keyword: 'assessment', label: 'Assessments' },
    { keyword: 'behavioral', label: 'Behavioral Questions' },
    { keyword: 'writing sample', label: 'Writing Sample' },
    { keyword: 'references', label: 'References' }
  ];

  const lowerHtml = html.toLowerCase();

  // Check for "application includes" or "required materials" section
  const appIncludesMatch = lowerHtml.match(/application includes:?(.*?)(?:next step|how to apply|contact|$)/is);
  const requiredMatch = lowerHtml.match(/required materials:?(.*?)(?:optional|how to apply|contact|$)/is);
  const youllNeedMatch = lowerHtml.match(/you.?ll need to provide:?(.*?)(?:how to apply|contact|$)/is);

  const searchText = [appIncludesMatch?.[1], requiredMatch?.[1], youllNeedMatch?.[1], html].filter(Boolean).join(' ');

  patterns.forEach(p => {
    if (searchText.toLowerCase().includes(p.keyword)) {
      requirements.push(p.label);
    }
  });

  // If no requirements found, return default based on job source
  if (requirements.length === 0) {
    if (url.includes('linkedin')) return ['Resume', 'Cover Letter'];
    if (url.includes('cityjobs') || url.includes('idealist')) return ['Resume', 'Cover Letter'];
    if (url.includes('greenhouse')) return ['Resume', 'Cover Letter'];
    return ['Requirements not specified - check application portal'];
  }

  return [...new Set(requirements)];
}

// Verify and check organization career page
async function checkOrgUrl(orgUrl) {
  try {
    const result = await fetchUrl(orgUrl, 8000);
    if (result.status >= 200 && result.status < 300) {
      return {
        status: 'valid',
        statusCode: result.status,
        url: orgUrl
      };
    } else if (result.status === 301 || result.status === 302 || result.status === 303 || result.status === 307) {
      const redirect = result.headers.location;
      return {
        status: 'redirect',
        statusCode: result.status,
        from: orgUrl,
        to: redirect
      };
    } else {
      return {
        status: 'error',
        statusCode: result.status,
        url: orgUrl
      };
    }
  } catch (err) {
    return {
      status: 'unreachable',
      error: err.message,
      url: orgUrl
    };
  }
}

// Process all jobs
async function processJobs() {
  console.log('📋 Checking Job URLs and Extracting Requirements...\n');
  const results = [];

  for (const job of JOBS) {
    try {
      console.log(`[${job.id}/50] Checking: ${job.t} (${job.c})`);
      const result = await fetchUrl(job.u, 8000);

      if (result.status >= 200 && result.status < 300) {
        const reqs = extractRequirements(result.body, job.u);
        results.push({
          id: job.id,
          title: job.t,
          company: job.c,
          url: job.u,
          status: 'valid',
          requirements: reqs,
          statusCode: result.status
        });
        console.log(`  ✓ Valid | Reqs: ${reqs.join(', ')}`);
      } else {
        results.push({
          id: job.id,
          title: job.t,
          company: job.c,
          url: job.u,
          status: 'invalid',
          statusCode: result.status,
          requirements: ['Check posting manually']
        });
        console.log(`  ✗ Status ${result.status}`);
      }
    } catch (err) {
      results.push({
        id: job.id,
        title: job.t,
        company: job.c,
        url: job.u,
        status: 'unreachable',
        error: err.message,
        requirements: ['Check posting manually']
      });
      console.log(`  ⚠ Unreachable: ${err.message}`);
    }

    // Rate limiting - wait 500ms between requests
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

// Process all organizations
async function processOrgs() {
  console.log('\n\n🏢 Checking Organization Career Pages...\n');
  const results = [];

  for (const org of ORGS) {
    try {
      console.log(`Checking: ${org.n}`);
      const result = await checkOrgUrl(org.u);
      results.push({
        name: org.n,
        ...result
      });

      if (result.status === 'valid') {
        console.log(`  ✓ Valid: ${org.u}`);
      } else if (result.status === 'redirect') {
        console.log(`  → Redirects to: ${result.to}`);
      } else {
        console.log(`  ✗ ${result.status}: ${org.u}`);
      }
    } catch (err) {
      results.push({
        name: org.n,
        status: 'error',
        error: err.message,
        url: org.u
      });
      console.log(`  ⚠ Error: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

// Main execution
async function main() {
  console.log('🚀 Starting scraper...\n');

  const jobResults = await processJobs();
  const orgResults = await processOrgs();

  // Save results
  const output = {
    timestamp: new Date().toISOString(),
    jobs: jobResults,
    organizations: orgResults,
    summary: {
      totalJobs: JOBS.length,
      validJobs: jobResults.filter(j => j.status === 'valid').length,
      invalidJobs: jobResults.filter(j => j.status !== 'valid').length,
      totalOrgs: ORGS.length,
      validOrgs: orgResults.filter(o => o.status === 'valid').length,
      invalidOrgs: orgResults.filter(o => o.status !== 'valid').length
    }
  };

  const fs = require('fs');
  fs.writeFileSync(
    'scraper-results.json',
    JSON.stringify(output, null, 2)
  );

  console.log('\n\n✅ Scraping complete!');
  console.log(`\nResults saved to: scraper-results.json`);
  console.log(`\nSummary:`);
  console.log(`  Valid job URLs: ${output.summary.validJobs}/${output.summary.totalJobs}`);
  console.log(`  Valid org URLs: ${output.summary.validOrgs}/${output.summary.totalOrgs}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
