import yaml from 'js-yaml';
import fs from 'fs';
const c = yaml.load(fs.readFileSync('portals.yml','utf8'));
const list = c.tracked_companies.filter(t=>t.enabled!==false && !t.parser && !t.api && !t.provider);

const SIGS = [
  [/greenhouse\.io|boards-api\.greenhouse/i,'greenhouse'],
  [/ashbyhq/i,'ashby'],
  [/lever\.co/i,'lever'],
  [/myworkdayjobs|workday/i,'workday'],
  [/breezy\.hr/i,'breezy'],
  [/smartrecruiters/i,'smartrecruiters'],
  [/recruitee/i,'recruitee'],
  [/teamtailor/i,'teamtailor'],
  [/personio/i,'personio'],
  [/workable/i,'workable'],
  [/bamboohr/i,'bamboohr'],
  [/applytojob|resumator/i,'jazzhr'],
  [/freshteam/i,'freshteam'],
  [/simplicant/i,'simplicant'],
  [/hirestream/i,'hirestream'],
  [/zohorecruit/i,'zoho'],
  [/careers-page\.com/i,'careers-page'],
  [/phenom|phenompeople/i,'phenom'],
  [/icims/i,'icims'],
  [/successfactors/i,'successfactors'],
  [/oraclecloud|taleo/i,'oracle'],
  [/pinpointhq/i,'pinpoint'],
  [/rippling/i,'rippling'],
  [/comeet/i,'comeet'],
  [/jobvite/i,'jobvite'],
  [/wp-json|wp-content/i,'wordpress'],
];

async function probe(t){
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), 20000);
  try{
    const r = await fetch(t.careers_url,{headers:{'user-agent':'Mozilla/5.0 (career-ops scan)'},redirect:'follow',signal:ctl.signal});
    const html = await r.text();
    const hits = SIGS.filter(([re])=>re.test(html)).map(([,n])=>n);
    // also check final URL host
    const hostHits = SIGS.filter(([re])=>re.test(r.url)).map(([,n])=>n);
    const all=[...new Set([...hostHits,...hits])];
    return {name:t.name,url:t.careers_url,status:r.status,final:r.url,bytes:html.length,sigs:all.join(',')||'-'};
  }catch(e){
    return {name:t.name,url:t.careers_url,status:'ERR',final:'',bytes:0,sigs:String(e.name||e.message).slice(0,20)};
  }finally{clearTimeout(timer);}
}

const out=[];
const q=[...list];
await Promise.all(Array.from({length:6},async()=>{
  while(q.length){ const t=q.shift(); out.push(await probe(t)); }
}));
out.sort((a,b)=>(a.sigs||'').localeCompare(b.sigs||''));
for(const o of out) console.log([o.sigs,o.name,o.status,o.bytes,o.final.slice(0,70)].join('\t'));
