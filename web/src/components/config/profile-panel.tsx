"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProfileFields } from "@/lib/profile-fields";
import { MaterialSymbol } from "@/components/material-symbol";

type Section = "identity" | "goals" | "constraints" | "followups" | "documents";
const CURRENCY = ["USD","PKR","EUR","GBP","CAD","AUD","INR","AED","SAR","CHF","JPY"];
const PERIODS = ["year","month","hour"];

export function ProfilePanel({section}: {section: Section}) {
  const [profile,setProfile]=useState<ProfileFields|null>(null);
  const [saved,setSaved]=useState<ProfileFields|null>(null);
  const [custom,setCustom]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{let live=true;fetch("/api/profile").then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not read config/profile.yml.");return d;}).then((d:{profile?:ProfileFields;customFields?:string[]})=>{if(live){setProfile(d.profile??{});setSaved(d.profile??{});setCustom(d.customFields??[]);}}).catch(()=>{if(live){setProfile({});setSaved({});setError("Could not read config/profile.yml.");}});return()=>{live=false;};},[]);
  if(!profile||!saved)return <div className="config-panel__loading">Reading config/profile.yml…</div>;
  const patch=(key:keyof ProfileFields,value:ProfileFields[keyof ProfileFields])=>setProfile(prev=>({...prev,[key]:value}));
  const dirtyKeys=(Object.keys(profile) as (keyof ProfileFields)[]).filter(key=>JSON.stringify(profile[key])!==JSON.stringify(saved[key]));
  const missingKeys=(Object.keys(saved) as (keyof ProfileFields)[]).filter(key=>!(key in profile));
  const dirty=dirtyKeys.length>0||missingKeys.length>0;
  async function save(){if(!profile)return;const snapshot=profile;setBusy(true);setError("");try{const changes:Record<string,unknown>={};for(const key of dirtyKeys)changes[key]=snapshot[key];for(const key of missingKeys)changes[key]="";const res=await fetch("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(changes)});const data=await res.json();if(!res.ok)throw new Error(data.error||"write failed");setSaved({...snapshot});}catch(e){setError(e instanceof Error?e.message:"write failed");}finally{setBusy(false);}}
  const field=(label:string,key:keyof ProfileFields,placeholder="",type="text")=><label className="block"><span className="block text-[13px] font-medium">{label}</span><input className="md3-field__input mt-1.5 w-full text-sm" type={type} value={(profile[key] as string|number|undefined)??""} placeholder={placeholder} onChange={e=>patch(key,type==="number"?(e.target.value===""?undefined:Number(e.target.value)):e.target.value)}/></label>;
  const list=(label:string,key:"roles"|"dealBreakers",hint:string)=><label className="block"><span className="block text-[13px] font-medium">{label}</span><textarea className="md3-field__input mt-1.5 w-full text-sm" value={(profile[key]??[]).join("\n")} onChange={e=>patch(key,e.target.value.split("\n").map(v=>v.trim()).filter(Boolean))}/><span className="text-xs text-[var(--md-sys-color-outline)]">{hint} · one item per line</span></label>;
  return <div className="space-y-4">
    {section==="identity"&&<><p className="text-sm">Used in reports, outreach drafts, and CV exports.</p><div className="grid gap-4 sm:grid-cols-2">{field("Full name","name","Name on your CV")}{field("Email","email","you@example.com","email")}{field("Current location","location","City, country")}{field("Country","country","Country")}{field("Time zone","timezone","Asia/Karachi")}{field("Work authorization","visa","Sponsorship / work authorization")}</div></>}
    {section==="goals"&&<><p className="text-sm">Seeds Explore, role scoring, and job search.</p>{list("Target roles","roles","Used by Explore and the scanner")}<div className="grid gap-4 sm:grid-cols-2">{field("Compensation range","compRange","150K-200K")}{field("Minimum acceptable compensation","minimum","120K")}{field("Currency code","currency","USD")}<label className="block text-[13px] font-medium">Pay period<select className="md3-field__input mt-1.5 w-full text-sm" value={profile.compPeriod??"year"} onChange={e=>patch("compPeriod",e.target.value)}>{PERIODS.map(v=><option key={v}>{v}</option>)}</select></label><label className="block text-[13px] font-medium">AI spend tier<select className="md3-field__input mt-1.5 w-full text-sm" value={profile.spendTier??"standard"} onChange={e=>patch("spendTier",e.target.value)}>{["economy","standard","premium"].map(v=><option key={v}>{v}</option>)}</select></label></div></>}
    {section==="constraints"&&<><p className="text-sm">Describe location eligibility as you mean it. Existing custom policies are kept verbatim unless you edit this field.</p>{field("Location policy","remote","Remote preferred; occasional onsite possible")}{list("Deal-breakers","dealBreakers","Used when matching roles")}<p className="text-xs text-[var(--md-sys-color-outline)]">For profile narrative and archetypes, edit <code>modes/_profile.md</code>.</p></>}
    {section==="followups"&&<><p className="text-sm">Defaults used by follow-up scheduling. Leave unchanged to keep the existing cadence.</p><div className="grid gap-4 sm:grid-cols-2">{field("First follow-up after applied (days)","appliedDays","7","number")}{field("Subsequent interval (days)","subsequentDays","7","number")}{field("Maximum follow-ups","maxFollowups","2","number")}{field("Interview thank-you after (days)","thankyouDays","1","number")}</div></>}
    {section==="documents"&&<><p className="text-sm">The master CV is your evidence source. Document layout only changes rendered exports.</p><Link className="md3-btn-outlined" href="/cv">Open Master CV and Tailored CVs</Link><p className="text-sm">Advanced document template settings are saved from the CV workspace to <code>config/profile.yml → cv</code>.</p></>}
    {custom.length>0&&<p className="rounded-xl bg-[var(--md-sys-color-secondary-container)] p-3 text-sm">Custom structured values detected for {custom.join(", ")}. They remain untouched until you explicitly replace them.</p>}
    {dirty&&<p className="text-xs">This edit writes {dirtyKeys.map(k=>`config/profile.yml → ${String(k)}`).join(", ")||"the selected fields"}.</p>}
    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-4"><span className="min-w-0 flex-1 text-xs text-[var(--md-sys-color-outline)]">Edits only update fields you changed. Unexposed profile values are preserved.</span><button type="button" className="md3-btn-filled min-h-10" onClick={save} disabled={!dirty||busy}>{busy?"Saving…":dirty?"Save changes":<><MaterialSymbol name="check" size={18}/>Saved</>}</button></div>
    {error&&<p role="alert" className="text-sm text-[var(--md-sys-color-error)]">{error}</p>}
  </div>;
}
