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
//
// THE HOUSE STYLE (docs/charts-mockups/rulebook.md, 2026-11-26). The ink, the series
// colours and each issuer's home colour are KIT_TOKENS, the block below, which
// src/utils/chart_tokens.py writes from config/chart_tokens.json (edit the JSON, never the
// block; a test fails when they differ). It sits in this file, not one of its own, so a
// page rendered before the theme still finds it. What the theme sets:
// Inter; ink text and soft axis labels; horizontal gridlines only and no plot border; the
// unit on the top tick and no y-axis title (the measure is in the caption, capText);
// years as 2017 ’18 ’19; a colour that belongs to the issuer (homeColors); a label at
// each line's end, name and latest value, for up to four series (the legend past that).
/* TOKENS:BEGIN */
const KIT_TOKENS = {"font":"Inter, system-ui, -apple-system, 'Segoe UI', sans-serif","ink":{"text":"#1a202e","soft":"#5b6270","faint":"#8b919c","grid":"#e4e6ea","base":"#9aa0aa","zero":"#6b7280","band":"#f0f1f4","navy":"#0034a5"},"series":["#0034a5","#d9622b","#149a6c","#c98a00","#c9548a","#3f8f2f","#7a5fd0","#d14545"],"market":"#1a202e","years":["#a9bbe6","#0a2a78"],"homes":{"auto":{"SDART":0,"TAOT":1,"CAOT":2,"GMCAR":3,"AMCAR":4,"AART":5,"BAAT":6,"BLAST":7,"BMWLT":0,"BMWOT":2,"BMWPORT":1,"CFAST":3,"CMXS":5,"COPAR":4,"CRART":7,"CRVNAN":0,"CRVNAP":2,"DRIVE":6,"EART":1,"EARTS":3,"FCALT":4,"FCAOT":6,"FRANK":5,"FTAT":7,"GMALT":1,"HAROT":0,"HART":2,"HUNT":4,"LBAAT":3,"MBALT":5,"MBART":6,"NALT":7,"NAROT":0,"PILOT":2,"TRIAD":1,"UPFC":4,"USAOT":5,"VALET":3,"VWALT":6,"WOALT":3,"WOART":7,"WOSAT":0,"ALLYPORT":2},"card":{"AMEXIT":0,"AMXCA":1,"BACCT":2,"CCCIT":3,"CHAIT":4,"COMET":5,"DCENT":6,"DRYROCK":7,"FNBO":0,"HAFF":1,"HSBCCC":2,"HSBCPL":3,"METRIS":4,"NATCITY":5,"PROVIDIAN":6,"SEARS2":7,"SYNCCMNT":0,"SYNIT":1,"WFCARD":2,"WFNN":3}}};
/* TOKENS:END */
const TK=KIT_TOKENS, INK=TK.ink;
// A colour per key, in the order picked. The market series is ink. Each key starts from
// its home; when a home is taken in this view the later pick moves to the next free one.
function homeColors(keys, kind, isMarket){
  const pal=TK.series, homes=TK.homes[kind]||{}, used=new Set(), out={};
  const hash=k=>[...String(k)].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
  keys.forEach(k=>{ if(isMarket && isMarket(k)){ out[k]=TK.market; return; }
    let i=homes[k]!=null?homes[k]:hash(k)%pal.length, n=0;
    while(used.has(i) && n<pal.length){ i=(i+1)%pal.length; n++; }
    used.add(i); out[k]=pal[i]; });
  return out;
}
// n colours of one hue, light to dark: years against each other, vintages past eight deals.
function rampColors(n){
  const h=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)), a=h(TK.years[0]), b=h(TK.years[1]);
  return Array.from({length:n},(_,i)=>{ const t=n<2?1:i/(n-1);
    return '#'+a.map((v,j)=>Math.round(v+(b[j]-v)*t).toString(16).padStart(2,'0')).join(''); });
}
// The y axis: about five gridlines at round values, the unit on the top tick only ("8%" then
// 6, 4, 2, 0), and for a rate no more decimals than the step between gridlines needs (the
// page's own format said 8.00%; the tooltip and the table keep the full figure).
function unitAxis(fmt, vals){
  const v=(vals||[]).filter(x=>x!=null);
  if(v.length && /%$/.test(fmt)){
    const step=(Math.max(0,...v)-Math.min(0,...v))/5*100;
    fmt=(fmt[0]==='+'?'+':'')+'.'+(step>=0.7?0:step>=0.07?1:step>=0.007?2:3)+'%';
  }
  return {format:fmt, tickCount:5, labelExpr:"datum.index==1 ? datum.label : replace(datum.label,'%','')"};
}
// A darker line at zero when the values cross it.
const zeroRule=(vals,Y)=>Math.min(0,...vals.filter(x=>x!=null))<0 ? [{data:{values:[{z:0}]},mark:{type:"rule",color:INK.zero,strokeWidth:1},encoding:{y:{...Y,field:"z"}}}] : [];
// The caption under the title says only what the title, the chips and the menus do not:
// the measure's denominator (the measure's name too when the title lacks it), then any
// setting the page reports, which it does only for one changed from its default.
function capText(){
  const a=[].concat(metricAxis()), t=titleFor().toLowerCase();
  const den=a[1]?String(a[1]).replace(/^\(|\)$/g,''):'', named=t.includes(String(a[0]).toLowerCase());
  const m=named ? den : a[0]+(den?', '+den:'');
  return [m, ...subtitleFor().split(' \u00b7 ').filter(x=>x && x!==a[0])].filter(Boolean).join(' \u00b7 ');
}
// A d3 format the kit's own text can use (chips, the end labels are Vega's): ".2%", "+.1%", ",.1f".
function fmtNum(v, f){
  const m=/^(\+?)(,?)\.(\d)([%f])$/.exec(f||'.2%'); if(v==null||!m) return v==null?'':String(v);
  const x=m[4]==='%'?v*100:v, t=Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:+m[3],maximumFractionDigits:+m[3],useGrouping:!!m[2]});
  return (x<0?'\u2212':(m[1]&&x>0?'+':''))+t+(m[4]==='%'?'%':'');
}
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
  const query='?' + serializeState().toString().replace(/%2C/g, ',');   // a readable list: sel=A,B
  // As a workspace tile (?embed=1) the page keeps the flag, so a reload stays a tile, and tells
  // the workspace its new settings, which is how the workspace's own address follows the tile.
  const tile=document.documentElement.classList.contains('ccm-embed');
  try{ history.replaceState(null, '', path + query + (tile?'&embed=1':'')); }catch(e){}
  if(tile){ const tf=el('tilefull'); if(tf) tf.href=tileFullHref(); }
  if(tile && window.parent!==window){ try{ window.parent.postMessage({type:'ccm-tile-state', path, search:query}, location.origin); }catch(e){} }
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
  const seasYears=[...new Set(data.map(d=>d.year))].sort();   // one hue, the newest year darkest
  const spec={
    $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(new Set(data.map(d=>d.year)).size,6), background:null,
    data:{values:data},
    params:[{name:"hl",select:{type:"point",fields:["year"]},bind:"legend"}],
    mark:{type:"line",strokeWidth:2,point:{size:22,filled:true},interpolate:"monotone"},
    encoding:{
      x:{field:"mn",type:"quantitative",title:null,scale:{domain:[1,12],nice:false},
         axis:{values:[1,2,3,4,5,6,7,8,9,10,11,12],labelExpr:"['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][datum.value]",labelAngle:0}},
      y:{field:"y",type:"quantitative",title:null,axis:unitAxis(axFmt(data.map(d=>d.y)),data.map(d=>d.y)),scale:{zero:true}},
      color:{field:"year",type:"ordinal",title:"Year",scale:{domain:seasYears,range:rampColors(seasYears.length)},legend:legendCfg()},
      opacity:{condition:{param:"hl",value:1},value:0.2},
      tooltip:[{field:"year",title:"Year"},{field:"mn",title:"Month"},{field:"y",title:metricAxis()[0],format:typeof valueFormat==="function"?valueFormat():".2%"}]
    },
    config:CHART_CFG
  };
  vegaEmbed(box,spec,VEGA_OPTS).then(()=>{ describeChart(box); return fitChart(box,spec); }).catch(e=>{box.innerHTML='<div class="chartph">chart error: '+esc(e.message)+'</div>';});
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
  if(axisBy['ovmacro']==null) axisBy['ovmacro']='right';              // macro defaults to the right axis, and its chip says so
  const mMk=seriesMark('ovmacro'),  mAx=axisBy['ovmacro'];
  const cA=typeof seriesColorOf==='function'?seriesColorOf(selected[0]):TK.series[0], cM=TK.series.find(c=>c!==cA && c!==TK.series[0])||TK.series[1];
  renderSeriesChips([{key:'ovmetric',name:`${subj.ticker} ${mlab}`,color:cA},{key:'ovmacro',name:m.name,color:cM}], true);
  const absMk = aMk==='bar'?{type:"bar",color:cA,opacity:0.6}:{type:"line",color:cA,strokeWidth:2.2,interpolate:"monotone"};
  const macMk = mMk==='bar'?{type:"bar",color:cM,opacity:0.45}:{type:"line",color:cM,strokeWidth:2.2,interpolate:"monotone"};
  // a level index (CPI, sentiment, sales) gets a non-zero baseline so its shape shows; a rate axis stays zero-based
  const macScale = mMk==='bar' ? {zero:false,nice:true} : {zero:false,nice:true};
  embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(selected.length,6), background:null,
    encoding:{x:{field:"date",type:"temporal",title:null,axis:dateAxis(new Set(absA.map(p=>p.date.slice(0,7))).size, plotWidth(box, true))}},
    layer:[
      {data:{values:macA},mark:macMk,
       encoding:{y:{field:"v",type:"quantitative",title:m.name,scale:macScale,axis:{orient:mAx,grid:false,tickCount:5,titleColor:cM,labelColor:cM}},
         tooltip:[{field:"date",type:"temporal",title:"Date",format:"%b %Y"},{field:"v",title:m.name}]}},
      {data:{values:absA},mark:absMk,
       encoding:{y:{field:"y",type:"quantitative",title:mlab,scale:{zero:true},axis:{...unitAxis(axFmt(absA.map(d=>d.y)),absA.map(d=>d.y)),orient:aAx,grid:aAx==='left',titleColor:cA,labelColor:cA}},
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
  const opts = isVin ? [['12','12'],['24','24'],['36','36'],['48','48'],['all','All']]   // months of deal age (the row is labelled so)
                     : [['1','1Y'],['3','3Y'],['5','5Y'],['all','All']];
  if(!opts.some(o=>o[0]===String(range))) range='all';   // reset if the unit no longer applies (mode switch)
  bar.innerHTML=opts.map(([v,l])=>`<button class="rpill ${String(range)===v?'on':''}" onclick="setRange('${v}')">${l}</button>`).join('');
}
window.setRange=v=>{ range = v==='all'?'all':parseInt(v); renderChart(); };
// The house chart settings (see THE HOUSE STYLE at the top of this file).
// aria:false drops Vega's per-mark ARIA (hundreds of unlabeled graphics-symbol nodes); the
// chart box carries one description instead (describeChart) and the Table display is the text.
const CHART_CFG={aria:false, font:TK.font,
  axis:{labelFont:TK.font,titleFont:TK.font,labelFontSize:12,labelColor:INK.soft,titleFontSize:12.5,titleFontWeight:500,titleColor:INK.soft,
        gridColor:INK.grid,gridWidth:1,domain:false,ticks:false,labelPadding:8},
  axisX:{grid:false,domain:true,domainColor:INK.base,domainWidth:1.2,ticks:true,tickColor:INK.base,tickSize:5,labelPadding:6},
  legend:{labelFont:TK.font,titleFont:TK.font,labelFontSize:12,labelColor:INK.text,titleFontSize:12,titleFontWeight:600,titleColor:INK.soft},
  text:{font:TK.font},
  view:{stroke:null,continuousHeight:300,continuousWidth:300}};
// The page is its own window now (the frame is stamped into it), so the
// layout classes come from this window's size, and the visible height for a
// landscape chart is the frame's content area, which is what scrolls.
// A workspace tile (?embed=1; the site frame marks it too) is neither a desktop page nor a
// phone. It shows the chart and nothing else: the title, a row of chips that is the legend
// (name and newest value), the plot sized to the height left in the tile, the source line.
// Every control the page has (the picker, the tabs, the settings rail) is one press away,
// behind the Controls button, which slides them out beside the chart (css/performance.css,
// html.ccm-embed and .ctl-open). The page's own head script may have classed a small tile
// as a phone before this file ran, so the classes are cleared here.
const isEmbed=()=>document.documentElement.classList.contains('ccm-embed');
if(/[?&]embed=1(&|$)/.test(location.search)){ const c=document.documentElement.classList; c.add('ccm-embed'); c.remove('bb-phone','bb-land'); }
// The controls panel (2026-11-26). Controls slides the page's own controls out beside the
// chart, which stays where it is and redraws as they change. A frame cannot draw outside
// itself, so the workspace enlarges this tile's frame over its neighbours and hands back
// the chart's box inside it (ccmTileBox: x, y, w, h, the panel's side and width); the page
// pins the chart to that box and leaves the rest of the frame clear. Opened on its own
// (no workspace above it), the panel takes the frame's right side, or its foot when narrow.
const PANEL_W=310;
let TILE_BOX=null, _afterOpen=null;
const tileBottom=()=>TILE_BOX ? TILE_BOX.y+TILE_BOX.h : window.innerHeight;
const inWorkspace=()=>{ try{ return window.parent!==window && typeof window.parent.ccmTilePanel==='function'; }catch(e){ return false; } };
window.ccmTileBox=function(b){
  const root=document.documentElement, c=root.classList, was=TILE_BOX;
  TILE_BOX=b||null;
  c.toggle('ctl-open', !!b); c.remove('ctl-right','ctl-left','ctl-bottom');
  if(b){
    c.add('ctl-'+b.side);
    const px=b.side==='left' ? b.x-b.pw : b.x+b.w;
    [['--tx',b.x],['--ty',b.y],['--tw',b.w],['--th',b.h],['--pw',b.pw],['--px',px]].forEach(([k,v])=>root.style.setProperty(k, Math.round(v)+'px'));
    if(b.resized) renderChart();                 // the chart gave up some width to the panel
    const f=_afterOpen; _afterOpen=null; if(f) setTimeout(f, 0);
  } else if(was){ if(was.resized) renderChart(); const t=el('tilectl'); if(t) t.focus(); }
};
function tileControls(open, then){
  if(open === !!TILE_BOX){ if(open && then) then(); return; }
  _afterOpen = open ? (then||null) : null;
  if(inWorkspace()){ window.parent.ccmTilePanel(window, open); return; }
  if(!open){ window.ccmTileBox(null); return; }
  const W=window.innerWidth, H=window.innerHeight, side=W>=PANEL_W+320;
  window.ccmTileBox(side ? {x:0,y:0,w:W-PANEL_W,h:H,side:'right',pw:PANEL_W,resized:true} : {x:0,y:0,w:W,h:H,side:'bottom',pw:W});
}
const tileFullHref=()=>location.pathname+location.search.replace(/([?&])embed=1(&|$)/,(m,a,b)=>b?a:'');
function setupTile(){
  const cap=el('chartcap'), page=document.querySelector('.bb-page'); if(!cap || !page || el('tilebar')) return;
  const bar=document.createElement('div'); bar.id='tilebar'; bar.className='tilebar';
  bar.innerHTML='<div class="tilechips" id="tilechips"></div><button type="button" class="tilebtn tilegear" id="tilectl" aria-expanded="false" aria-label="Chart controls" title="Chart controls"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>';
  cap.insertAdjacentElement('afterend', bar);
  // The panel holds the page's own controls: they are moved, not copied, so every one works as it does on the full page.
  const panel=document.createElement('aside'); panel.id='tilepanel'; panel.className='tilepanel'; panel.setAttribute('aria-label','Chart controls');
  panel.innerHTML='<div class="tilepanel-head"><span>Chart controls</span><button type="button" class="tilebtn on" id="tiledone">Done</button></div>';
  ['.selector','.mtabs','.chartrail'].forEach(q=>{ const n=document.querySelector(q); if(n) panel.appendChild(n); });
  const full=document.createElement('a'); full.className='tilefull'; full.id='tilefull'; full.target='_top'; full.textContent='Open the full page \u203a';
  full.href=tileFullHref();
  panel.appendChild(full);
  page.appendChild(panel);
  el('tilectl').onclick=()=>tileControls(!TILE_BOX);
  el('tiledone').onclick=()=>tileControls(false);
  { const plot=el('chart'); if(plot) plot.addEventListener('click', ()=>{ if(TILE_BOX) tileControls(false); }); }   // a press on the chart closes it too
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && TILE_BOX) tileControls(false); });
  // The panel stays until the reader closes it (the gear, Done, Escape, a press on the chart). A press elsewhere does
  // not close it: a control that redraws itself (line or bar on a series chip) is gone from the
  // page by the time its press is heard, and so looked like a press outside.
  new MutationObserver(()=>el('tilectl').setAttribute('aria-expanded', String(document.documentElement.classList.contains('ctl-open'))))
    .observe(document.documentElement, {attributes:true, attributeFilter:['class']});
}
if(isEmbed()) setupTile();
// The tile's legend: a chip per series (swatch, short name, newest value) and a way to add one.
function renderTileChips(list){
  const box=el('tilechips'); if(!box) return;
  const add=typeof window.KIT_ADD_LABEL==='string'?window.KIT_ADD_LABEL:'Add';
  const drop=(list||[]).length>1 && typeof window.unsel==='function';     // the last series stays
  box.innerHTML=(list||[]).map(s=>`<span class="tchip"><i style="background:${s.color}"></i>${esc(s.short||s.name)}${s.val?` <b>${esc(s.val)}</b>`:''}${drop&&s.tk?`<button type="button" class="tx" data-tk="${esc(s.tk)}" aria-label="Remove ${esc(s.short||s.name)}" title="Remove">×</button>`:''}</span>`).join('')
    +`<button type="button" class="tchip tadd" id="tileadd">+ ${esc(add)}</button>`;
  box.querySelectorAll('.tx').forEach(b=>b.onclick=()=>window.unsel(b.dataset.tk));
  el('tileadd').onclick=()=>tileControls(true, ()=>{ const b=el('issbtn'), p=el('isspanel'); if(b && !(p && p.classList.contains('open'))) b.click(); });
}
const isPhone=()=>document.documentElement.classList.contains('bb-phone');
const isLandscapePhone=()=>document.documentElement.classList.contains('bb-land');
function applyViewMode(){   // returns true when the layout changed
  const w = innerWidth, h = innerHeight;
  const c = document.documentElement.classList, before = c.contains('bb-phone') + ':' + c.contains('bb-land');
  if(isEmbed()){ c.remove('bb-phone','bb-land'); return before !== 'false:false'; }
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
const longCols=()=>Math.max(1,Math.min(6,Math.floor(((el('chart')||{}).clientWidth||600)/190)));   // issuer names need about 190px each
const legendCfg=(long)=>isLandscapePhone()
  ? {orient:"right",direction:"vertical",columns:long?1:2,columnPadding:8,labelLimit:long?150:70,labelFontSize:10.5,symbolSize:80,symbolLimit:1000,symbolType:"stroke",symbolStrokeWidth:2,title:null,rowPadding:2}
  : ({orient:"bottom",direction:"horizontal",columns:long?longCols():legendCols(),columnPadding:isPhone()?10:24,labelLimit:long?170:90,...(long?{title:null}:{}),symbolSize:110,symbolLimit:1000,symbolType:"stroke",symbolStrokeWidth:2});
// Calendar x-axis. The tick step is chosen from the pixels the plot has, not
// from the orientation: a label needs about 44px of room as a year and 70px as
// "Mar 2026" (labelFontSize 10–11); with less room per label the next coarser
// step is tried (months 1·2·3·6, years 1·2·5·10) and, when the coarsest still
// does not fit, the labels are angled, which needs about 18px each. Vega's
// own overlap removal stays on as the safety net. A 23-year card trust on a
// 260px plot (Safari at 150% zoom, or the iPhone Duo's outer screen) used to
// print every other year on top of its neighbour. `plotPx` is the box width
// less the y axis; the kit's own charts pass it from the box.
const AXIS_PX = {year: 44, month: 70, angled: 18};
function dateAxis(nMonths, plotPx){
  const px = plotPx > 0 ? plotPx : 640, months = nMonths > 0 ? nMonths : 120;
  const fits = (n, w) => n * w <= px;
  let a, n;
  if(months <= 24){
    const step = [1, 2, 3, 6].find(st => fits(Math.ceil(months / st), AXIS_PX.month)) || 6;
    n = Math.ceil(months / step);
    a = {tickCount: step === 1 ? "month" : {interval: "month", step}, format: "%b %Y"};
  } else {
    const years = Math.max(2, months / 12), labels = st => Math.max(2, Math.round(years / st));
    const step = [1, 2, 5, 10].find(st => fits(labels(st), AXIS_PX.year)) || 10;
    n = labels(step);
    // the first and the last year in full, those between as ’18 ’19 (the exhibits' rule)
    a = {tickCount: step === 1 ? "year" : {interval: "year", step}, format: "%Y",
         labelExpr: "datum.index==0||datum.index==1 ? timeFormat(datum.value,'%Y') : '\u2019'+timeFormat(datum.value,'%y')"};
  }
  a.labelOverlap = true;                       // parity: drops every other label only if they still collide
  a.labelSeparation = 4;
  if(isPhone()){ a.labelFontSize = 10; }
  if(!fits(n, months <= 24 ? AXIS_PX.month : AXIS_PX.year)){ a.labelAngle = -45; a.labelFontSize = 10; }
  return a;
}
// The plot's width: the box less the y axis (two when a series is on the right axis).
const plotWidth = (box, dual) => (box && box.clientWidth ? box.clientWidth : 0) - (dual ? 110 : 55);
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
     mark:{type:"rule",color:INK.base,strokeWidth:1,strokeDash:[3,3]}, encoding:{x}}
  ];
}
const VEGA_OPTS={actions:false,renderer:'svg',tooltip:{disableDefaultStyle:true}};
// Space kept clear beneath the plot: the source line (~15px), its gap, and
// deliberate breathing room so nothing sits flush against the window edge.
// Used by BOTH the initial height estimate and the corrective fit pass — when
// these disagreed the fit pass ran last and clawed the margin back.
const BOTTOM_RESERVE=78;
const bottomReserve=()=>isEmbed()?34:BOTTOM_RESERVE;   // a tile keeps one line for "Source & notes"

function describeChart(box){   // the box is the image; the SVG's own node tree says nothing a reader needs
  const t=(el('viewTitle')||{}).textContent||'Chart';
  box.setAttribute('role','img'); box.setAttribute('aria-label', t+'. The Table display lists the same figures.');
  box.querySelectorAll('svg').forEach(s=>s.setAttribute('aria-hidden','true'));
}
function fitChart(box,spec){
  // One corrective pass. The plot box is the only part Vega sizes to order;
  // axis, axis title and legend are added on top, so the rendered SVG is the
  // only honest measure of what the chart actually occupies.
  const svg=box.querySelector('svg'); if(!svg||typeof spec.height!=='number'||isPhone()) return;
  const avail=(isEmbed()?tileBottom():window.innerHeight)-box.getBoundingClientRect().top-bottomReserve();
  const over=svg.getBoundingClientRect().height-avail;
  if(over>4 && spec.height-over>=(isEmbed()?80:200)){
    return vegaEmbed(box,{...spec,height:Math.round(spec.height-over)},VEGA_OPTS).then(()=>describeChart(box)).catch(()=>{});
  }
}
function embed(box,spec){ if(typeof vegaEmbed==='undefined'){ box.innerHTML='<div class="chartph">loading chart library…</div>'; return; }
  return vegaEmbed(box,spec,VEGA_OPTS).then(()=>{ describeChart(box); return fitChart(box,spec); })
    .catch(e=>{box.innerHTML='<div class="chartph">chart error: '+esc(e.message)+'</div>';}); }
function hideChips(){ const g=el('seriesgroup'); if(g)g.style.display='none'; const b=el('serieschips'); if(b)b.innerHTML=''; renderTileChips([]); }
function renderSeriesChips(list, showAxis){   // each chart series: [swatch] name [≡|▋] [L|R]  (live-dashboard chip model)
  const bar=el('serieschips'), g=el('seriesgroup'); if(!bar) return;
  if(!list||!list.length){ hideChips(); return; }
  renderTileChips(list);
  if(g)g.style.display='';
  bar.innerHTML=list.map(s=>{
    const mk=seriesMark(s.key), ax=seriesAxis(s.key);
    const mb=['line','bar'].map(m=>`<button class="cm ${mk===m?'on':''}" title="${m}" onclick="setSeriesMark('${s.key}','${m}')">${m==='line'?'≡':'▮'}</button>`).join('');
    const ab=showAxis?`<span class="cgrp">${['left','right'].map(a=>`<button class="cm ${ax===a?'on':''}" title="${a} axis" onclick="setSeriesAxis('${s.key}','${a}')">${a==='left'?'L':'R'}</button>`).join('')}</span>`:'';
    const val=s.val?`<span class="sval">${esc(s.val)}</span>`:'';
    return `<span class="schip"><span class="ssw" style="background:${s.color}"></span><span class="snm">${esc(s.name)}</span>${val}<span class="cgrp">${mb}</span>${ab}</span>`;
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
  // A tile: the plot takes exactly what is left above the x-axis labels and the source line, so
  // nothing falls below the tile's edge; a legend (vintage curves, the year overlay) is taken
  // off by fitChart's corrective pass.
  if(isEmbed()) return Math.max(90, Math.round(tileBottom() - top - 30 - bottomReserve()));
  const chrome = 46 + (legendRows*22) + bottomReserve();
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
  if(isEmbed()){ rail.style.maxHeight=''; rail.style.overflowY=''; return; }   // in a tile the rail is inside the controls panel
  if(isPhone() || document.body.scrollHeight > window.innerHeight + 1){ rail.style.maxHeight = ''; rail.style.overflowY = ''; return; }
  rail.style.maxHeight = Math.max(200, Math.round(window.innerHeight - rail.getBoundingClientRect().top - 12)) + 'px';
  rail.style.overflowY = 'auto';
}
// The calendar (time-series) chart: per-series chips (line/bar + L/R axis),
// dual axes via yL/yR fields, the Explorer's hover. `o`: axisTitle, axisFormat(vals),
// tip {series,x,y}, valueFormat, extraRows, boldTest (Vega expression), nEntries, xTitle.
// A series with `seg` set is one piece of a line drawn in pieces (a gap breaks it); with `dash` set, that
// piece is drawn dashed (a provisional reading). Opt-in, for series that carry an uncertainty:
// o.band (each point's extra holds lo/hi: a shaded margin per series) and o.points (a dot per point,
// drawn hollow and grey where the point's extra has flag:true). o.yZero:false lets a rate axis fit its data.
function calendarChart(box,S,o){
  const grps=[...new Set(S.map(s=>s.grp))], col=g=>S.find(s=>s.grp===g).color;
  // The newest reading of each series: its chip says it, and so does the label at its line's end.
  const lastOf=g=>{ let b=null; S.filter(s=>s.grp===g).forEach(s=>s.pts.forEach(p=>{ if(p[1]!=null && (!b||p[0]>=b[0])) b=p; })); return b; };
  const allVals=S.flatMap(s=>s.pts.map(p=>p[1])).filter(v=>v!=null), vMax=Math.max(0,...allVals.map(Math.abs));
  const axF=o.axisFormat(allVals), vf=o.valueFormat||'.2%';
  // the label's own format: a signed change keeps its sign, a rate reads to a tenth (a hundredth under 2%)
  const labF=o.labelFormat || (axF[0]==='+' ? axF : /%$/.test(vf) ? (vMax<0.02?'.2%':'.1%') : vf);
  // CALENDAR: per-series chips (line/bar + L/R axis) → dual-axis via yL/yR fields
  renderSeriesChips(grps.map(g=>({key:g,name:g,tk:(S.find(x=>x.grp===g)||{}).tk,short:(S.find(x=>x.grp===g)||{}).short,color:col(g),val:lastOf(g)?fmtNum(lastOf(g)[1],labF):''})), grps.length>1);
  // Up to four series are named at their line ends, so the legend goes; past four it stays.
  const tight=(box.clientWidth||0)<560;
  let direct=grps.length<=4;
  // One series: the title names it, so its end label is the value and the period alone.
  const shortOf=g=>{ const s=S.find(x=>x.grp===g); return tight && s.short ? s.short : g; };
  let solo=grps.length===1;
  let labPx=solo ? 78 : direct ? Math.min(tight?120:230, Math.max(...grps.map(g=>(shortOf(g).length+7)*(tight?6.4:7.1)))+14) : 0;
  // The labels need the plot to keep its width: on a screen too narrow for both (a folded phone's
  // outer screen, Safari at 150%) the plot wins and the legend names the series, as past four.
  if(labPx && plotWidth(box, false)-labPx < 190){ direct=false; solo=false; labPx=0; }
  const data=[]; S.forEach(s=>{ const ax=seriesAxis(s.grp); s.pts.forEach(([x,y,xl,extra])=>data.push({x,xl,series:s.series,grp:s.grp,seg:s.seg||s.series, dash:!!s.dash, yL:ax==='left'?y:null, yR:ax==='right'?y:null, ...(extra||{})})); });
  const nMonths=new Set(data.map(d=>String(d.x).slice(0,7))).size;
  const dual = grps.some(g=>seriesAxis(g)==='right') && grps.some(g=>seriesAxis(g)==='left');
  // A calendar axis needs no title; a page passes xTitle only when the dates mean something else.
  const X={field:"x",type:"temporal",title:o.xTitle||null,
           axis:{...dateAxis(nMonths, plotWidth(box, dual)-labPx), titleAnchor:"start", titleLimit:Math.max(120, plotWidth(box, dual)-labPx)}};
  const C={field:"grp",type:"nominal",title:"Series",scale:{domain:grps,range:grps.map(col)}};
  const T=o.tip;
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
    // One scale: no axis title, the unit on the top tick. Two scales: each keeps its title, in its colour.
    const Y={field:yf,type:"quantitative",title:dual?o.axisTitle:null,scale:{zero:o.yZero!==false,nice:true},
             axis:{...unitAxis(o.axisFormat(data.map(r=>r[yf])),data.map(r=>r[yf])),grid:sd==='left'||!dual,orient:sd,...ac}};
    const d=data.filter(r=>r[yf]!=null);
    const marks=['line','bar'].map(mk=>{ const ms=gs.filter(g=>seriesMark(g)===mk); if(!ms.length) return null;
      return {data:{values:d.filter(r=>ms.includes(r.grp))},
        mark: mk==='bar'?{type:"bar",opacity:0.75}:{type:"line",interpolate:"monotone"},
        encoding:{y:Y, detail:{field:"seg"},
          ...(mk==='line' ? {strokeWidth:{condition:{test:o.boldTest, value:3}, value:2},
                             strokeDash:{condition:{test:"datum.dash", value:[5,4]}, value:[1,0]}} : {})}}; }).filter(Boolean);
    // The margin sits under the lines; the dots on top. Both read the same y scale as the lines.
    const band = o.band ? [{data:{values:d.filter(r=>r.lo!=null&&r.hi!=null&&!r.dash)},
        mark:{type:"area",interpolate:"monotone",opacity:gs.length>2?0.10:0.16},
        encoding:{y:{...Y,field:"lo"}, y2:{field:"hi"}, detail:{field:"seg"}}}] : [];
    const dots = o.points ? [{data:{values:d},
        mark:{type:"point",filled:true,size:28,strokeWidth:1.6},
        encoding:{y:Y,
          fill:{condition:{test:"datum.flag || datum.dash", value:"#ffffff"}, field:"grp", type:"nominal", scale:C.scale, legend:null},
          stroke:{condition:{test:"datum.flag", value:"#8a929e"}, field:"grp", type:"nominal", scale:C.scale, legend:null}}}] : [];
    // The line's end: a dot with a white ring, and (to four series) the name and the newest value,
    // pushed apart so two close endings never print over one another.
    const lasts=gs.map(g=>({g, p:lastOf(g)})).filter(e=>e.p);
    const ends=lasts.map(e=>({x:e.p[0], [yf]:e.p[1], grp:e.g}));
    const endDots=[{data:{values:ends}, mark:{type:"point",filled:true,size:64,stroke:"#fff",strokeWidth:2,opacity:1}, encoding:{y:Y}}];
    const ys=d.map(r=>r[yf]), lo=o.yZero!==false?Math.min(0,...ys):Math.min(...ys), hi=Math.max(...ys);
    const gap=((hi-lo)||1)*(tight?17:19)/Math.max(80,chartHeight(o.nEntries,6)-30);
    const xEnd=data.reduce((m,r)=>r.x>m?r.x:m,'');
    const labs=lasts.map(e=>({x:xEnd, [yf]:e.p[1], grp:e.g, nm:shortOf(e.g), v:e.p[1], xl:e.p[2]||''})).sort((a,b)=>a[yf]-b[yf]);
    labs.forEach((l,i)=>{ if(i && l[yf]-labs[i-1][yf]<gap) l[yf]=labs[i-1][yf]+gap; });
    const endLabs = solo ? [
        {data:{values:labs}, transform:[{calculate:`format(datum.v, '${labF}')`, as:"lab"}],
         mark:{type:"text",align:"left",baseline:"bottom",dx:10,dy:1,fontSize:16,fontWeight:700},
         encoding:{y:Y, text:{field:"lab"}, color:{value:col(gs[0])}}},
        {data:{values:labs}, mark:{type:"text",align:"left",baseline:"top",dx:10,dy:4,fontSize:11.5,fontWeight:500},
         encoding:{y:Y, text:{field:"xl"}, color:{value:INK.soft}}}]
      : direct ? [{data:{values:labs}, transform:[{calculate:`datum.nm + '  ' + format(datum.v, '${labF}')`, as:"lab"}],
        mark:{type:"text",align:"left",baseline:"middle",dx:9,fontSize:tight?11.5:12.5,fontWeight:600},
        encoding:{y:Y, text:{field:"lab"}, color:{value:INK.text}}}] : [];
    return {layer: zeroRule(ys,Y).concat(band, marks, dots, endDots, endLabs, hoverLayers(d, X, Y,
      {color:C, rows:[{field:"series",type:"nominal",title:T.series},{field:"xl",type:"nominal",title:T.x},{field:yf,type:"quantitative",title:T.y,format:o.valueFormat||".2%"}, ...(o.extraRows||[])]}, "hover"+sd))};
  };
  const groups=[side('left'),side('right')].filter(Boolean);
  return embed(box,{ $schema:"https://vega.github.io/schema/vega-lite/v5.json", width:"container", height:chartHeight(o.nEntries,6), background:null,
    // symbolOpacity: with a band, the legend would otherwise take the band's faint opacity.
    encoding:{ x:X, color:{...C, legend: !direct && grps.length>1 && !isEmbed() ? {...legendCfg(true), ...(o.band?{symbolOpacity:1}:{})} : null} },
    layer: groups.length>1 ? groups : groups[0].layer,
    ...(groups.length>1 ? {resolve:{scale:{y:"independent"}}} : {}), config:CHART_CFG });
}
/* Picker — a button that summarises the selection and a panel of checkboxes
   (radio when the view takes one). The subject is selected[0]: the panel
   marks it with a star and lets a checked entry be promoted.
   cfg: {btn, panel, wrap, placeholder, options() → [{t,label,retired,ended,off,offTitle,group}],
         multi() → bool, hint() → text or '', get() → selected, set(arr),
         onChange('pick' | 'subject')}
   `ended` (a year) marks an entry no longer reporting: 'to 2005' at the row's right, ' (to 2005)' on the button. */
function kitPicker(cfg){
  const btn=el(cfg.btn), panel=el(cfg.panel);
  const text=a=>a.label+(a.retired?' (retired)':'');
  const btnText=a=>text(a)+(a.ended?' (to '+a.ended+')':'');
  function updateBtn(){
    const parts = cfg.get().map(t=>btnText(cfg.options().find(x=>x.t===t)||{label:t}));
    if(!parts.length)        btn.textContent = cfg.placeholder;
    else if(parts.length<=2) btn.textContent = parts.join(', ') + ' \u25be';
    else                     btn.textContent = parts[0] + ', +' + (parts.length-1) + ' more \u25be';
  }
  function build(){
    const multi=cfg.multi(), selected=cfg.get();
    panel.innerHTML = '';
    const hint=cfg.hint();
    if(hint){ const h=document.createElement('div'); h.className='mss-hint'; h.textContent=hint; panel.appendChild(h); }
    let groupShown=null;
    for(const a of cfg.options()){
      // a grouped entry sits under its heading; options() lists groups last
      if(a.group && a.group!==groupShown){ const g=document.createElement('div'); g.className='mss-hint mss-group'; g.textContent=a.group; panel.appendChild(g); groupShown=a.group; }
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
      if(a.ended){ const e=document.createElement('span'); e.className='mss-ended'; e.textContent='to '+a.ended; lbl.appendChild(e); }
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
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && panel.classList.contains('open')){ close(); btn.focus(); } });   // Escape closes, focus returns to the button
  return {build, updateBtn, close};
}
// Inter is served by the site (style.css). When it arrives after the first draw Vega has
// measured its labels in the fallback font, so the chart is drawn once more.
if(document.fonts && document.fonts.load && !document.fonts.check("12px Inter")){
  document.fonts.load("12px Inter").then(f=>{ if(f && f.length && typeof renderChart==='function'){ try{ renderChart(); }catch(e){} } }).catch(()=>{});
}
