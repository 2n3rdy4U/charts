// Credit Card page — trust picker, tabs and controls on the kit. Plain scripts sharing one
// scope, loaded in order by credit_card.html; see web/README.md.
/* ---------- selector ---------- */
// Deals describes one trust; the charts compare several.
const issMulti = () => metric !== 'deals';
let _setAside = null;
function fitSelectionToView(){
  if(!issMulti() && selected.length>1){ _setAside = selected.slice(1); selected = [selected[0]]; }
  else if(issMulti() && _setAside && selected.length===1){
    selected = [selected[0], ..._setAside.filter(t=>t!==selected[0] && AVAIL.some(a=>a.t===t))];
    _setAside = null;
  }
}
const PICK = kitPicker({btn:'issbtn', panel:'isspanel', wrap:'isswrap', placeholder:'Select trusts ▾',
  options:()=>AVAIL.slice().sort((x,y)=>isAll(x.t)?-1:isAll(y.t)?1:x.label.localeCompare(y.label))
                .map(a=>({...a, off:!issMulti()&&isAll(a.t), offTitle:'All Trusts has no series of its own'})),
  multi:issMulti,
  hint:()=>issMulti() ? '' : 'Deals describes one trust at a time',
  get:()=>selected, set:v=>{ selected=v; },
  onChange:why=>{ refresh(); if(why==='pick') countView(); }});
function updateIssBtn(){ PICK.updateBtn(); }
function buildIssPanel(){ PICK.build(); }
function closeAdd(){ PICK.close(); }

async function refresh(){ fitSelectionToView(); await ensure(selected); enforceSingleIssuerViews(); updateIssBtn(); syncTabs(); renderSubject(); renderChart(); }
window.sel=t=>{ if(!selected.includes(t))selected.push(t); buildIssPanel(); refresh(); countView(); };
window.unsel=t=>{ if(selected.length<2)return; selected=selected.filter(x=>x!==t); buildIssPanel(); refresh(); };
window.makeSubject=t=>{ selected=[t,...selected.filter(x=>x!==t)]; buildIssPanel(); refresh(); };
function syncTabs(){
  document.querySelectorAll('.mtabs button').forEach(x=>x.classList.toggle('on',x.dataset.tab===tabOf()));
  // Deals describes one trust; All Trusts has none, so the tab is greyed out
  // while it is the subject rather than opening on a message.
  const dt=document.querySelector('.mtabs button[data-tab="deals"]');
  if(dt){ dt.disabled=isAll(selected[0]); dt.title=dt.disabled?'All Trusts has no series of its own':''; }
  syncDqSeg(); syncYldSeg();
}
document.querySelectorAll('.mtabs button').forEach(b=>b.onclick=()=>{
  const tab=b.dataset.tab;
  if(tab==='deals'){ metric='deals'; syncTabs(); fitSelectionToView(); buildIssPanel(); updateIssBtn(); showLens('deals'); return; }
  // a tab remembers its last bucket / measure
  if(tabOf()!==tab) metric = TAB_DEFAULT[tab];
  syncTabs(); fitSelectionToView(); buildIssPanel(); updateIssBtn(); renderSubject(); showLens('chart'); countView();});
function syncDqSeg(){ document.querySelectorAll('#dqseg button').forEach(x=>x.classList.toggle('on', x.dataset.dq===metric)); }
function syncYldSeg(){ document.querySelectorAll('#yldseg button').forEach(x=>x.classList.toggle('on', x.dataset.yld===metric)); }
document.querySelectorAll('#dqseg button').forEach(b=>b.onclick=()=>{ metric=b.dataset.dq; syncDqSeg(); renderChart(); countView(); });
document.querySelectorAll('#yldseg button').forEach(b=>b.onclick=()=>{ metric=b.dataset.yld; syncYldSeg(); renderChart(); countView(); });
document.querySelectorAll('#outseg button').forEach(b=>b.onclick=()=>setOutput(b.dataset.out));
document.querySelectorAll('#xfseg button').forEach(b=>b.onclick=()=>{ transform=b.dataset.transform; renderChart(); });
let _rz, _rzW=window.innerWidth; addEventListener('resize',()=>{ clearTimeout(_rz); _rz=setTimeout(()=>{
  const changed = applyViewMode();
  if(isPhone() && !changed && window.innerWidth===_rzW) return;
  _rzW=window.innerWidth;
  if(!el('perfPanel').hidden) renderChart();
}, 180); });
el('macrosel').onchange=e=>{ if(multiIssuer()){ e.target.value=''; toast('Macro overlay is for one trust at a time — select a single trust to use it.'); return; }
  macroId=e.target.value||null; el('macrosel').classList.toggle('on',!!macroId); renderChart(); };
if(window.ccmFrame) ccmFrame.setActive('abs-credit-card');
