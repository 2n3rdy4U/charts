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
        (subj.deals||[]).filter(d=>d.curve_absee&&d.curve_absee.length&&vintOK(d.series)).forEach(d=>{const yr=(d.series||'').slice(0,4);
          S.push({series:d.series, grp:yr, color:yearColor(yr), pts:d.curve_absee.filter(p=>p[K]!=null).map(p=>[p.m,p[K],fmtMonth(p.date)])});});
      } else {
        (subj.deals||[]).filter(d=>d.has_tend_curve&&d.curve&&d.curve.length&&vintOK(d.series)).forEach(d=>{const yr=(d.series||'').slice(0,4);
          S.push({series:d.series, grp:yr, color:yearColor(yr), pts:(isTurn()?[]:[[0,0,'']]).concat(d.curve.filter(p=>p[K]!=null).map(p=>[p.m,p[K],fmtMonth(p.date)+(d.curve_source?' · '+d.curve_source:'')]))});});  // anchor at month-0 origin (cutoff); a monthly rate has none. curve_source: an older deal's source (loss_history)
      }
    } else if(isRecov()){ recSeries(S, subj.ticker, ISSCOLOR[0]); } else {
      const c=calOf(subj).filter(p=>p[K]!=null);
      S.push({series:labCode(subj.ticker), grp:labCode(subj.ticker), color:isAll(subj.ticker)?ALL_COLOR:ISSCOLOR[0], pts:c.map(p=>[p.date,p[K],fmtMonth(p.date),extraOf(p)])});
    }
  } else { // 2+ : calendar only (aggregate vintage dropped; cross-issuer vintage = cohort picker, next)
    if(isRecov()){ selected.forEach((tk,i)=>recSeries(S, tk, ISSCOLOR[i%ISSCOLOR.length])); return S; }
    selected.forEach((tk,i)=>{const sh=SHELVES[tk];const arr=calOf(sh).filter(p=>p[K]!=null);
      S.push({series:labCode(tk), grp:labCode(tk), color:isAll(tk)?ALL_COLOR:ISSCOLOR[i%ISSCOLOR.length], pts:arr.map(p=>[p.date,p[K],fmtMonth(p.date),extraOf(p)])});});
  }
  return S;
}
// Recoveries: one line per issuer; on the 6-month view the windows not yet 12 months old (the early read)
// are a second, dashed piece joined to the last settled point.
function recSeries(S, tk, color){
  const sh=SHELVES[tk], name=labCode(tk), pts=calOf(sh).filter(p=>p.recovery_rate!=null);
  const row=p=>[p.date,p.recovery_rate,fmtMonth(p.date),extraOf(p)];
  const settled=pts.filter(p=>!p.early), early=pts.filter(p=>p.early);
  S.push({series:name, grp:name, color, seg:name, pts:settled.map(row)});
  if(early.length) S.push({series:name, grp:name, color, seg:name+' (early read)', dash:true,
    pts:(settled.length?[row(settled[settled.length-1])]:[]).concat(early.map(row))});
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
  const rw=el('recwinctl'), rv=el('recviewctl'); if(rw) rw.hidden=!isRecov(); if(rv) rv.hidden=!isRecov();
  const rg=el('rangegroup'); if(rg) rg.hidden = isRecov() && recView!=='time';   // a single cohort has no range
  document.querySelectorAll('#recwinseg button').forEach(b=>b.classList.toggle('on',b.dataset.win===recWin));
  document.querySelectorAll('#recviewseg button').forEach(b=>b.classList.toggle('on',b.dataset.rview===recView));
  const pc=el('poolctl'); if(pc) pc.hidden = isTurn() || isRecov() || (isResid() && mode==='calendar') || !(mode==='calendar' || output==='seasonal' || macroId);   // one basis: turn-in, residual by month
  const sb=el('seasbtn'); sb.style.opacity=multiIssuer()?0.4:1; sb.setAttribute('aria-disabled', String(multiIssuer()));   // faded = unavailable, said to a screen reader too
  sb.title=multiIssuer()?'Year overlay is for one issuer at a time':'';
  el('macrosel').disabled=multiIssuer();
  el('macrosel').title=multiIssuer()?'Macro overlay is for one issuer at a time':'';
  document.querySelectorAll('#poolseg button').forEach(b=>b.classList.toggle('on',b.dataset.pools===pools));
  el('modeseg').style.opacity = output==='seasonal' ? 0.4 : 1;   // vintage/calendar N/A for the YoY view
  el('modeseg').querySelectorAll('button').forEach(b=>b.setAttribute('aria-disabled',
    String(output==='seasonal' || (b.dataset.mode==='vintage' && (isRepo()||isRecov()||anyAll())))));   // the same rule updateModeAvail fades by
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
  const vin=document.querySelector('#modeseg button[data-mode="vintage"]'), noVin=isRepo()||isRecov()||anyAll();
  vin.style.opacity=noVin?0.4:1; vin.setAttribute('aria-disabled', String(noVin));
  vin.title=isRecov()?'Recoveries are measured by default cohort across a shelf\'s deals; there is no per-deal vintage curve.'
          :isRepo()?'Repossessions are a monthly rate by calendar month; there is no per-deal vintage curve.'
          :anyAll()?'All Issuers is a pooled time series; pick one issuer for its vintage curves.':'';
  if(noVin && mode==='vintage'){ mode='calendar'; document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode==='calendar')); }
  // an earlier issuer has curves by deal age only
  const cal=document.querySelector('#modeseg button[data-mode="calendar"]'), noCal=isHist(selected[0]);
  cal.style.opacity=noCal?0.4:1; cal.setAttribute('aria-disabled', String(noCal)); cal.title=noCal?'Loss curves by deal age only for an earlier issuer':'';
  if(noCal && mode==='calendar'){ mode='vintage'; document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode==='vintage')); }
}
function renderChart(){
  updateModeAvail(); updateOutputAvail(); setCap(); renderRangeBar(); renderVintBar(); requestAnimationFrame(fitRail);
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
    + ' &middot; <a href="../methodology.html' + (hasHistory() ? '#loss-history' : '') + '">Methodology ›</a></span>';
  window.CC_CHART_SOURCE = _src + (_notes.length ? '. ' + _notes.join(' ') : '');
  const box=el('chart');
  if(!metric){ box.innerHTML='<div class="chartph">This metric is coming soon.</div>'; return; }
  if(isRecov() && recView!=='time'){ hideChips(); return renderRecoveryCuts(box); }
  if(macroId) return renderOverlay(box);   // macro overlay: dual-axis, single subject, calendar
  if(output==='seasonal'){ hideChips(); return renderSeasonal(box); }
  let S=buildSeries(); const isVin=mode==='vintage';
  if(!S.length || S.every(x=>!x.pts.length)){ hideChips();
    const rs=((SHELVES[selected[0]]||{}).pool_snapshot||{}).loss_recon_status;
    box.innerHTML = isRecov()
      ? `<div class="chartph">${esc(recEmptyText())}</div>`
      : (anyAll() && !isDQ())
      ? (assetClass==='lease'
         ? '<div class="chartph">All Issuers is published for delinquency and credit losses; residual results and turn-in are each servicer\'s own definition, so pick an issuer for them.</div>'
         : '<div class="chartph">All Issuers is published for delinquency only; pick an issuer for its losses and repossessions.</div>')
      : (metric==='cnl_ratio' && rs==='none')
      ? '<div class="chartph">No servicer reports are collected for this shelf: its filings ended before collection began. Delinquency and repossessions come from the loan tape.</div>'
      : (isRepo() && assetClass==='lease')
      ? '<div class="chartph">Repossessions are not yet published for lease shelves.</div>'
      : (isRecov() && assetClass==='lease')
      ? '<div class="chartph">Recoveries are published for loan shelves; lease losses are residual values, under Residuals.</div>'
      : isRecov()
      ? `<div class="chartph">${esc(recEmptyText())}</div>`
      : isTurn()
      ? `<div class="chartph">${esc(((SHELVES[selected[0]]||{}).notes||{}).turnin?.[0] || 'No turn-in rate is reported for this shelf.')}</div>`
      : (isResid() && mode==='calendar')
      ? '<div class="chartph">No monthly residual results are reported for this shelf.</div>'
      : (metric==='cnl_ratio' && !isVin && rs==='withheld')
      ? '<div class="chartph">Loss series withheld: this shelf\'s monthly and cumulative loss figures do not reconcile, so it is not published until they do.</div>'
      : '<div class="chartph">no curve data wired for this view yet</div>';
    return; }
  if(yoyActive()) S=S.map(s=>({...s, pts:applyYoy(s.pts)}));
  S=applyRange(S,isVin);
  if(!isVin && S.every(x=>!x.pts.length)){ hideChips(); box.innerHTML='<div class="chartph">Not enough history for a year-over-year comparison.</div>'; return; }
  if(output==='table'){ hideChips(); return isRecov() ? renderRecoveryTable(box,S) : renderTable(box,S,isVin); }
  const grps=[...new Set(S.map(s=>s.grp))], col=g=>S.find(s=>s.grp===g).color;
  if(isVin){   // VINTAGE: per-deal/issuer lines — Vega legend + click-highlight, no per-series chips
    hideChips();
    const data=[]; S.forEach(s=>s.pts.forEach(([x,y,xl])=>data.push({x,y,series:s.series,grp:s.grp,xl})));
    const T=tipLabels(), isLoss=(metric==='cnl_ratio'||isResid()||isTurn());   // x is deal age in months
    const X={field:"x",type:"quantitative",title:(SHELVES[selected[0]]||{}).portfolio?"Months Since Origination":"Months Since Issuance",scale:{zero:true,nice:false},axis:{format:"d",tickMinStep:isLoss?6:1}};
    // From 0 unless a value is visibly below it (a lease credit gain): a negligible negative — AmeriCredit 2001-B's
    // -0.000065% first month — must not pull a "nice" axis down a whole step. The value itself is unchanged.
    const ymin=Math.min(0,...data.map(d=>d.y).filter(v=>v!=null));
    const Y={field:"y",type:"quantitative",title:metricAxis(),axis:{format:axFmt(data.map(d=>d.y))},
             scale:ymin>-0.0005?{zero:true,domainMin:0}:{zero:true}};
    // Past 30 deals a colour per deal stops telling them apart: colour and legend by vintage year instead (the
    // tooltip still names the deal).
    const MANY=new Set(S.map(x=>x.series)).size>30 && ((SHELVES[selected[0]]||{}).deals||[]).some(d=>d.curve_source);   // only with the older deals (loss_history)
    const C=MANY?{field:"grp",type:"ordinal",title:"Vintage",scale:{scheme:"viridis"},legend:legendCfg()}
               :{field:"series",type:"nominal",title:"Series",scale:{scheme:"tableau10"},legend:legendCfg()};
    const rows=[{field:"series",type:"nominal",title:T.series},
      isLoss?{field:"x",type:"quantitative",title:T.x}:{field:"xl",type:"nominal",title:T.x},
      {field:"y",type:"quantitative",title:T.y,format:".2%"}];
    return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(MANY?new Set(S.map(x=>x.grp)).size:new Set(S.map(x=>x.series)).size,legendCols()), background:null,
      layer:[
        {data:{values:data}, params:[{name:"hl",select:{type:"point",fields:[MANY?"grp":"series"],toggle:true,clear:false},bind:"legend"}],
         mark:{type:"line",interpolate:"monotone"},
         encoding:{x:X, y:Y, color:C, detail:{field:"series"},
           opacity:{condition:{param:"hl",value:1},value:0.25},
           strokeWidth:{condition:{param:"hl",empty:false,value:3},value:1.5}}},
        ...hoverLayers(data.filter(d=>isLoss||d.xl), X, Y, {color:C, rows}, "hover")
      ], config:CHART_CFG });
  }
  return calendarChart(box,S,{axisTitle:metricAxis(), axisFormat:vals=>yoyActive() ? (transform==='yoy-delta' ? '+.2%' : '+.1%') : axFmt(vals),
    tip:tipLabels(), extraRows:extraRows(), boldTest:"datum.series === 'All Issuers'", nEntries:selected.length,
    band:isRecov(), points:isRecov(), valueFormat:isRecov()?'.1%':undefined, yZero:!isRecov(),
    xTitle:isRecov()?'Defaults through (end of each four-quarter window)':undefined});
}
/* ---------- Recoveries: empty states, the cohort table, the newest-cohort cuts ---------- */
// Why a shelf has no recovery series, in the reader's words (the status comes from the metrics layer).
function recEmptyText(){
  const ps=(SHELVES[selected[0]]||{}).pool_snapshot||{}, st=ps.recovery_status;
  if(anyAll()) return 'Recoveries are published issuer by issuer; pick an issuer.';
  if(st==='withheld') return 'Not published for this shelf. '+(ps.recovery_reason||'Its data does not yet meet the standard.');
  if(st==='unavailable'||st==='error') return 'Not published today: this shelf\'s recovery series could not be checked against its servicer reports, so it is withheld rather than shown unchecked.';
  return 'No recovery series for this shelf yet: it needs four quarters of defaults, each followed for 12 months.';
}
// Table: one row per cohort window, newest first; each cell is the rate, its 95% margin and the loans it covers.
function renderRecoveryTable(box,S){
  const issuers=[...new Set(S.map(s=>s.grp))];
  const cell=new Map(); S.forEach(s=>s.pts.forEach(([x,y,xl,e])=>cell.set(s.grp+'|'+x,{y,e,early:!!s.dash})));
  const xs=[...new Set(S.flatMap(s=>s.pts.map(p=>p[0])))].sort().reverse();
  const th='<th>Defaults (four quarters)</th>'+issuers.map(g=>`<th class="num">${esc(g)}</th>`).join('');
  const body=xs.map(x=>{ const any=issuers.map(g=>cell.get(g+'|'+x)).find(Boolean);
    return `<tr><td>${esc(any&&any.e?any.e.window:x)}</td>`+issuers.map(g=>{ const c=cell.get(g+'|'+x);
      if(!c) return '<td class="num">·</td>';
      const dim=c.e.flag||c.early;
      return `<td class="num"${dim?' style="color:var(--muted)"':''}>${pct(c.y,1)} ±${(c.e.margin*100).toFixed(1)} · ${c.e.loans.toLocaleString('en-US')}${c.early?' (early)':''}</td>`; }).join('')+'</tr>'; }).join('');
  box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body||'<tr><td>no data</td></tr>'}</tbody></table></div>
    <div class="otnote">Rate ±95% margin · defaulted loans. Grey: margin wider than ±3 points, or a provisional early read.</div>`;
}
// Cuts: the newest 12-month cohort by loan-to-value band or new/used vehicle, issuers side by side.
// A bar for fewer than 400 loans is drawn grey: too few to measure within ±3 points.
function renderRecoveryCuts(box){
  const dim=recView==='ltv'?'ltv':'vehicle', order=dim==='ltv'?['Under 100%','100–120%','120% and over']:['New','Used'];
  const data=[], wins=[];
  selected.forEach((tk,i)=>{ const c=((SHELVES[tk]||{}).pooled||{}).recovery_cuts||{};
    (c[dim]||[]).forEach(r=>data.push({band:r.band, issuer:labCode(tk), rate:r.recovery_rate, loans:r.loans, few:r.loans<400, window:c.window}));
    if(c.window) wins.push(c.window); });
  if(!data.length){ box.innerHTML=`<div class="chartph">${esc(recEmptyText())}</div>`; return; }
  const grps=selected.map(labCode), cols=selected.map((t,i)=>ISSCOLOR[i%ISSCOLOR.length]);
  if(output==='table'){
    const th='<th>'+(dim==='ltv'?'Loan-to-value at origination':'Vehicle')+'</th>'+grps.map(g=>`<th class="num">${esc(g)}</th>`).join('');
    const body=order.map(b=>`<tr><td>${b}</td>`+grps.map(g=>{ const r=data.find(d=>d.band===b&&d.issuer===g);
      return r?`<td class="num"${r.few?' style="color:var(--muted)"':''}>${pct(r.rate,1)} · ${r.loans.toLocaleString('en-US')}</td>`:'<td class="num">·</td>'; }).join('')+'</tr>').join('');
    box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="otnote">Recovered within 12 months · defaulted loans. Defaults ${esc([...new Set(wins)].join('; '))}. Grey: fewer than 400 loans.</div>`;
    return;
  }
  const C={field:"issuer",type:"nominal",title:"Issuer",scale:{domain:grps,range:cols},
           legend:grps.length>1?{...legendCfg(true),symbolType:"square",symbolStrokeWidth:0,symbolOpacity:1}:null};
  return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(grps.length,6), background:null,
    data:{values:data},
    mark:{type:"bar",cornerRadiusEnd:2},
    encoding:{x:{field:"band",type:"nominal",sort:order,title:dim==='ltv'?'Loan-to-value at origination':'Vehicle',axis:{labelAngle:0}},
      xOffset:{field:"issuer",sort:grps},
      y:{field:"rate",type:"quantitative",title:['Recovered within 12 months','(% of balance at default)'],axis:{format:".0%"},scale:{zero:true}},
      color:C, opacity:{condition:{test:"datum.few",value:0.35},value:0.9},
      tooltip:[{field:"issuer",title:"Issuer"},{field:"band",title:dim==='ltv'?'LTV':'Vehicle'},{field:"rate",title:"Recovered",format:".1%"},
               {field:"loans",title:"Defaulted loans",format:","},{field:"window",title:"Defaults"}]},
    config:CHART_CFG });
}
