// Build B · Performance page — issuer picker, tabs and controls. Plain scripts sharing one scope,
// loaded in order by index.html; see web/README.md.
/* ---------- selector ---------- */
function classAvail(){ return AVAIL.filter(a=>a.asset===assetClass); }

/* Issuer picker — the live site's pattern: a button that summarises the
   selection, and a panel of checkboxes. Replaces the chip row, whose standing
   "Compare:" label described something that is only a comparison once a second
   issuer exists.

   Build B keeps a concept the live loss picker does not: selected[0] is the
   SUBJECT, and the KPI band, the Deals lens and the chart title all key off it.
   So the panel marks the subject with a star and lets a checked issuer be
   promoted, rather than treating every selection as equal.

   Single vs multiple is decided by the view, as on the Explorer: Deals and
   vintage curves describe one shelf, so there the picker takes one issuer
   (checking replaces the selection); time series compares several. */
const issMulti = () => metric !== 'deals' && mode !== 'vintage';
// Going to a one-issuer view keeps the subject and sets the others aside;
// coming back to time series restores them, so a comparison is not lost by
// glancing at one shelf's vintages.
let _setAside = null;
function fitSelectionToView(){
  if(!issMulti() && selected.length>1){ _setAside = selected.slice(1); selected = [selected[0]]; }
  else if(issMulti() && _setAside && selected.length===1){
    selected = [selected[0], ..._setAside.filter(t=>t!==selected[0] && AVAIL.some(a=>a.t===t && a.asset===assetClass))];
    _setAside = null;
  }
}

function updateIssBtn(){
  const parts = selected.map(t=>{ const a=AVAIL.find(x=>x.t===t)||{label:t}; return a.label+(a.retired?' (retired)':''); });
  const b = el('issbtn');
  if(!parts.length)        b.textContent = 'Select issuers \u25be';
  else if(parts.length<=2) b.textContent = parts.join(', ') + ' \u25be';
  else                     b.textContent = parts[0] + ', +' + (parts.length-1) + ' more \u25be';
}

function buildIssPanel(){
  const panel = el('isspanel');
  const opts = classAvail().sort((x,y)=>x.label.localeCompare(y.label));
  panel.innerHTML = '';
  if(!issMulti()){
    const h=document.createElement('div'); h.className='mss-hint';
    h.textContent = metric==='deals' ? 'Deals describes one shelf at a time'
                                     : 'Vintage curves show one issuer — use Time series to compare';
    panel.appendChild(h);
  }
  for(const a of opts){
    const lbl=document.createElement('label');
    const cb=document.createElement('input');
    cb.type = issMulti() ? 'checkbox' : 'radio';
    cb.name = 'issPick'; cb.value=a.t; cb.checked = selected.includes(a.t);
    if(!issMulti() && isAll(a.t)){ cb.disabled=true; lbl.classList.add('off'); lbl.title='All Issuers has no deals of its own'; }
    cb.addEventListener('change', ()=>{
      if(!issMulti()){ selected=[a.t]; }
      else if(cb.checked){ if(!selected.includes(a.t)) selected.push(a.t); }
      else {
        if(selected.length<2){ cb.checked=true; return; }   // never empty
        selected = selected.filter(x=>x!==a.t);
      }
      buildIssPanel(); updateIssBtn(); refresh(); countView();
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' '+a.label+(a.retired?' (retired)':'')));
    if(issMulti() && selected.includes(a.t)){
      const st=document.createElement('span');
      const isSubj = selected[0]===a.t;
      st.className='mss-star'+(isSubj?' on':'');
      st.textContent='\u2605';
      st.title = isSubj ? 'Subject' : 'Make subject';
      if(!isSubj) st.onclick=(e)=>{ e.preventDefault(); e.stopPropagation();
        selected=[a.t,...selected.filter(x=>x!==a.t)];
        buildIssPanel(); updateIssBtn(); refresh(); };
      lbl.appendChild(st);
    }
    panel.appendChild(lbl);
  }
}
function closeAdd(){ el('isspanel').classList.remove('open'); }

async function refresh(){ fitSelectionToView(); await ensure(selected); enforceSingleIssuerViews(); updateIssBtn(); syncTabs(); renderSubject(); renderChart();
}
window.sel=t=>{ if(!selected.includes(t))selected.push(t); buildIssPanel(); refresh(); countView(); };
window.unsel=t=>{ if(selected.length<2)return; selected=selected.filter(x=>x!==t); buildIssPanel(); refresh(); };
window.makeSubject=t=>{ selected=[t,...selected.filter(x=>x!==t)]; buildIssPanel(); refresh(); };
el('issbtn').onclick=e=>{ e.stopPropagation(); buildIssPanel(); el('isspanel').classList.toggle('open'); };
document.addEventListener('click',e=>{ if(!e.target.closest('#isswrap')) closeAdd(); });
// Auto Loan and Auto Lease are both this page; the frame's highlight and
// breadcrumb follow the Loans | Leases toggle, and so does the address — on a
// CLICK of the toggle it becomes the one the rail entry opens, so the rail, the
// address bar and the page always agree (no reload; a copied address reopens
// this asset class). On load the address is left alone: a deep link keeps its
// settings in the bar (it once collapsed ?sel=…&m=… to ?ac=… on arrival).
function tellFrameAsset(setAddress){
  const id=assetClass==='lease' ? 'abs-auto-lease' : 'abs-auto';
  if(window.ccmFrame) ccmFrame.setActive(id);
  if(!setAddress) return;
  const rail=document.querySelector('#rail [data-id="'+id+'"]');
  const href=rail ? rail.getAttribute('href') : location.pathname+'?ac='+assetClass;
  try{ if(location.pathname+location.search!==href) history.replaceState(null,'',href); }catch(e){}
}
// Tabs that belong to one asset class (Repossessions: loan; Residuals: lease).
function syncTabs(){ document.querySelectorAll('.mtabs button[data-asset]').forEach(b=>{ b.hidden=b.dataset.asset!==assetClass; });
  // Deals describes one shelf; All Issuers has none, so the tab is greyed out
  // while it is the subject rather than opening on a message.
  const dt=document.querySelector('.mtabs button[data-metric="deals"]');
  if(dt){ dt.disabled=isAll(selected[0]); dt.title=dt.disabled?'All Issuers has no deals of its own':''; } }
document.querySelectorAll('#assetseg button').forEach(b=>b.onclick=()=>{
  if(b.dataset.asset===assetClass)return;
  document.querySelectorAll('#assetseg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  assetClass=b.dataset.asset; selected=[CLASS_DEFAULT[assetClass]]; syncTabs(); tellFrameAsset(true);
  const cur=document.querySelector('.mtabs button.on'); if(cur&&cur.hidden){ document.querySelector('.mtabs button[data-metric="dq_60plus_pct"]').click(); }
  closeAdd(); buildIssPanel(); refresh(); countView();
});

document.querySelectorAll('.mtabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.mtabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');metric=b.dataset.metric;
  // Deals describes one shelf, the charts can compare several — the picker
  // changes between radio and checkbox with the lens, so it offers only what
  // the current view can actually use.
  if(metric==='deals'){ fitSelectionToView(); buildIssPanel(); updateIssBtn(); showLens('deals'); return; }
  const m=METRIC_META[metric]; if(m)setMode(m.mode); el('dqctl').style.display=(m&&m.dq)?'':'none'; syncDqSeg();
  fitSelectionToView(); buildIssPanel(); updateIssBtn(); renderSubject(); showLens('chart'); countView();});
function syncDqSeg(){ document.querySelectorAll('#dqseg button').forEach(x=>x.classList.toggle('on', x.dataset.dq===metric)); }
document.querySelectorAll('#dqseg button').forEach(b=>b.onclick=()=>{ metric=b.dataset.dq; syncDqSeg(); renderChart(); });
document.querySelectorAll('#modeseg button').forEach(b=>b.onclick=()=>{
  if(b.dataset.mode==='vintage'&&isRepo())return;   // repossessions are a calendar rate; no vintage curve
  setMode(b.dataset.mode); refresh(); countView();});
document.querySelectorAll('#outseg button').forEach(b=>b.onclick=()=>setOutput(b.dataset.out));
document.querySelectorAll('#poolseg button').forEach(b=>b.onclick=()=>{ pools=b.dataset.pools; renderChart(); });
document.querySelectorAll('#xfseg button').forEach(b=>b.onclick=()=>{ transform=b.dataset.transform; renderChart(); });
// Redraw on resize — height is derived from the window. On a phone, Safari's
// address bar showing and hiding while scrolling resizes the window's HEIGHT
// only; redrawing then made the chart jump, so a phone redraws only when the
// width changes (rotation).
let _rz, _rzW=window.innerWidth; addEventListener('resize',()=>{ clearTimeout(_rz); _rz=setTimeout(()=>{
  const changed = applyViewMode();
  if(isPhone() && !changed && window.innerWidth===_rzW) return;
  _rzW=window.innerWidth;
  if(!el('perfPanel').hidden) renderChart();
}, 180); });
el('macrosel').onchange=e=>{ if(multiIssuer()){ e.target.value=''; toast('Macro overlay is for one issuer at a time — select a single issuer to use it.'); return; }
  macroId=e.target.value||null; el('macrosel').classList.toggle('on',!!macroId); renderChart(); };

