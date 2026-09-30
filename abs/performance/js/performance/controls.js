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

   Single vs multiple is decided by the lens: Deals describes one shelf, so
   checking there replaces the selection instead of adding to it. */
const issMulti = () => metric !== 'deals';

function updateIssBtn(){
  const parts = selected.map(t=>(AVAIL.find(x=>x.t===t)||{label:t}).label);
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
    h.textContent='Deals describes one shelf at a time';
    panel.appendChild(h);
  }
  for(const a of opts){
    const lbl=document.createElement('label');
    const cb=document.createElement('input');
    cb.type = issMulti() ? 'checkbox' : 'radio';
    cb.name = 'issPick'; cb.value=a.t; cb.checked = selected.includes(a.t);
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
    lbl.appendChild(document.createTextNode(' '+a.label));
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

async function refresh(){ await ensure(selected); enforceSingleIssuerViews(); updateIssBtn(); renderSubject(); renderChart();
}
window.sel=t=>{ if(!selected.includes(t))selected.push(t); buildIssPanel(); refresh(); countView(); };
window.unsel=t=>{ if(selected.length<2)return; selected=selected.filter(x=>x!==t); buildIssPanel(); refresh(); };
window.makeSubject=t=>{ selected=[t,...selected.filter(x=>x!==t)]; buildIssPanel(); refresh(); };
el('issbtn').onclick=e=>{ e.stopPropagation(); buildIssPanel(); el('isspanel').classList.toggle('open'); };
document.addEventListener('click',e=>{ if(!e.target.closest('#isswrap')) closeAdd(); });
// Tabs that belong to one asset class (Repossessions: loan; Residuals: lease).
function syncTabs(){ document.querySelectorAll('.mtabs button[data-asset]').forEach(b=>{ b.hidden=b.dataset.asset!==assetClass; }); }
document.querySelectorAll('#assetseg button').forEach(b=>b.onclick=()=>{
  if(b.dataset.asset===assetClass)return;
  document.querySelectorAll('#assetseg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  assetClass=b.dataset.asset; selected=[CLASS_DEFAULT[assetClass]]; syncTabs();
  const cur=document.querySelector('.mtabs button.on'); if(cur&&cur.hidden){ document.querySelector('.mtabs button[data-metric="dq_60plus_pct"]').click(); }
  closeAdd(); buildIssPanel(); refresh(); countView();
});

document.querySelectorAll('.mtabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.mtabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');metric=b.dataset.metric;
  // Deals describes one shelf, the charts can compare several — the picker
  // changes between radio and checkbox with the lens, so it offers only what
  // the current view can actually use.
  if(metric==='deals'){ if(selected.length>1) selected=[selected[0]];
                        buildIssPanel(); updateIssBtn(); showLens('deals'); return; }
  buildIssPanel(); showLens('chart');
  const m=METRIC_META[metric]; if(m)setMode(m.mode); el('dqctl').style.display=(m&&m.dq)?'':'none'; syncDqSeg(); renderChart(); countView();});
function syncDqSeg(){ document.querySelectorAll('#dqseg button').forEach(x=>x.classList.toggle('on', x.dataset.dq===metric)); }
document.querySelectorAll('#dqseg button').forEach(b=>b.onclick=()=>{ metric=b.dataset.dq; syncDqSeg(); renderChart(); });
document.querySelectorAll('#modeseg button').forEach(b=>b.onclick=()=>{
  if(b.dataset.mode==='vintage'&&(selected.length>=2||isRepo()))return;   // vintage is single-issuer; cross-issuer = calendar (cohort comparison deferred to Losses tab)
  document.querySelectorAll('#modeseg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');mode=b.dataset.mode;renderChart();});
document.querySelectorAll('#outseg button').forEach(b=>b.onclick=()=>setOutput(b.dataset.out));
document.querySelectorAll('#poolseg button').forEach(b=>b.onclick=()=>{ pools=b.dataset.pools; renderChart(); });
let _rz; addEventListener('resize',()=>{ clearTimeout(_rz); _rz=setTimeout(()=>{
  if(!el('perfPanel').hidden) renderChart();   // height is derived from the window
}, 180); });
el('macrosel').onchange=e=>{ if(multiIssuer()){ e.target.value=''; toast('Macro overlay is for one issuer at a time — select a single issuer to use it.'); return; }
  macroId=e.target.value||null; el('macrosel').classList.toggle('on',!!macroId); renderChart(); };

