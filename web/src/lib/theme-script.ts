/** Server-safe theme bootstrap — no "use client". */

export const THEME_KEY = "career-ops:theme";
export const CONTRAST_KEY = "career-ops:contrast";
export const REDUCE_MOTION_KEY = "career-ops:reduce-motion";

export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_KEY}')||'dark';var c=localStorage.getItem('${CONTRAST_KEY}')||'standard';var r=localStorage.getItem('${REDUCE_MOTION_KEY}')==='true';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var el=document.documentElement;el.setAttribute('data-theme',m);el.dataset.contrast=c;el.dataset.reduceMotion=r?'true':'false';el.classList.remove('dark','light');el.classList.add(d?'dark':'light');var tc=d?'#191211':'#FCEAE2';var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',tc);}catch(e){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}})();`;
