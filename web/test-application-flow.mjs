import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright-core";
import { createCareerOpsFixture } from "./test-support/career-ops-fixture.mjs";

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
const web = import.meta.dirname;
const repo = path.resolve(web, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "career-application-flow-"));
const root = createCareerOpsFixture(repo, path.join(temp, "home"));
const dist = ".next-application-flow";
fs.mkdirSync(path.join(root, "data/outreach"));
const draft = { id: "1-example-jane", trackerNum: "1", company: "Example Co", role: "Engineer", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", contact: { name: "Jane", title: "Recruiter", email: "jane@example.com", emailConfidence: "found" }, alternates: [], subject: "Engineer application", body: "Hi Jane,\n\nHere is my application.\n\nThanks.", followups: [{day:3,body:"Checking in on my application."}], status:"ready" };
const outreachFile = path.join(root, "data/outreach/1-example-jane.json");
fs.writeFileSync(outreachFile, JSON.stringify(draft));
const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(web,"node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port",String(port)], { cwd:web, detached:true, env:{...process.env,BUILD_DIST:dist,CAREER_OPS_ROOT:root,CAREER_OPS_SESSION_TOKEN:"application-flow-test"}, stdio:["ignore","pipe","pipe"] });
let output = "";
for (const stream of [server.stdout,server.stderr]) stream.on("data",(chunk)=>{output=(output+chunk).slice(-10000);});
let browser;
let currentPage;
try {
  let ready = false;
  for(let attempt=0;attempt<100;attempt++) {
    if(server.exitCode!==null) throw new Error(output);
    try { if((await fetch(origin)).ok){ready=true;break;} } catch {}
    await new Promise((resolve)=>setTimeout(resolve,250));
  }
  assert.ok(ready, `UI server did not start: ${output}`);
  try { browser = await chromium.launch({headless:true}); } catch { browser = await chromium.launch({channel:"chrome",headless:true}); }
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>localStorage.setItem("career-ops:tour-completed",JSON.stringify(["onboarding","dashboard","explore","config"])));
  await context.route("https://mail.google.com/**",route=>route.fulfill({body:"Test email draft — no message is sent."}));
  const page = await context.newPage();
  currentPage = page;
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const api=(route,data)=>page.request.post(`${origin}${route}`,{headers:{origin,"sec-fetch-site":"same-origin"},data});
  const activities=()=>{
    const dir=path.join(root,"data/application-activity/1");
    return fs.existsSync(dir)?fs.readdirSync(dir).filter(file=>file.endsWith(".json")).map(file=>JSON.parse(fs.readFileSync(path.join(dir,file),"utf8"))):[];
  };
  await page.goto(origin,{waitUntil:"networkidle"});
  await page.waitForURL("**/explore");
  assert.equal(await page.locator('.md3-rail .app-nav-links > a').count(),3);
  await page.getByRole("link",{name:"Saved matches",exact:true}).click();
  await page.waitForURL("**/explore?view=matches");
  await page.goto(`${origin}/apply?n=1`,{waitUntil:"networkidle"});
  const submission=page.getByRole("form",{name:"Record submitted application"});
  await submission.getByLabel("CV you submitted").fill("example-engineer-v2.pdf");
  await submission.getByRole("checkbox").check();
  assert.deepEqual(await submission.evaluate(form=>[...form.elements].filter(input=>input.willValidate&&!input.validity.valid).map(input=>({name:input.name,validation:input.validationMessage}))),[]);
  await submission.getByRole("button",{name:/Save application record/}).click();
  await page.getByRole("link",{name:/View application record/}).waitFor();
  assert.equal(activities().filter(event=>event.kind==="application").length,1);
  assert.equal(activities()[0].cvFile,"example-engineer-v2.pdf");
  assert.match(fs.readFileSync(path.join(root,"data/applications.md"),"utf8"),/Example Co \| Engineer \| 4.4\/5 \| Applied/);
  await page.goto(`${origin}/pipeline`,{waitUntil:"networkidle"});
  const legacy=page.getByRole("list",{name:"Application records"}).locator("li").filter({hasText:"Legacy Co"});
  assert.match(await legacy.innerText(),/Submission details not recorded/);
  await page.goto(`${origin}/apply?n=1#email`,{waitUntil:"networkidle"});
  const email=page.getByRole("region",{name:"Email for this role"});
  const popupPromise=page.waitForEvent("popup");
  await email.getByRole("button",{name:/Open Gmail draft/}).click();
  const popup=await popupPromise;
  await popup.waitForLoadState();
  assert.equal(new URL(popup.url()).searchParams.get("body"),draft.body);
  await popup.close();
  assert.equal(JSON.parse(fs.readFileSync(outreachFile,"utf8")).status,"ready");
  assert.equal(activities().filter(event=>event.kind==="email").length,0,"opening Gmail must not count as sent");
  await email.getByRole("button",{name:"I sent this message",exact:true}).click();
  await email.getByText("Follow-ups",{exact:true}).waitFor();
  await email.getByRole("button",{name:"I sent this message",exact:true}).waitFor({state:"detached"});
  const sent=activities().find(event=>event.kind==="email");
  assert.equal(sent?.body,draft.body);
  assert.equal(sent?.recipient,"jane@example.com");
  assert.equal(JSON.parse(fs.readFileSync(outreachFile,"utf8")).status,"sent");
  const followup=email.getByText("Day 3",{exact:true}).locator("..").locator("..");
  await followup.getByRole("button",{name:/Open follow-up in Gmail/}).click();
  assert.equal(JSON.parse(fs.readFileSync(outreachFile,"utf8")).followups[0].sentAt,undefined);
  await followup.getByRole("button",{name:"I sent this follow-up",exact:true}).click();
  await followup.getByText(/^Sent /).waitFor();
  assert.equal(activities().filter(event=>event.kind==="followup").length,1);
  const headers={origin,"sec-fetch-site":"same-origin"};
  const blocked=await page.request.patch(`${origin}/api/outreach`,{headers,data:{id:draft.id,action:"edit",body:"Changed after sending"}});
  assert.equal(blocked.status(),409);
  const unconfirmed=await page.request.patch(`${origin}/api/outreach`,{headers,data:{id:draft.id,action:"sent"}});
  assert.equal(unconfirmed.status(),409);
  const note={id:randomUUID(),n:"1",kind:"note",channel:"other",note:"A call is scheduled",confirmed:false};
  assert.equal((await api('/api/application-activity',note)).status(),200);
  assert.equal((await api('/api/application-activity',note)).status(),200);
  assert.equal(activities().filter(event=>event.id===note.id).length,1);
  const low={id:randomUUID(),n:"3",kind:"application",channel:"company-site",confirmed:true};
  assert.equal((await api('/api/application-activity',low)).status(),409);
  assert.equal((await api('/api/application-activity',{...low,overrideReason:"A specific referral makes this relevant."})).status(),200);
  await page.goto(`${origin}/pipeline/1`,{waitUntil:"networkidle"});
  const history=page.getByRole("list",{name:"Application history"});
  assert.match(await history.innerText(),/Email sent/);
  await history.getByText(draft.subject,{exact:true}).click();
  assert.ok((await history.innerText()).includes(draft.body));
  console.log("Search → Apply → Track: submission, exact sent email, follow-up, legacy gaps and idempotent retry passed.");
  for(const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:1000});
    for(const route of ['/explore','/apply?n=1','/pipeline','/pipeline/1']) {
      await page.goto(`${origin}${route}`,{waitUntil:'networkidle'});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${route} overflows`);
      if(route==='/pipeline/1') assert.ok(await page.getByRole('heading',{name:'Example Co',exact:true}).evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Company name must stay readable');
      if(width===320 || width===1280) await page.screenshot({path:path.join(os.tmpdir(),`career-workspace-${route.startsWith('/pipeline/1')?'record':route.startsWith('/pipeline')?'track':route.startsWith('/apply')?'apply':'search'}-${width}.png`),fullPage:true});
    }
    await page.screenshot({path:path.join(os.tmpdir(),`career-application-flow-${width}.png`),fullPage:true});
    console.log(`${width}px: Search, Apply, Track and role record fit the viewport.`);
  }
  assert.deepEqual(errors,[]);
} catch(error) {
  console.error(output);
  if(currentPage) { console.error((await currentPage.locator("main").first().innerText()).slice(-5000)); await currentPage.screenshot({path:path.join(os.tmpdir(),"career-application-flow-failure.png"),fullPage:true}).catch(()=>{}); }
  throw error;
} finally {
  await browser?.close();
  try {process.kill(-server.pid,"SIGTERM");}catch{}
  await new Promise(resolve=>server.exitCode!==null?resolve():server.once("exit",resolve));
  // Next adds its isolated test output to tsconfig; remove only those generated entries.
  const current=fs.readFileSync(path.join(web,"tsconfig.json"),"utf8");
  const cleaned=current.replace(new RegExp(`,?\\n    "${dist.replaceAll('.','\\.')}/(?:dev/)?types/\\*\\*/\\*\\.ts"`,'g'),'');
  if(cleaned!==current)fs.writeFileSync(path.join(web,"tsconfig.json"),cleaned);
  fs.rmSync(temp,{recursive:true,force:true});
}
