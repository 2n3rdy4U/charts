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
// Axis tick format. ".1%" repeated labels whenever ticks fell between tenths
// (a 0.3%-max lease chart read 0.1%, 0.1%, 0.1%); ".2~%" keeps two decimals
// and trims trailing zeros, so 0.05% / 0.1% / 1% / 7.5% all read as written.
const AXFMT=".2~%";
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
// Denominator on a SECOND LINE of the axis title, as the live charts do — an
// axis that says "delinquency" without saying "of what" is not self-describing.
const metricAxis=()=>{
  const lab=metricLabel().replace(/^./,c=>c.toUpperCase());
  if(isDQ())                            return [lab, useAbsee()?'(% of loans)':'(% of pool balance)'];
  if(isRepo())                          return [lab,'(% of loans at start of month)'];
  const poolWord=assetClass==='lease'?'securitization value':'pool balance';
  if(isResid())                         return [lab,`(% of original ${poolWord})`];
  if(metric==='cnl_ratio')              return mode==='calendar'
      ? [lab,`(% of average ${poolWord}, annualized)`]
      : [lab,`(% of original ${poolWord})`];
  return [lab];
};
const lab=t=>(AVAIL.find(a=>a.t===t)||{}).label||t;
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
function titleFor(){
  if(macroId){ const m=MACRO&&MACRO.find(x=>x.id===macroId); return `${lab(selected[0])} · ${metricTitle()} vs ${m?m.name:'macro'}`; }
  if(selected.length>1) return `${metricTitle()} — ${selected.length} issuers`;
  return `${lab(selected[0])} · ${metricTitle()}`;
}
const mkey=()=>(metric==='cnl_ratio'&&mode==='calendar')?'anl_pct':metric;  // losses on calendar = annualized flow, not cumulative
const METRIC_META={dq_60plus_pct:{mode:'vintage',dq:true},dq_31_60_pct:{mode:'vintage',dq:true},dq_30plus_pct:{mode:'vintage',dq:true},cnl_ratio:{mode:'vintage',dq:false},repo_rate:{mode:'calendar',dq:false},rv_gl_cum_ratio:{mode:'vintage',dq:false}};
// Residual value gain/loss: lease shelves only, cumulative, so vintage only.
const isResid=()=>metric==='rv_gl_cum_ratio';  // sensible default axis + whether DQ buckets apply (CNL has none)
function setMode(m){mode=m;document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}

async function ensure(tks){ for(const t of tks){ if(!SHELVES[t]){ const r=await fetch(`data/${t}.json?t=`+Date.now()); SHELVES[t]=await r.json(); } } }

