// Build B · Deal page (per-deal presale view). Loaded by deal.html after
// js/format.js; see web/README.md.
const party=(label,val)=>val?`<div class="prow"><div class="pl">${esc(label)}</div><div class="pv">${esc(val)}</div></div>`:"";
function edgarUrl(cik,acc){ if(!cik||!acc) return null; const c=String(cik).replace(/^0+/,""),a=String(acc);
  if(a.length!==18) return null; return `https://www.sec.gov/Archives/edgar/data/${c}/${a}/${a.slice(0,10)}-${a.slice(10,12)}-${a.slice(12)}-index.htm`; }
function docLinks(f){ if(!f) return '<div class="pv" style="color:var(--muted)">—</div>';
  const items=[["Prospectus",edgarUrl(f.cik,f.final)],["Pricing FWP",edgarUrl(f.cik,f.fwp)]].filter(x=>x[1]);
  return items.length?items.map(x=>`<a class="doc" href="${x[1]}" target="_blank" rel="noopener">${esc(x[0])} ↗</a>`).join(""):'<div class="pv" style="color:var(--muted)">No filing links available.</div>'; }
const AG={sp:"S&P",moodys:"Moody's",fitch:"Fitch",dbrs:"DBRS",kbra:"KBRA"};
let PEERS=null;   // peers.json — prospectus comparison universe (live-PSR computation), used for BOTH tables

const params=new URLSearchParams(location.search), T=params.get("t"), S=params.get("s");
const normT=t=>String(t).startsWith("CRVNA")?"CRVNA":t;   // prospectus keeps Carvana as one shelf (CRVNA); P/N split via series

async function main(){
  if(!T||!S){ root("<div class='note'>Missing deal reference. Open a deal from a shelf's roster.</div>"); return; }
  let shelf; try{ shelf=await (await fetch(`data/${T}.json?t=`+Date.now())).json(); }
  catch(e){ root(`<div class='note'>Could not load shelf <b>${esc(T)}</b>.</div>`); return; }
  const d=(shelf.deals||[]).find(x=>x.series===S);
  if(!d){ root(`<div class='note'>Deal <b>${esc(S)}</b> not found on ${esc(T)}.</div>`); return; }
  try{ PEERS=await (await fetch(`data/peers.json?t=`+Date.now())).json(); }catch(e){ PEERS=null; }
  render(shelf,d);
}
function root(html){ document.getElementById("root").innerHTML=html; }

function kpi(l,v){ return `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div></div>`; }

function capTable(cap){
  if(!cap||!cap.classes||!cap.classes.length) return `<div class="pbody"><div class="note" style="padding:6px 0">Capital structure not available (pre-prospectus deal).</div></div>`;
  const order=["sp","moodys","fitch","dbrs","kbra"], ags=order.filter(a=>cap.classes.some(c=>c.ratings&&c.ratings[a]));  // agencies that rated THIS deal
  const aghd=ags.map(a=>`<th class="rcol">${AG[a]}</th>`).join('');
  const rows=cap.classes.map(c=>{
    const rc=ags.map(a=>`<td class="rcol">${(c.ratings&&c.ratings[a])?esc(c.ratings[a]):'—'}</td>`).join('');
    return `<tr class="${c.senior?'snr':''}"><td>${esc(c.class_name)}</td>`+
      `<td>${money(c.principal_usd)}</td><td>${pct(c.pct_of_pool,1)}</td><td>${pct(c.sub_pct,1)}</td>`+
      `<td>${c.coupon_rate!=null?(c.coupon_rate*100).toFixed(2)+'%':'—'}</td>`+
      `<td>${c.spread_bps!=null?Math.round(c.spread_bps)+' bps':'—'}</td>`+
      `<td>${c.wal_years!=null?c.wal_years+' yr':'—'}</td>${rc}</tr>`;
  }).join('');
  return `<div style="overflow-x:auto"><table class="cap"><thead><tr><th>Class</th><th>Size</th><th>% pool</th><th>Sub %</th><th>Coupon</th><th>Spread</th><th>WAL</th>${aghd}</tr></thead><tbody>${rows}</tbody></table></div><div style="height:8px"></div>`;
}

function render(shelf,d){
  const t=d.terms||{}, cap=d.capital;
  root(`
  <div class="crumb"><a href="index.html">‹ Back to ${esc(T)} shelf</a></div>
  <div class="titlerow"><h1>${esc(d.deal_name||d.series)}</h1>
    <span class="ticker">${esc(T)}</span>
    <span class="snap">Snapshot · ${fmtDate(t.closing_date)}</span></div>
  <div class="snapnote">Issuance snapshot — frozen as of the final filing (close); does not update. For ongoing performance, see the <a href="index.html">Performance page</a>.</div>

  <div class="layout">
    <div>
      <div class="panel"><h2>Key terms <span class="sub">at pricing</span></h2>
        <div class="kpis">
          ${kpi('Size',money(t.total_size_usd))}
          ${kpi('Credit Score',t.wa_fico!=null?Math.round(t.wa_fico):'—')}
          ${kpi('WA APR',pct(t.wa_apr,2))}
          ${kpi('WA term',t.wa_original_term!=null?Math.round(t.wa_original_term)+' mo':'—')}
          ${kpi('% new',pct(t.pct_new_vehicles,1))}
          ${kpi('Reserve',pct(cap&&cap.reserve_pct,2))}
          ${kpi('Hard CE',pct(cap&&cap.hard_ce_pct,2))}
        </div>
      </div>
      <div class="panel"><h2>Capital structure <span class="sub">at pricing</span></h2>${capTable(cap)}</div>
      <div class="panel"><h2>Issuer track record <span class="sub">this deal vs prior same-shelf vintages · Δ vs cohort median</span></h2>
        <div id="trk" style="padding:4px 4px 12px"><div class="note" style="padding:6px 0">loading…</div></div>
      </div>
      <div class="panel"><h2>Peer set <span class="sub" id="peersub">comparable issuers · Δ vs cohort median</span></h2>
        <div id="peer" style="padding:4px 4px 12px"><div class="note" style="padding:6px 0">loading…</div></div>
      </div>
    </div>
    <div>
      <div class="panel"><h2>Transaction parties</h2><div class="pbody">
        ${party("Sponsor",t.sponsor)}${party("Depositor",t.depositor)}${party("Servicer",t.servicer)}
        ${party("Indenture trustee",t.indenture_trustee)}${party("Owner trustee",t.owner_trustee)}
        ${party("Asset-rep reviewer",t.asset_rep_reviewer)}${party("Underwriters",t.underwriters)}
      </div></div>
      <div class="panel"><h2>Documents</h2><div class="pbody">${docLinks(d.filings)}</div></div>
    </div>
  </div>`);
  renderTrackTable(d); renderPeerTable(d);
}

// ---- comparison table (issuer track record + peer set share this) ----
const cap=x=>x.capital||{};
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
const geo3=g=>(g&&g.length)?g.slice(0,3).map(s=>`${esc(s.state)} ${s.pct}%`).join("<br>"):"—";
function dlSpan(dl,cfg){ if(dl==null||Math.abs(dl)<1e-9) return "";
  const fav=(dl*cfg.good)>0, s=cfg.u==="pp"?((dl>0?"+":"")+(dl*100).toFixed(1)+"pp"):cfg.u==="bps"?((dl>0?"+":"")+Math.round(dl)+"bps"):((dl>0?"+":"")+Math.round(dl));
  return ` <span class="dl ${fav?"good":"bad"}">${s}</span>`; }
const M_COLL=[
  {l:"Closing date", g:x=>(x.terms||{}).closing_date, f:v=>v||"—"},
  {l:"Pool balance", g:x=>(x.terms||{}).initial_pool_balance, f:money},
  {l:"WA credit score", g:x=>(x.terms||{}).wa_fico, f:v=>v!=null?Math.round(v):"—", d:{u:"raw",good:1}},
  {l:"WA APR", g:x=>(x.terms||{}).wa_apr, f:v=>pct(v,2), d:{u:"pp",good:-1}},
  {l:"WA original term", g:x=>(x.terms||{}).wa_original_term, f:v=>v!=null?Math.round(v)+" mo":"—", d:{u:"raw",good:-1}},
  {l:"% new vehicles", g:x=>(x.terms||{}).pct_new_vehicles, f:v=>pct(v,1)},
  {l:"Reserve %", g:x=>cap(x).reserve_pct, f:v=>pct(v,2)},
  {l:"Geo top-3", g:x=>(x.terms||{}).geo_top5, f:geo3},
];
const M_STRUCT=[
  {l:"AAA spread", g:x=>cap(x).aaa_spread_bps, f:v=>v!=null?"+"+Math.round(v)+" bps":"—", d:{u:"bps",good:-1}},
  {l:"AAA % of pool", g:x=>cap(x).aaa_pct_of_pool, f:v=>pct(v,1), d:{u:"pp",good:1}},
  {l:"Subordination below AAA", g:x=>cap(x).sub_below_aaa, f:v=>pct(v,1), d:{u:"pp",good:1}},
  {l:"OC (initial)", g:x=>cap(x).oc_initial, f:v=>pct(v,2)},
  {l:"YSOC", g:x=>cap(x).ysoc_na?"n.a.":cap(x).ysoc_pct, f:v=>v==="n.a."?v:pct(v,2)},
  {l:"Tranches", g:x=>cap(x).n_classes, f:v=>v!=null?String(v):"—"},
];
function cmpRow(r,cohort,others){
  const cells=cohort.map((x,i)=>{ const v=r.g(x); let badge="";
    if(i===0&&r.d&&v!=null){ const ov=others.map(r.g).filter(z=>z!=null); if(ov.length) badge=dlSpan(v-median(ov),r.d); }
    return `<td class="${i===0?"subj":""}">${r.f(v)}${badge}</td>`; }).join("");
  return `<tr><td class="rl">${esc(r.l)}</td>${cells}</tr>`;
}
function renderCompare(elId,cohort,others,colTicker){
  const head=`<tr><th></th>`+cohort.map((x,i)=>`<th class="${i===0?"subj":""}">${esc(x.ticker||colTicker)} ${esc(x.series)}</th>`).join("")+`</tr>`;
  const sec=(t,rows)=>`<tr class="sec"><td colspan="${cohort.length+1}">${t}</td></tr>`+rows.map(r=>cmpRow(r,cohort,others)).join("");
  el(elId).innerHTML=`<div style="overflow-x:auto"><table class="cmp"><thead>${head}</thead><tbody>${sec("Collateral (pool at cut-off)",M_COLL)}${sec("Structure (at issuance)",M_STRUCT)}</tbody></table></div>`;
}
// adapt a flat peers.json row into the {terms, capital} shape renderCompare expects (dt = display ticker override)
function peerAdapt(p,dt){ return {ticker:dt||p.ticker, series:p.series,
  terms:{closing_date:p.effective_date, initial_pool_balance:p.pool_balance, wa_fico:p.wa_fico, wa_apr:p.wa_apr,
    wa_original_term:p.wa_original_term, pct_new_vehicles:p.pct_new_vehicles, geo_top5:p.geo_top5},
  capital:{aaa_spread_bps:p.aaa_spread_bps, aaa_pct_of_pool:p.aaa_pct, sub_below_aaa:p.subordination_pct,
    oc_initial:p.oc_pct, ysoc_pct:p.ysoc_pct, ysoc_na:p.ysoc_not_applicable, reserve_pct:p.reserve_fund_pct,
    n_classes:p.n_classes} }; }
const subjPeer=d=>PEERS && PEERS.find(p=>p.ticker===normT(T) && p.series===d.series);
function mostRecentPerTicker(arr){ const seen={}; arr.slice().sort((a,b)=>(""+b.effective_date).localeCompare(""+a.effective_date)).forEach(p=>{ if(!seen[p.ticker]) seen[p.ticker]=p; }); return Object.values(seen); }
function renderTrackTable(d){
  if(!PEERS){ el("trk").innerHTML='<div class="note" style="padding:6px 0">Peer dataset unavailable.</div>'; return; }
  const nt=normT(T), subj=subjPeer(d);
  if(!subj){ el("trk").innerHTML='<div class="note" style="padding:6px 0">Deal not found in the comparison dataset.</div>'; return; }
  const pn=d.series.includes("-P")?"P":(d.series.includes("-N")?"N":null);   // keep CRVNAP/N track records to one pool
  const priors=PEERS.filter(p=>p.ticker===nt && p.series!==d.series && p.effective_date<subj.effective_date && (pn===null||p.series.includes("-"+pn)))
    .sort((a,b)=>b.effective_date.localeCompare(a.effective_date)).slice(0,5);
  if(!priors.length){ el("trk").innerHTML='<div class="note" style="padding:6px 0">No prior same-shelf vintages.</div>'; return; }
  renderCompare("trk",[subj,...priors].map(p=>peerAdapt(p,T)),priors.map(p=>peerAdapt(p,T)),T);
}
function renderPeerTable(d){
  if(!PEERS){ el("peer").innerHTML='<div class="note" style="padding:6px 0">Peer dataset unavailable.</div>'; return; }
  const nt=normT(T), subj=subjPeer(d);
  if(!subj||!subj.effective_date){ el("peer").innerHTML='<div class="note" style="padding:6px 0">No comparable peers.</div>'; return; }
  const ed=subj.effective_date, lo=(parseInt(ed.slice(0,4))-3)+ed.slice(4);   // 3-yr point-in-time recency floor
  const base=PEERS.filter(p=>p.ticker!==nt && p.asset_class===subj.asset_class && p.effective_date && p.effective_date>=lo && p.effective_date<=ed);
  const strict=base.filter(p=>p.sponsor_type===subj.sponsor_type && p.fico_tier===subj.fico_tier);
  const tier=base.filter(p=>p.fico_tier===subj.fico_tier);
  let chosen, lbl;
  if(mostRecentPerTicker(strict).length>=3){ chosen=strict; lbl="same sponsor-type + FICO tier"; }
  else if(mostRecentPerTicker(tier).length>=3){ chosen=tier; lbl="same FICO tier"; }
  else { chosen=base; lbl="auto universe"; }
  const cohort=mostRecentPerTicker(chosen).sort((a,b)=>b.effective_date.localeCompare(a.effective_date)).slice(0,5);
  const sub=el("peersub"); if(sub) sub.textContent=`${subj.fico_tier} cohort · ${lbl} · Δ vs cohort median`;
  if(!cohort.length){ el("peer").innerHTML='<div class="note" style="padding:6px 0">No comparable peers in the point-in-time window.</div>'; return; }
  renderCompare("peer",[peerAdapt(subj,T),...cohort.map(p=>peerAdapt(p))],cohort.map(p=>peerAdapt(p)),null);
}

main();
