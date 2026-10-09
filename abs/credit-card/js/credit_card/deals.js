// Credit Card page — context line and Deals (series) table. Plain scripts sharing one scope,
// loaded in order by credit_card.html; see web/README.md.
function renderCtx(){
  const d=SHELVES[selected[0]]; if(!d) return; const s=d.snapshot||{};
  const through = `reports through <b>${fmtMonth(s.through)}</b>`;
  const more = selected.length>1 ? ` &middot; +${selected.length-1} comparison${selected.length>2?'s':''} on the chart` : '';
  if(isAll(d.ticker)){
    el('ctxline').innerHTML=`${s.n_trusts} trusts weighted by receivables &middot; ${through}${more}`;
    return;
  }
  el('ctxline').innerHTML=[
      s.balance!=null ? `receivables <b>${money(s.balance)}</b>` : '',
      `${s.n_active} series outstanding`, s.n_matured ? `${s.n_matured} matured` : '',
      through, more.replace(/^ &middot; /,'')
    ].filter(Boolean).join(' &middot; ');
}
function renderSubject(){
  const d=SHELVES[selected[0]];
  renderCtx();
  el('dealsubj').textContent=isAll(d.ticker)?'':'— '+d.ticker+' (subject)'; renderDeals();
}
// The Deals table has one renderer — src/workflows/cc/render_trust_pages.py —
// which writes it as a fragment (data/<T>.deals.html). A static trust page
// embeds it; this page fetches it. Both show the same table, always.
const _frag={};
async function renderDeals(){
  const sh=SHELVES[selected[0]], t=sh.ticker, box=el('dealsbody');
  if(!(window.BB_PRESET&&window.BB_PRESET.static&&window.BB_PRESET.sel===t&&box.querySelector('.deals-block'))){
    if(!_frag[t]){ try{ _frag[t]=await (await fetch(`data/${t}.deals.html?t=`+Date.now())).text(); }
                   catch(e){ _frag[t]='<div class="note">Series table unavailable.</div>'; } }
    box.innerHTML=_frag[t];
  }
  const blk=box.querySelector('.deals-block'); el('ndeals').textContent=blk?blk.dataset.ndeals:'';
  const sw=box.querySelector('.sw'); if(sw)sw.onclick=e=>{e.preventDefault();const rs=box.querySelectorAll('.woundrow');const shw=rs[0].style.display==='none';rs.forEach(r=>r.style.display=shw?'':'none');sw.textContent=(shw?'Hide ':'Show ')+rs.length+' matured'+(shw?' ▴':' ▾');};
}
