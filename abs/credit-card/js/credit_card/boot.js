// Credit Card page — deep links, analytics and start-up. Plain scripts sharing one scope,
// loaded in order by credit_card.html; see web/README.md.
const METRIC_SHORT={dq_30plus:'dq30',dq_30_60:'dq3060',dq_61_90:'dq6190',dq_91_120:'dq91120',dq_120plus:'dq120',charge_off_rate:'co',payment_rate:'pr',portfolio_yield:'yld',excess_spread:'xs',trust_balance:'bal'};
function serializeState(){
  const p=new URLSearchParams();
  p.set('sel',selected.join(','));
  if(metric)p.set('m',metric);
  if(output!=='chart')p.set('out',output);
  if(range&&range!=='all')p.set('range',range);
  if(macroId)p.set('macro',macroId);
  if(transform!=='rate')p.set('transform',transform);
  return p;
}
window.CC_CHART_SHARE_URL=function(){   // explicit Copy-link only; never writes the address bar
  try{ let base=(window.CC_CHART_META&&window.CC_CHART_META.url)||(location.origin+location.pathname);
    return base.split('#')[0].split('?')[0]+'?'+serializeState().toString();
  }catch(e){ return (window.CC_CHART_META&&window.CC_CHART_META.url)||location.href; }
};
function applyState(){   // restore a shared view from ?params on load
  const q=new URLSearchParams(location.search);
  const known=t=>AVAIL.some(a=>a.t===t);
  const sel=(q.get('sel')||'').split(',').map(s=>s.trim()).filter(known);
  if(sel.length)selected=sel;
  const m=q.get('m'); if(m&&(METRIC_META[m]||m==='deals'))metric=m;
  if(metric==='deals'&&selected.length>1)selected=[selected[0]];
  if(metric==='deals'&&isAll(selected[0]))metric='dq_30plus';
  const o=q.get('out'); if(o==='table'||o==='seasonal'||o==='chart')output=o;
  const r=q.get('range'); if(r)range=r==='all'?'all':parseInt(r);
  const mc=q.get('macro'); if(mc)macroId=mc;
  const xf=q.get('transform'); if(xf==='yoy-delta'||xf==='yoy-pct')transform=xf;
  document.querySelectorAll('#outseg button').forEach(x=>x.classList.toggle('on',x.dataset.out===output));
}
let _cvT=null;
function countView(){
  clearTimeout(_cvT);
  _cvT=setTimeout(()=>{ if(!(window.goatcounter&&window.goatcounter.count))return;
    const ms=METRIC_SHORT[metric]||'other', primary=selected[0]||'-';
    try{ window.goatcounter.count({path:`/abs/credit-card/${ms}/${primary}`,
      title:`Credit Card — ${lab(primary)} · ${metricTitle()}`, event:false}); }catch(e){} },600);
}

fetch('data/trusts.json?t='+Date.now()).then(r=>r.json()).then(trusts=>{
  AVAIL.push(...trusts);
  if(window.BB_PRESET){ selected=[window.BB_PRESET.sel];
    if(window.BB_PRESET.static){ const dt=document.querySelector('.mtabs button[data-tab="deals"]'); if(dt) dt.hidden=true; } }
  applyState(); syncTabs();
  fetch('data/macro.json?t='+Date.now()).then(r=>r.json()).then(m=>{ MACRO=m;
    el('macrosel').innerHTML='<option value="">＋ overlay</option>'+m.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if(macroId){ el('macrosel').value=macroId; el('macrosel').classList.add('on'); renderChart(); } }).catch(()=>{});
  buildIssPanel();
  return refresh();
}).then(()=>{ if(metric==='deals') showLens('deals'); countView(); });
