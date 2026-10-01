// Build B · Performance page — shelf roster, view state and data selection. Plain scripts sharing one scope,
// loaded in order by index.html; see web/README.md.
// The issuer picker: every shelf, its name and asset class — written by the
// resolver (shelves.json) from the issuer roster; filled in by boot.js.
const AVAIL=[];
const CLASS_DEFAULT={loan:'CRVNAP',lease:'FCALT'};
const ISSCOLOR=['#2f6db5','#2e8b57','#b5762f','#9c4fb5'];
const yearColor=y=>({'2023':'#9c4fb5','2024':'#b5762f','2025':'#2e8b57','2026':'#2f6db5'}[y]||'#5a6b85');

const SHELVES={}; let selected=['CRVNAP'], assetClass='loan', mode='vintage', metric='dq_60plus_pct', output='chart', tableAll=false, macroId=null, range='all', pools='all';
const markBy={}, axisBy={};   // per-series: seriesKey -> 'line'|'bar', 'left'|'right' (live-dashboard model)
const seriesMark=k=>markBy[k]||'line', seriesAxis=k=>axisBy[k]||'left';
window.setSeriesMark=(k,m)=>{ markBy[k]=m; renderChart(); };
window.setSeriesAxis=(k,s)=>{ axisBy[k]=s; renderChart(); };
let MACRO=null;   // curated FRED overlay series (macro.json)
const DQ_LAB={dq_60plus_pct:'60+',dq_31_60_pct:'30–59',dq_30plus_pct:'30+'};
const isDQ=()=>metric in DQ_LAB;
// Axis tick format: two decimals on every tick, as the Explorer prints them
// (3.00%, 2.50%, 0.05%). Trimming trailing zeros gave a ragged axis.
const AXFMT=".2%";
// ...except an axis whose values stay under 0.2% (a prime shelf's monthly
// repossession rate, ~0.04%): its ticks fall at 0.005% steps, and two decimals
// printed them twice each (0.04%, 0.04%, 0.03%...). Three decimals there.
const axFmt=vals=>{ const m=Math.max(0,...vals.filter(v=>v!=null).map(Math.abs)); return m>0 && m<0.002 ? ".3%" : AXFMT; };
// Delinquency on loan shelves comes from the ABS-EE loan tape — the same
// numbers as the live Explorer, by COUNT of loans. Losses, and everything on
// lease shelves, come from the 10-D servicer reports, by balance. The two are
// never mixed on one axis; the axis title and source line follow this choice.
const hasAbsee=sh=>!!(sh&&sh.pooled&&sh.pooled.absee_calendar&&sh.pooled.absee_calendar.length);
const useAbsee=()=>isDQ()&&hasAbsee(SHELVES[selected[0]]);
// Repossessions: the monthly first-time repossession rate from the loan tape
// (src/metrics/absee_repossessions.py) — a calendar series, loan shelves only.
const isRepo=()=>metric==='repo_rate';
// Pooled series: all deals reporting that month, or only deals at least six
// months old — the "seasoned" basis, which keeps a burst of new issuance
// (near-zero delinquency, no losses yet) from diluting the rate. Every pooled
// series comes from the metrics layer on both bases: loan delinquency from the
// loan tape, lease delinquency and losses from the 10-D reports.
const calOf=sh=>{
  const P=(sh&&sh.pooled)||{}, seas=pools==='seasoned';
  if(metric==='cnl_ratio') return (seas?P.loss_calendar_seasoned:P.loss_calendar)||[];
  if(isRepo()) return (seas?P.repo_calendar_seasoned:P.repo_calendar)||[];
  if(useAbsee()&&hasAbsee(sh)) return (seas?P.absee_calendar_seasoned:P.absee_calendar)||[];
  return (seas?P.calendar_seasoned:P.calendar)||[];
};
const lossWord=()=>assetClass==='lease'?'net credit loss':'net loss';
const metricLabel=()=>isRepo()?'first-time repossessions':isResid()?'cumulative residual value gain (loss)':(metric==='cnl_ratio'&&mode==='calendar')?`annualized ${lossWord()}`:(isDQ()?`${DQ_LAB[metric]} delinquency`:(metric==='cnl_ratio'?`cumulative ${lossWord()}`:'this metric'));
// Axis titles in the Explorer's words: the measure on the first line, its
// denominator on the second — an axis that says "delinquency" without saying
// "of what" is not self-describing.
const DPD=()=>`${DQ_LAB[metric]} DPD`;
const lossName=()=>assetClass==='lease'?'Net Credit Loss':'Net Loss';
const metricAxis=()=>{
  const poolWord=assetClass==='lease'?'securitization value':'pool balance';
  if(isDQ())                            return [DPD(), useAbsee()?'(% of active loans)':'(% of pool balance)'];
  if(isRepo())                          return ['1st-Time Repo','(% of loans at start of month)'];
  if(isResid())                         return ['Cumulative Residual Gain (Loss)',`(% of original ${poolWord})`];
  if(metric==='cnl_ratio')              return mode==='calendar'
      ? [`Annualized ${lossName()}`,`(% of average ${poolWord})`]
      : [`Cumulative ${lossName()}`,`(% of original ${poolWord})`];
  return [metricLabel()];
};
// Tooltip rows, as the Explorer labels them for the same view.
const tipLabels=()=>{
  if(mode==='vintage' && (metric==='cnl_ratio'||isResid()))
    return {series:'Vintage', x:'Months', y: isResid()?'Cum. Residual G/(L)':'Cum. Loss Rate'};
  if(isRepo())               return {series:'Issuer', x:'Month', y:'Rate'};
  if(metric==='cnl_ratio')   return {series:'Issuer', x:'Month', y:`Annualized ${lossName().toLowerCase()}`};
  return {series:'Series', x:'Date', y:DPD()};
};
const lab=t=>(AVAIL.find(a=>a.t===t)||{}).label||t;
const labCode=t=>{ const l=lab(t); return l.includes(`(${t})`)?l:`${l} (${t})`; };   // the Explorer's issuer label: "Name (CODE)"
const metricTitle=()=>isRepo()?'First-Time Repossession Rate':isResid()?'Cumulative Residual Value Gain (Loss)':metric==='cnl_ratio'?(mode==='calendar'?(assetClass==='lease'?'Annualized Net Credit Loss Rate':'Annualized Net Loss Rate'):(assetClass==='lease'?'Cumulative Net Credit Loss':'Cumulative Net Loss')):(isDQ()?`${DQ_LAB[metric]} Day Delinquency Rate`:metricLabel());
function sourceFor(){
  // Says which source the chart on screen is actually drawn from: the loan
  // tape for loan delinquencies, the servicer reports for everything else.
  return (useAbsee()||isRepo()) ? 'SEC Form ABS-EE loan-level data, EDGAR'
                    : 'SEC Form 10-D servicer distribution reports, EDGAR';
}
// Disclosures for the shelves on screen, from the metrics layer via the
// resolver: repossession caveats, credit-score caveats, and the loan-tape
// universe — each only where the chart actually draws that kind of data.
function notesFor(){
  const specific=[], general=[];
  selected.forEach(t=>{ const n=(SHELVES[t]||{}).notes||{};
    if(isRepo()) specific.push(...(n.repossessions||[]));
    if(isRepo()||useAbsee()){ specific.push(...(n.score||[])); general.push(...(n.universe||[])); } });
  return [...new Set(specific), ...new Set(general)];   // shelf caveats first, the universe once
}
/* Chart title and sub-head, by the Explorer's rules (updateViewHeader in
   generate_sec_explorer_data.py): the title names the issuer and the measure;
   the sub-head lists the settings in force, joined by " · ". Build B has no
   credit-score or vehicle filter, so on the loan tape the sub-head states the
   whole book, as the Explorer's does with those filters at their defaults. */
const AUTO=()=>assetClass==='lease'?'Auto Lease ABS':'Auto ABS';
function titleFor(){
  const one=selected.length===1, who=labCode(selected[0]);
  if(macroId){ const m=MACRO&&MACRO.find(x=>x.id===macroId); return `${who} vs ${m?m.name:'macro'}`; }
  if(isRepo())                 return `${one?who:AUTO()} — 1st-Time Repossessions`;
  if(mode==='vintage'){
    if(metric==='cnl_ratio')   return `${who} Vintage Loss Curves`;
    if(isResid())              return `${who} Vintage Residual Value Gain (Loss)`;
    return `${who} Vintage`;
  }
  if(output==='table' && !one) return `${AUTO()} Issuer Comparison`;
  if(metric==='cnl_ratio')     return `${one?who:AUTO()} Annualized ${lossName()}`;
  return `${one?who:AUTO()} DQ ${DPD()}`;
}
function subtitleFor(){
  const book = useAbsee() ? ['All Credit Scores','New & Used'] : [];
  const poolTxt = pools==='seasoned' ? 'Seasoned pools (>6 mo)' : 'All pools';
  const n = selected.length>1 ? [`${selected.length} issuers`] : [];
  let parts;
  if(macroId)                          parts=[metricAxis()[0], poolTxt];
  else if(mode==='vintage' && isDQ())  parts=[DPD(), ...book];
  else if(mode==='vintage')            parts=['By series (individual deals)'];
  else if(isDQ() && useAbsee())        parts=[...book, pools==='seasoned'?'Seasoned (>6mo)':''];   // exactly the Explorer's DQ time series
  else                                 parts=[poolTxt, ...n];
  if(output==='seasonal') parts.push('Year overlay');
  return parts.filter(Boolean).join(' · ');
}
const mkey=()=>(metric==='cnl_ratio'&&mode==='calendar')?'anl_pct':metric;  // losses on calendar = annualized flow, not cumulative
const METRIC_META={dq_60plus_pct:{mode:'vintage',dq:true},dq_31_60_pct:{mode:'vintage',dq:true},dq_30plus_pct:{mode:'vintage',dq:true},cnl_ratio:{mode:'vintage',dq:false},repo_rate:{mode:'calendar',dq:false},rv_gl_cum_ratio:{mode:'vintage',dq:false}};
// Residual value gain/loss: lease shelves only, cumulative, so vintage only.
const isResid=()=>metric==='rv_gl_cum_ratio';  // sensible default axis + whether DQ buckets apply (CNL has none)
function setMode(m){mode=m;document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}

async function ensure(tks){ for(const t of tks){ if(!SHELVES[t]){ const r=await fetch(`data/${t}.json?t=`+Date.now()); SHELVES[t]=await r.json(); } } }

