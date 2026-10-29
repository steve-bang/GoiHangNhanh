const L = require('./lib');
const { ic, scr, appbar, btn, chip, ev, src, banner, field, prog, pad, sec, foot, grow, sheet, dlg, gli, grp, scene, thumb } = L;
const { orderRow, attention } = require('./screens1').helpers;
const S = [];
const add = (id, code, name, group, html) => S.push({ id, code, name, group, html });
const seg = (...t) => `<div class="chips">${t.map((x,i)=>`<span class="fc ${x.startsWith('*')?'on':''}">${x.replace('*','')}</span>`).join('')}</div>`;
const retRow = (code, sub, st) => `<div class="it">${ic('ret',{c:'var(--jade)',s:28})}<div class="fl"><div class="b" style="font-size:16px">${code}</div><div class="cp">${sub}</div></div>${st}</div>`;

// ---------- Hàng hoàn ----------
add('D01','UI-D01','Danh sách hàng hoàn','Hàng hoàn', scr(`
  <div class="big">Hàng hoàn</div>
  <div class="pad"><div class="fld row g8" style="flex-direction:row;align-items:center">${ic('search',{c:'#8A8F8C'})}<span class="ph">Mã đơn, mã vận đơn, mã hoàn</span></div></div>
  <div class="mt12">${seg('*Tất cả','Đang tiếp nhận','Đang kiểm tra','Có sai lệch')}</div>
  <div class="lst mt16">
    ${retRow('RT-0612-001','Đơn 250611AB3K7Q · hôm nay',chip('wn','Đang kiểm tra','clock'))}
    ${retRow('RT-0611-004','Chưa liên kết đơn gốc',chip('dv','Chưa liên kết','info'))}
    ${retRow('RT-0610-002','Đơn 2506117781204 · 10/06',chip('er','Có sai lệch','alert'))}
    ${retRow('RT-0609-001','Đơn LZ8831209948 · 09/06',chip('ok','Đã kiểm tra','check'))}
  </div>
  ${grow}<div class="pad" style="padding-bottom:12px">${btn('Tiếp nhận hàng hoàn','p','plus')}</div>`,{tab:'orders'}));

add('D02','UI-D02','Tìm đơn gốc','Hàng hoàn', scr(`
  ${appbar('Tìm đơn gốc',{close:true})}
  <div class="pad col g12"><div class="cp">Quét hoặc nhập mã trên kiện hàng hoàn.</div>
    <div style="height:150px;border-radius:16px;overflow:hidden;position:relative">${scene({cls:'cam',h:300,dy:-80})}<div style="position:absolute;left:30px;right:30px;top:60px;height:2px;background:var(--scan);box-shadow:0 0 10px var(--scan)"></div></div>
    ${field('Mã đơn hoặc mã vận đơn','250611AB3K7Q',{f:true})}</div>
  ${sec('Tìm thấy 1 đơn')}
  <div class="lst"><div class="it" style="border:2px solid var(--jade)">${src('SP')}<div class="fl"><div class="b">250611AB3K7Q</div><div class="cp">Shopee · 11/06 · Áo sơ mi nữ × 2</div></div><div class="rad on"></div></div></div>
  <div class="pad mt12">${banner('in','Thông tin này do bạn nhập khi đóng gói, chỉ để đối chiếu.')}</div>
  ${grow}${foot(btn('Dùng đơn này','p'),btn('Không có đơn gốc — tạo hồ sơ chưa liên kết','s'))}`));

add('D03','UI-D03','Ghi nhận kiện bên ngoài','Hàng hoàn', scr(`
  ${appbar('Kiện bên ngoài')}
  <div class="pad"><div class="prog"><i style="width:33%"></i></div><div class="xs mt4">Bước 1/3 · Chụp kiện</div></div>
  <div class="pad col g12 mt12">
    <div style="height:190px;border-radius:16px;overflow:hidden;position:relative">${scene({cls:'cam',h:380,dy:-60})}<div class="pill" style="position:absolute;right:10px;bottom:10px">${ic('cam')}Chụp lại</div></div>
    <div class="cp b">Tình trạng kiện</div>
    <div class="row g8 wrap"><span class="fc">Nguyên vẹn</span><span class="fc on">Móp</span><span class="fc">Rách</span><span class="fc">Ướt</span><span class="fc">Niêm phong lạ</span><span class="fc">Nhãn không đọc được</span></div>
    ${field('Ghi chú ngắn (tùy chọn)','Móp góc phải, băng dính còn nguyên')}
  </div>
  ${grow}${foot(btn('Tiếp tục ghi hình mở kiện','p','video'))}`));

add('D04','UI-D04','Quay video mở kiện','Hàng hoàn', scr(`
  ${scene({open:true})}
  <div class="row sp" style="padding:0 16px;position:relative;z-index:3;margin-top:4px"><div class="pill">RT-0612-001 · Mở kiện</div><div class="pill" style="background:#C62828"><span class="dot" style="background:#fff"></span>00:27</div></div>
  <div style="position:absolute;left:16px;right:16px;bottom:210px;z-index:3"><div class="pill" style="display:flex;justify-content:center;text-align:center;border-radius:14px;font-weight:500;line-height:1.35">Quay từ trước khi mở niêm phong đến khi lấy hết hàng ra</div></div>
  <div style="position:absolute;left:0;right:0;bottom:70px;z-index:3;display:flex;justify-content:center"><div style="width:84px;height:84px;border-radius:50%;border:5px solid #fff;display:flex;align-items:center;justify-content:center"><div style="width:34px;height:34px;border-radius:8px;background:#E5484D"></div></div></div>`,{dk:true}));

add('D04b','UI-D04','Kiện đã mở trước khi quay','Hàng hoàn', scr(`
  ${appbar('Kiện đã được mở?',{close:true})}
  <div class="pad c" style="padding-top:16px"><div class="ill wn">${ic('box')}</div><div class="h1 mt24">Kiện đã mở trước khi quay</div><div class="bd mt8" style="color:var(--tx2)">Hãy ghi nhận đúng thực tế. Hồ sơ sẽ đánh dấu thiếu bằng chứng quá trình mở.</div></div>
  <div class="pad mt16"><div class="card"><div class="row g12"><div class="cb on">${ic('check')}</div><div class="fl">Kiện đã bị mở trước khi tôi bắt đầu quay</div></div></div></div>
  ${grow}${foot(btn('Ghi nhận và tiếp tục','p'),btn('Quay lại','s'))}`));

add('D05','UI-D05','Kiểm tra hàng thực nhận','Hàng hoàn', scr(`
  ${appbar('Kiểm tra hàng')}
  <div class="pad"><div class="prog"><i style="width:66%"></i></div><div class="xs mt4">Bước 2/3 · So với khai báo ban đầu</div></div>
  <div class="lst mt12">
    <div class="card col g12"><div class="row sp"><div><div class="b">Áo sơ mi nữ cổ tròn</div><div class="cp">Trắng · M</div></div>${chip('ok','Khớp','check')}</div>
      <div class="row g12"><div class="fl cp">Khai báo <b style="color:var(--tx)">2</b></div><div class="fl cp">Thực nhận</div><div class="qty" style="width:130px"><b>−</b><span>2</span><b>＋</b></div></div>
      <div class="row g8 wrap"><span class="fc on">Bình thường</span><span class="fc">Hư hỏng</span><span class="fc">Thiếu phụ kiện</span></div></div>
    <div class="card col g12"><div class="row sp"><div><div class="b">Quần culottes</div><div class="cp">Đen · L</div></div>${chip('wn','Thiếu 1','alert')}</div>
      <div class="row g12"><div class="fl cp">Khai báo <b style="color:var(--tx)">2</b></div><div class="fl cp">Thực nhận</div><div class="qty" style="width:130px"><b>−</b><span>1</span><b>＋</b></div></div></div>
  </div>
  <div class="pad mt12">${banner('in','Số liệu khai báo ban đầu không bị ghi đè.')}</div>
  ${grow}${foot(btn('Xem lại kết quả','p'))}`));

add('D06','UI-D06','Xác nhận kết quả kiểm tra','Hàng hoàn', scr(`
  ${appbar('Xác nhận kết quả')}
  <div class="pad col g12">
    <div class="card"><div class="kv"><span>Hồ sơ hoàn</span><span>RT-0612-001</span></div><div class="kv"><span>Đơn gốc</span><span>250611AB3K7Q</span></div><div class="kv"><span>Tình trạng kiện</span><span>Móp góc</span></div></div>
    <div class="card"><div class="b">Đối chiếu</div><div class="kv"><span>Áo sơ mi nữ · Trắng M</span><span>Khớp</span></div><div class="kv"><span>Quần culottes · Đen L</span><span style="color:var(--wn)">Thiếu 1</span></div></div>
    ${banner('in','Đơn Chứng chỉ ghi điều quan sát và khai báo. Không kết luận bên nào chịu trách nhiệm.')}
  </div>
  ${grow}${foot(btn('Xác nhận và hoàn tất','p','check'),btn('Sửa kết quả','s'))}`));

add('D07','UI-D07','Hoàn tất tiếp nhận','Hàng hoàn', scr(`
  ${appbar('Đã tiếp nhận',{back:false})}
  <div class="pad c"><div class="ill" style="background:var(--okb)">${ic('check',{c:'var(--ok)'})}</div><div class="h1 mt16">Đã ghi nhận hàng hoàn</div></div>
  <div class="pad mt24"><div class="card"><div class="b">Bằng chứng</div>
    <div class="row g12 mt12">${thumb({open:true})}<div class="fl"><div class="b">Video mở kiện</div><div class="cp">01:12</div></div>${ev('wait')}</div>
    <div class="row g12 mt12"><div class="th" style="background:var(--jade-l)">${ic('cam',{c:'var(--jade)',s:28}).replace('<svg','<svg style="margin:14px"')}</div><div class="fl"><div class="b">Ảnh kiện bên ngoài</div><div class="cp">1 ảnh</div></div>${ev('ver')}</div></div></div>
  <div class="pad mt12">${banner('wn','Video đang chờ đồng bộ. Dữ liệu kiểm tra đã được lưu.','clock')}</div>
  ${grow}${foot(btn('Xem hồ sơ hàng hoàn','p'),btn('Tạo hồ sơ tranh chấp','s','gavel'))}`));

// ---------- Đơn hàng ----------
add('E01','UI-E01','Danh sách đơn','Đơn hàng', scr(`
  <div class="row sp" style="padding-right:8px"><div class="big">Đơn hàng</div><div class="ic" style="width:44px">${ic('filter')}</div></div>
  <div class="pad"><div class="fld row g8" style="flex-direction:row;align-items:center;min-height:48px">${ic('search',{c:'#8A8F8C'})}<span class="ph">Tìm mã đơn hoặc mã vận đơn</span></div></div>
  <div class="mt12">${seg('*Tất cả','Chưa có video','Chưa tải xong','Lỗi')}</div>
  <div class="sec" style="padding-top:12px">Hôm nay · 12 đơn</div>
  <div class="lst">
    ${orderRow('SP','250611AB3K7Q','10:12 · 1 video','ver')}
    ${orderRow('TT','2506117781204','09:40 · 1 video','up')}
    ${orderRow('LZ','LZ8831209948','09:05 · 1 video','saved')}
    ${orderRow('SP','250611ZP90LA','08:50 · chưa có video','none')}
    ${orderRow('KH','DH-TAY-0021','08:31 · 2 video','err')}
  </div>`,{tab:'orders'}));

add('E01b','UI-E01','Danh sách đơn — chưa có đơn','Đơn hàng', scr(`
  <div class="big">Đơn hàng</div>
  <div class="pad col" style="align-items:center;text-align:center;margin-top:90px"><div class="ill">${ic('box')}</div><div class="h1 mt24">Chưa có đơn nào</div><div class="bd mt8" style="color:var(--tx2);max-width:260px">Quét mã đơn đầu tiên để bắt đầu lưu bằng chứng.</div><div style="width:220px;margin-top:24px">${btn('Quét mã đơn','p','scan')}</div></div>`,{tab:'orders'}));

add('E01c','UI-E01','Lọc không có kết quả','Đơn hàng', scr(`
  <div class="big">Đơn hàng</div>
  <div class="pad"><div class="fld row g8" style="flex-direction:row;align-items:center;min-height:48px">${ic('search',{c:'#8A8F8C'})}<span class="v" style="font-size:16px">99999</span></div></div>
  <div class="pad col" style="align-items:center;text-align:center;margin-top:80px"><div class="ill in">${ic('search')}</div><div class="h1 mt24">Không có đơn khớp</div><div class="bd mt8" style="color:var(--tx2);max-width:260px">Thử mã khác hoặc bỏ bớt bộ lọc.</div><div style="width:220px;margin-top:24px">${btn('Xóa bộ lọc','s')}</div></div>`,{tab:'orders'}));

add('E02','UI-E02','Chi tiết đơn','Đơn hàng', scr(`
  ${appbar('Chi tiết đơn',{right:['share']})}
  <div class="pad"><div class="row g12">${src('SP')}<div class="fl"><div class="h1">250611AB3K7Q</div><div class="cp">Shopee · tạo 10:05 bởi bạn</div></div></div></div>
  <div class="pad mt12 col g12">
    <div class="card"><div class="row sp"><div class="b">Bằng chứng đóng gói</div>${ev('ver')}</div>
      <div class="row g12 mt12">${thumb()}<div class="fl"><div class="b">Kiện 1 · 00:58</div><div class="cp">11/06 10:12 · 84 MB</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>
      <div class="row g8 mt12"><span class="chip ck-vf">${ic('hash')}Mã băm khớp</span></div></div>
    <div class="card"><div class="b">Sản phẩm khai báo</div><div class="bd mt4">Áo sơ mi nữ cổ tròn · Trắng · M × 2</div><div class="xs mt4">Thông tin do người dùng nhập</div></div>
    <div class="grp" style="margin:0">${gli('ret','Hàng hoàn','Chưa có')}${gli('gavel','Tranh chấp','Chưa có')}${gli('clock','Lịch sử thay đổi','2 mục')}</div>
  </div>
  ${grow}${foot(btn('Xem bằng chứng','p','eye'),btn('Quay bổ sung','s','video'))}`));

add('E03','UI-E03','Danh sách bằng chứng','Đơn hàng', scr(`
  ${appbar('Bằng chứng')}
  <div class="pad"><div class="xs">Đơn 250611AB3K7Q · 3 mục</div></div>
  <div class="lst mt12">
    <div class="it">${thumb()}<div class="fl"><div class="b">Video đóng gói · Kiện 1</div><div class="cp">11/06 10:12 · 00:58</div><div class="mt4">${ev('ver')}</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>
    <div class="it">${thumb({open:true})}<div class="fl"><div class="b">Video bổ sung</div><div class="cp">12/06 08:20 · 00:34</div><div class="mt4">${ev('up')}</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>
    <div class="it">${thumb()}<div class="fl"><div class="b">Video đóng gói · Kiện 2</div><div class="cp">11/06 10:20 · 00:47</div><div class="mt4">${ev('int')}</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>
  </div>
  <div class="pad mt12">${banner('in','Quay bổ sung tạo phiên mới. Video gốc không bị thay thế.')}</div>`));

add('E04','UI-E04','Chi tiết video','Đơn hàng', scr(`
  ${appbar('Video đóng gói',{right:['share']})}
  <div style="height:260px;position:relative;margin:0 0">${scene({cls:'cam',h:520,dy:-40})}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="width:64px;height:64px;border-radius:32px;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center">${ic('play',{c:'#fff',s:28})}</div></div><div style="position:absolute;left:16px;right:16px;bottom:10px;height:4px;border-radius:2px;background:rgba(255,255,255,.35)"><div style="width:30%;height:4px;background:#fff;border-radius:2px"></div></div></div>
  <div class="pad mt16 col g12">
    <div class="row sp"><div class="h2">250611AB3K7Q · Kiện 1</div>${ev('ver')}</div>
    <div class="card"><div class="kv"><span>Giờ trên máy</span><span>11/06/2025 10:12</span></div><div class="kv"><span>Giờ máy chủ nhận</span><span>11/06/2025 10:14</span></div><div class="kv"><span>Thời lượng</span><span>00:58</span></div><div class="kv"><span>Gián đoạn</span><span>Không</span></div></div>
    <div class="cp">Mã băm SHA-256 chỉ chứng minh tệp không đổi kể từ lúc tính.</div>
    <div class="row g8"><span class="chip ck-dv" style="font-family:monospace">a3f9…7c21</span><span class="cp row g4" style="color:var(--jade);font-weight:700">${ic('copy',{s:16})}Sao chép</span></div>
  </div>`));

add('E05','UI-E05','Lịch sử thay đổi','Đơn hàng', scr(`
  ${appbar('Lịch sử thay đổi')}
  <div class="pad mt8"><div class="card"><div class="tl">
    <div class="e"><div class="b">Đã xác minh mã băm</div><div class="cp">Máy chủ · 11/06 10:14</div></div>
    <div class="e"><div class="b">Số lượng sản phẩm đổi</div><div class="cp">Lan Anh · 11/06 10:06</div><div class="row g8 mt4"><span class="chip ck-er" style="text-decoration:line-through">1</span>${ic('chev',{s:14})}<span class="chip ck-ok">2</span></div></div>
    <div class="e g"><div class="b">Tạo đơn</div><div class="cp">Lan Anh · 11/06 10:05 · thông tin do bạn nhập</div></div>
  </div></div></div>
  <div class="pad mt12 cp">Lịch sử không thể sửa hoặc xóa.</div>`));

module.exports = S;
