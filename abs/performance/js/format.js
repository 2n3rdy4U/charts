// Build B · formatting helpers shared by every page (index.html, deal.html).
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate=i=>{if(!i)return"—";const[y,m,d]=i.split("-").map(Number);return `${MON[m-1]} ${d}, ${y}`;};
const fmtMonth=i=>{if(!i)return"—";const[y,m]=i.split("-").map(Number);return `${MON[m-1]} ${y}`;};
const decYear=i=>{const[y,m,d]=i.split("-").map(Number);return y+(m-1)/12+(d-1)/365;};
const pct=(x,d=2)=>x==null?"—":(x*100).toFixed(d)+"%";
const fac=x=>x==null?"—":Number(x).toFixed(3);
const money=x=>x==null?"—":x>=1e9?"$"+(x/1e9).toFixed(2)+"B":x>=1e6?"$"+(x/1e6).toFixed(0)+"M":"$"+Math.round(x).toLocaleString();
const el=id=>document.getElementById(id);
const esc=s=>(s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
