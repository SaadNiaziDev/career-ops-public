import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, validateCvPayload } from '../engine/build-cv-html.mjs';
const payload = (count) => ({contract_version:'1.0',candidate:{name:'Test Candidate',headline:'Engineer'},summary:'Software engineer.',experience:[{company:'Example',role:'Engineer'}],education:[],skills:[],projects:Array.from({length:count},(_,i)=>({name:`Project ${i}`,description:'Description proof',bullets:['Separate bullet proof'],tech:'JavaScript'}))});
test('tailored contract permits up to four projects and rejects excess without silently truncating',()=>{
 assert.equal(validateCvPayload(payload(4),{requireContract:true}).ok,true);
 assert.equal(validateCvPayload(payload(0),{requireContract:true}).ok,true);
 assert.match(validateCvPayload(payload(5),{requireContract:true}).errors.join(' '),/at most 4/);
 assert.equal(validateCvPayload(payload(5)).ok,true,'canonical previews retain all projects');
});
test('project descriptions do not suppress their evidence bullets in non-list templates',()=>{
 const html=renderHtml('<html><body><!-- PROJECTS --><h2>{{SECTION_PROJECTS}}</h2>{{PROJECTS}}</body></html>',payload(1));
 assert.match(html,/Description proof/);
 assert.match(html,/Separate bullet proof/);
 assert.match(html,/JavaScript/);
});
