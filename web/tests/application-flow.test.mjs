import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplicationFlow } from '../src/lib/application-flow.ts';
const app=(n,status)=>({n,company:`Company ${n}`,role:'Engineer',status});
const event=(n,from,to,day)=>({n,from,to,at:`2026-01-${String(day).padStart(2,'0')}T12:00:00Z`});

test('counts observed transitions, skipped stages and current endpoints without duplicate events',()=>{
 const history=[event('1','Evaluated','Applied',1),event('1','Applied','Interview',2),event('1','Applied','Interview',2),event('1','Interview','Offer',3)];
 const flow=buildApplicationFlow([app('1','Offer')],history,[]);
 assert.equal(flow.included,1);
 assert.deepEqual(flow.links.map(l=>l.id),['Applied->Interview','Interview->Offer','Offer->Offer:Currently at this stage']);
 assert.ok(flow.links.every(l=>l.applications.length===1));
 assert.ok(!flow.nodes.some(n=>n.label==='Responded'));
});
test('separates rejection, withdrawal, hiring and backward movement into acyclic paths',()=>{
 const cases=[['Rejected','Applied','Rejected'],['Discarded','Applied','Discarded'],['Hired','Applied','Hired'],['Applied','Interview','Applied']];
 for(const [status,from,to] of cases){
  const history=[event('1','Evaluated','Applied',1),...(from==='Interview'?[event('1','Applied','Interview',2)]:[]),event('1',from,to,3)];
  const flow=buildApplicationFlow([app('1',status)],history,[]);
  assert.ok(flow.links.every(l=>flow.nodes.find(n=>n.id===l.source).column<flow.nodes.find(n=>n.id===l.target).column));
  if(from==='Interview')assert.ok(flow.nodes.some(n=>n.label==='Reopened / moved back'));
 }
});
test('keeps legacy gaps separate, excludes unsubmitted roles and ignores deleted applications events',()=>{
 const flow=buildApplicationFlow([app('1','Applied'),app('2','Rejected'),app('3','Evaluated')],[event('99','Evaluated','Applied',1)],[]);
 assert.equal(flow.included,0);assert.equal(flow.excluded,1);
 assert.equal(flow.incomplete.reduce((n,g)=>n+g.applications.length,0),2);
 assert.equal(flow.links.length,0);
});
test('submission evidence supports current Applied and later missing history without inventing stages',()=>{
 const flow=buildApplicationFlow([app('1','Interview'),app('2','Applied')],[],[{n:'1',at:'2026-01-01'},{n:'2',at:'2026-01-01'}]);
 assert.equal(flow.included,2);
 assert.ok(flow.nodes.some(n=>n.label==='Later history incomplete'));
 assert.ok(!flow.nodes.some(n=>n.id==='Interview'));
 assert.equal(flow.nodes.find(n=>n.id==='Applied').applications.length,2);
});
