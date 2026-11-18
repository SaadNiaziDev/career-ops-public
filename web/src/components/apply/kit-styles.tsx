// Co-located styles for the Apply kit + queue (kept out of globals.css so the
// apply surface owns them). Tokens only: works in light and dark.
const CSS = `
.co-kit-card{border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low);border-radius:var(--md-sys-shape-corner-extra-large,28px);overflow:hidden}
.co-kit-step{position:relative;display:grid;grid-template-columns:2.25rem minmax(0,1fr);gap:.75rem;padding:1rem}
@media(min-width:640px){.co-kit-step{padding:1.1rem 1.25rem}}
.co-kit-step+.co-kit-step{border-top:1px solid var(--md-sys-color-outline-variant)}
.co-kit-dot{display:grid;place-items:center;width:2.25rem;height:2.25rem;border-radius:999px;border:1.5px solid var(--md-sys-color-outline-variant);color:var(--md-sys-color-outline);font:var(--md-sys-typescale-label-large);background:var(--md-sys-color-surface)}
.co-kit-dot[data-state=done]{border-color:transparent;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)}
.co-kit-dot[data-state=running]{border-color:var(--md-sys-color-primary);color:var(--md-sys-color-primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--md-sys-color-primary) 14%,transparent)}
.co-kit-dot[data-state=skipped]{border-style:dashed}
.co-kit-dot[data-state=blocked]{color:var(--md-sys-color-error);border-color:color-mix(in srgb,var(--md-sys-color-error) 40%,transparent)}
.co-kit-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem}
.co-kit-actions .md3-action-btn{min-height:36px;padding:0 14px 0 12px}
.apply-workspace .md3-action-btn{max-width:100%;height:auto;min-height:40px;white-space:normal;flex-wrap:wrap;padding-top:8px;padding-bottom:8px}
.apply-workspace .md3-action-btn__label{min-width:0;line-height:1.3;overflow-wrap:anywhere}
@media(max-width:639px){.apply-workspace .apply-workspace-tabs{display:flex;flex-wrap:wrap;border-radius:20px;overflow:visible}.apply-workspace-tabs .md3-segmented-btn{flex:1 1 40%;min-width:0;padding:6px 10px}.co-kit-step{grid-template-columns:1.75rem minmax(0,1fr);gap:.5rem;padding:.85rem}.co-kit-dot{width:1.75rem;height:1.75rem}.co-kit-actions .md3-action-btn{padding:8px 10px}}
.co-kit-panel{margin-top:.75rem;border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-sys-shape-corner-large,16px);background:var(--md-sys-color-surface);overflow:hidden}
.co-kit-chip{display:inline-flex;align-items:center;gap:.25rem;min-height:30px;padding:0 .7rem;border-radius:999px;border:1px solid var(--md-sys-color-outline-variant);font:var(--md-sys-typescale-label-medium);color:var(--md-sys-color-on-surface-variant);background:transparent;cursor:pointer;max-width:100%}
.co-kit-chip:hover:not(:disabled){background:var(--md-sys-color-surface-container-high)}
.co-kit-chip:focus-visible,.co-kit-icon-btn:focus-visible,.co-kit-row:focus-visible{outline:2px solid var(--md-sys-color-primary);outline-offset:2px}
.co-kit-chip--active{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container);border-color:transparent}
.co-kit-chip--warn{border-color:color-mix(in srgb,var(--md-sys-color-tertiary) 55%,transparent);color:var(--md-sys-color-tertiary)}
.co-kit-chip--suggest{border-style:dashed;color:var(--md-sys-color-primary)}
.co-kit-icon-btn{display:grid;place-items:center;flex-shrink:0;width:36px;height:36px;border-radius:999px;color:var(--md-sys-color-on-surface-variant);background:transparent;border:0;cursor:pointer}
.co-kit-icon-btn:hover:not(:disabled){background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface)}
.co-kit-icon-btn:disabled{opacity:.35;cursor:default}
.co-kit-meter{height:6px;border-radius:999px;background:var(--md-sys-color-surface-container-highest);overflow:hidden}
.co-kit-meter>span{display:block;height:100%;border-radius:inherit;background:var(--md-sys-color-primary);transition:width .6s cubic-bezier(.22,1,.36,1)}
.co-kit-hero{border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-sys-shape-corner-extra-large,28px);padding:1rem;background:
  radial-gradient(120% 140% at 100% 0%, color-mix(in srgb,var(--md-sys-color-primary-container) 55%,transparent), transparent 60%),
  var(--md-sys-color-surface-container-low)}
@media(min-width:640px){.co-kit-hero{padding:1.25rem 1.5rem}}
.co-kit-confirm{border:1px solid color-mix(in srgb,var(--md-sys-color-primary) 35%,transparent);background:color-mix(in srgb,var(--md-sys-color-primary-container) 45%,transparent);border-radius:var(--md-sys-shape-corner-large,16px);padding:.9rem 1rem;margin-top:.75rem}
.co-kit-row{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:.75rem;align-items:center;padding:.85rem 1rem;color:inherit;text-decoration:none}
.co-kit-row+.co-kit-row{border-top:1px solid var(--md-sys-color-outline-variant)}
.co-kit-row:hover{background:var(--md-sys-color-surface-container)}
.co-kit-pill{display:inline-flex;align-items:center;gap:.2rem;font:var(--md-sys-typescale-label-small);padding:.15rem .45rem;border-radius:999px;background:var(--md-sys-color-surface-container-highest);color:var(--md-sys-color-on-surface-variant);white-space:nowrap}
.co-kit-pill[data-on=true]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.co-kit-pill[data-run=true]{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.co-kit-prose{padding:1rem;max-height:26rem;overflow:auto;font-size:.9rem;line-height:1.6;color:var(--md-sys-color-on-surface);white-space:pre-wrap;overflow-wrap:anywhere}
@keyframes co-kit-shim{0%{background-position:-200% 0}100%{background-position:200% 0}}
.co-kit-skel{border-radius:.5rem;background:linear-gradient(90deg,color-mix(in srgb,var(--md-sys-color-on-surface) 6%,transparent) 25%,color-mix(in srgb,var(--md-sys-color-on-surface) 12%,transparent) 37%,color-mix(in srgb,var(--md-sys-color-on-surface) 6%,transparent) 63%);background-size:200% 100%;animation:co-kit-shim 1.6s linear infinite}
@keyframes co-kit-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.co-kit-in{animation:co-kit-in .35s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion: reduce){.co-kit-skel,.co-kit-in{animation:none}.co-kit-meter>span{transition:none}}
`;

export function KitStyles() {
  return <style>{CSS}</style>;
}
