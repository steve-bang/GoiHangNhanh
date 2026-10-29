const L = require('./lib');
const { ic, scr, appbar, btn, chip, ev, src, banner, field, prog, pad, sec, foot, grow, sheet, dlg, gli, grp, scene, thumb } = L;

const orderRow = (s, code, sub, st, o = {}) => `<div class="it">${o.th?thumb():src(s)}<div class="fl"><div class="b" style="font-size:16px">${code}</div><div class="cp">${sub}</div></div>${st?ev(st):''}${o.chev?ic('chev',{s:18,c:'#9AA09C'}):''}</div>`;
const attention = (chipH, code, sub) => `<div class="it">${chipH}<div class="fl"><div class="b">${code}</div><div class="cp">${sub}</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>`;

const S = [];
const add = (id, code, name, group, html) => S.push({ id, code, name, group, html });

// ---------- Nhóm 1: Vào app & thiết lập quyền ----------
add('A05a','UI-A05','Giải thích quyền camera','Thiết lập', scr(`
  ${appbar('',{back:false,right:[]})}
  <div class="pad col" style="flex:1;align-items:center;text-align:center;padding-top:24px">
    <div class="ill">${ic('cam')}</div>
    <div class="h1 mt24">Cần dùng camera</div>
    <div class="bd mt8" style="color:var(--tx2);max-width:300px">Để quét mã đơn và quay video đóng gói. Chỉ dùng khi bạn bấm quét hoặc quay.</div>
    <div class="grp mt24" style="width:100%;margin:24px 0 0;text-align:left">
      ${gli('scan','Quét mã đơn, mã vận đơn','Không lưu ảnh khi quét',' ')}
      ${gli('video','Quay video đóng gói','Video lưu trên máy của bạn trước',' ')}
    </div>
  </div>
  ${foot(btn('Cho phép dùng camera','p'),btn('Để sau','t'))}`));

add('A05b','UI-J03','Camera bị từ chối','Thiết lập', scr(`
  ${appbar('Quét mã',{close:true})}
  <div class="pad col" style="flex:1;align-items:center;text-align:center;padding-top:40px">
    <div class="ill wn">${ic('cam')}</div>
    <div class="h1 mt24">Camera đang bị tắt</div>
    <div class="bd mt8" style="color:var(--tx2);max-width:300px">Bật camera trong Cài đặt để quét mã và quay video. Bạn vẫn có thể nhập mã bằng tay.</div>
  </div>
  ${foot(btn('Mở Cài đặt','p','gear'),btn('Nhập mã bằng tay','s'))}`));

// ---------- Nhóm 2: Trang chủ & quét ----------
add('B01','UI-B01','Trang chủ','Đóng gói', scr(`
  <div class="row sp pad" style="height:56px"><div><div class="xs">Cửa hàng</div><div class="h2" style="display:flex;align-items:center;gap:4px">Minh Anh Fashion ${ic('chev',{s:16,st:'transform:rotate(90deg)'})}</div></div><div style="width:40px;height:40px;border-radius:20px;background:var(--jade-l);color:var(--jade-d);display:flex;align-items:center;justify-content:center;font-weight:800">LA</div></div>
  <div class="pad mt8">${banner('wn','<b>2 video đang chờ tải lên.</b> Video vẫn được lưu trên máy. <u style="font-weight:700">Xem</u>','clock')}</div>
  <div class="pad col g12 mt16">
    <div class="btn p" style="min-height:84px;border-radius:18px;justify-content:flex-start;padding:0 20px;gap:16px;font-size:20px">${ic('box',{s:34,c:'#fff'})}<div style="text-align:left"><div>Đóng gói đơn</div><div style="font-size:13px;font-weight:500;opacity:.85">Quét mã rồi quay video</div></div></div>
    <div class="btn" style="min-height:68px;border-radius:18px;justify-content:flex-start;padding:0 20px;gap:16px;font-size:17px">${ic('ret',{s:28})}<div style="text-align:left"><div>Nhận hàng hoàn</div></div></div>
  </div>
  ${sec('Cần xử lý')}
  <div class="lst">
    ${attention(chip('er','Lỗi','alert'),'SPX0412…889','Tải lên lỗi · chạm để thử lại')}
    ${attention(chip('wn','Dở dang','pause'),'TT-77120','Phiên quay bị gián đoạn lúc 09:41')}
  </div>
  ${sec('Đơn gần đây')}
  <div class="lst">${orderRow('SP','250611AB3K7Q','10:12 · 1 video','ver')}${orderRow('LZ','LZ8831209948','09:05 · 1 video','saved')}</div>`,{tab:'home'}));

add('B02','UI-B02','Quét mã','Đóng gói', scr(`
  ${scene()}
  <div class="row sp" style="padding:0 16px;position:relative;z-index:3"><div class="pill">${ic('x')}Đóng</div><div class="pill">${ic('flash')}Đèn</div></div>
  <div style="position:absolute;left:50%;top:300px;transform:translateX(-50%);width:270px;height:170px;z-index:3">
    ${['0 auto auto 0|1','0 0 auto auto|2','auto auto 0 0|3','auto 0 0 auto|4'].map(x=>{const [m,n]=x.split('|');const [t,r,b,l]=m.split(' ');const pos={1:'top:0;left:0;border-width:4px 0 0 4px;border-radius:14px 0 0 0',2:'top:0;right:0;border-width:4px 4px 0 0;border-radius:0 14px 0 0',3:'bottom:0;left:0;border-width:0 0 4px 4px;border-radius:0 0 0 14px',4:'bottom:0;right:0;border-width:0 4px 4px 0;border-radius:0 0 14px 0'}[n];return `<div style="position:absolute;width:38px;height:38px;border:solid var(--scan);${pos}"></div>`}).join('')}
    <div style="position:absolute;left:12px;right:12px;top:84px;height:2px;background:var(--scan);box-shadow:0 0 12px var(--scan)"></div>
  </div>
  <div class="c" style="position:absolute;left:0;right:0;top:490px;z-index:3;color:#fff;font-weight:600">Đưa mã đơn hoặc mã vận đơn vào khung</div>
  <div class="sheet" style="z-index:4;padding-bottom:34px">
    ${field('Hoặc nhập mã','',{ph:'Ví dụ: 250611AB3K7Q'})}
    <div class="row g8"><span class="fc">${ic('clock',{s:16})}&nbsp;Mã vừa quét</span><span class="fc">${ic('search',{s:16})}&nbsp;Tìm đơn đã lưu</span></div>
  </div>`,{dk:true,noSb:false}));

add('B02b','UI-B02','Đã quét — đang tra cứu','Đóng gói', scr(`
  ${scene()}
  <div class="sheet" style="z-index:4">
    <div class="row g12"><div style="width:44px;height:44px;border-radius:12px;background:var(--jade-l);display:flex;align-items:center;justify-content:center">${ic('hash',{c:'var(--jade)'})}</div><div class="fl"><div class="xs">Đã quét</div><div class="h2">250611AB3K7Q</div></div><div style="width:22px;height:22px;border:3px solid var(--jade-l);border-top-color:var(--jade);border-radius:50%"></div></div>
    <div class="cp">Đang tìm hồ sơ đơn này…</div>
  </div>`,{dk:true}));

add('J01','UI-J01','Mã không tìm thấy','Đóng gói', scr(`
  ${scene()}
  ${sheet(`<div class="row g12"><div style="width:44px;height:44px;border-radius:12px;background:var(--wnb);display:flex;align-items:center;justify-content:center">${ic('search',{c:'var(--wn)'})}</div><div class="fl"><div class="h2">Chưa có hồ sơ đơn này</div><div class="cp">Mã 250611AB3K7Q chưa được lưu trong cửa hàng.</div></div></div>
    ${banner('in','Bạn tự nhập thông tin đơn. Đơn Chứng không lấy dữ liệu từ sàn.')}
    ${btn('Tạo đơn nhanh','p','plus')}${btn('Quét mã khác','s')}`)}`,{dk:true}));

add('J02','UI-J02','Mã trùng — chọn đúng đơn','Đóng gói', scr(`
  ${scene()}
  ${sheet(`<div class="h2">Có 2 đơn trùng mã 250611AB3K7Q</div><div class="cp" style="margin-top:-6px">Chọn đúng đơn. Ứng dụng không tự chọn thay bạn.</div>
    <div class="it">${src('SP')}<div class="fl"><div class="b">250611AB3K7Q</div><div class="cp">Shopee · 11/06 · 2 sản phẩm</div></div><div class="rad"></div></div>
    <div class="it" style="border:2px solid var(--jade)">${src('TT')}<div class="fl"><div class="b">250611AB3K7Q</div><div class="cp">TikTok Shop · 12/06 · Chưa khai báo SP</div></div><div class="rad on"></div></div>
    ${btn('Dùng đơn này','p')}${btn('Đây là đơn mới','s')}`)}`,{dk:true}));

add('B03','UI-B03','Tìm đơn đã lưu','Đóng gói', scr(`
  ${appbar('Tìm đơn',{close:true})}
  <div class="pad">${field('Mã đơn hoặc mã vận đơn','250611',{f:true})}</div>
  ${sec('Kết quả (3)')}
  <div class="lst">${orderRow('SP','250611AB3K7Q','Shopee · 11/06 · 1 video','ver',{})}${orderRow('SP','250611ZP90LA','Shopee · 11/06 · chưa có video','none')}${orderRow('TT','2506117781204','TikTok Shop · 12/06 · 1 video','wait')}</div>
  ${sec('Tìm gần đây')}
  <div class="grp">${gli('clock','SPX0412889',null)}${gli('clock','LZ8831209948',null)}</div>`));

add('B04','UI-B04','Tạo đơn nhanh','Đóng gói', scr(`
  ${appbar('Tạo đơn nhanh',{close:true})}
  <div class="pad"><div class="prog"><i style="width:50%"></i></div><div class="xs mt4">Bước 1/2 · Thông tin đơn</div></div>
  <div class="pad col g16 mt16">
    ${field('Mã đơn','250611AB3K7Q',{hint:'Điền từ mã vừa quét'})}
    <div><div class="cp b" style="margin-bottom:8px">Nguồn bán</div><div class="row g8 wrap"><span class="fc on">Shopee</span><span class="fc">TikTok Shop</span><span class="fc">Lazada</span><span class="fc">Khác</span></div></div>
    ${field('Mã vận đơn (tùy chọn)','',{ph:'Quét hoặc nhập mã vận đơn'})}
    <div class="card col g12"><div class="row sp"><div class="b">Sản phẩm <span class="cp" style="font-weight:500">(tùy chọn)</span></div></div>
      ${field('Tên sản phẩm','Áo sơ mi nữ cổ tròn')}
      <div class="row g12">${field('Phân loại','Trắng · M')}<div style="width:130px"><div class="cp b" style="margin-bottom:6px">Số lượng</div><div class="qty"><b>−</b><span>2</span><b>＋</b></div></div></div>
      <div class="cp row g4" style="color:var(--jade);font-weight:700">${ic('plus',{s:16})} Thêm sản phẩm khác</div></div>
    ${banner('in','Bỏ trống sản phẩm vẫn quay được. Thông tin do bạn nhập.')}
  </div>
  ${grow}${foot(btn('Tiếp tục','p'))}`));

add('B04b','UI-B04','Xác nhận đơn hàng','Đóng gói', scr(`
  ${appbar('Xác nhận đơn hàng')}
  <div class="pad"><div class="prog"><i style="width:100%"></i></div><div class="xs mt4">Bước 2/2 · Kiểm tra lại</div></div>
  <div class="pad mt16"><div class="card">
    <div class="row g12">${src('SP')}<div class="fl"><div class="h2">250611AB3K7Q</div><div class="cp">Shopee</div></div></div>
    <div class="div mt12"></div>
    <div class="kv"><span>Mã vận đơn</span><span>Chưa nhập</span></div>
    <div class="kv"><span>Sản phẩm</span><span>Áo sơ mi nữ cổ tròn<br><span class="cp" style="font-weight:500">Trắng · M × 2</span></span></div>
    <div class="kv"><span>Nguồn thông tin</span><span>Bạn nhập</span></div>
  </div></div>
  <div class="pad mt12">${banner('wn','Sau khi quay, bạn không sửa được thông tin đơn nếu chưa có lịch sử thay đổi.','info')}</div>
  ${grow}${foot(btn('Tạo đơn hàng','p'),btn('Quay lại chỉnh sửa','s'))}`));

add('B05','UI-B05','Chế độ xử lý liên tục','Đóng gói', scr(`
  ${appbar('Đóng gói liên tục',{close:true,right:[`<span class="chip ck-vf">3 đơn</span>`]})}
  <div class="pad"><div class="bn in">${ic('info')}<div>Quét lần lượt từng đơn. Không tự chuyển đơn khi đang quay.</div></div></div>
  ${sec('Phiên hôm nay')}
  <div class="lst">
    <div class="it" style="border:2px solid var(--jade)">${src('SP')}<div class="fl"><div class="b">250611AB3K7Q</div><div class="cp">Đang chờ quay</div></div>${chip('vf','Tiếp theo')}</div>
    ${orderRow('TT','2506117781204','Đã quay · 00:51','saved')}${orderRow('SP','250611ZP90LA','Đã quay · 01:04','up')}
  </div>
  ${grow}${foot(btn('Quay đơn này','p','video'),btn('Quét đơn tiếp','s','scan'))}`));

// ---------- Nhóm 3: Quay & lưu ----------
add('C01','UI-C01','Xem nhanh trước khi quay','Quay & lưu', scr(`
  ${appbar('Chuẩn bị quay',{close:true})}
  <div class="pad col g12">
    <div class="card"><div class="row g12">${src('SP')}<div class="fl"><div class="h1">250611AB3K7Q</div><div class="cp">Shopee · tạo 10:05</div></div></div>
      <div class="div mt12"></div><div class="b mt8" style="font-size:14px">Sản phẩm</div><div class="bd">Áo sơ mi nữ cổ tròn · Trắng · M × 2</div></div>
    <div class="card"><div class="row sp"><div class="b">Kiện hàng</div><span class="cp" style="color:var(--jade);font-weight:700">+ Thêm kiện</span></div>
      <div class="it mt8" style="border:2px solid var(--jade);background:var(--jade-l)">${ic('box',{c:'var(--jade)'})}<div class="fl b">Kiện 1</div><div class="rad on"></div></div></div>
    <div class="row g8 cp">${ic('mic',{s:18,c:'#8A8F8C'})}<span>Chưa thu tiếng. Chỉ ghi hình.</span></div>
  </div>
  ${grow}${foot(btn('Bắt đầu quay','p','video'))}`));

add('C02','UI-C02','Kiểm tra trước khi quay — thiếu bộ nhớ','Quay & lưu', scr(`
  ${appbar('Chưa thể quay',{close:true})}
  <div class="pad c" style="padding-top:24px"><div class="ill er">${ic('disk')}</div><div class="h1 mt24">Máy còn quá ít bộ nhớ</div><div class="bd mt8" style="color:var(--tx2)">Cần ít nhất 500 MB để lưu video an toàn. Hiện còn 210 MB.</div></div>
  <div class="pad mt24"><div class="card"><div class="row sp"><span class="cp">Đang dùng bởi Đơn Chứng</span><b>1,8 GB</b></div><div class="prog wn mt8"><i style="width:92%"></i></div><div class="xs mt8">Có 2 video đã tải lên và xác minh, có thể giải phóng an toàn.</div></div></div>
  ${grow}${foot(btn('Xem video có thể giải phóng','p'),btn('Quay lại','s'))}`));

add('C03','UI-C03','Quay video','Quay & lưu', scr(`
  ${scene({open:false})}
  <div class="row sp" style="padding:0 16px;position:relative;z-index:3;margin-top:4px"><div class="pill">250611AB3K7Q · Kiện 1/1</div><div class="pill" style="background:#C62828"><span class="dot" style="background:#fff"></span>00:42</div></div>
  <div style="position:absolute;left:16px;right:16px;bottom:210px;z-index:3"><div class="pill" style="display:flex;justify-content:center;font-weight:500;text-align:center;border-radius:14px;line-height:1.35">Quay từ lúc chưa đóng đến khi dán xong niêm phong</div></div>
  <div style="position:absolute;left:0;right:0;bottom:70px;z-index:3;display:flex;justify-content:center"><div style="width:84px;height:84px;border-radius:50%;border:5px solid #fff;display:flex;align-items:center;justify-content:center"><div style="width:34px;height:34px;border-radius:8px;background:#E5484D"></div></div></div>
  <div class="c" style="position:absolute;left:0;right:0;bottom:40px;z-index:3;color:#fff;font-size:13px">Chạm để dừng</div>`,{dk:true}));

add('C03b','UI-C03','Quay — cảnh báo gần hết bộ nhớ','Quay & lưu', scr(`
  ${scene()}
  <div class="row sp" style="padding:0 16px;position:relative;z-index:3;margin-top:4px"><div class="pill">250611AB3K7Q · Kiện 1/1</div><div class="pill" style="background:#C62828"><span class="dot" style="background:#fff"></span>03:12</div></div>
  <div style="position:absolute;left:16px;right:16px;top:100px;z-index:3"><div class="bn wn" style="box-shadow:0 4px 14px rgba(0,0,0,.3)">${ic('alert')}<div><b>Sắp hết bộ nhớ.</b> Còn khoảng 2 phút. Dừng quay để không mất video.</div></div></div>
  <div style="position:absolute;left:0;right:0;bottom:70px;z-index:3;display:flex;justify-content:center"><div style="width:84px;height:84px;border-radius:50%;border:5px solid #fff;display:flex;align-items:center;justify-content:center"><div style="width:34px;height:34px;border-radius:8px;background:#E5484D"></div></div></div>`,{dk:true}));

add('J14','UI-J14','Phiên quay bị gián đoạn','Quay & lưu', scr(`
  ${appbar('Phiên quay',{close:true})}
  <div class="pad col g12">
    ${banner('wn','<b>Phiên quay bị gián đoạn lúc 09:41.</b> Cuộc gọi đến đã làm camera dừng. Hai đoạn đã được lưu riêng, không ghép giả.','pause')}
    <div class="card"><div class="tl">
      <div class="e"><div class="b">Đoạn 1 · 09:40 – 09:41</div><div class="cp">00:23 · kết thúc do gián đoạn</div></div>
      <div class="e w"><div class="b">Gián đoạn · 09:41 – 09:43</div><div class="cp">Không có hình trong khoảng này</div></div>
      <div class="e"><div class="b">Đoạn 2 · 09:43 – 09:44</div><div class="cp">00:31 · quay tiếp</div></div>
    </div></div>
  </div>
  ${grow}${foot(btn('Lưu cả hai đoạn','p'),btn('Quay thêm đoạn mới','s'))}`));

add('C04','UI-C04','Kết thúc và xác nhận','Quay & lưu', scr(`
  ${appbar('Kiểm tra video',{close:true})}
  <div class="pad"><div style="height:300px;border-radius:16px;overflow:hidden;position:relative">${scene({cls:'cam',h:600,dy:-60,open:false})}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="width:60px;height:60px;border-radius:30px;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center">${ic('play',{c:'#fff',s:26})}</div></div><div class="pill" style="position:absolute;left:10px;bottom:10px">00:58</div></div></div>
  <div class="pad mt12"><div class="card"><div class="kv"><span>Đơn / kiện</span><span>250611AB3K7Q · Kiện 1</span></div><div class="kv"><span>Dung lượng</span><span>84 MB</span></div><div class="kv"><span>Giờ trên máy</span><span>11/06/2025 10:12</span></div></div></div>
  ${grow}${foot(btn('Lưu bằng chứng','p','check'),btn('Xem lại từ đầu','s','play'))}`));

add('C05','UI-C05','Đang lưu và đồng bộ','Quay & lưu', scr(`
  ${appbar('Đã lưu video',{back:false})}
  <div class="pad c" style="padding-top:8px"><div class="ill">${ic('check',{})}</div><div class="h1 mt16">Video đã lưu trên máy</div><div class="bd mt4" style="color:var(--tx2)">Bạn có thể quay đơn tiếp theo ngay.</div></div>
  <div class="pad mt24"><div class="card col g12">
    <div class="row g12">${thumb()}<div class="fl"><div class="b">250611AB3K7Q · Kiện 1</div><div class="cp">00:58 · 84 MB</div></div></div>
    <div class="row sp"><span class="cp">Trên máy</span>${ev('saved')}</div>
    <div class="row sp"><span class="cp">Trên máy chủ</span>${ev('up')}</div>
    ${prog(38)}<div class="xs">32 MB / 84 MB · Chỉ tải khi ứng dụng đang mở</div>
  </div></div>
  <div class="pad mt12">${banner('in','Chỉ hiện “Đã lưu trên máy chủ” sau khi máy chủ xác nhận.')}</div>
  ${grow}${foot(btn('Đóng gói đơn tiếp theo','p','box'),btn('Xem bằng chứng','s'))}`));

add('C06','UI-C06','Hoàn tất đóng gói','Quay & lưu', scr(`
  ${appbar('Hoàn tất',{back:false})}
  <div class="pad c" style="padding-top:8px"><div class="ill" style="background:var(--okb)">${ic('check',{c:'var(--ok)'})}</div><div class="h1 mt16">Đã xong đơn 250611AB3K7Q</div></div>
  <div class="pad mt24"><div class="card">
    <div class="kv"><span>Số video</span><span>1</span></div>
    <div class="kv"><span>Trạng thái</span><span>${ev('wait')}</span></div>
    <div class="kv"><span>Hôm nay</span><span>12 đơn · 11 video đã tải</span></div>
  </div></div>
  <div class="pad mt12">${banner('wn','Video đã lưu trên máy, đang chờ đồng bộ. Chưa nên xóa ứng dụng.','clock')}</div>
  ${grow}${foot(btn('Đóng gói đơn tiếp theo','p','box'),btn('Xem bằng chứng','s'))}`));

module.exports = S;
module.exports.helpers = { orderRow, attention };
