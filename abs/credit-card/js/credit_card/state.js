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
// delinquency buckets under one tab.
const METRIC_META={
  dq_30plus:         {tab:'dq',    title:'30+ Day Delinquency',      axis:['30+ Day Delinquency','(% of receivables)'],      unit:'rate'},
  dq_30_60:          {tab:'dq',    title:'30–60 Day Delinquency',    axis:['30–60 Day Delinquency','(% of receivables)'],    unit:'rate'},
  dq_61_90:          {tab:'dq',    title:'61–90 Day Delinquency',    axis:['61–90 Day Delinquency','(% of receivables)'],    unit:'rate'},
  dq_91_120:         {tab:'dq',    title:'91–120 Day Delinquency',   axis:['91–120 Day Delinquency','(% of receivables)'],   unit:'rate'},
  dq_120plus:        {tab:'dq',    title:'120+ Day Delinquency',     axis:['120+ Day Delinquency','(% of receivables)'],     unit:'rate'},
  charge_off_rate:   {tab:'co',    title:'Net Charge-off Rate',      axis:['Net Charge-off Rate','(annualized, % of receivables)'], unit:'rate'},
  payment_rate:      {tab:'pr',    title:'Monthly Payment Rate',     axis:['Monthly Payment Rate','(% of beginning receivables)'], unit:'rate'},
  portfolio_yield:   {tab:'yld',   title:'Portfolio Yield',          axis:['Portfolio Yield','(annualized, % of receivables)'], unit:'rate'},
  excess_3mo:        {tab:'xs',    title:'Excess Spread, 3-Month Average', axis:['Excess Spread, 3-month average','(annualized, % of receivables)'], unit:'rate'},
  excess_weakest:    {tab:'xs',    title:'Excess Spread, Weakest Series',  axis:['Excess Spread, one month','(weakest series tested, annualized)'], unit:'rate'},
  trust_balance:     {tab:'bal',   title:'Trust Receivables Balance',axis:['Receivables Balance','($ billions)'],             unit:'usd_bn'},
};
const TAB_DEFAULT={dq:'dq_30plus', co:'charge_off_rate', pr:'payment_rate', yld:'portfolio_yield', xs:'excess_3mo', bal:'trust_balance'};
// A label the data overrides (trust_detail `labels`: e.g. "Gross Portfolio Yield" once the trust-level
// definitions are on), so the page never names a figure differently from the records it draws.
const meta=()=>{ const m=METRIC_META[metric]||{};
  const o=Object.values(SHELVES).map(s=>(s.labels||{})[metric]).find(Boolean);
  return o ? {...m, title:o, axis:[o, (m.axis||[])[1]||'']} : m; };
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
const bare=t=>lab(t).replace(/ \(.*\)$/,'');   // 'Comenity (WFN)' -> 'Comenity': the ticker goes in its own brackets
const labCode=t=>isAll(t) ? 'All Trusts' : `${bare(t)} (${t})`;
const metricTitle=()=>meta().title||'';
const metricLabel=()=>(meta().title||'this metric').toLowerCase();
const metricAxis=()=>{
  if(yoyActive()) return transform==='yoy-delta' ? 'YOY Δ (percentage points)' : 'YOY % Change';
  return meta().axis||[metricTitle()];
};
// Tooltip rows. All Trusts carries the number of trusts behind each point.
const tipLabels=()=>yoyActive() ? {series:'Series', x:'Month', y: transform==='yoy-delta' ? 'YOY Δ (pp)' : 'YOY %'}
                                : {series:'Trust', x:'Month', y: isRate() ? 'Rate' : '$ billions'};
// A month from the site's history (src/metrics/cc_history: before 10-D reporting, or a month the current reader
// misses) says so in its tooltip; the one-month excess view names the series it shows (src/metrics/cc_excess).
const anyHist=()=>selected.some(t=>((SHELVES[t]||{}).sources||[]).includes('history'));
const extraRows=()=>[...(anyAll() ? [{field:"n",type:"quantitative",title:"Trusts in figure",format:"d"}] : []),
                     ...(anyHist() ? [{field:"src",type:"nominal",title:"Source"}] : []),
                     ...(metric==='excess_weakest' && !anyAll() ? [{field:"tested",type:"nominal",title:"Tested at"}] : [])];
const extraOf=p=>{ const o={}, n=p[metric+'_n']; if(n!=null) o.n=n;
  if(anyHist()) o.src=p.hist ? 'Servicer report (history)' : 'Servicer report (10-D)';
  if(metric==='excess_weakest' && !anyAll()) o.tested=p.weakest_series ? `Series ${p.weakest_series} (lowest of ${p.weakest_n})` : 'All notes (one test)';
  return Object.keys(o).length ? o : null; };
function sourceFor(){ return anyHist() ? 'SEC servicer reports (Form 8-K to 2006, Form 10-D after)' : 'SEC Form 10-D servicer reports'; }
// The chart footer: the source, then only what is needed to read THIS chart — the yield's basis, how All
// Trusts is built, a gross charge-off series, and a line that starts later than its trust's records (written from
// the data, for the metric on screen, only when that start is in view). Definitions and coverage in full are on
// the methodology page (§11), which the footer links to.
function notesFor(){
  const out=[];
  if(metric==='portfolio_yield' && Object.values(SHELVES).some(s=>(s.labels||{}).portfolio_yield)) out.push('Yield is before charge-offs.');
  if(anyAll()) out.push('All Trusts is weighted by receivables.');
  if(metric==='charge_off_rate') selected.forEach(t=>{ const s=(SHELVES[t]||{}).snapshot||{};
    if(s.charge_off_basis==='gross'){ out.push(`${lab(t)}'s charge-off rate is gross of recoveries.`); return; }
    // a trust that reports net now but only gross in its earlier months (Capital One before 2006, Amex before
    // Oct-2008): say so when those months are on screen
    const cal=calOf(SHELVES[t]), firstNet=cal.find(p=>p.charge_off_basis==='net'&&p.charge_off_rate!=null);
    const latest=(cal[cal.length-1]||{}).date||'', cut=range==='all' ? '' : (parseInt(latest.slice(0,4))-range)+latest.slice(4);
    if(firstNet && cal.some(p=>p.charge_off_basis==='gross'&&p.charge_off_rate!=null&&p.date<firstNet.date&&p.date>cut))
      out.push(`${bare(t)}'s charge-off rate is gross of recoveries before ${fmtMonth(firstNet.date)}.`); });
  selected.filter(t=>!isAll(t)).forEach(t=>{
    const cal=calOf(SHELVES[t]), first=(cal[0]||{}).date, f=cal.find(p=>p[metric]!=null);
    if(!first||!f) return;
    const gap=(+f.date.slice(0,4)-+first.slice(0,4))*12+(+f.date.slice(5,7)-+first.slice(5,7));
    const latest=(cal[cal.length-1]||{}).date||'', cut=range==='all'||mode==='vintage' ? '' : (parseInt(latest.slice(0,4))-range)+latest.slice(4);
    // a trust already footnoted as gross before some month needs no 'begins' line: what begins there is its gross rate
    if(metric==='charge_off_rate' && out.some(x=>x.startsWith(`${bare(t)}'s charge-off rate is gross`))) return;
    if(gap>=3 && f.date>cut) out.push(`${bare(t)}'s ${metricLabel()} begins ${fmtMonth(f.date)}.`);
  });
  if(metric==='excess_3mo'||metric==='excess_weakest'){
    out.push(metric==='excess_3mo' ? 'Mean of the month and the two before it, the period early-amortization triggers test.'
                                   : 'One month, at the weakest series the trigger tests; where one test covers every note, the trust\'s own figure.');
    // the trigger is 0% at every trust today; a trust whose report states another level is named
    selected.forEach(t=>{ const r=[...calOf(SHELVES[t])].reverse().find(p=>p.trigger_required!=null);
      if(r) out.push(`${bare(t)}'s trigger is ${(r.trigger_required*100).toFixed(2)}%, not 0%.`); });
    const linked=selected.filter(t=>calOf(SHELVES[t]).some(p=>p.weakest_series));
    if(linked.length) out.push(metric==='excess_3mo'
      ? `${linked.map(bare).join(', ')} test${linked.length>1?'':'s'} each series on its own: see Weakest series.`
      : `${linked.map(bare).join(', ')}: the lowest of ${linked.length>1?'their':'its'} series.`);
    if(selected.includes('COMET')) out.push('Capital One\'s figure is calculated from its reports on its prospectus\'s definition.');
    if(anyAll() && metric==='excess_weakest') out.push('All Trusts has no series of its own: its monthly average.');
  }
  out.push("Trusts' definitions differ.");
  return [...new Set(out)];
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
  let parts;
  if(macroId)                     parts=[metricAxis()[0]];
  else                            parts=['By collection month'];
  if(output==='seasonal') parts.push('Year overlay');
  return parts.filter(Boolean).join(' · ');
}
async function ensure(tks){ for(const t of tks){ if(!SHELVES[t]){ const r=await fetch(`data/${t}.json?t=`+Date.now()); SHELVES[t]=await r.json(); } } }
