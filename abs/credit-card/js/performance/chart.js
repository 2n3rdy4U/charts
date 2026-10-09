// Build B · Performance page — chart and table rendering (Vega-Lite). Plain scripts sharing one scope,
// loaded in order by index.html; see web/README.md.
/* ---------- chart (Vega-Lite) ---------- */
function buildSeries(){
  const subj=SHELVES[selected[0]], S=[];
  if(!metric) return S;
  const K=mkey();
  if(selected.length===1){
    if(mode==='vintage'){
      if(useAbsee()){   // loan tape: starts at the first full performance month, as the Explorer draws it
        (subj.deals||[]).filter(d=>d.curve_absee&&d.curve_absee.length).forEach(d=>{const yr=(d.series||'').slice(0,4);
          S.push({series:d.series, grp:yr, color:yearColor(yr), pts:d.curve_absee.filter(p=>p[K]!=null).map(p=>[p.m,p[K],fmtMonth(p.date)])});});
      } else {
        (subj.deals||[]).filter(d=>d.has_tend_curve&&d.curve&&d.curve.length).forEach(d=>{const yr=(d.series||'').slice(0,4);
          S.push({series:d.series, grp:yr, color:yearColor(yr), pts:[[0,0,'']].concat(d.curve.filter(p=>p[K]!=null).map(p=>[p.m,p[K],fmtMonth(p.date)]))});});  // anchor at month-0 origin (cutoff)
      }
    } else {
      const c=calOf(subj).filter(p=>p[K]!=null);
      S.push({series:labCode(subj.ticker), grp:labCode(subj.ticker), color:isAll(subj.ticker)?ALL_COLOR:ISSCOLOR[0], pts:c.map(p=>[p.date,p[K],fmtMonth(p.date),extraOf(p)])});
    }
  } else { // 2+ : calendar only (aggregate vintage dropped; cross-issuer vintage = cohort picker, next)
    selected.forEach((tk,i)=>{const sh=SHELVES[tk];const arr=calOf(sh).filter(p=>p[K]!=null);
      S.push({series:labCode(tk), grp:labCode(tk), color:isAll(tk)?ALL_COLOR:ISSCOLOR[i%ISSCOLOR.length], pts:arr.map(p=>[p.date,p[K],fmtMonth(p.date),extraOf(p)])});});
  }
  return S;
}
function setCap(){ el('chartcap').textContent = subtitleFor(); }   // the Explorer's sub-head: settings in force
function updateCutAvail(){
  // The year-over-year view exists for the loan-tape delinquency time series.
  el('xfctl').hidden = !(isDQ() && useAbsee() && !isRepo() && mode==='calendar' && output!=='seasonal' && !macroId);
  document.querySelectorAll('#xfseg button').forEach(b=>b.classList.toggle('on',b.dataset.transform===transform));
}
function updateOutputAvail(){
  updateCutAvail();
  document.querySelectorAll('#outseg button').forEach(b=>b.classList.toggle('on',b.dataset.out===output));
  // Row density applies to the age-indexed vintage table only — the calendar
  // table's rows are issuers and its columns are years.
  const rc=el('rowsctl'); if(rc) rc.hidden = !(output==='table' && mode==='vintage');
  // Pools applies wherever a pooled series is drawn: time series, year overlay,
  // macro overlay. Per-deal vintage curves have no pool to season.
  const pc=el('poolctl'); if(pc) pc.hidden = !(mode==='calendar' || output==='seasonal' || macroId);
  const sb=el('seasbtn'); sb.style.opacity=multiIssuer()?0.4:1;
  sb.title=multiIssuer()?'Year overlay is for one issuer at a time':'';
  el('macrosel').disabled=multiIssuer();
  el('macrosel').title=multiIssuer()?'Macro overlay is for one issuer at a time':'';
  document.querySelectorAll('#poolseg button').forEach(b=>b.classList.toggle('on',b.dataset.pools===pools));
  el('modeseg').style.opacity = output==='seasonal' ? 0.4 : 1;   // vintage/calendar N/A for the YoY view
  el('modeseg').title = output==='seasonal' ? 'Vintage/Time-series does not apply to the year-over-year view' : '';
}
function enforceSingleIssuerViews(){
  if(!multiIssuer()) return;
  if(output==='seasonal'){ output='chart'; toast('Year overlay compares one issuer\'s years against each other — showing the time series for the issuers selected.'); }
  if(macroId){ macroId=null; el('macrosel').value=''; el('macrosel').classList.remove('on');
               toast('Macro overlay plots one issuer against a macro series — showing the issuers selected without it.'); }
}
function setOutput(o){
  if(o==='seasonal' && multiIssuer()){ toast('Year overlay is for one issuer at a time — select a single issuer to use it.'); return; }
  output=o; renderChart();
}
window.setTableAll=v=>{ tableAll=v; renderChart(); };
document.querySelectorAll('#rowseg button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#rowseg button').forEach(x=>x.classList.toggle('on',x===b));
  setTableAll(b.dataset.rows==='1');
});
function renderTable(box,S,isVin){ return isVin?renderVintageTable(box,S):renderCalendarTable(box,S); }
function renderVintageTable(box,S){  // rows = age, cols = deals/vintages; shaded ACROSS each row (compare vintages at the same age)
  const cols=S.map(s=>s.series), maps=S.map(s=>{const m=new Map(); s.pts.forEach(([x,y])=>m.set(x,y)); return m;});
  let xs=[...new Set(S.flatMap(s=>s.pts.map(p=>p[0])))].sort((a,b)=>a-b);
  if(!tableAll) xs=xs.filter(x=>x%6===0);
  const th=`<th>Age</th>`+cols.map(c=>`<th class="num">${esc(c)}</th>`).join('');
  const body=xs.map(x=>{const row=maps.map(m=>m.get(x)), rv=row.filter(v=>v!=null), lo=Math.min(...rv), hi=Math.max(...rv);
    return `<tr><td><b>M${x}</b></td>`+row.map(v=>`<td class="num" style="${heatBG(v,lo,hi)}">${v==null?'·':pct(v,2)}</td>`).join('')+'</tr>';}).join('');
  box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body||'<tr><td>no data</td></tr>'}</tbody></table></div>
    <div class="otnote">Value at deal age · shaded across each row, so vintages compare at the same age.</div>`;
}
function updateModeAvail(){
  // Vintage curves describe one issuer: there the picker takes one (as the
  // Explorer's does), so a second issuer never pushes the view to time series.
  // The All Issuers series has no deals, so no vintage curves either.
  const vin=document.querySelector('#modeseg button[data-mode="vintage"]'), noVin=isRepo()||anyAll();
  vin.style.opacity=noVin?0.4:1;
  vin.title=isRepo()?'Repossessions are a monthly rate by calendar month; there is no per-deal vintage curve.'
          :anyAll()?'All Issuers is a pooled time series; pick one issuer for its vintage curves.':'';
  if(noVin && mode==='vintage'){ mode='calendar'; document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode==='calendar')); }
}
function renderChart(){
  updateModeAvail(); updateOutputAvail(); setCap(); renderRangeBar(); requestAnimationFrame(fitRail);
  // One title, set here so every view below it (chart / table / year overlay /
  // macro overlay) is captioned by the same call that decides what is drawn.
  // share.js reads this element for the exported PNG's header, so the image
  // cannot go out describing something other than what it pictures.
  el('viewTitle').textContent = titleFor();
  renderCtx();
  syncAddress();
  if(_focusNext){ _focusNext=false; requestAnimationFrame(focusChart); }
  // Same call site as the title, for the same reason: share.js reads this when
  // it composes the PNG footer, so the image states its own provenance.
  const _src = sourceFor(), _notes = notesFor();
  // On a phone the full line (source + every disclosure) would run several
  // lines under the chart, so it collapses to one tappable "Source & notes".
  el('chartsrc').innerHTML = '<button type="button" class="src-toggle" onclick="this.parentNode.classList.toggle(\'open\')">Source &amp; notes ›</button>'
    + '<span class="src-full">Source: ' + esc(_src)
    + (_notes.length ? ' &middot; ' + esc(_notes.join(' ')) : '')
    + ' &middot; <a href="../methodology.html">Methodology &amp; Data Quality</a></span>';
  window.CC_CHART_SOURCE = _src + (_notes.length ? '. ' + _notes.join(' ') : '');
  const box=el('chart');
  if(!metric){ box.innerHTML='<div class="chartph">This metric is coming soon.</div>'; return; }
  if(macroId) return renderOverlay(box);   // macro overlay: dual-axis, single subject, calendar
  if(output==='seasonal'){ hideChips(); return renderSeasonal(box); }
  let S=buildSeries(); const isVin=mode==='vintage';
  if(!S.length || S.every(x=>!x.pts.length)){ hideChips();
    const rs=((SHELVES[selected[0]]||{}).pool_snapshot||{}).loss_recon_status;
    box.innerHTML = (anyAll() && !isDQ())
      ? '<div class="chartph">All Issuers is published for delinquency only; pick an issuer for its losses and repossessions.</div>'
      : (metric==='cnl_ratio' && rs==='none')
      ? '<div class="chartph">No servicer reports are collected for this shelf: its filings ended before collection began. Delinquency and repossessions come from the loan tape.</div>'
      : (isRepo() && assetClass==='lease')
      ? '<div class="chartph">Repossessions are not yet published for lease shelves.</div>'
      : (isResid() && mode==='calendar')
      ? '<div class="chartph">Residual value gain (loss) is cumulative — see the vintage view.</div>'
      : (metric==='cnl_ratio' && !isVin && rs==='withheld')
      ? '<div class="chartph">Loss series withheld: this shelf\'s monthly and cumulative loss figures do not reconcile, so it is not published until they do.</div>'
      : '<div class="chartph">no curve data wired for this view yet</div>';
    return; }
  if(yoyActive()) S=S.map(s=>({...s, pts:applyYoy(s.pts)}));
  S=applyRange(S,isVin);
  if(!isVin && S.every(x=>!x.pts.length)){ hideChips(); box.innerHTML='<div class="chartph">Not enough history for a year-over-year comparison.</div>'; return; }
  if(output==='table'){ hideChips(); return renderTable(box,S,isVin); }
  const grps=[...new Set(S.map(s=>s.grp))], col=g=>S.find(s=>s.grp===g).color;
  if(isVin){   // VINTAGE: per-deal/issuer lines — Vega legend + click-highlight, no per-series chips
    hideChips();
    const data=[]; S.forEach(s=>s.pts.forEach(([x,y,xl])=>data.push({x,y,series:s.series,grp:s.grp,xl})));
    const T=tipLabels(), isLoss=(metric==='cnl_ratio'||isResid());
    const X={field:"x",type:"quantitative",title:"Months Since Issuance",scale:{zero:true,nice:false},axis:{format:"d",tickMinStep:isLoss?6:1}};
    const Y={field:"y",type:"quantitative",title:metricAxis(),axis:{format:axFmt(data.map(d=>d.y))},scale:{zero:true}};
    const C={field:"series",type:"nominal",title:"Series",scale:{scheme:"tableau10"},legend:legendCfg()};
    const rows=[{field:"series",type:"nominal",title:T.series},
      isLoss?{field:"x",type:"quantitative",title:T.x}:{field:"xl",type:"nominal",title:T.x},
      {field:"y",type:"quantitative",title:T.y,format:".2%"}];
    return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(new Set(S.map(x=>x.series)).size,legendCols()), background:null,
      layer:[
        {data:{values:data}, params:[{name:"hl",select:{type:"point",fields:["series"],toggle:true,clear:false},bind:"legend"}],
         mark:{type:"line",interpolate:"monotone"},
         encoding:{x:X, y:Y, color:C, detail:{field:"series"},
           opacity:{condition:{param:"hl",value:1},value:0.25},
           strokeWidth:{condition:{param:"hl",empty:false,value:3},value:1.5}}},
        ...hoverLayers(data.filter(d=>isLoss||d.xl), X, Y, {color:C, rows}, "hover")
      ], config:CHART_CFG });
  }
  return calendarChart(box,S,{axisTitle:metricAxis(), axisFormat:vals=>yoyActive() ? (transform==='yoy-delta' ? '+.2%' : '+.1%') : axFmt(vals),
    tip:tipLabels(), extraRows:extraRows(), boldTest:"datum.series === 'All Issuers'", nEntries:selected.length});
}
