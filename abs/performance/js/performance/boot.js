// Build B · Performance page — deep links, analytics and start-up. Plain scripts sharing one scope,
// loaded in order by index.html; see web/README.md.
/* ---------- deep-link + analytics (mirrors live macro CC_CHART_SHARE_URL convention) ---------- */
const METRIC_SHORT={dq_60plus_pct:'dq60',dq_31_60_pct:'dq3059',dq_30plus_pct:'dq30',cnl_ratio:'loss',repo_rate:'repo'};
function serializeState(){
  const p=new URLSearchParams();
  p.set('ac',assetClass); p.set('sel',selected.join(','));
  if(metric)p.set('m',metric);
  p.set('view',mode);
  if(output!=='chart')p.set('out',output);
  if(range&&range!=='all')p.set('range',range);
  if(macroId)p.set('macro',macroId);
  if(pools!=='all')p.set('pools',pools);
  return p;
}
window.CC_CHART_SHARE_URL=function(){   // explicit Copy-link only; never writes the address bar (can't affect rendering)
  try{ let base=(window.CC_CHART_META&&window.CC_CHART_META.url)||(location.origin+location.pathname);
    return base.split('#')[0].split('?')[0]+'?'+serializeState().toString();
  }catch(e){ return (window.CC_CHART_META&&window.CC_CHART_META.url)||location.href; }
};
function applyState(){   // restore a shared view from ?params on load
  const q=new URLSearchParams(location.search);
  const ac=q.get('ac'); if(ac==='loan'||ac==='lease')assetClass=ac;
  const inClass=t=>{const a=AVAIL.find(x=>x.t===t);return a&&a.asset===assetClass;};
  const sel=(q.get('sel')||'').split(',').map(s=>s.trim()).filter(inClass);
  if(sel.length)selected=sel; else if(!inClass(selected[0]))selected=[CLASS_DEFAULT[assetClass]];
  const m=q.get('m'); if(m&&(METRIC_META[m]||m==='deals'))metric=m;
  if(metric==='deals'&&selected.length>1)selected=[selected[0]];   // Deals describes one shelf
  const v=q.get('view'); if(v==='vintage'||v==='calendar')mode=v;
  const o=q.get('out'); if(o==='table'||o==='seasonal'||o==='chart')output=o;
  const r=q.get('range'); if(r)range=r;
  const mc=q.get('macro'); if(mc)macroId=mc;
  if(q.get('pools')==='seasoned')pools='seasoned';
  document.querySelectorAll('#assetseg button').forEach(x=>x.classList.toggle('on',x.dataset.asset===assetClass));
  document.querySelectorAll('.mtabs button').forEach(x=>x.classList.toggle('on',x.dataset.metric===metric));
  document.querySelectorAll('#modeseg button').forEach(x=>x.classList.toggle('on',x.dataset.mode===mode));
  document.querySelectorAll('#outseg button').forEach(x=>x.classList.toggle('on',x.dataset.out===output));
  syncDqSeg();
  const mm=METRIC_META[metric]; el('dqctl').style.display=(mm&&mm.dq)?'':'none';
}
let _cvT=null;
function countView(){   // light GoatCounter granularity: one virtual pageview per meaningful view (guarded + debounced)
  clearTimeout(_cvT);
  _cvT=setTimeout(()=>{ if(!(window.goatcounter&&window.goatcounter.count))return;
    const ms=METRIC_SHORT[metric]||'other', primary=selected[0]||'-';
    try{ window.goatcounter.count({path:`/auto/performance/${assetClass}/${ms}/${primary}`,
      title:`Performance — ${lab(primary)} · ${metricTitle()}`, event:false}); }catch(e){} },600);
}

fetch('data/shelves.json?t='+Date.now()).then(r=>r.json()).then(shelves=>{
  AVAIL.push(...shelves);
  if(window.BB_PRESET){ assetClass=window.BB_PRESET.ac; selected=[window.BB_PRESET.sel];
    if(window.BB_PRESET.static){ const dt=document.querySelector('.mtabs button[data-metric="deals"]'); if(dt) dt.hidden=true; } }
  applyState();
  // Macro overlay list: fetched after the deep link is applied, so a shared
  // ?macro= view selects its series whichever script loads first.
  fetch('data/macro.json?t='+Date.now()).then(r=>r.json()).then(m=>{ MACRO=m;
    el('macrosel').innerHTML='<option value="">＋ overlay</option>'+m.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if(macroId){ el('macrosel').value=macroId; el('macrosel').classList.add('on'); renderChart(); } }).catch(()=>{});
  buildIssPanel();
  return refresh();
}).then(()=>{ if(metric==='deals') showLens('deals'); countView(); });
