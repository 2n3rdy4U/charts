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
          S.push({series:d.series, grp:yr, color:yearColor(yr), pts:d.curve_absee.filter(p=>p[K]!=null).map(p=>[p.m,p[K],'M'+p.m])});});
      } else {
        (subj.deals||[]).filter(d=>d.has_tend_curve&&d.curve&&d.curve.length).forEach(d=>{const yr=(d.series||'').slice(0,4);
          S.push({series:d.series, grp:yr, color:yearColor(yr), pts:[[0,0,'M0']].concat(d.curve.filter(p=>p[K]!=null).map(p=>[p.m,p[K],'M'+p.m]))});});  // anchor at month-0 origin (cutoff)
      }
    } else {
      const c=calOf(subj).filter(p=>p[K]!=null);
      S.push({series:subj.ticker, grp:subj.ticker, color:ISSCOLOR[0], pts:c.map(p=>[p.date,p[K],fmtMonth(p.date)])});
    }
  } else { // 2+ : calendar only (aggregate vintage dropped; cross-issuer vintage = cohort picker, next)
    selected.forEach((tk,i)=>{const sh=SHELVES[tk];const arr=calOf(sh).filter(p=>p[K]!=null);
      S.push({series:AVAIL.find(a=>a.t===tk).label, grp:AVAIL.find(a=>a.t===tk).label, color:ISSCOLOR[i%ISSCOLOR.length], pts:arr.map(p=>[p.date,p[K],fmtMonth(p.date)])});});
  }
  return S;
}
const seasLabel=()=>isRepo()?'first-time repossessions':metric==='cnl_ratio'?'annualized net loss':(isDQ()?`${DQ_LAB[metric]} delinquency`:'this metric');
function setCap(){   // title carries the "what"; caption is just the read-hint
  if(output==='seasonal'){ el('chartcap').innerHTML='Year overlay — one line per calendar year'
      + (pools==='seasoned'?' · deals 6+ months old':''); return; }
  if(output==='table'){ el('chartcap').innerHTML = mode==='vintage'
      ? 'Value at deal age · shaded <b>across each row</b>, so vintages compare at the same age'
      : 'Annual average of monthly readings · shaded globally (darker = higher)'; return; }
  const tk = selected.length===1 ? `<b>${esc(selected[0])}</b> &middot; ` : '';   // a comparison names no single issuer
  const basis = pools==='seasoned' ? 'deals 6+ months old' : 'all deals reporting';
  el('chartcap').innerHTML = selected.length===1
    ? tk + (mode==='vintage'? 'one line per deal — click a deal in the legend to highlight it'
                            : `pooled across ${basis}, by calendar month`)
    : tk + `${selected.length} issuers, each pooled across ${basis} — calendar comparison`;
}
function updateOutputAvail(){
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
// Views that describe ONE issuer: the year overlay (its years against each
// other) and the macro overlay (its series against a macro series). With two
// or more issuers they are unavailable, and the page says so rather than
// silently drawing only the first one.
const multiIssuer=()=>selected.length>1;
function toast(msg){
  let t=el('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),4200);
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
function showLens(which){
  const fixed = !!(window.BB_PRESET&&window.BB_PRESET.static);   // a shelf page: both panels, always
  el('perfPanel').hidden  = !fixed && which!=='chart';
  el('dealsPanel').hidden = !fixed && which!=='deals';
  // Redraw on entry: Vega sizes to its container, so a chart drawn while its
  // panel was hidden measures zero width.
  if(which==='deals') renderDeals(); else renderChart();
}
window.setTableAll=v=>{ tableAll=v; renderChart(); };
document.querySelectorAll('#rowseg button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#rowseg button').forEach(x=>x.classList.toggle('on',x===b));
  setTableAll(b.dataset.rows==='1');
});
function heatBG(v,lo,hi){ if(v==null||hi<=lo) return ''; const a=Math.max(0,Math.min(1,(v-lo)/(hi-lo)))*0.6; return `background:rgba(192,73,47,${a.toFixed(3)})`; }
function renderTable(box,S,isVin){ return isVin?renderVintageTable(box,S):renderCalendarTable(box,S); }
function renderVintageTable(box,S){  // rows = age, cols = deals/vintages; shaded ACROSS each row (compare vintages at the same age)
  const cols=S.map(s=>s.series), maps=S.map(s=>{const m=new Map(); s.pts.forEach(([x,y])=>m.set(x,y)); return m;});
  let xs=[...new Set(S.flatMap(s=>s.pts.map(p=>p[0])))].sort((a,b)=>a-b);
  if(!tableAll) xs=xs.filter(x=>x%6===0);
  const th=`<th>Age</th>`+cols.map(c=>`<th class="num">${esc(c)}</th>`).join('');
  const body=xs.map(x=>{const row=maps.map(m=>m.get(x)), rv=row.filter(v=>v!=null), lo=Math.min(...rv), hi=Math.max(...rv);
    return `<tr><td><b>M${x}</b></td>`+row.map(v=>`<td class="num" style="${heatBG(v,lo,hi)}">${v==null?'·':pct(v,2)}</td>`).join('')+'</tr>';}).join('');
  box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body||'<tr><td>no data</td></tr>'}</tbody></table></div>`;
}
function renderCalendarTable(box,S){  // rows = issuer(s), cols = calendar years; cell = annual avg of monthly readings; global heat
  const rows=S.map(s=>{const by={}; s.pts.forEach(([x,y])=>{const yr=String(x).slice(0,4); (by[yr]=by[yr]||[]).push(y);});
    const avg={}; for(const yr in by) avg[yr]=by[yr].reduce((a,b)=>a+b,0)/by[yr].length; return {name:s.series,avg};});
  const years=[...new Set(rows.flatMap(r=>Object.keys(r.avg)))].sort(), partial=years[years.length-1];
  const allv=rows.flatMap(r=>Object.values(r.avg)), lo=Math.min(...allv), hi=Math.max(...allv);
  const th=`<th>Issuer</th>`+years.map(y=>`<th class="num">${y}${y===partial?'†':''}</th>`).join('');
  const body=rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td>`+years.map(y=>{const v=r.avg[y];return `<td class="num" style="${heatBG(v,lo,hi)}">${v==null?'·':pct(v,2)}</td>`;}).join('')+'</tr>').join('');
  box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="otnote">Annual average of monthly readings, by calendar year · shaded globally (darker = higher) · <b>†</b> ${partial} is a partial-year (YTD) average.</div>`;
}
function renderSeasonal(box){
  if(typeof vegaEmbed==='undefined'){ box.innerHTML='<div class="chartph">loading chart library…</div>'; return; }
  const subj=SHELVES[selected[0]], sk=metric==='cnl_ratio'?'anl_pct':metric, cal=calOf(subj);
  const data=cal.filter(p=>p[sk]!=null).map(p=>{const a=p.date.split('-').map(Number);return {mn:a[1],y:p[sk],year:String(a[0])};});
  if(!data.length){ box.innerHTML='<div class="chartph">no seasonal data for this metric</div>'; return; }
  const spec={
    $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(new Set(data.map(d=>d.year)).size,6), background:null,
    data:{values:data},
    params:[{name:"hl",select:{type:"point",fields:["year"]},bind:"legend"}],
    mark:{type:"line",strokeWidth:2,point:{size:22,filled:true},interpolate:"monotone"},
    encoding:{
      x:{field:"mn",type:"quantitative",title:null,scale:{domain:[1,12],nice:false},
         axis:{values:[1,2,3,4,5,6,7,8,9,10,11,12],labelExpr:"['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][datum.value]",grid:false}},
      y:{field:"y",type:"quantitative",title:metricAxis(),axis:{format:AXFMT,grid:true},scale:{zero:true}},
      color:{field:"year",type:"nominal",title:null,scale:{scheme:"viridis"},legend:{orient:"bottom"}},
      opacity:{condition:{param:"hl",value:1},value:0.18},
      tooltip:[{field:"year",title:"Year"},{field:"mn",title:"Month"},{field:"y",title:seasLabel(),format:".2%"}]
    },
    config:{view:{stroke:null},font:"-apple-system,Segoe UI,Roboto,sans-serif",
      axis:{labelColor:"#6b7585",titleColor:"#6b7585",domainColor:"#e4e8ef",gridColor:"#eef1f6",titleFontWeight:"normal",labelFontSize:11,titleFontSize:11.5},
      legend:{labelColor:"#33414f",labelFontSize:11.5,symbolStrokeWidth:3}}
  };
  vegaEmbed(box,spec,VEGA_OPTS).then(()=>fitChart(box,spec)).catch(e=>{box.innerHTML='<div class="chartph">chart error: '+esc(e.message)+'</div>';});
}
function updateModeAvail(){
  const vin=document.querySelector('#modeseg button[data-mode="vintage"]'), multi=selected.length>=2, noVin=multi||isRepo();
  vin.style.opacity=noVin?0.4:1;
  vin.title=isRepo()?'Repossessions are a monthly rate by calendar month; there is no per-deal vintage curve.'
          :multi?'Vintage curves are single-issuer; cross-issuer comparison is calendar (pooled). Drop to one issuer for per-deal vintage.':'';
  if(noVin && mode==='vintage'){ mode='calendar'; document.querySelectorAll('#modeseg button').forEach(b=>b.classList.toggle('on',b.dataset.mode==='calendar')); }
}
function renderOverlay(box){
  const subj=SHELVES[selected[0]], sk=metric==='cnl_ratio'?'anl_pct':metric, mlab=metricLabel();
  const cal=calOf(subj), m=MACRO&&MACRO.find(x=>x.id===macroId);
  if(!m){ box.innerHTML='<div class="chartph">overlay data not loaded</div>'; return; }
  let absA=cal.filter(p=>p[sk]!=null).map(p=>({date:p.date,y:p[sk]}));
  if(!absA.length){ box.innerHTML='<div class="chartph">no calendar data for this metric</div>'; return; }
  const d0=absA[0].date.slice(0,7), d1=absA[absA.length-1].date.slice(0,7);
  let macA=m.values.filter(([d])=>d.slice(0,7)>=d0&&d.slice(0,7)<=d1).map(([d,v])=>({date:d,v}));
  if(range!=='all'){ const latest=absA[absA.length-1].date, cut=(parseInt(latest.slice(0,4))-range)+latest.slice(4);
    absA=absA.filter(p=>p.date>=cut); macA=macA.filter(p=>p.date>=cut); }
  const aMk=seriesMark('ovmetric'), aAx=axisBy['ovmetric']||'left';
  const mMk=seriesMark('ovmacro'),  mAx=axisBy['ovmacro']||'right';   // macro defaults to the right axis
  renderSeriesChips([{key:'ovmetric',name:`${subj.ticker} ${mlab}`,color:'#2f6db5'},{key:'ovmacro',name:m.name,color:'#9c4fb5'}], true);
  const absMk = aMk==='bar'?{type:"bar",color:"#2f6db5",opacity:0.6}:{type:"line",color:"#2f6db5",strokeWidth:2.6,interpolate:"monotone"};
  const macMk = mMk==='bar'?{type:"bar",color:"#b98fd6",opacity:0.45}:{type:"line",color:"#9c4fb5",strokeWidth:2.4,interpolate:"monotone"};
  // a level index (CPI, sentiment, sales) gets a non-zero baseline so its shape shows; a rate axis stays zero-based
  const macScale = mMk==='bar' ? {zero:false,nice:true} : {zero:false,nice:true};
  embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(selected.length,6), background:null,
    encoding:{x:{field:"date",type:"temporal",title:null,axis:{format:"%Y",tickCount:"year",grid:false}}},
    layer:[
      {data:{values:macA},mark:macMk,
       encoding:{y:{field:"v",type:"quantitative",title:m.name,scale:macScale,axis:{orient:mAx,grid:false,titleColor:"#9c4fb5",labelColor:"#9c4fb5"}},
         tooltip:[{field:"date",type:"temporal",title:"Date",format:"%b %Y"},{field:"v",title:m.name}]}},
      {data:{values:absA},mark:absMk,
       encoding:{y:{field:"y",type:"quantitative",title:mlab,scale:{zero:true},axis:{orient:aAx,format:AXFMT,grid:aAx==='left',titleColor:"#2f6db5",labelColor:"#2f6db5"}},
         tooltip:[{field:"date",type:"temporal",title:"Date",format:"%b %Y"},{field:"y",title:mlab,format:".2%"}]}}
    ],
    resolve:{scale:{y:"independent"}}, config:CHART_CFG });
  el('chartcap').innerHTML='';   // title + chips already say what this is
}
function applyRange(S,isVin){   // vintage: cap age <= range months; calendar: trailing `range` years from latest
  if(range==='all') return S;
  if(isVin) return S.map(s=>({...s,pts:s.pts.filter(p=>p[0]<=range)}));
  let latest=''; S.forEach(s=>s.pts.forEach(p=>{ if(typeof p[0]==='string'&&p[0]>latest) latest=p[0]; }));
  if(!latest) return S;
  const cut=(parseInt(latest.slice(0,4))-range)+latest.slice(4);
  return S.map(s=>({...s,pts:s.pts.filter(p=>p[0]>=cut)}));
}
function renderRangeBar(){
  const grp=el('rangegroup'), bar=el('rangebar'); if(!bar) return;
  if(output==='seasonal'){ if(grp)grp.style.display='none'; return; }   // year-overlay is already Jan–Dec
  if(grp)grp.style.display='';
  const isVin = mode==='vintage' && !macroId;   // overlay is calendar
  const opts = isVin ? [['12','M12'],['24','M24'],['36','M36'],['48','M48'],['all','All']]
                     : [['1','1Y'],['3','3Y'],['5','5Y'],['all','All']];
  if(!opts.some(o=>o[0]===String(range))) range='all';   // reset if the unit no longer applies (mode switch)
  bar.innerHTML=opts.map(([v,l])=>`<button class="rpill ${String(range)===v?'on':''}" onclick="setRange('${v}')">${l}</button>`).join('');
}
window.setRange=v=>{ range = v==='all'?'all':parseInt(v); renderChart(); };
const CHART_CFG={view:{stroke:null},font:"-apple-system,Segoe UI,Roboto,sans-serif",
  axis:{labelColor:"#6b7585",titleColor:"#6b7585",domainColor:"#e4e8ef",gridColor:"#eef1f6",titleFontWeight:"normal",labelFontSize:13,titleFontSize:14,titlePadding:14},
  legend:{labelColor:"#33414f",labelFontSize:11.5,symbolStrokeWidth:3}};
const VEGA_OPTS={actions:false,renderer:'svg',tooltip:{disableDefaultStyle:true}};
// Space kept clear beneath the plot: the source line (~15px), its gap, and
// deliberate breathing room so nothing sits flush against the window edge.
// Used by BOTH the initial height estimate and the corrective fit pass — when
// these disagreed the fit pass ran last and clawed the margin back.
const BOTTOM_RESERVE=78;

function fitChart(box,spec){
  // One corrective pass. The plot box is the only part Vega sizes to order;
  // axis, axis title and legend are added on top, so the rendered SVG is the
  // only honest measure of what the chart actually occupies.
  const svg=box.querySelector('svg'); if(!svg||typeof spec.height!=='number') return;
  const avail=window.innerHeight-box.getBoundingClientRect().top-BOTTOM_RESERVE;
  const over=svg.getBoundingClientRect().height-avail;
  if(over>4 && spec.height-over>=200){
    vegaEmbed(box,{...spec,height:Math.round(spec.height-over)},VEGA_OPTS).catch(()=>{});
  }
}
function embed(box,spec){ if(typeof vegaEmbed==='undefined'){ box.innerHTML='<div class="chartph">loading chart library…</div>'; return; }
  return vegaEmbed(box,spec,VEGA_OPTS).then(()=>fitChart(box,spec))
    .catch(e=>{box.innerHTML='<div class="chartph">chart error: '+esc(e.message)+'</div>';}); }
function hideChips(){ const g=el('seriesgroup'); if(g)g.style.display='none'; const b=el('serieschips'); if(b)b.innerHTML=''; }
function renderSeriesChips(list, showAxis){   // each chart series: [swatch] name [≡|▋] [L|R]  (live-dashboard chip model)
  const bar=el('serieschips'), g=el('seriesgroup'); if(!bar) return;
  if(!list||!list.length){ hideChips(); return; }
  if(g)g.style.display='';
  bar.innerHTML=list.map(s=>{
    const mk=seriesMark(s.key), ax=seriesAxis(s.key);
    const mb=['line','bar'].map(m=>`<button class="cm ${mk===m?'on':''}" title="${m}" onclick="setSeriesMark('${s.key}','${m}')">${m==='line'?'≡':'▮'}</button>`).join('');
    const ab=showAxis?`<span class="cgrp">${['left','right'].map(a=>`<button class="cm ${ax===a?'on':''}" title="${a} axis" onclick="setSeriesAxis('${s.key}','${a}')">${a==='left'?'L':'R'}</button>`).join('')}</span>`:'';
    return `<span class="schip"><span class="ssw" style="background:${s.color}"></span><span class="snm">${esc(s.name)}</span><span class="cgrp">${mb}</span>${ab}</span>`;
  }).join('');
}
function chartHeight(nEntries, nCols){
  nEntries = nEntries || 1; nCols = nCols || 6;
  // Whatever remains below the chart's top edge, less room for the source
  // line and the panel's own padding. Floored so it never collapses to a
  // sliver on a short window; above the floor the page scrolls instead
  // (see the body media query).
  const box = el('chart');
  if(!box) return 400;
  const top = box.getBoundingClientRect().top + window.scrollY;
  // Below the plot box Vega still draws: x-axis labels + title (~46) and the
  // bottom legend (~22 per row). BOTTOM_RESERVE keeps the source line clear
  // of the window edge on top of that.
  const legendRows = Math.max(1, Math.ceil(nEntries/Math.max(1,nCols)));
  const chrome = 46 + (legendRows*22) + BOTTOM_RESERVE;
  return Math.max(260, Math.round(window.innerHeight - top - chrome));
}
function renderChart(){
  updateModeAvail(); updateOutputAvail(); setCap(); renderRangeBar();
  // One title, set here so every view below it (chart / table / year overlay /
  // macro overlay) is captioned by the same call that decides what is drawn.
  // share.js reads this element for the exported PNG's header, so the image
  // cannot go out describing something other than what it pictures.
  el('viewTitle').textContent = titleFor();
  renderCtx();
  // Same call site as the title, for the same reason: share.js reads this when
  // it composes the PNG footer, so the image states its own provenance.
  const _src = sourceFor(), _notes = notesFor();
  el('chartsrc').innerHTML = 'Source: ' + esc(_src)
    + (_notes.length ? ' &middot; ' + esc(_notes.join(' ')) : '')
    + ' &middot; <a href="../methodology.html">Methodology &amp; Data Quality</a>';
  window.CC_CHART_SOURCE = _src + (_notes.length ? '. ' + _notes.join(' ') : '');
  const box=el('chart');
  if(!metric){ box.innerHTML='<div class="chartph">This metric is coming soon.</div>'; return; }
  if(macroId) return renderOverlay(box);   // macro overlay: dual-axis, single subject, calendar
  if(output==='seasonal'){ hideChips(); return renderSeasonal(box); }
  let S=buildSeries(); const isVin=mode==='vintage';
  if(!S.length || S.every(x=>!x.pts.length)){ hideChips();
    const rs=((SHELVES[selected[0]]||{}).pool_snapshot||{}).loss_recon_status;
    box.innerHTML = (isRepo() && assetClass==='lease')
      ? '<div class="chartph">Repossessions are not yet published for lease shelves.</div>'
      : (isResid() && mode==='calendar')
      ? '<div class="chartph">Residual value gain (loss) is cumulative — see the vintage view.</div>'
      : (metric==='cnl_ratio' && !isVin && rs==='withheld')
      ? '<div class="chartph">Loss series withheld: this shelf\'s monthly and cumulative loss figures do not reconcile, so it is not published until they do.</div>'
      : '<div class="chartph">no curve data wired for this view yet</div>';
    return; }
  S=applyRange(S,isVin);
  if(output==='table'){ hideChips(); return renderTable(box,S,isVin); }
  const grps=[...new Set(S.map(s=>s.grp))], col=g=>S.find(s=>s.grp===g).color;
  if(isVin){   // VINTAGE: per-deal/issuer lines — Vega legend + click-highlight, no per-series chips
    hideChips();
    const data=[]; S.forEach(s=>s.pts.forEach(([x,y,xl])=>data.push({x,y,series:s.series,grp:s.grp,xl})));
    const perDeal=selected.length===1, colorField=perDeal?'series':'grp', sw=perDeal?1.5:2.6;
    // Legend size drives how much room the plot can have, so work it out once
    // and hand it to chartHeight rather than letting the two disagree.
    const _legN=perDeal?new Set(S.map(x=>x.series)).size:grps.length;
    const _legCols=perDeal?(S.length>8?6:4):(grps.length>6?6:null);
    return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(selected.length,6), background:null,
      data:{values:data}, params:[{name:"hl",select:{type:"point",fields:[colorField]},bind:"legend"}],
      mark:{type:"line",strokeWidth:sw,interpolate:"monotone"},
      encoding:{ x:{field:"x",type:"quantitative",title:"Months since deal close",scale:{zero:true,nice:false},axis:{format:"d",tickMinStep:3,grid:false}},
        y:{field:"y",type:"quantitative",title:metricAxis(),axis:{format:AXFMT,grid:true},scale:{zero:true}},
        color:{field:colorField,type:"nominal",title:null,scale:perDeal?{scheme:"tableau20"}:{domain:grps,range:grps.map(col)},legend:{orient:"bottom",columns:_legCols}},
        detail:{field:"series"}, opacity:{condition:{param:"hl",value:1},value:0.16},
        tooltip:[{field:"series",title:"Series"},{field:"xl",title:"Age"},{field:"y",title:metricAxis(),format:".2%"}] }, config:CHART_CFG });
  }
  // CALENDAR: per-series chips (line/bar + L/R axis) → dual-axis via yL/yR fields
  renderSeriesChips(grps.map(g=>({key:g,name:g,color:col(g)})), grps.length>1);
  const data=[]; S.forEach(s=>{ const ax=seriesAxis(s.grp); s.pts.forEach(([x,y,xl])=>data.push({x,xl,series:s.series,grp:s.grp, yL:ax==='left'?y:null, yR:ax==='right'?y:null})); });
  const lay=(side,mk,yf)=>{ const gs=grps.filter(g=>seriesAxis(g)===side&&seriesMark(g)===mk); if(!gs.length) return null;
    return {data:{values:data.filter(d=>gs.includes(d.grp))},
      mark: mk==='bar'?{type:"bar",opacity:0.75}:{type:"line",strokeWidth:2.6,interpolate:"monotone"},
      encoding:{ y:{field:yf,type:"quantitative",title:metricAxis(),scale:{zero:true},axis:{format:AXFMT,grid:side==='left',orient:side}},
        detail:{field:"series"}, tooltip:[{field:"series",title:"Series"},{field:"xl",title:"Date"},{field:yf,title:metricAxis(),format:".2%"}] }}; };
  const layers=[lay('left','line','yL'),lay('left','bar','yL'),lay('right','line','yR'),lay('right','bar','yR')].filter(Boolean);
  return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(selected.length,6), background:null,
    encoding:{ x:{field:"x",type:"temporal",title:null,axis:{format:"%Y",tickCount:"year",grid:false}},
      color:{field:"grp",type:"nominal",title:null,scale:{domain:grps,range:grps.map(col)},
             legend: grps.length>1 ? {orient:"bottom",direction:"horizontal",symbolType:"stroke",symbolStrokeWidth:3,labelFontSize:12.5} : null} },
    layer:layers, config:CHART_CFG });
}

