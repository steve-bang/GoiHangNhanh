const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const L=require('./lib');const S=[...require('./screens1'),...require('./screens2'),...require('./screens3')];
const out=path.join(__dirname,'png');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
for(const s of S){await p.setContent(`<html><head><meta charset=utf-8><style>${L.css}</style></head><body>${s.html}</body></html>`);await p.waitForTimeout(30);
await p.locator('.phone').screenshot({path:path.join(out,`${s.id}.png`)});}
await b.close();
// bảng tổng hợp
const groups={};S.forEach(s=>(groups[s.group]=groups[s.group]||[]).push(s));
let h=`<!doctype html><html lang=vi><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Đơn Chứng – Thiết kế v2</title><style>body{font-family:Inter,sans-serif;background:#ECE9E1;margin:0;padding:32px;color:#1B1B1B}h1{font-size:30px}h2{margin:40px 0 12px;font-size:20px}.g{display:flex;gap:24px;flex-wrap:wrap}.f{width:260px}.f img{width:260px;border-radius:28px;box-shadow:0 6px 24px rgba(0,0,0,.18);display:block}.f b{display:block;margin-top:8px;font-size:14px}.f span{font-size:12px;color:#5A5F5C}</style><h1>Đơn Chứng – Thiết kế giao diện v2 (${S.length} màn)</h1>`;
for(const g in groups){h+=`<h2>${g}</h2><div class=g>`+groups[g].map(s=>`<div class=f><img src="png/${s.id}.png" loading=lazy><b>${s.name}</b><span>${s.code} · ${s.id}</span></div>`).join('')+'</div>';}
fs.writeFileSync(path.join(__dirname,'index.html'),h);
console.log(S.length,'screens',Object.keys(groups).map(g=>g+':'+groups[g].length).join(' | '));})();
