// Build B · Performance page — context line and Deals table. Plain scripts sharing one scope,
// loaded in order by index.html; see web/README.md.
/* ---------- subject sections ---------- */
// A deal's life stage (active / new / wound) is decided once, in
// src/metrics/deal_status.py; the context line and the Deals table both read it.
const dealState=dl=>dl.state;
function dealCounts(sh){ const n={active:0,new:0,wound:0}; (sh.deals||[]).forEach(d=>n[dealState(d)]++); return n; }
function renderCtx(){
  const d=SHELVES[selected[0]]; if(!d) return; const ps=d.pool_snapshot||{};
  // Provenance only. The identity is already stated twice above — in the
  // picker and in the chart title — and the servicer lives on the presale
  // report, which is one click away from the Deals lens. "Data through" is
  // the newest period of whichever source the current lens draws from.
  const through = useAbsee()
    ? `loan tape through <b>${fmtMonth(ps.absee_through)}</b>`
    : `data through <b>${fmtMonth(ps.data_through||ps.as_of)}</b>` + (ps.as_of?` (reported ${fmtDate(ps.as_of)})`:'');
  const n=dealCounts(d);
  el('ctxline').innerHTML=[
      `${n.active} active deal${n.active===1?'':'s'}`,
      n.new?`${n.new} awaiting first report`:'',
      `${n.wound} wound down`,
      through,
      selected.length>1?`+${selected.length-1} comparison${selected.length>2?'s':''} on the chart`:''
    ].filter(Boolean).join(' &middot; ');
}
function renderSubject(){
  const d=SHELVES[selected[0]];
  renderCtx();
  el('dealsubj').textContent='— '+d.ticker+' (subject)'; renderDeals();
}
// The Deals table has one renderer — src/workflows/sec/shelf_detail/render_pages.py —
// which writes it as a fragment (data/<T>.deals.html). A static shelf page
// embeds it; this page fetches it. Both show the same table, always.
const _frag={};
async function renderDeals(){
  const sh=SHELVES[selected[0]], t=sh.ticker, box=el('dealsbody');
  if(!(window.BB_PRESET&&window.BB_PRESET.static&&window.BB_PRESET.sel===t&&box.querySelector('.deals-block'))){
    if(!_frag[t]){ try{ _frag[t]=await (await fetch(`data/${t}.deals.html?t=`+Date.now())).text(); }
                   catch(e){ _frag[t]='<div class="note">Deals table unavailable.</div>'; } }
    box.innerHTML=_frag[t];
  }
  const blk=box.querySelector('.deals-block'); el('ndeals').textContent=blk?blk.dataset.ndeals:'';
  const sw=box.querySelector('.sw'); if(sw)sw.onclick=e=>{e.preventDefault();const rs=box.querySelectorAll('.woundrow');const shw=rs[0].style.display==='none';rs.forEach(r=>r.style.display=shw?'':'none');sw.textContent=(shw?'Hide ':'Show ')+rs.length+' wound-down'+(shw?' ▴':' ▾');};
}
