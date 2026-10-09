// Credit Card page — chart and table rendering on the kit (js/kit/core.js). Plain scripts
// sharing one scope, loaded in order by credit_card.html; see web/README.md.
/* ---------- chart ---------- */
// A month a trust (or All Trusts, under its share gate) does not report
// leaves a gap in the line rather than a bridge across it: the series is
// drawn in contiguous pieces.
const monthIndex=d=>{ const [y,m]=d.split('-').map(Number); return y*12+m; };
function pieces(pts){
  const out=[]; let cur=[];
  pts.forEach((p,i)=>{ if(i && monthIndex(p[0])-monthIndex(pts[i-1][0])>1){ out.push(cur); cur=[]; } cur.push(p); });
  if(cur.length) out.push(cur);
  return out;
}
function buildSeries(){
  const K=calKey(), k=scaleOf(), S=[];
  selected.forEach((tk,i)=>{ const sh=SHELVES[tk]; const arr=calOf(sh).filter(p=>p[K]!=null);
    const name=labCode(tk), color=isAll(tk)?ALL_COLOR:ISSCOLOR[i%ISSCOLOR.length];
    const pts=arr.map(p=>[p.date,p[K]*k,fmtMonth(p.date),extraOf(p)]);
    pieces(pts).forEach((run,j)=>S.push({series:name, grp:name, seg:j?`${name}#${j}`:name, color, pts:run})); });
  return S;
}
function setCap(){ el('chartcap').textContent = subtitleFor(); }
function updateOutputAvail(){
  el('xfctl').hidden = !(isRate() && output!=='seasonal' && !macroId);
  document.querySelectorAll('#xfseg button').forEach(b=>b.classList.toggle('on',b.dataset.transform===transform));
  document.querySelectorAll('#outseg button').forEach(b=>b.classList.toggle('on',b.dataset.out===output));
  el('dqctl').hidden = !isDQ();
  el('yldctl').hidden = meta().tab!=='yld';
  const sb=el('seasbtn'); sb.style.opacity=multiIssuer()?0.4:1;
  sb.title=multiIssuer()?'Year overlay is for one trust at a time':'';
  el('macrosel').disabled=multiIssuer();
  el('macrosel').title=multiIssuer()?'Macro overlay is for one trust at a time':'';
}
// Views that describe ONE trust: the year overlay and the macro overlay. With
// two or more trusts they are unavailable, and the page says so rather than
// silently drawing only the first one.
function enforceSingleIssuerViews(){
  if(!multiIssuer()) return;
  if(output==='seasonal'){ output='chart'; toast('Year overlay compares one trust\'s years against each other — showing the time series for the trusts selected.'); }
  if(macroId){ macroId=null; el('macrosel').value=''; el('macrosel').classList.remove('on');
               toast('Macro overlay plots one trust against a macro series — showing the trusts selected without it.'); }
}
function setOutput(o){
  if(o==='seasonal' && multiIssuer()){ toast('Year overlay is for one trust at a time — select a single trust to use it.'); return; }
  output=o; renderChart();
}
function renderChart(){
  updateOutputAvail(); setCap(); renderRangeBar(); requestAnimationFrame(fitRail);
  el('viewTitle').textContent = titleFor();
  renderCtx();
  syncAddress();
  if(_focusNext){ _focusNext=false; requestAnimationFrame(focusChart); }
  const _src = sourceFor(), _notes = notesFor();
  el('chartsrc').innerHTML = '<button type="button" class="src-toggle" onclick="this.parentNode.classList.toggle(\'open\')">Source &amp; notes ›</button>'
    + '<span class="src-full">Source: ' + esc(_src)
    + (_notes.length ? ' &middot; ' + esc(_notes.join(' ')) : '')
    + ' &middot; <a href="../methodology.html">Methodology &amp; Data Quality</a></span>';
  window.CC_CHART_SOURCE = _src + (_notes.length ? '. ' + _notes.join(' ') : '');
  const box=el('chart');
  if(metric==='deals') return;                 // the Deals lens has no chart
  if(macroId) return renderOverlay(box);
  if(output==='seasonal'){ hideChips(); return renderSeasonal(box); }
  let S=buildSeries();
  if(!S.length || S.every(x=>!x.pts.length)){ hideChips();
    const who=lab(selected[0]);
    box.innerHTML = `<div class="chartph">${esc(who)} does not report ${esc(metricLabel())}.</div>`;
    return; }
  if(yoyActive()) S=S.map(s=>({...s, pts:applyYoy(s.pts)}));
  S=applyRange(S,false);
  if(S.every(x=>!x.pts.length)){ hideChips(); box.innerHTML='<div class="chartph">Not enough history for a year-over-year comparison.</div>'; return; }
  if(output==='table'){ hideChips(); return renderCalendarTable(box,S); }
  return calendarChart(box,S,{axisTitle:metricAxis(), axisFormat:vals=>yoyActive() ? (transform==='yoy-delta' ? '+.2%' : '+.1%') : axFmt(vals),
    tip:tipLabels(), valueFormat:valueFormat(), extraRows:extraRows(), boldTest:"datum.series === 'All Trusts'", nEntries:selected.length, xTitle:'Collection Month'});
}
