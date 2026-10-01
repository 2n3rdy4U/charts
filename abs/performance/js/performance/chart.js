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
      S.push({series:labCode(subj.ticker), grp:labCode(subj.ticker), color:ISSCOLOR[0], pts:c.map(p=>[p.date,p[K],fmtMonth(p.date)])});
    }
  } else { // 2+ : calendar only (aggregate vintage dropped; cross-issuer vintage = cohort picker, next)
    selected.forEach((tk,i)=>{const sh=SHELVES[tk];const arr=calOf(sh).filter(p=>p[K]!=null);
      S.push({series:labCode(tk), grp:labCode(tk), color:ISSCOLOR[i%ISSCOLOR.length], pts:arr.map(p=>[p.date,p[K],fmtMonth(p.date)])});});
  }
  return S;
}
function setCap(){ el('chartcap').textContent = subtitleFor(); }   // the Explorer's sub-head: settings in force
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
  box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body||'<tr><td>no data</td></tr>'}</tbody></table></div>
    <div class="otnote">Value at deal age · shaded across each row, so vintages compare at the same age.</div>`;
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
         axis:{values:[1,2,3,4,5,6,7,8,9,10,11,12],labelExpr:"['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][datum.value]",labelAngle:0}},
      y:{field:"y",type:"quantitative",title:metricAxis(),axis:{format:axFmt(data.map(d=>d.y))},scale:{zero:true}},
      color:{field:"year",type:"nominal",title:"Year",scale:{scheme:"tableau10"},legend:legendCfg()},
      opacity:{condition:{param:"hl",value:1},value:0.2},
      tooltip:[{field:"year",title:"Year"},{field:"mn",title:"Month"},{field:"y",title:metricAxis()[0],format:".2%"}]
    },
    config:CHART_CFG
  };
  vegaEmbed(box,spec,VEGA_OPTS).then(()=>fitChart(box,spec)).catch(e=>{box.innerHTML='<div class="chartph">chart error: '+esc(e.message)+'</div>';});
}
function updateModeAvail(){
  // Vintage curves describe one issuer: there the picker takes one (as the
  // Explorer's does), so a second issuer never pushes the view to time series.
  const vin=document.querySelector('#modeseg button[data-mode="vintage"]'), noVin=isRepo();
  vin.style.opacity=noVin?0.4:1;
  vin.title=isRepo()?'Repossessions are a monthly rate by calendar month; there is no per-deal vintage curve.':'';
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
    encoding:{x:{field:"date",type:"temporal",title:"Reporting Date",axis:dateAxis()}},
    layer:[
      {data:{values:macA},mark:macMk,
       encoding:{y:{field:"v",type:"quantitative",title:m.name,scale:macScale,axis:{orient:mAx,grid:false,titleColor:"#9c4fb5",labelColor:"#9c4fb5"}},
         tooltip:[{field:"date",type:"temporal",title:"Date",format:"%b %Y"},{field:"v",title:m.name}]}},
      {data:{values:absA},mark:absMk,
       encoding:{y:{field:"y",type:"quantitative",title:mlab,scale:{zero:true},axis:{orient:aAx,format:axFmt(absA.map(d=>d.y)),grid:aAx==='left',titleColor:"#2f6db5",labelColor:"#2f6db5"}},
         tooltip:[{field:"date",type:"temporal",title:"Date",format:"%b %Y"},{field:"y",title:metricAxis()[0],format:".2%"}]}}
    ],
    resolve:{scale:{y:"independent"}}, config:CHART_CFG });
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
// The Explorer's chart settings (generate_sec_explorer_data.py), so the two
// pages draw alike: Vega's default font, bold axis titles, gridlines in both
// directions, the default plot border. Only sizes are set, as there.
const CHART_CFG={axis:{labelFontSize:13,titleFontSize:14},
  title:{anchor:"middle",fontSize:15,subtitleFontSize:11},
  view:{continuousHeight:300,continuousWidth:300}};
// A phone either way up: portrait (narrow) or landscape (short). Both get the
// phone layout; landscape additionally sizes the chart to the screen.
const isPhone=()=>window.matchMedia('(max-width:640px), (orientation:landscape) and (max-height:500px)').matches;
const isLandscapePhone=()=>window.matchMedia('(orientation:landscape) and (max-height:500px)').matches;
// Legend under the plot, columns by screen width — the Explorer's legendColumns().
const legendCols=()=>isPhone()?4:window.matchMedia('(max-width:1024px)').matches?6:9;
// Issuer names ("Santander (SDART)") are long: fewer, wider columns on a phone.
// Landscape phone: height is the scarce dimension, so the legend goes to the
// right of the plot instead of under it.
const legendCfg=(long)=>isLandscapePhone()
  ? {orient:"right",direction:"vertical",columns:long?1:2,columnPadding:8,labelLimit:long?150:70,labelFontSize:10.5,symbolSize:80,symbolLimit:1000,symbolType:"stroke",symbolStrokeWidth:2,title:null,rowPadding:2}
  : ({orient:"bottom",direction:"horizontal",columns:long&&isPhone()?2:legendCols(),columnPadding:isPhone()?10:24,labelLimit:long?170:90,symbolSize:110,symbolLimit:1000,symbolType:"stroke",symbolStrokeWidth:2});
// Calendar x-axis — the Explorer's tsDateAxis(): month labels on a short
// window, years otherwise, angled on a phone.
function dateAxis(nMonths){
  const a = (nMonths && nMonths<=24) ? {tickCount:6,format:"%b %Y"}
          : (nMonths && nMonths>72) ? {tickCount:{interval:"year",step:2},format:"%Y"}
          : {tickCount:"year",format:"%Y"};
  a.labelOverlap=false;
  if(isPhone() && !isLandscapePhone()){ a.labelAngle=-45; a.labelFontSize=10; }   // narrow portrait only
  return a;
}
// The Explorer's hover: a large invisible target that snaps to the nearest
// point, a dot on the point, and a dashed guide line down to the axis. The
// tooltip rides on the dot, so the reader never has to land on a 1.5px line.
function hoverLayers(data, x, y, tooltip, name){
  return [
    {data:{values:data}, params:[{name, select:{type:"point",nearest:true,on:"mouseover",clear:"mouseout"}}],
     mark:{type:"circle",opacity:0,size:900}, encoding:{x, y}},
    {data:{values:data}, mark:{type:"point",filled:true,size:90,strokeWidth:1.5},
     encoding:{x, y, color:tooltip.color,
       opacity:{condition:{param:name,empty:false,value:1},value:0}, tooltip:tooltip.rows}},
    {data:{values:data}, transform:[{filter:{param:name,empty:false}}],
     mark:{type:"rule",color:"#94a3b8",strokeWidth:1,strokeDash:[3,3]}, encoding:{x}}
  ];
}
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
  const svg=box.querySelector('svg'); if(!svg||typeof spec.height!=='number'||isPhone()) return;
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
  if(isLandscapePhone()){
    // Title, plot, axis and source line together fill the screen: the reader
    // sees the whole chart without scrolling; the controls are a scroll away.
    const head = el('viewTitle').offsetHeight + el('chartcap').offsetHeight;
    return Math.max(140, Math.round(window.innerHeight - head - 46 - 26 - 14));
  }
  if(isPhone()) return 280;   // portrait: the chart keeps a readable fixed height (the Explorer's #vis)
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
// Landscape phone: after loading, rotating, or any tab/control change, settle
// the page on the chart so it fills the screen and the result is in view.
// (Only on a phone held sideways, and only in a top-level window — inside the
// site frame the parent page does the scrolling.)
let _focusNext = true;
function focusChart(){
  if(!isLandscapePhone() || window.self!==window.top) return;
  const r = el('export-region'); if(r) r.scrollIntoView({block:'start', behavior:'smooth'});
}
document.addEventListener('click', e=>{ if(e.target.closest('.mtabs, .chartrail, #assetseg, #isspanel')) _focusNext=true; }, true);
addEventListener('orientationchange', ()=>{ _focusNext=true; });
function renderChart(){
  updateModeAvail(); updateOutputAvail(); setCap(); renderRangeBar();
  // One title, set here so every view below it (chart / table / year overlay /
  // macro overlay) is captioned by the same call that decides what is drawn.
  // share.js reads this element for the exported PNG's header, so the image
  // cannot go out describing something other than what it pictures.
  el('viewTitle').textContent = titleFor();
  renderCtx();
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
  // CALENDAR: per-series chips (line/bar + L/R axis) → dual-axis via yL/yR fields
  renderSeriesChips(grps.map(g=>({key:g,name:g,color:col(g)})), grps.length>1);
  const data=[]; S.forEach(s=>{ const ax=seriesAxis(s.grp); s.pts.forEach(([x,y,xl])=>data.push({x,xl,series:s.series,grp:s.grp, yL:ax==='left'?y:null, yR:ax==='right'?y:null})); });
  const nMonths=new Set(data.map(d=>String(d.x).slice(0,7))).size;
  const X={field:"x",type:"temporal",title:"Reporting Date",axis:dateAxis(nMonths)};
  const C={field:"grp",type:"nominal",title:"Series",scale:{domain:grps,range:grps.map(col)}};
  const T=tipLabels();
  const dual = grps.some(g=>seriesAxis(g)==='right') && grps.some(g=>seriesAxis(g)==='left');
  // One group per axis side: that side's lines/bars AND its hover layers share
  // one y encoding — one scale, one axis. (A hover layer with a y of its own
  // made Vega draw a second default axis on each side, two scales printed on
  // top of each other.) With series on both sides, the two groups get
  // independent scales: the point of putting a series on the right axis.
  const side=(sd)=>{
    const yf = sd==='left'?'yL':'yR', gs=grps.filter(g=>seriesAxis(g)===sd);
    if(!gs.length) return null;
    // When both axes are in use, colour each axis like its series (one series)
    // so the reader can tell which line reads against which scale.
    const ac = dual && gs.length===1 ? {titleColor:col(gs[0]),labelColor:col(gs[0])} : {};
    const Y={field:yf,type:"quantitative",title:metricAxis(),scale:{zero:true},
             axis:{format:axFmt(data.map(r=>r[yf])),grid:sd==='left'||!dual,orient:sd,...ac}};
    const d=data.filter(r=>r[yf]!=null);
    const marks=['line','bar'].map(mk=>{ const ms=gs.filter(g=>seriesMark(g)===mk); if(!ms.length) return null;
      return {data:{values:d.filter(r=>ms.includes(r.grp))},
        mark: mk==='bar'?{type:"bar",opacity:0.75}:{type:"line",strokeWidth:2.6,interpolate:"monotone"},
        encoding:{y:Y, detail:{field:"series"}}}; }).filter(Boolean);
    return {layer: marks.concat(hoverLayers(d, X, Y,
      {color:C, rows:[{field:"series",type:"nominal",title:T.series},{field:"xl",type:"nominal",title:T.x},{field:yf,type:"quantitative",title:T.y,format:".2%"}]}, "hover"+sd))};
  };
  const groups=[side('left'),side('right')].filter(Boolean);
  return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(selected.length,6), background:null,
    encoding:{ x:X, color:{...C, legend: grps.length>1 ? legendCfg(true) : null} },
    layer: groups.length>1 ? groups : groups[0].layer,
    ...(groups.length>1 ? {resolve:{scale:{y:"independent"}}} : {}), config:CHART_CFG });
}

