// Thư viện thành phần giao diện Đơn Chứng v2. Token lấy từ src/core/theme/primitives.ts.
const css = `
:root{--jade:#D93B20;--jade-d:#B02E17;--jade-l:#FFF1EC;--brand:#EE4D2D;--bg:#FFFAF7;--card:#fff;--mut:#FFF5F0;--line:#E6D9D2;--line2:#F0E4DE;
--tx:#292524;--tx2:#746D68;--tx3:#746D68;--ok:#15803D;--okb:#DCFCE7;--wn:#B45309;--wnb:#FDF3E7;--er:#B91C1C;--erb:#FEE2E2;--in:#0369A1;--inb:#E0F2FE;--teal:#DCFCE7;--cam:#16201A;--scan:#FF6A45}
/* Màn đã khách duyệt (Splash, đăng nhập, thiết lập) giữ bảng màu xanh ngọc cũ */
.legacy{--jade:#157852;--jade-d:#14382A;--jade-l:#E6F0E9;--brand:#157852;--bg:#FAF8F2;--mut:#F3F6F5;--line:#D9D6CC;--line2:#E8E5DC;--tx:#1B1B1B;--tx2:#5A5F5C;--tx3:#566B7C;--ok:#1E7A3C;--okb:#E3F1E7;--er:#B3261E;--erb:#FCEBEA;--in:#1F5EA8;--inb:#E8F0FA;--teal:#EAF5F4;--scan:#35E0A1}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,-apple-system,Roboto,sans-serif;background:#fff;color:var(--tx);-webkit-font-smoothing:antialiased}
.phone{width:390px;height:844px;background:var(--bg);position:relative;overflow:hidden;display:flex;flex-direction:column;font-size:15px;line-height:1.4}
.sb{height:47px;flex:none;display:flex;justify-content:space-between;align-items:flex-end;padding:0 28px 6px 32px;font-weight:600;font-size:15px;position:relative;z-index:5}
.sb.dk{color:#fff}
.sb svg{height:12px;width:auto;margin-left:6px;vertical-align:middle}
.hi{position:absolute;bottom:7px;left:50%;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#1B1B1B;z-index:9}
.hi.dk{background:#fff}
.sc{flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative}
.pad{padding:0 16px}
.ab{height:48px;flex:none;display:flex;align-items:center;padding:0 8px;position:relative}
.ab .t{position:absolute;left:56px;right:56px;text-align:center;font-weight:700;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ab .ic{width:44px;height:44px;display:flex;align-items:center;justify-content:center}
.ab .rt{margin-left:auto;display:flex}
.big{font-size:28px;font-weight:800;letter-spacing:-.4px;line-height:1.15;padding:6px 16px 10px}
.h1{font-size:20px;font-weight:700;letter-spacing:-.2px}
.h2{font-size:17px;font-weight:700}
.bd{font-size:15px}.cp{font-size:13px;color:var(--tx2)}.xs{font-size:12px;color:var(--tx2)}
.b{font-weight:700}.c{text-align:center}.mt4{margin-top:4px}.mt8{margin-top:8px}.mt12{margin-top:12px}.mt16{margin-top:16px}.mt24{margin-top:24px}
.g4{gap:4px}.g8{gap:8px}.g12{gap:12px}.g16{gap:16px}
.row{display:flex;align-items:center}.col{display:flex;flex-direction:column}.sp{justify-content:space-between}.fl{flex:1;min-width:0}.wrap{flex-wrap:wrap}
.tb{height:84px;flex:none;background:#fff;border-top:1px solid var(--line2);display:flex;justify-content:space-around;padding:8px 6px 0;position:relative;z-index:4}
.tb div{width:64px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--tx2);font-weight:500}
.tb .on{color:var(--jade);font-weight:700}
.tb svg{width:24px;height:24px}
.fab{position:absolute;left:50%;top:-26px;transform:translateX(-50%);width:62px!important;height:62px;border-radius:50%;background:var(--brand);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(238,77,45,.35);border:4px solid var(--bg)}
.fab svg{stroke:#fff;width:28px;height:28px}
.btn{min-height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:16px;border:1.5px solid var(--line);color:var(--jade-d);background:transparent;padding:0 16px;width:100%}.legacy .btn{border-color:var(--jade);color:var(--jade)}.legacy .btn.p{color:#fff}
.btn svg{width:20px;height:20px}
.btn.p{background:var(--jade);color:#fff}.btn.p svg{stroke:#fff}
.btn.d{border-color:var(--er);color:var(--er)}.btn.dp{background:var(--er);border-color:var(--er);color:#fff}
.btn.t{border-color:transparent;min-height:44px}
.btn.off{opacity:.45}.btn.s{min-height:44px;font-size:14px;border-radius:12px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px}
.card.pl{padding:0;overflow:hidden}
.sec{font-size:13px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.4px;padding:16px 16px 8px}
.it{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px}
.lst{display:flex;flex-direction:column;gap:8px;padding:0 16px}
.grp{background:#fff;border:1px solid var(--line);border-radius:14px;margin:0 16px;overflow:hidden}
.grp .li{display:flex;align-items:center;gap:12px;padding:14px;min-height:56px;border-bottom:1px solid var(--line2)}
.grp .li:last-child{border-bottom:0}
.li .ico{width:34px;height:34px;border-radius:10px;background:var(--jade-l);display:flex;align-items:center;justify-content:center;flex:none}
.li .ico svg{width:20px;height:20px;stroke:var(--jade)}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:4px 9px;border-radius:99px;white-space:nowrap}
.chip svg{width:13px;height:13px}
.ck-ok{background:var(--okb);color:var(--ok)}.ck-wn{background:var(--wnb);color:var(--wn)}.ck-er{background:var(--erb);color:var(--er)}
.ck-in{background:var(--inb);color:var(--in)}.ck-dv{background:var(--mut);color:var(--tx2);border:1px solid var(--line)}.ck-vf{background:var(--okb);color:var(--ok)}.ck-br{background:var(--jade-l);color:var(--jade-d)}
.ck-ok svg,.ck-vf svg{stroke:currentColor}
.fc{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:99px;border:1.5px solid var(--line);background:#fff;font-size:14px;font-weight:500;white-space:nowrap}
.fc.on{background:var(--jade-l);border-color:var(--jade);color:var(--jade-d);font-weight:700}
.chips{display:flex;gap:8px;padding:0 16px;overflow:hidden}
.fld{background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:8px 14px;min-height:56px;display:flex;flex-direction:column;justify-content:center}
.fld label{font-size:12px;color:var(--tx2);font-weight:500}
.fld .v{font-size:16px;font-weight:600}.fld .ph{font-size:16px;color:#8A8F8C}
.fld.f{border-color:var(--jade);border-width:2px}.fld.e{border-color:var(--er);border-width:2px}
.err{color:var(--er);font-size:13px;margin-top:4px}
.bn{display:flex;gap:10px;border-radius:12px;padding:12px;font-size:14px;line-height:1.4;align-items:flex-start}
.bn svg{width:20px;height:20px;flex:none;margin-top:1px}
.bn.ok{background:var(--okb);color:#14502A}.bn.ok svg{stroke:var(--ok)}
.bn.wn{background:var(--wnb);color:#7A3A06}.bn.wn svg{stroke:var(--wn)}
.bn.er{background:var(--erb);color:#7E1A15}.bn.er svg{stroke:var(--er)}
.bn.in{background:var(--inb);color:#173F70}.bn.in svg{stroke:var(--in)}
.src{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none}
.s-sp{background:#FDEBE3;color:#B8431A}.s-tt{background:#E9EBEE;color:#1B1B1B}.s-lz{background:#E5EAFB;color:#2C3FA8}.s-kh{background:var(--mut);color:var(--tx2);border:1px solid var(--line)}
.th{width:56px;height:56px;border-radius:10px;flex:none;position:relative;overflow:hidden;background:var(--cam)}
.th svg.sc2{width:100%;height:100%}
.th .pl{position:absolute;right:4px;bottom:4px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.th .pl svg{width:9px;height:9px;fill:#fff;stroke:none}
.prog{height:6px;border-radius:3px;background:#E4E8E5;overflow:hidden}.prog i{display:block;height:100%;background:var(--in);border-radius:3px}.legacy .prog i{background:var(--jade)}
.prog.wn i{background:var(--wn)}
.scrim{position:absolute;inset:0;background:rgba(10,16,12,.5);z-index:6}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:24px 24px 0 0;padding:10px 16px 34px;z-index:7;display:flex;flex-direction:column;gap:12px}
.sheet:before{content:"";width:40px;height:4px;border-radius:2px;background:#D5D8D6;align-self:center;margin-bottom:4px}
.dlg{position:absolute;left:28px;right:28px;top:50%;transform:translateY(-50%);background:#fff;border-radius:20px;padding:20px;z-index:7;display:flex;flex-direction:column;gap:12px}
.snack{position:absolute;left:16px;right:16px;bottom:100px;background:#1B1B1B;color:#fff;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;z-index:8;font-size:14px}
.ill{width:120px;height:120px;border-radius:60px;background:var(--jade-l);display:flex;align-items:center;justify-content:center;margin:0 auto}
.ill svg{width:56px;height:56px;stroke:var(--jade)}
.ill.wn{background:var(--wnb)}.ill.wn svg{stroke:var(--wn)}.ill.er{background:var(--erb)}.ill.er svg{stroke:var(--er)}.ill.in{background:var(--inb)}.ill.ok{background:var(--okb)}.ill.ok svg{stroke:var(--ok)}.ill.ne{background:var(--mut)}.ill.ne svg{stroke:var(--tx2)}.ill.in svg{stroke:var(--in)}
.foot{padding:12px 16px 34px;background:linear-gradient(to top,var(--bg) 70%,rgba(250,248,242,0));display:flex;flex-direction:column;gap:8px;flex:none}
.cam{position:absolute;inset:0}
.pill{background:rgba(0,0,0,.55);color:#fff;border-radius:99px;padding:6px 12px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px}
.pill svg{width:16px;height:16px;stroke:#fff}
.dot{width:8px;height:8px;border-radius:50%;background:#FF4D4F;display:inline-block}
.tl{position:relative;padding-left:22px}.tl:before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--line)}
.tl .e{position:relative;padding-bottom:16px}.tl .e:before{content:"";position:absolute;left:-22px;top:5px;width:12px;height:12px;border-radius:50%;background:var(--jade);border:2px solid var(--bg)}
.tl .e.w:before{background:var(--wn)}.tl .e.g:before{background:#B9BEBB}
.kv{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line2);gap:12px;font-size:14px}
.kv:last-child{border-bottom:0}.kv span:first-child{color:var(--tx2)}.kv span:last-child{font-weight:600;text-align:right}
.rad{width:22px;height:22px;border-radius:50%;border:2px solid #B9BEBB;flex:none}.rad.on{border-color:var(--jade);background:radial-gradient(var(--jade) 45%,#fff 48%)}
.cb{width:22px;height:22px;border-radius:6px;border:2px solid #B9BEBB;flex:none;display:flex;align-items:center;justify-content:center}.cb.on{background:var(--jade);border-color:var(--jade)}.cb svg{width:14px;height:14px;stroke:#fff;stroke-width:3}
.sw{width:50px;height:30px;border-radius:15px;background:#C9CECB;position:relative;flex:none}.sw:after{content:"";position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.sw.on{background:var(--jade)}.sw.on:after{left:23px}
.otp{display:flex;gap:8px}.otp div{flex:1;height:56px;border:1.5px solid var(--line);border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
.qty{display:flex;align-items:center;gap:0;border:1.5px solid var(--line);border-radius:12px;background:#fff;height:44px}
.qty b{width:44px;text-align:center;font-size:20px;color:var(--jade)}.qty span{width:36px;text-align:center;font-weight:700}
.bars{display:flex;align-items:flex-end;gap:3px;height:40px}.bars i{flex:1;background:var(--jade-l);border-radius:3px}
.div{height:1px;background:var(--line2);margin:4px 0}
`;

const P = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  list:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  scan:'<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M4 12h16"/>',
  bell:'<path d="M6 17V11a6 6 0 1112 0v6l2 2H4z"/><path d="M10 21h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  cam:'<path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="4"/>',
  flash:'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',back:'<path d="M15 5l-7 7 7 7"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12l5 5 9-10"/>',alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  off:'<path d="M2 8a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0"/><path d="M3 3l18 18"/><circle cx="12" cy="19" r=".6"/>',
  up:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 18v2h16v-2"/>',
  cloud:'<path d="M7 18a4 4 0 01-.5-8 6 6 0 0111.5 1.5A3.5 3.5 0 0117 18z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  play:'<path d="M7 4l13 8-13 8z"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17v.5"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  store:'<path d="M4 9l1-5h14l1 5"/><path d="M4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0"/><path d="M5 12v8h14v-8"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  share:'<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/>',
  file:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  hash:'<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  refresh:'<path d="M20 11a8 8 0 00-14-4M4 4v4h4M4 13a8 8 0 0014 4M20 20v-4h-4"/>',
  video:'<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/>',
  ret:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10H8"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.7-3.5 3.3-5 7-5s6.300 1.500 7 5"/><path d="M16 5a3.500 3.500 0 010 7M18 15c2 .6 3.500 2 4 5"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',
  gavel:'<path d="M14 4l6 6-3 3-6-6zM11 9l-8 8 3 3 8-8M3 21h10"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  disk:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.700 3.600 3 8 3s8-1.300 8-3V6M4 12c0 1.700 3.600 3 8 3s8-1.300 8-3"/>',
  logout:'<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1"/>',
  star:'<path d="M12 3l2.800 5.700 6.200.9-4.500 4.400 1 6.200L12 17.200 6.500 20.200l1-6.200L3 9.600l6.200-.9z"/>',
  hand:'<path d="M8 12V5a1.500 1.500 0 013 0v6M11 11V3.500a1.500 1.500 0 013 0V11M14 11V5a1.500 1.500 0 013 0v8c0 5-3 8-6 8s-5-2-6-5l-2-4a1.500 1.500 0 012.500-1.500L8 14"/>',
};
const ic = (n, o = {}) => `<svg viewBox="0 0 24 24" width="${o.s||24}" height="${o.s||24}" fill="none" stroke="${o.c||'currentColor'}" stroke-width="${o.w||1.8}" stroke-linecap="round" stroke-linejoin="round" ${o.st?`style="${o.st}"`:''}>${P[n]||''}</svg>`;

const statusBar = (dk) => `<div class="sb ${dk?'dk':''}"><span>9:41</span><span style="display:flex;align-items:center">
<svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.500" width="3" height="9.500" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.600" stroke-linecap="round"><path d="M1 4a10 10 0 0114 0M3.500 6.800a6 6 0 019 0M6 9.500a2.500 2.500 0 014 0"/></svg>
<svg viewBox="0 0 27 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3.500" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".4"/></svg></span></div>`;

const scr = (inner, o = {}) => `<div class="phone" style="${o.dk?"background:#16201A":(o.bg?`background:${o.bg}`:"")}">${o.noSb?'':statusBar(o.dk)}<div class="sc">${inner}</div>${o.tab?tabbar(o.tab):''}<div class="hi ${o.dk?'dk':''}"></div></div>`;
const tabbar = (a) => {
  const t = [['home','Trang chủ','home'],['orders','Đơn hàng','list'],['scan','',''],['notif','Thông báo','bell'],['me','Cá nhân','user']];
  return `<div class="tb">${t.map(([k,l,i])=>k==='scan'?`<div class="fab">${ic('scan')}</div><div style="visibility:hidden"></div>`:`<div class="${a===k?'on':''}">${ic(i,{w:a===k?2.2:1.8})}<span>${l}</span></div>`).join('')}</div>`;
};
const appbar = (title, o = {}) => `<div class="ab">${o.back===false?'':`<div class="ic">${ic(o.close?'x':'back',{s:26})}</div>`}<div class="t">${title||''}</div><div class="rt">${(o.right||[]).map(r=>`<div class="ic">${typeof r==='string'&&P[r]?ic(r,{s:24}):r}</div>`).join('')}</div></div>`;
const btn = (l, k = 'p', i, x = '') => `<div class="btn ${k} ${x}">${i?ic(i):''}${l}</div>`;
const chip = (k, l, i) => `<span class="chip ck-${k}">${i?ic(i):''}${l}</span>`;
const EV = {
  saved:['dv','Đã lưu trên máy','disk'], wait:['wn','Chờ tải lên','clock'], up:['in','Đang tải lên','up'],
  done:['ok','Đã tải lên','cloud'], ver:['vf','Đã xác minh','shield'], err:['er','Lỗi tải lên','alert'], hash:['er','Mã băm không khớp','alert'],
  rec:['er','Đang ghi','video'], int:['wn','Gián đoạn','pause'], none:['wn','Chưa có video','video'],
};
const ev = (k, l) => chip(EV[k][0], l || EV[k][1], EV[k][2]);
const src = (s) => ({SP:'<div class="src s-sp">SP</div>',TT:'<div class="src s-tt">TT</div>',LZ:'<div class="src s-lz">LZ</div>',KH:'<div class="src s-kh">···</div>'}[s]);
const banner = (k, t, i) => `<div class="bn ${k}">${ic(i||({ok:'check',wn:'alert',er:'alert',in:'info'}[k]))}<div>${t}</div></div>`;
const field = (l, v, o = {}) => `<div><div class="fld ${o.f?'f':''} ${o.e?'e':''}"><label>${l}</label>${v?`<div class="v">${v}</div>`:`<div class="ph">${o.ph||''}</div>`}</div>${o.err?`<div class="err">${o.err}</div>`:''}${o.hint?`<div class="xs mt4">${o.hint}</div>`:''}</div>`;
const prog = (p, k = '') => `<div class="prog ${k}"><i style="width:${p}%"></i></div>`;
const pad = (h, x = '') => `<div class="pad ${x}">${h}</div>`;
const sec = (t) => `<div class="sec">${t}</div>`;
const foot = (...b) => `<div class="foot">${b.join('')}</div>`;
const grow = '<div style="flex:1"></div>';
const sheet = (h, d = true) => `${d?'<div class="scrim"></div>':''}<div class="sheet">${h}</div>`;
const dlg = (h) => `<div class="scrim"></div><div class="dlg">${h}</div>`;
const gli = (i, t, s, r = ic('chev', {s: 20, c: '#9AA09C'})) => `<div class="li"><div class="ico">${ic(i)}</div><div class="fl"><div class="b">${t}</div>${s?`<div class="cp">${s}</div>`:''}</div>${r}</div>`;
const grp = (...l) => `<div class="grp">${l.join('')}</div>`;

// Hình minh họa: cảnh bàn đóng hàng (dùng cho khung camera và ảnh bìa video)
const sceneId = {n:0};
const scene = (o = {}) => { const id = 's' + (++sceneId.n); const tape = o.open ? '' : `<rect x="146" y="278" width="108" height="26" fill="#C9A66B" opacity=".9" transform="skewX(-6)"/>`;
  return `<svg class="${o.cls||'cam'}" viewBox="0 0 390 ${o.h||844}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B4A41"/><stop offset="1" stop-color="#18221C"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C79A5E"/><stop offset="1" stop-color="#9E7440"/></linearGradient><radialGradient id="${id}c" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="390" height="${o.h||844}" fill="url(#${id}a)"/><rect y="${(o.h||844)*.55}" width="390" height="${(o.h||844)*.45}" fill="#26332B"/><rect y="${(o.h||844)*.55}" width="390" height="3" fill="#0F1712" opacity=".6"/>
<g transform="translate(${o.dx||0},${o.dy||0})"><polygon points="105,260 285,260 300,420 90,420" fill="url(#${id}b)"/><polygon points="105,260 285,260 262,238 128,238" fill="#D9AE72"/>${o.open?'<polygon points="105,260 128,238 112,214 80,236" fill="#B58A52"/><polygon points="285,260 262,238 278,214 310,236" fill="#B58A52"/>':''}${tape}
<rect x="172" y="330" width="46" height="62" rx="3" fill="#fff" opacity=".92"/><rect x="178" y="338" width="34" height="3" fill="#333"/><rect x="178" y="346" width="26" height="3" fill="#777"/><rect x="178" y="356" width="34" height="22" fill="#222" opacity=".85"/></g>
<rect width="390" height="${o.h||844}" fill="url(#${id}c)"/></svg>`; };
const thumb = (o = {}) => `<div class="th">${scene({cls:'sc2',h:390,dy:-130,dx:0,open:o.open})}<div class="pl">${ic('play',{s:9,c:'none'})}</div></div>`;

module.exports = { css, ic, scr, appbar, btn, chip, ev, EV, src, banner, field, prog, pad, sec, foot, grow, sheet, dlg, gli, grp, scene, thumb, tabbar, statusBar, P };
