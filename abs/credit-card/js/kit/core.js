// Build B · page kit — what every performance page shares: the chart primitives
// (Vega-Lite config, hover, legend, axis, sizing), the time-series chart, the
// calendar table, the year overlay, the macro overlay, the range bar, the
// per-series chips, the picker and the phone layout classes. Plain scripts
// sharing one scope; a page loads format.js, its own state.js, then this file.
//
// What a page must define for the kit (the contract): SHELVES, selected, metric,
// mode ('calendar' when the page has no vintage view), output, range, macroId,
// MACRO, transform, calOf(sh), calKey(), metricAxis(), metricLabel(), axFmt(vals),
// renderChart(), renderDeals(), serializeState() (the view as URL params); and may
// set window.KIT_ROW_LABEL (the calendar table's first column: 'Issuer' unless
// told otherwise). A page calls syncAddress() at the end of its renderChart().
const markBy={}, axisBy={};   // per-series: seriesKey -> 'line'|'bar', 'left'|'right' (live-dashboard model)
const seriesMark=k=>markBy[k]||'line', seriesAxis=k=>axisBy[k]||'left';
window.setSeriesMark=(k,m)=>{ markBy[k]=m; renderChart(); };
window.setSeriesAxis=(k,s)=>{ axisBy[k]=s; renderChart(); };
// Year over year, as the Explorer drew it: each point against the same month a
// year earlier — a change in percentage points, or a percent change; months
// with no year-earlier reading are left out.
function applyYoy(pts){
  const by=new Map(pts.map(p=>[String(p[0]).slice(0,7), p[1]]));
  const prior=d=>{ const y=+d.slice(0,4)-1; return by.get(y+d.slice(4,7)); };
  return pts.map(p=>{ const d=String(p[0]).slice(0,7), q=prior(d);
    if(q==null) return null;
    const v = transform==='yoy-delta' ? p[1]-q : (q===0 ? null : (p[1]-q)/q);
    return v==null ? null : [p[0], v, p[2]]; }).filter(Boolean);
}
// The address is the view: after a reader changes a control the address bar
// is rewritten (no reload, no history entry) to the page's own deep link, so
// copying the address sends exactly what is on screen and a reload reproduces
// it. On arrival the address is left as it came. On a static page (one shelf
// or trust) a change of subject moves the address to the section's index.
let _addrDirty = false;
document.addEventListener('click', e=>{ if(e.target.closest('.mtabs, .chartrail, #assetseg, #isswrap, #isspanel')) _addrDirty=true; }, true);
document.addEventListener('change', e=>{ if(e.target.closest('.chartrail, #isspanel')) _addrDirty=true; }, true);
function syncAddress(){
  if(!_addrDirty || typeof serializeState!=='function') return;
  let path=location.pathname;
  const pre=window.BB_PRESET;
  if(pre && pre.static && (selected[0]!==pre.sel || (pre.ac && typeof assetClass!=='undefined' && assetClass!==pre.ac)))
    path=path.replace(/[^/]+\/$/, '') + 'index.html';    // <T>/ → ../index.html
  try{ history.replaceState(null, '', path + '?' + serializeState().toString().replace(/%2C/g, ',')); }catch(e){}   // a readable list: sel=A,B
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
function showLens(which){
  const fixed = !!(window.BB_PRESET&&window.BB_PRESET.static);   // a shelf page: both panels, always
  el('perfPanel').hidden  = !fixed && which!=='chart';
  el('dealsPanel').hidden = !fixed && which!=='deals';
  // Redraw on entry: Vega sizes to its container, so a chart drawn while its
  // panel was hidden measures zero width.
  if(which==='deals'){ renderDeals(); syncAddress(); } else renderChart();
}
function heatBG(v,lo,hi){ if(v==null||hi<=lo) return ''; const a=Math.max(0,Math.min(1,(v-lo)/(hi-lo)))*0.6; return `background:rgba(192,73,47,${a.toFixed(3)})`; }
function renderCalendarTable(box,S){  // rows = issuer(s), cols = calendar years; cell = annual avg of monthly readings; global heat
  const rows=S.map(s=>{const by={}; s.pts.forEach(([x,y])=>{const yr=String(x).slice(0,4); (by[yr]=by[yr]||[]).push(y);});   // (a YOY series averages its monthly changes)
    const avg={}; for(const yr in by) avg[yr]=by[yr].reduce((a,b)=>a+b,0)/by[yr].length; return {name:s.series,avg};});
  const years=[...new Set(rows.flatMap(r=>Object.keys(r.avg)))].sort(), partial=years[years.length-1];
  const allv=rows.flatMap(r=>Object.values(r.avg)), lo=Math.min(...allv), hi=Math.max(...allv);
  const th=`<th>${window.KIT_ROW_LABEL||'Issuer'}</th>`+years.map(y=>`<th class="num">${y}${y===partial?'†':''}</th>`).join('');
  const body=rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td>`+years.map(y=>{const v=r.avg[y];return `<td class="num" style="${heatBG(v,lo,hi)}">${v==null?'·':pct(v,2)}</td>`;}).join('')+'</tr>').join('');
  box.innerHTML=`<div class="otscroll"><table class="otable"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="otnote">Annual average of monthly readings, by calendar year · shaded globally (darker = higher) · <b>†</b> ${partial} is a partial-year (YTD) average.</div>`;
}
function renderSeasonal(box){
  if(typeof vegaEmbed==='undefined'){ box.innerHTML='<div class="chartph">loading chart library…</div>'; return; }
  const subj=SHELVES[selected[0]], sk=calKey(), cal=calOf(subj);
  const k=typeof scaleOf==='function'?scaleOf():1;
  const data=cal.filter(p=>p[sk]!=null).map(p=>{const a=p.date.split('-').map(Number);return {mn:a[1],y:p[sk]*k,year:String(a[0])};});
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
      tooltip:[{field:"year",title:"Year"},{field:"mn",title:"Month"},{field:"y",title:metricAxis()[0],format:typeof valueFormat==="function"?valueFormat():".2%"}]
    },
    config:CHART_CFG
  };
  vegaEmbed(box,spec,VEGA_OPTS).then(()=>fitChart(box,spec)).catch(e=>{box.innerHTML='<div class="chartph">chart error: '+esc(e.message)+'</div>';});
}
function renderOverlay(box){
  const subj=SHELVES[selected[0]], sk=calKey(), mlab=metricLabel();
  const cal=calOf(subj), m=MACRO&&MACRO.find(x=>x.id===macroId);
  if(!m){ box.innerHTML='<div class="chartph">overlay data not loaded</div>'; return; }
  const k=typeof scaleOf==='function'?scaleOf():1;
  let absA=cal.filter(p=>p[sk]!=null).map(p=>({date:p.date,y:p[sk]*k}));
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
         tooltip:[{field:"date",type:"temporal",title:"Date",format:"%b %Y"},{field:"y",title:metricAxis()[0],format:typeof valueFormat==="function"?valueFormat():".2%"}]}}
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
// The page is its own window now (the frame is stamped into it), so the
// layout classes come from this window's size, and the visible height for a
// landscape chart is the frame's content area, which is what scrolls.
const isPhone=()=>document.documentElement.classList.contains('bb-phone');
const isLandscapePhone=()=>document.documentElement.classList.contains('bb-land');
function applyViewMode(){   // returns true when the layout changed
  const w = innerWidth, h = innerHeight;
  const c = document.documentElement.classList, before = c.contains('bb-phone') + ':' + c.contains('bb-land');
  const land = w > h && h <= 500;
  c.toggle('bb-land', land); c.toggle('bb-phone', land || w <= 640);
  return before !== c.contains('bb-phone') + ':' + c.contains('bb-land');
}
const scroller = () => document.getElementById('main') || document.scrollingElement;
const visibleHeight = () => (scroller() && scroller().clientHeight) || window.innerHeight;
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
    return Math.max(140, Math.round(visibleHeight() - head - 46 - 26 - 14));
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
let _focusNext = true;
function focusChart(){
  if(!isLandscapePhone()) return;
  const r = el('export-region'); if(r) r.scrollIntoView({block:'start', behavior:'smooth'});
}
document.addEventListener('click', e=>{ if(e.target.closest('.mtabs, .chartrail, #assetseg, #isspanel')) _focusNext=true; }, true);
addEventListener('orientationchange', ()=>{ _focusNext=true; });
// Desktop: the page does not scroll (the chart is sized to the window), so the
// control rail must — with the credit-score, vehicle and year-over-year
// groups it can be taller than a laptop window, and Range sat below the edge.
function fitRail(){
  const rail = document.querySelector('.chartrail'); if(!rail) return;
  if(isPhone() || document.body.scrollHeight > window.innerHeight + 1){ rail.style.maxHeight = ''; rail.style.overflowY = ''; return; }
  rail.style.maxHeight = Math.max(200, Math.round(window.innerHeight - rail.getBoundingClientRect().top - 12)) + 'px';
  rail.style.overflowY = 'auto';
}
// The calendar (time-series) chart: per-series chips (line/bar + L/R axis),
// dual axes via yL/yR fields, the Explorer's hover. `o`: axisTitle, axisFormat(vals),
// tip {series,x,y}, valueFormat, extraRows, boldTest (Vega expression), nEntries, xTitle.
// A series with `seg` set is one piece of a line drawn in pieces (a gap breaks it).
function calendarChart(box,S,o){
  const grps=[...new Set(S.map(s=>s.grp))], col=g=>S.find(s=>s.grp===g).color;
  // CALENDAR: per-series chips (line/bar + L/R axis) → dual-axis via yL/yR fields
  renderSeriesChips(grps.map(g=>({key:g,name:g,color:col(g)})), grps.length>1);
  const data=[]; S.forEach(s=>{ const ax=seriesAxis(s.grp); s.pts.forEach(([x,y,xl,extra])=>data.push({x,xl,series:s.series,grp:s.grp,seg:s.seg||s.series, yL:ax==='left'?y:null, yR:ax==='right'?y:null, ...(extra||{})})); });
  const nMonths=new Set(data.map(d=>String(d.x).slice(0,7))).size;
  const X={field:"x",type:"temporal",title:o.xTitle||"Reporting Date",axis:dateAxis(nMonths)};
  const C={field:"grp",type:"nominal",title:"Series",scale:{domain:grps,range:grps.map(col)}};
  const T=o.tip;
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
    const Y={field:yf,type:"quantitative",title:o.axisTitle,scale:{zero:true,nice:true},
             axis:{format: o.axisFormat(data.map(r=>r[yf])),grid:sd==='left'||!dual,orient:sd,...ac}};
    const d=data.filter(r=>r[yf]!=null);
    const marks=['line','bar'].map(mk=>{ const ms=gs.filter(g=>seriesMark(g)===mk); if(!ms.length) return null;
      return {data:{values:d.filter(r=>ms.includes(r.grp))},
        mark: mk==='bar'?{type:"bar",opacity:0.75}:{type:"line",interpolate:"monotone"},
        encoding:{y:Y, detail:{field:"seg"},
          ...(mk==='line' ? {strokeWidth:{condition:{test:o.boldTest, value:4}, value:2.6}} : {})}}; }).filter(Boolean);
    return {layer: marks.concat(hoverLayers(d, X, Y,
      {color:C, rows:[{field:"series",type:"nominal",title:T.series},{field:"xl",type:"nominal",title:T.x},{field:yf,type:"quantitative",title:T.y,format:o.valueFormat||".2%"}, ...(o.extraRows||[])]}, "hover"+sd))};
  };
  const groups=[side('left'),side('right')].filter(Boolean);
  return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(o.nEntries,6), background:null,
    encoding:{ x:X, color:{...C, legend: grps.length>1 ? legendCfg(true) : null} },
    layer: groups.length>1 ? groups : groups[0].layer,
    ...(groups.length>1 ? {resolve:{scale:{y:"independent"}}} : {}), config:CHART_CFG });
}
/* Picker — a button that summarises the selection and a panel of checkboxes
   (radio when the view takes one). The subject is selected[0]: the panel
   marks it with a star and lets a checked entry be promoted.
   cfg: {btn, panel, wrap, placeholder, options() → [{t,label,retired,off,offTitle}],
         multi() → bool, hint() → text or '', get() → selected, set(arr),
         onChange('pick' | 'subject')} */
function kitPicker(cfg){
  const btn=el(cfg.btn), panel=el(cfg.panel);
  const text=a=>a.label+(a.retired?' (retired)':'');
  function updateBtn(){
    const parts = cfg.get().map(t=>text(cfg.options().find(x=>x.t===t)||{label:t}));
    if(!parts.length)        btn.textContent = cfg.placeholder;
    else if(parts.length<=2) btn.textContent = parts.join(', ') + ' \u25be';
    else                     btn.textContent = parts[0] + ', +' + (parts.length-1) + ' more \u25be';
  }
  function build(){
    const multi=cfg.multi(), selected=cfg.get();
    panel.innerHTML = '';
    const hint=cfg.hint();
    if(hint){ const h=document.createElement('div'); h.className='mss-hint'; h.textContent=hint; panel.appendChild(h); }
    for(const a of cfg.options()){
      const lbl=document.createElement('label');
      const cb=document.createElement('input');
      cb.type = multi ? 'checkbox' : 'radio';
      cb.name = cfg.btn+'Pick'; cb.value=a.t; cb.checked = selected.includes(a.t);
      if(a.off){ cb.disabled=true; lbl.classList.add('off'); lbl.title=a.offTitle||''; }
      cb.addEventListener('change', ()=>{
        if(!multi){ cfg.set([a.t]); }
        else if(cb.checked){ if(!selected.includes(a.t)) cfg.set([...selected, a.t]); }
        else {
          if(selected.length<2){ cb.checked=true; return; }   // never empty
          cfg.set(selected.filter(x=>x!==a.t));
        }
        build(); updateBtn(); cfg.onChange('pick');
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' '+text(a)));
      if(multi && selected.includes(a.t)){
        const st=document.createElement('span');
        const isSubj = selected[0]===a.t;
        st.className='mss-star'+(isSubj?' on':'');
        st.textContent='\u2605';
        st.title = isSubj ? 'Subject' : 'Make subject';
        if(!isSubj) st.onclick=(e)=>{ e.preventDefault(); e.stopPropagation();
          cfg.set([a.t,...selected.filter(x=>x!==a.t)]);
          build(); updateBtn(); cfg.onChange('subject'); };
        lbl.appendChild(st);
      }
      panel.appendChild(lbl);
    }
  }
  const close=()=>panel.classList.remove('open');
  btn.onclick=e=>{ e.stopPropagation(); build(); panel.classList.toggle('open'); };
  document.addEventListener('click',e=>{ if(!e.target.closest('#'+cfg.wrap)) close(); });
  return {build, updateBtn, close};
}
