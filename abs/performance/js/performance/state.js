// Build B · Performance page — shelf roster, view state and data selection. Plain scripts sharing one scope,
// loaded in order by index.html; see web/README.md.
// The issuer picker: every shelf, its name and asset class — written by the
// resolver (shelves.json) from the issuer roster; filled in by boot.js.
const AVAIL=[];
const CLASS_DEFAULT={loan:'ALL',lease:'ALL-LEASE'};   // the market series: a neutral opening view, not one issuer's
const ISSCOLOR=['#2f6db5','#2e8b57','#b5762f','#9c4fb5'];
// The All Issuers series (every loan shelf's tape added together, from the
// metrics layer): time series only, delinquency only, drawn heavier and in ink.
const ALL='ALL', ALL_LEASE='ALL-LEASE';   // the market series, loan and lease: shelves added together, no deals
const isAll=t=>t===ALL||t===ALL_LEASE;
const anyAll=()=>selected.some(isAll);
const ALL_COLOR='#1a2230';
const yearColor=y=>({'2023':'#9c4fb5','2024':'#b5762f','2025':'#2e8b57','2026':'#2f6db5'}[y]||'#5a6b85');

const SHELVES={}; let selected=['ALL'], assetClass='loan', mode='vintage', metric='dq_60plus_pct', output='chart', tableAll=false, macroId=null, range='all', pools='all';
// The loan-tape time series can be shown as the change on a year earlier.
// (Credit-score and vehicle cuts of it are computed daily into <T>.cuts.json
// but not offered here: a cut by origination score needs a paragraph to read
// correctly, so it is left to the newsletter's editorial charts.)
let transform='rate';
// Recoveries: the window (12 months after default, or the 6-month early read) and the view (over time,
// or the newest cohort cut by loan-to-value or new/used vehicle).
let recWin='12', recView='time';
// Vintage charts: which vintages to draw — '5' / '10' (the last N vintage years of the shelf on screen), 'all', or
// 'YYYY-YYYY'. With 25 years of deals on a shelf, which vintages is the first question; the deal-age row
// (`range`) then caps the age axis.
let vint='10';
const vintYears=()=>[...new Set(((SHELVES[selected[0]]||{}).deals||[]).map(d=>+(d.series||'').slice(0,4)).filter(y=>y>1990))].sort((a,b)=>a-b);
function vintOK(series){
  const y=+(series||'').slice(0,4); if(!y||vint==='all') return true;
  const m=/^(\d{4})-(\d{4})$/.exec(vint); if(m) return y>=+m[1] && y<=+m[2];
  const ys=vintYears(); return !ys.length || y>ys[ys.length-1]-(+vint);
}
const yoyActive=()=>isDQ()&&useAbsee()&&mode==='calendar'&&output!=='seasonal'&&!macroId&&transform!=='rate';
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
// Recoveries: cash collected on defaulted loans within 12 (or 6) months of default, as a share of the balance
// owed, by four-quarter default cohort (src/metrics/recoveries.py) — loan shelves only, a calendar series.
const isRecov=()=>metric==='recovery_rate';
// Pooled series: all deals reporting that month, or only deals at least six
// months old — the "seasoned" basis, which keeps a burst of new issuance
// (near-zero delinquency, no losses yet) from diluting the rate. Every pooled
// series comes from the metrics layer on both bases: loan delinquency from the
// loan tape, lease delinquency and losses from the 10-D reports.
const calOf=sh=>{
  const P=(sh&&sh.pooled)||{}, seas=pools==='seasoned';
  if(isTurn()) return P.turnin_calendar||[];   // one basis: the deals reporting a turn-in that month
  if(isResid()) return P.resid_calendar||[];   // one basis: the vehicles sold that month
  if(metric==='cnl_ratio') return (seas?P.loss_calendar_seasoned:P.loss_calendar)||[];
  if(isRepo()) return (seas?P.repo_calendar_seasoned:P.repo_calendar)||[];
  if(isRecov()) return (recWin==='6'?P.recovery_calendar_6m:P.recovery_calendar)||[];   // one basis: the cohort
  if(useAbsee()&&hasAbsee(sh)) return (seas?P.absee_calendar_seasoned:P.absee_calendar)||[];
  return (seas?P.calendar_seasoned:P.calendar)||[];
};
const lossWord=()=>assetClass==='lease'?'net credit loss':'net loss';
const metricLabel=()=>isRecov()?'recovery on defaulted loans':isRepo()?'first-time repossessions':isTurn()?'turn-in rate':isResid()?(mode==='calendar'?'residual gain (loss) on vehicles sold':'cumulative residual value gain (loss)'):(metric==='cnl_ratio'&&mode==='calendar')?`annualized ${lossWord()}`:(isDQ()?`${DQ_LAB[metric]} delinquency`:(metric==='cnl_ratio'?`cumulative ${lossWord()}`:'this metric'));
// Axis titles in the Explorer's words: the measure on the first line, its
// denominator on the second — an axis that says "delinquency" without saying
// "of what" is not self-describing.
const DPD=()=>`${DQ_LAB[metric]} DPD`;
const lossName=()=>assetClass==='lease'?'Net Credit Loss':'Net Loss';
const metricAxis=()=>{
  const poolWord=assetClass==='lease'?'securitization value':'pool balance';
  if(yoyActive())                       return transform==='yoy-delta' ? 'YOY \u0394 (percentage points)' : 'YOY % Change';
  if(isDQ())                            return [DPD(), useAbsee()?'(% of active loans)':'(% of pool balance)'];
  if(isRepo())                          return ['1st-Time Repo','(% of loans at start of month)'];
  if(isRecov())                         return [`Recovered within ${recWin} months`,'(% of balance at default)'];
  if(isTurn())                          return ['Turn-in Rate','(% of leases reaching scheduled end)'];
  if(isResid())                         return mode==='calendar'
      ? ['Residual Gain (Loss)','(% of residual value of vehicles sold)']
      : ['Cumulative Residual Gain (Loss)',`(% of original ${poolWord})`];
  if(metric==='cnl_ratio')              return mode==='calendar'
      ? [`Annualized ${lossName()}`,`(% of average ${poolWord})`]
      : [`Cumulative ${lossName()}`,`(% of original ${poolWord})`];
  return [metricLabel()];
};
// Tooltip rows, as the Explorer labels them for the same view.
// Extra tooltip rows for a metric, read from the same metrics-layer point as
// the rate: a repossession rate shows the repossessions and the loans at risk
// it was computed from.
const extraRows=()=>isRecov() ? [{field:"severity",type:"quantitative",title:"Loss severity",format:".1%"},
                                 {field:"margin",type:"quantitative",title:"\u00b1 margin (95%)",format:".1%"},
                                 {field:"loans",type:"quantitative",title:"Defaulted loans",format:","},
                                 {field:"window",type:"nominal",title:"Defaults"}]
                 : isRepo() ? [{field:"repos",type:"quantitative",title:"Repossessions",format:","},
                                {field:"at_risk",type:"quantitative",title:"Loans at start of month",format:","}]
                 : (isTurn() && mode==='calendar') ? [{field:"leases",type:"quantitative",title:"Leases reaching scheduled end",format:","}]
                 : (isResid() && mode==='calendar') ? [{field:"base",type:"quantitative",title:"Residual value of vehicles sold ($)",format:",.0f"}] : [];
const extraOf=p=>isRecov() ? {severity:1-p.recovery_rate, lo:p.recovery_rate-p.margin, hi:p.recovery_rate+p.margin, margin:p.margin, loans:p.loans,
                               window:p.window, flag:!!p.grey} : isRepo() ? {repos:p.repos, at_risk:p.at_risk} : (isTurn() && p.leases!=null) ? {leases:p.leases}
               : (isResid() && p.base!=null) ? {base:p.base} : null;
const tipLabels=()=>{
  if(isTurn())               return mode==='vintage' ? {series:'Vintage', x:'Months', y:'Turn-in'} : {series:'Issuer', x:'Month', y:'Turn-in'};
  if(mode==='vintage' && (metric==='cnl_ratio'||isResid()))
    return {series:'Vintage', x:'Months', y: isResid()?'Cum. Residual G/(L)':'Cum. Loss Rate'};
  if(isResid())              return {series:'Issuer', x:'Month', y:'Residual G/(L) on vehicles sold'};
  if(isRepo())               return {series:'Issuer', x:'Month', y:'Rate'};
  if(isRecov())              return {series:'Issuer', x:'Defaults through', y:'Recovered'};
  if(metric==='cnl_ratio')   return {series:'Issuer', x:'Month', y:`Annualized ${lossName().toLowerCase()}`};
  // (repossessions: the count and the loans at risk ride along — see extraRows)
  if(yoyActive())            return {series:'Series', x:'Date', y: transform==='yoy-delta' ? 'YOY \u0394 (pp)' : 'YOY %'};
  return {series:'Series', x:'Date', y:DPD()};
};
const lab=t=>(AVAIL.find(a=>a.t===t)||{}).label||t;
const labCode=t=>{ if(isAll(t)) return 'All Issuers'; const l=lab(t); if((AVAIL.find(a=>a.t===t)||{}).portfolio) return l;   // no code for a whole-portfolio set
  return l.includes(`(${t})`)?l:`${l} (${t})`; };   // the Explorer's issuer label: "Name (CODE)"
const metricTitle=()=>isRecov()?'Recovery Rate on Defaulted Loans':isRepo()?'First-Time Repossession Rate':isTurn()?'Turn-in Rate':isResid()?(mode==='calendar'?'Residual Gain (Loss) on Vehicles Sold':'Cumulative Residual Value Gain (Loss)'):metric==='cnl_ratio'?(mode==='calendar'?(assetClass==='lease'?'Annualized Net Credit Loss Rate':'Annualized Net Loss Rate'):(assetClass==='lease'?'Cumulative Net Credit Loss':'Cumulative Net Loss')):(isDQ()?`${DQ_LAB[metric]} Day Delinquency Rate`:metricLabel());
function renderVintBar(){
  const g=el('vintgroup'), bar=el('vintbar'), isVin=mode==='vintage'&&!macroId&&selected.length===1&&output!=='seasonal';
  const lbl=el('rangelabel'); if(lbl) lbl.textContent = isVin ? 'Deal age, months' : 'Range';
  g.hidden=!isVin; if(!isVin) return;
  const ys=vintYears(); if(ys.length<2){ g.hidden=true; return; }
  const last=ys[ys.length-1], m=/^(\d{4})-(\d{4})$/.exec(vint);
  const hi=m?+m[2]:last, lo=m?+m[1]:(vint==='all'?ys[0]:(ys.find(y=>y>last-(+vint))||ys[0]));   // the menus show the range drawn
  const opt=(v,sel)=>ys.map(y=>`<option${y===sel?' selected':''}>${y}</option>`).join('');
  bar.innerHTML=[['5','Last 5 yrs'],['10','Last 10 yrs'],['all','All']].map(([v,l])=>`<button class="rpill ${vint===v?'on':''}" onclick="setVint('${v}')">${l}</button>`).join('')
    + `<span class="vintcustom"><select class="ovsel" aria-label="First vintage" onchange="setVint(this.value+'-'+this.nextElementSibling.nextElementSibling.value)">${opt(0,lo)}</select>`
    + `<span> to </span><select class="ovsel" aria-label="Last vintage" onchange="setVint(this.previousElementSibling.previousElementSibling.value+'-'+this.value)">${opt(0,hi)}</select></span>`;
}
window.setVint=v=>{ const m=/^(\d{4})-(\d{4})$/.exec(v); vint = m && +m[1]>+m[2] ? `${m[2]}-${m[1]}` : v; renderChart(); };
function sourceFor(){
  // Says which source the chart on screen is actually drawn from: the loan
  // tape for loan delinquencies, the servicer reports for everything else.
  if(isRecov()) return 'SEC Form ABS-EE loan-level data, checked against Form 10-D servicer reports, EDGAR';
  if(useAbsee()||isRepo()) return 'SEC Form ABS-EE loan-level data, EDGAR';
  if((SHELVES[selected[0]]||{}).portfolio) return "Issuer's static-pool disclosures in its prospectuses: all originations, not securitized pools";
  return hasHistory() ? "SEC Form 10-D servicer reports; deals before 2010 from issuers' static-pool disclosures"
                      : 'SEC Form 10-D servicer distribution reports, EDGAR';
}
// The Losses tab draws older deals from the backfill on this shelf (loss_history): from a static-pool table where
// the trust's own reports are not public. The source line says so; the methodology has the detail.
const hasHistory=()=>metric==='cnl_ratio' && selected.some(t=>((SHELVES[t]||{}).deals||[]).some(d=>d.curve_source && d.curve_source!=='servicer report (10-D)'));
// Disclosures for the shelves on screen, from the metrics layer via the
// resolver: repossession caveats, credit-score caveats, and the loan-tape
// universe — each only where the chart actually draws that kind of data.
function notesFor(){
  const specific=[], general=[];
  selected.forEach(t=>{ const n=(SHELVES[t]||{}).notes||{};
    if(isRepo()) specific.push(...(n.repossessions||[]));
    if(isRecov()) specific.push(...(n.recoveries||[]).map(s=>`${lab(t)}: ${s}`));   // several issuers: say whose
    if(isTurn()) specific.push(...(n.turnin||[]));   // each servicer states its rate its own way
    if(isResid()) specific.push(...(n.residual||[]));
    if(metric==='cnl_ratio') specific.push(...(n.losses||[]));   // lease: the sign convention, a known odd month
    if(isAll(t) && !useAbsee()) general.push(...(n.universe||[]));   // the lease market line: how it adds up
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
  const one=selected.length===1 && !isAll(selected[0]), who=labCode(selected[0]);
  if(macroId){ const m=MACRO&&MACRO.find(x=>x.id===macroId); return `${who} vs ${m?m.name:'macro'}`; }
  if(isRepo())                 return `${one?who:AUTO()} — 1st-Time Repossessions`;
  if(isRecov())                return recView==='time' ? `${one?who:AUTO()} — Recovery Rate, ${recWin} Months After Default`
                                    : `${one?who:AUTO()} — Recovery Rate by ${recView==='ltv'?'Loan-to-Value':'New vs Used Vehicle'}`;
  if(mode==='vintage'){
    if(metric==='cnl_ratio')   return `${who} Vintage Loss Curves`;
    if(isResid())              return `${who} Vintage Residual Value Gain (Loss)`;
    if(isTurn())               return `${who} Turn-in Rate by Deal Age`;
    return `${who} Vintage`;
  }
  if(output==='table' && !one) return `${AUTO()} Issuer Comparison`;
  if(metric==='cnl_ratio')     return `${one?who:AUTO()} Annualized ${lossName()}`;
  if(isTurn())                 return `${one?who:AUTO()} Turn-in Rate`;
  if(isResid())                return `${one?who:AUTO()} Residual Gain (Loss) on Vehicles Sold`;
  const yoy = yoyActive() ? (transform==='yoy-delta' ? ' \u00b7 YOY \u0394 (pp)' : ' \u00b7 YOY %') : '';
  return `${one?who:AUTO()} DQ ${DPD()}${yoy}`;
}
function subtitleFor(){
  const book = useAbsee() ? ['All Credit Scores','New & Used'] : [];
  const poolTxt = pools==='seasoned' ? 'Seasoned pools (>6 mo)' : 'All pools';
  const n = selected.length>1 ? [`${selected.length} issuers`] : [];
  let parts;
  if(macroId)                          parts=[metricAxis()[0], poolTxt];
  else if(mode==='vintage' && isDQ())  parts=[DPD(), ...book];
  else if(mode==='vintage')            parts=[(SHELVES[selected[0]]||{}).portfolio?'By origination year (all of the lender\'s loans)':'By series (individual deals)'];
  else if(isDQ() && useAbsee())        parts=[...book, pools==='seasoned'?'Seasoned (>6mo)':''];
  else if(isRecov())                   parts=recView==='time'
                                         ? ['Loans defaulting in the four quarters to each date', 'Net of repossession and sale costs', ...n]
                                         : ['Newest cohort with 12 months of follow-up', 'Faded bars: fewer than 400 loans', ...n];
  else if(isTurn())                    parts=['All deals, weighted by leases reaching scheduled end', ...n];
  else if(isResid())                   parts=['All deals, weighted by value of vehicles sold', ...n];   // exactly the Explorer's DQ time series
  else                                 parts=[poolTxt, ...n];
  if(output==='seasonal') parts.push('Year overlay');
  return parts.filter(Boolean).join(' · ');
}
const mkey=()=>(metric==='cnl_ratio'&&mode==='calendar')?'anl_pct':(isResid()&&mode==='calendar')?'rv_margin':metric;   // calendar = the month's flow  // losses on calendar = annualized flow, not cumulative
const METRIC_META={dq_60plus_pct:{mode:'vintage',dq:true},dq_31_60_pct:{mode:'vintage',dq:true},dq_30plus_pct:{mode:'vintage',dq:true},cnl_ratio:{mode:'vintage',dq:false},repo_rate:{mode:'calendar',dq:false},recovery_rate:{mode:'calendar',dq:false},rv_gl_cum_ratio:{mode:'vintage',dq:false},turn_in_ratio:{mode:'calendar',dq:false}};
// Residual value gain/loss: lease shelves only; cumulative by deal age on the vintage view; on the time
// series, the month's gain (loss) on the vehicles sold as a share of their residual value.
const isResid=()=>metric==='rv_gl_cum_ratio';
// Turn-in rate: lease shelves whose servicer states one; a monthly rate driven by the
// used-car market, so time series by default, by deal age on the vintage view.
const isTurn=()=>metric==='turn_in_ratio';  // sensible default axis + whether DQ buckets apply (CNL has none)
function setMode(m){mode=m;document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));}

async function ensure(tks){ for(const t of tks){ if(!SHELVES[t]){ const r=await fetch(`data/${t}.json?t=`+Date.now()); SHELVES[t]=await r.json(); } } }
const calKey=()=>metric==='cnl_ratio'?'anl_pct':metric;   // the pooled calendar field for the metric (losses: the annualized flow)
