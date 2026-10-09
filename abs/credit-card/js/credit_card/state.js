// Credit Card page — trust roster, view state and data selection. Plain scripts sharing one
// scope, loaded in order by credit_card.html (format.js, this, kit/core.js, chart.js, deals.js,
// controls.js, boot.js); see web/README.md. Every figure comes from src/metrics/cc_10d.py by
// way of src/workflows/cc/trust_detail.py; this page only draws.
const AVAIL=[];                       // the picker: trusts.json (ticker, label, name)
const ISSCOLOR=['#2f6db5','#2e8b57','#b5762f','#9c4fb5','#c0492f','#2a9d8f'];
const ALL='ALL';                      // the All Trusts series: balance-weighted, drawn heavier and in ink
const isAll=t=>t===ALL;
const anyAll=()=>selected.some(isAll);
const ALL_COLOR='#1a2230';
const SHELVES={}; let selected=[ALL], mode='calendar', metric='dq_30plus', output='chart', macroId=null, range='all';
let MACRO=null;                       // curated FRED overlay series (macro.json)
let transform='rate';                 // rate | yoy-delta | yoy-pct
window.KIT_ROW_LABEL='Trust';
// The tabs and their series. `unit` says how a value prints; `tab` groups the
// delinquency buckets and the two yield measures under one tab each.
const METRIC_META={
  dq_30plus:         {tab:'dq',    title:'30+ Day Delinquency',      axis:['30+ Day Delinquency','(% of receivables)'],      unit:'rate'},
  dq_30_60:          {tab:'dq',    title:'30–60 Day Delinquency',    axis:['30–60 Day Delinquency','(% of receivables)'],    unit:'rate'},
  dq_61_90:          {tab:'dq',    title:'61–90 Day Delinquency',    axis:['61–90 Day Delinquency','(% of receivables)'],    unit:'rate'},
  dq_91_120:         {tab:'dq',    title:'91–120 Day Delinquency',   axis:['91–120 Day Delinquency','(% of receivables)'],   unit:'rate'},
  dq_120plus:        {tab:'dq',    title:'120+ Day Delinquency',     axis:['120+ Day Delinquency','(% of receivables)'],     unit:'rate'},
  charge_off_rate:   {tab:'co',    title:'Net Charge-off Rate',      axis:['Net Charge-off Rate','(annualized, % of receivables)'], unit:'rate'},
  payment_rate:      {tab:'pr',    title:'Monthly Payment Rate',     axis:['Monthly Payment Rate','(% of beginning receivables)'], unit:'rate'},
  portfolio_yield:   {tab:'yld',   title:'Portfolio Yield',          axis:['Portfolio Yield','(annualized, % of receivables)'], unit:'rate'},
  excess_spread:     {tab:'yld',   title:'Excess Spread',            axis:['Excess Spread','(annualized, % of receivables)'],  unit:'rate'},
  trust_balance:     {tab:'bal',   title:'Trust Receivables Balance',axis:['Receivables Balance','($ billions)'],             unit:'usd_bn'},
};
const TAB_DEFAULT={dq:'dq_30plus', co:'charge_off_rate', pr:'payment_rate', yld:'portfolio_yield', bal:'trust_balance'};
const meta=()=>METRIC_META[metric]||{};
const tabOf=()=>metric==='deals'?'deals':meta().tab;
const isRate=()=>meta().unit==='rate';
const isDQ=()=>meta().tab==='dq';
// Year over year applies to the rates on the time series (not to the balance,
// the year overlay or the macro overlay).
const yoyActive=()=>isRate()&&output!=='seasonal'&&!macroId&&transform!=='rate';
// Axis tick format: two decimals on every tick, as the auto page prints them;
// dollars in billions to one decimal.
const AXFMT=".2%";
const axFmt=vals=>{ if(!isRate()) return ",.1f"; const m=Math.max(0,...vals.filter(v=>v!=null).map(Math.abs)); return m>0 && m<0.002 ? ".3%" : AXFMT; };
const valueFormat=()=>isRate() ? (yoyActive() ? (transform==='yoy-delta' ? '+.2%' : '+.1%') : '.2%') : '$,.2f';
// The chart's series: every trust record carries one calendar with every
// metric; the balance is drawn in billions.
const calOf=sh=>(sh&&sh.calendar)||[];
const calKey=()=>metric;
const scaleOf=()=>meta().unit==='usd_bn' ? 1e-9 : 1;
const lab=t=>(AVAIL.find(a=>a.t===t)||{}).label||t;
const labCode=t=>isAll(t) ? 'All Trusts' : `${lab(t)} (${t})`;
const metricTitle=()=>meta().title||'';
const metricLabel=()=>(meta().title||'this metric').toLowerCase();
const metricAxis=()=>{
  if(yoyActive()) return transform==='yoy-delta' ? 'YOY Δ (percentage points)' : 'YOY % Change';
  return meta().axis||[metricTitle()];
};
// Tooltip rows. All Trusts carries the number of trusts behind each point.
const tipLabels=()=>yoyActive() ? {series:'Series', x:'Month', y: transform==='yoy-delta' ? 'YOY Δ (pp)' : 'YOY %'}
                                : {series:'Trust', x:'Month', y: isRate() ? 'Rate' : '$ billions'};
const extraRows=()=>anyAll() ? [{field:"n",type:"quantitative",title:"Trusts in figure",format:"d"}] : [];
const extraOf=p=>{ const n=p[metric+'_n']; return n!=null ? {n} : null; };
function sourceFor(){ return 'SEC Form 10-D servicer distribution reports, EDGAR'; }
// Disclosures for the trusts on screen, from the metrics layer via trust_detail:
// what a trust does not report, and the universe line, once.
function notesFor(){
  const specific=[], general=[];
  selected.forEach(t=>{ const n=(SHELVES[t]||{}).notes||{}; specific.push(...(n.gaps||[])); general.push(...(n.universe||[])); });
  // a gross-basis charge-off series says so on the chart that draws it
  if(metric==='charge_off_rate') selected.forEach(t=>{ const s=(SHELVES[t]||{}).snapshot||{};
    if(s.charge_off_basis==='gross') specific.push(`${lab(t)}'s charge-off rate is gross of recoveries.`); });
  return [...new Set(specific), ...new Set(general)];
}
const CARD=()=>'Credit Card ABS';
function titleFor(){
  const one=selected.length===1 && !isAll(selected[0]), who=labCode(selected[0]);
  if(macroId){ const m=MACRO&&MACRO.find(x=>x.id===macroId); return `${who} vs ${m?m.name:'macro'}`; }
  if(output==='table' && !one) return `${CARD()} Trust Comparison`;
  const yoy = yoyActive() ? (transform==='yoy-delta' ? ' · YOY Δ (pp)' : ' · YOY %') : '';
  return `${one?who:(selected.length>1?CARD():who)} ${metricTitle()}${yoy}`;
}
function subtitleFor(){
  const n = selected.length>1 ? [`${selected.length} trusts`] : [];
  let parts;
  if(macroId)                     parts=[metricAxis()[0]];
  else                            parts=['By collection month', ...n];
  if(output==='seasonal') parts.push('Year overlay');
  return parts.filter(Boolean).join(' · ');
}
async function ensure(tks){ for(const t of tks){ if(!SHELVES[t]){ const r=await fetch(`data/${t}.json?t=`+Date.now()); SHELVES[t]=await r.json(); } } }
