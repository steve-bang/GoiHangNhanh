const L = require('./lib');
const { ic, scr, appbar, btn, chip, ev, src, banner, field, prog, pad, sec, foot, grow, sheet, dlg, gli, grp, scene, thumb } = L;
const { orderRow, attention } = require('./screens1').helpers;
const S = [];
const add = (id, code, name, group, html) => S.push({ id, code, name, group, html });
const seg = (...t) => `<div class="chips">${t.map(x=>`<span class="fc ${x.startsWith('*')?'on':''}">${x.replace('*','')}</span>`).join('')}</div>`;
const tgl = (t, s, on) => `<div class="li"><div class="fl"><div class="b">${t}</div>${s?`<div class="cp">${s}</div>`:''}</div><div class="sw ${on?'on':''}"></div></div>`;
const syncRow = (code, sub, right, p) => `<div class="it"><div style="flex:1;min-width:0"><div class="row sp"><div class="b">${code}</div>${right}</div><div class="cp">${sub}</div>${p!=null?`<div style="margin-top:8px">${prog(p)}</div>`:''}</div></div>`;

// ---------- Đồng bộ ----------
add('F01','UI-F01','Trung tâm đồng bộ','Đồng bộ & lưu trữ', scr(`
  <div class="big">Đồng bộ</div>
  <div class="pad"><div class="card"><div class="row sp"><div class="b">Đang tải 1 · Chờ 2 · Lỗi 1</div><span class="cp">210 MB</span></div><div class="mt8">${prog(38)}</div><div class="xs mt8">Chỉ tải khi ứng dụng đang mở. Ứng dụng tự thử lại khi có mạng.</div></div></div>
  <div class="mt12">${seg('*Cần xử lý 1','Đang tải','Chờ','Xong')}</div>
  <div class="lst mt12">
    <div class="it" style="border-color:var(--er)"><div class="fl"><div class="row sp"><div class="b">SPX0412889</div>${ev('err')}</div><div class="cp mt4">Video vẫn lưu trên máy. Mạng không ổn định.</div><div class="mt12">${btn('Thử tải lại','d s','refresh')}</div></div></div>
    ${syncRow('2506117781204','84 MB · 32 MB đã tải',ev('up'),38)}
    ${syncRow('LZ8831209948','61 MB · chờ có mạng',ev('wait'))}
  </div>
  ${grow}<div class="pad cp c" style="padding-bottom:16px">Không có nút “Xóa tất cả”. Video chỉ được xóa khi đủ điều kiện.</div>`,{tab:'notif'}));

add('F02','UI-F02','Chi tiết lỗi đồng bộ','Đồng bộ & lưu trữ', scr(`
  ${appbar('Lỗi tải lên',{})}
  <div class="pad c" style="padding-top:12px"><div class="ill er">${ic('off')}</div><div class="h1 mt24">Chưa tải lên được</div><div class="bd mt8" style="color:var(--tx2)">Video vẫn được lưu trên máy. Chưa thể tải lên vì kết nối mạng không ổn định.</div></div>
  <div class="pad mt24"><div class="card"><div class="kv"><span>Hồ sơ</span><span>SPX0412889 · Kiện 1</span></div><div class="kv"><span>Dung lượng</span><span>92 MB</span></div><div class="kv"><span>Đã thử</span><span>3 lần · gần nhất 09:58</span></div><div class="kv"><span>Dữ liệu gốc</span><span style="color:var(--ok)">Còn nguyên trên máy</span></div></div></div>
  <div class="pad mt12">${banner('in','Bạn không cần quay lại nếu tệp gốc còn nguyên.')}</div>
  ${grow}${foot(btn('Thử tải lên lại','p','refresh'),btn('Mở hồ sơ đơn','s'))}`));

add('F03','UI-F03','Dung lượng và lưu trữ','Đồng bộ & lưu trữ', scr(`
  ${appbar('Dung lượng')}
  <div class="pad col g12">
    <div class="card"><div class="row sp"><span class="b">Trên máy</span><span class="b">1,8 GB</span></div><div class="prog mt8"><i style="width:62%"></i></div><div class="xs mt8">Còn trống 4,2 GB</div>
      <div class="div mt12"></div><div class="kv"><span>Chờ tải lên</span><span>153 MB</span></div><div class="kv"><span>Có thể giải phóng an toàn</span><span>1,1 GB</span></div></div>
    <div class="card"><div class="row sp"><span class="b">Trên máy chủ</span><span class="b">12,4 GB</span></div><div class="kv"><span>Thời hạn lưu</span><span>Chưa có thông tin</span></div><div class="kv"><span>Bằng chứng đang được giữ</span><span>0</span></div></div>
    ${banner('in','Không có video chưa tải hoặc đang giữ do tranh chấp nào bị xóa.')}
  </div>
  ${grow}${foot(btn('Xem video có thể giải phóng','p'))}`));

add('F03b','UI-F03','Xác nhận giải phóng bộ nhớ','Đồng bộ & lưu trữ', scr(`
  ${appbar('Dung lượng')}<div class="pad"><div class="card" style="height:200px"></div></div>
  ${sheet(`<div class="h2">Xóa 14 video khỏi máy?</div><div class="bd" style="color:var(--tx2)">Các video này đã tải lên và xác minh trên máy chủ. Bản trên máy chủ vẫn còn. Không thể hoàn tác.</div>
    <div class="card"><div class="kv"><span>Giải phóng</span><span>1,1 GB</span></div><div class="kv"><span>Vẫn còn trên máy chủ</span><span>14 / 14</span></div></div>
    ${btn('Xóa 14 video khỏi máy','dp')}${btn('Hủy','t')}`)}`));

add('F04','UI-F04','Ngoại tuyến','Đồng bộ & lưu trữ', scr(`
  <div style="background:var(--wnb);padding:10px 16px;display:flex;gap:10px;align-items:center;color:#7A3A06;font-size:14px">${ic('off',{c:'var(--wn)',s:20})}<div><b>Đang ngoại tuyến.</b> Bằng chứng sẽ tự đồng bộ khi có mạng.</div></div>
  <div class="big">Đơn hàng</div>
  <div class="lst">${orderRow('SP','250611AB3K7Q','10:12 · lưu trên máy','saved')}${orderRow('SP','250611ZP90LA','08:50 · lưu trên máy','wait')}</div>
  <div class="pad mt12 cp">Chỉ hiển thị dữ liệu có trên máy. Việc cần máy chủ được đánh dấu riêng.</div>`,{tab:'orders'}));

// ---------- Tranh chấp ----------
add('G01','UI-G01','Danh sách tranh chấp','Tranh chấp', scr(`
  <div class="big">Tranh chấp</div>
  <div class="mt4">${seg('*Đang mở','Đã đóng')}</div>
  <div class="lst mt16">
    <div class="it"><div class="src" style="background:var(--erb)">${ic('gavel',{c:'var(--er)'})}</div><div class="fl"><div class="b">TC-0612-01</div><div class="cp">Đơn 250611AB3K7Q · 3 bằng chứng</div><div class="mt4 row g4 wrap">${chip('wn','Đang mở')} ${chip('wn','1 chưa tải','clock')}</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>
    <div class="it"><div class="src" style="background:var(--mut)">${ic('gavel',{c:'var(--tx2)'})}</div><div class="fl"><div class="b">TC-0604-02</div><div class="cp">Đơn 2506117781204 · 2 bằng chứng</div><div class="mt4">${chip('dv','Đang mở')}</div></div>${ic('chev',{s:18,c:'#9AA09C'})}</div>
  </div>
  ${grow}<div class="pad" style="padding-bottom:12px">${btn('Tạo hồ sơ tranh chấp','p','plus')}</div>`,{tab:'notif'}));

add('G02','UI-G02','Tạo hồ sơ tranh chấp','Tranh chấp', scr(`
  ${appbar('Tạo hồ sơ tranh chấp',{close:true})}
  <div class="pad col g16">
    ${field('Đơn hoặc hồ sơ hoàn','250611AB3K7Q · Shopee')}
    <div><div class="cp b" style="margin-bottom:8px">Vấn đề</div><div class="row g8 wrap"><span class="fc on">Thiếu hàng</span><span class="fc">Sai phân loại</span><span class="fc">Hư hỏng</span><span class="fc">Tình trạng kiện</span><span class="fc">Khác</span></div></div>
    ${field('Mô tả ngắn','Khách báo thiếu 1 quần culottes')}
    ${banner('in','Thông tin đơn đã có sẵn, không cần khai lại.')}
  </div>
  ${grow}${foot(btn('Tiếp tục chọn bằng chứng','p'))}`));

add('G03','UI-G03','Chọn bằng chứng','Tranh chấp', scr(`
  ${appbar('Chọn bằng chứng')}
  <div class="lst mt8">
    <div class="it">${thumb()}<div class="fl"><div class="b">Video đóng gói · Kiện 1</div><div class="cp">11/06 10:12</div><div class="mt4">${ev('ver')}</div></div><div class="cb on">${ic('check')}</div></div>
    <div class="it">${thumb({open:true})}<div class="fl"><div class="b">Video mở kiện hoàn</div><div class="cp">12/06 08:20</div><div class="mt4">${ev('wait')}</div></div><div class="cb on">${ic('check')}</div></div>
    <div class="it"><div class="th" style="background:var(--jade-l)">${ic('cam',{c:'var(--jade)',s:26}).replace('<svg','<svg style="margin:15px"')}</div><div class="fl"><div class="b">Ảnh kiện bên ngoài</div><div class="cp">12/06 08:18</div><div class="mt4">${ev('ver')}</div></div><div class="cb"></div></div>
  </div>
  <div class="pad mt12">${banner('wn','1 tệp chưa tải lên. Hồ sơ xuất sẽ ghi rõ tệp này chưa có trên máy chủ.','clock')}</div>
  ${grow}${foot(btn('Xem trước (2 đã chọn)','p'))}`));

add('G04','UI-G04','Xem trước và xuất','Tranh chấp', scr(`
  ${appbar('Xem trước hồ sơ')}
  <div class="pad col g12">
    <div class="card"><div class="h2">TC-0612-01</div><div class="cp">Thiếu hàng · Đơn 250611AB3K7Q</div>
      <div class="div mt12"></div><div class="kv"><span>Bằng chứng</span><span>2 mục</span></div><div class="kv"><span>Đã xác minh</span><span>1</span></div><div class="kv"><span>Chưa tải lên</span><span style="color:var(--wn)">1</span></div></div>
    ${banner('wn','Chưa đủ điều kiện ghi “đầy đủ”: còn 1 tệp chưa có trên máy chủ.')}
    <div class="grp" style="margin:0">${gli('file','Bản tóm tắt (PDF)','Thông tin đơn, giờ, trạng thái tệp')}${gli('box','Gói tệp (ZIP)','Video và ảnh đã chọn')}</div>
  </div>
  ${grow}${foot(btn('Xuất hồ sơ','p','share'))}`));

add('G05','UI-G05','Chi tiết và đóng hồ sơ','Tranh chấp', scr(`
  ${appbar('TC-0612-01')}
  <div class="pad col g12">
    <div class="row g8">${chip('wn','Đang mở')}${chip('vf','Đang giữ bằng chứng','lock')}</div>
    <div class="card"><div class="kv"><span>Lý do</span><span>Thiếu hàng</span></div><div class="kv"><span>Đơn</span><span>250611AB3K7Q</span></div><div class="kv"><span>Tạo</span><span>12/06 09:02</span></div></div>
    <div class="card"><div class="b">Lịch sử</div><div class="tl mt12"><div class="e"><div class="b">Thêm 2 bằng chứng</div><div class="cp">Lan Anh · 09:05</div></div><div class="e g"><div class="b">Tạo hồ sơ</div><div class="cp">Lan Anh · 09:02</div></div></div></div>
  </div>
  ${grow}${foot(btn('Bổ sung bằng chứng','p','plus'),btn('Đóng hồ sơ','d'))}`));

// ---------- Gói & thanh toán (đang ẩn, thiết kế sẵn) ----------
add('H01','UI-H01','Gói dịch vụ (đang ẩn)','Gói dịch vụ', scr(`
  ${appbar('Gói dịch vụ')}
  <div class="pad col g12"><div class="card"><div class="row sp"><div><div class="xs">Gói hiện tại</div><div class="h1">Chưa có thông tin</div></div>${chip('dv','Sắp có')}</div></div>
    <div class="card"><div class="b">Chính sách lưu trữ dự kiến</div><div class="cp mt8">• Có cảnh báo trước khi hết hạn<br>• Bằng chứng đang tranh chấp được giữ lại<br>• Hạ gói không xóa ngầm dữ liệu</div></div>
    ${btn('Nâng cấp gói','p','off')}<div class="xs c">Chưa mở thanh toán</div></div>`));

add('H02','UI-H02','So sánh gói','Gói dịch vụ', scr(`
  ${appbar('So sánh gói')}
  <div class="pad col g12">
    ${[['Cơ bản','Lưu 30 ngày','5 GB · 1 thành viên',0],['Cửa hàng','Lưu 90 ngày','50 GB · 3 thành viên',1],['Doanh nghiệp','Lưu 365 ngày','500 GB · không giới hạn',0]].map(p=>`<div class="card" style="${p[3]?'border:2px solid var(--jade)':''}"><div class="row sp"><div class="h2">${p[0]}</div>${p[3]?chip('vf','Phổ biến'):''}</div><div class="cp mt4">${p[1]} · ${p[2]}</div><div class="cp mt8">Giá và chu kỳ: <b>đang cập nhật</b></div></div>`).join('')}
    ${banner('in','Khi hết hạn gói, bằng chứng không bị xóa ngầm. Bạn được báo trước.')}
  </div>`));

add('H03','UI-H03','Xác nhận thanh toán','Gói dịch vụ', scr(`
  ${appbar('Xác nhận thanh toán',{close:true})}
  <div class="pad col g12"><div class="card"><div class="kv"><span>Gói</span><span>Cửa hàng</span></div><div class="kv"><span>Chu kỳ</span><span>Hàng tháng</span></div><div class="kv"><span>Gia hạn</span><span>Tự động, hủy bất cứ lúc nào</span></div></div>
    ${banner('in','Kết quả thanh toán lấy từ nhà cung cấp, không báo thành công trước khi họ xác nhận.')}</div>
  ${grow}${foot(btn('Thanh toán','p','card'),btn('Hủy','t'))}`));

add('H04','UI-H04','Gần đạt giới hạn lưu trữ','Gói dịch vụ', scr(`
  ${appbar('Gần đầy dung lượng')}
  <div class="pad c" style="padding-top:12px"><div class="ill wn">${ic('cloud')}</div><div class="h1 mt24">Đã dùng 92% dung lượng</div><div class="bd mt8" style="color:var(--tx2)">Video đang chờ tải vẫn được giữ. Bạn vẫn xem được toàn bộ bằng chứng hiện có.</div></div>
  <div class="pad mt24"><div class="card"><div class="prog wn"><i style="width:92%"></i></div><div class="row sp mt8"><span class="cp">46 GB</span><span class="cp">50 GB</span></div></div></div>
  ${grow}${foot(btn('Xem các gói','p'),btn('Giải phóng bộ nhớ trên máy','s'))}`));

// ---------- Tài khoản ----------
add('I01','UI-I01','Cá nhân','Cá nhân', scr(`
  <div class="big">Cá nhân</div>
  <div class="pad"><div class="card row g12"><div style="width:56px;height:56px;border-radius:28px;background:var(--jade-l);color:var(--jade-d);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px">LA</div><div class="fl"><div class="h2">Lan Anh</div><div class="cp">lananh@minhanh.vn</div></div></div></div>
  <div class="pad mt12"><div class="card"><div class="row sp"><div><div class="xs">Cửa hàng đang dùng</div><div class="b">Minh Anh Fashion</div></div>${chip('ok','Đang hoạt động')}</div></div></div>
  <div class="mt12">${grp(gli('store','Cửa hàng','Tên, nguồn bán'),gli('bell','Thông báo','Chọn loại muốn nhận'),gli('disk','Dung lượng và thời hạn lưu'),gli('shield','Quyền riêng tư và dữ liệu'),gli('help','Trợ giúp'))}</div>
  ${grow}<div class="pad" style="padding-bottom:12px">${btn('Đăng xuất','d')}</div>`,{tab:'me'}));

add('I02','UI-I02','Cửa hàng','Cá nhân', scr(`
  ${appbar('Cửa hàng')}
  <div class="pad col g12"><div class="card"><div class="row sp"><div><div class="xs">Tên cửa hàng</div><div class="h2">Minh Anh Fashion</div></div><span class="cp" style="color:var(--jade);font-weight:700">Sửa</span></div></div>
    <div class="card"><div class="b">Nguồn bán</div><div class="row g8 wrap mt8"><span class="fc on">Shopee</span><span class="fc on">TikTok Shop</span><span class="fc">Lazada</span><span class="fc">Khác</span></div></div>
    <div class="card"><div class="kv"><span>Trạng thái</span><span style="color:var(--ok)">Đang hoạt động</span></div></div>
    ${btn('Chuyển cửa hàng','s','store')}
    ${banner('in','Đổi tên không làm thay đổi lịch sử bằng chứng đã ghi.')}</div>`));

add('I02b','UI-J12','Chuyển cửa hàng bị chặn','Cá nhân', scr(`
  ${appbar('Chuyển cửa hàng')}<div class="lst mt8"><div class="it" style="border:2px solid var(--jade)">${ic('store',{c:'var(--jade)'})}<div class="fl b">Minh Anh Fashion</div><div class="rad on"></div></div><div class="it">${ic('store',{c:'var(--tx2)'})}<div class="fl b">Kho Hà Nội</div><div class="rad"></div></div></div>
  ${dlg(`<div class="h2">Chưa thể chuyển cửa hàng</div><div class="bd" style="color:var(--tx2)">Còn 2 video chưa tải lên. Hãy chờ tải xong để không gắn nhầm sang cửa hàng khác.</div>${btn('Xem tệp chưa tải','p')}${btn('Để sau','t')}`)}`));

add('I03','UI-I03','Thành viên và quyền','Cá nhân', scr(`
  ${appbar('Thành viên')}
  <div class="lst mt8">
    <div class="it"><div class="src s-kh" style="border-radius:18px;width:44px;height:44px;color:var(--jade-d);background:var(--jade-l)">LA</div><div class="fl"><div class="b">Lan Anh (bạn)</div><div class="cp">lananh@minhanh.vn</div></div>${chip('vf','Chủ shop')}</div>
    <div class="it"><div class="src s-kh" style="border-radius:22px;width:44px;height:44px">TH</div><div class="fl"><div class="b">Thu Hà</div><div class="cp">Nhân viên đóng gói</div></div>${chip('dv','Nhân viên')}</div>
    <div class="it"><div class="src s-kh" style="border-radius:22px;width:44px;height:44px">${ic('mail',{s:20})}</div><div class="fl"><div class="b">minh@email.com</div><div class="cp">Đã mời 2 ngày trước</div></div>${chip('wn','Chờ chấp nhận')}</div>
  </div>
  ${grow}${foot(btn('Mời thành viên','p','plus'))}`));

add('I04','UI-I04','Cài đặt thông báo','Cá nhân', scr(`
  ${appbar('Thông báo')}
  <div class="mt8">${grp(tgl('Tải lên lỗi hoặc cần xử lý','Luôn nên bật',1),tgl('Dung lượng sắp đầy','',1),tgl('Gói sắp hết hạn','',1),tgl('Đồng bộ hoàn tất','Không báo từng video',0))}</div>
  <div class="pad mt12 cp">Đơn Chứng không báo từng video tải thành công.</div>`));

add('I05','UI-I05','Bảo mật và dữ liệu','Cá nhân', scr(`
  ${appbar('Quyền riêng tư và dữ liệu')}
  <div class="mt8">${grp(gli('shield','Chính sách lưu trữ và xóa'),gli('file','Yêu cầu tải dữ liệu của tôi'),gli('users','Phiên và thiết bị đăng nhập'),gli('trash','Xóa tài khoản','Nút bị khóa cho đến khi đủ điều kiện'))}</div>
  <div class="pad mt12">${banner('wn','Hãy chờ tải xong video trước khi đăng xuất hoặc xóa ứng dụng.')}</div>`));

add('I06','UI-I06','Trợ giúp','Cá nhân', scr(`
  ${appbar('Trợ giúp')}
  <div class="pad"><div class="fld row g8" style="flex-direction:row;align-items:center;min-height:48px">${ic('search',{c:'#8A8F8C'})}<span class="ph">Tìm hướng dẫn</span></div></div>
  <div class="mt16">${grp(gli('box','Đóng gói đúng cách','Quay đủ từ đầu đến niêm phong'),gli('ret','Ghi hình hàng hoàn'),gli('cloud','Hiểu trạng thái tải lên'),gli('off','Mất mạng hoặc hết bộ nhớ'),gli('mail','Liên hệ và báo lỗi'))}</div>`));

add('I07','UI-I07','Thông báo (tab)','Cá nhân', scr(`
  <div class="big">Thông báo</div>
  <div class="mt4">${seg('*Tất cả','Cần xử lý')}</div>
  <div class="lst mt16">
    <div class="it">${ic('alert',{c:'var(--er)',s:28})}<div class="fl"><div class="b">Tải lên lỗi: SPX0412889</div><div class="cp">Video vẫn trên máy · 09:58</div></div><span class="dot" style="background:var(--jade)"></span></div>
    <div class="it">${ic('disk',{c:'var(--wn)',s:28})}<div class="fl"><div class="b">Dung lượng máy còn ít</div><div class="cp">Còn 210 MB · 08:30</div></div><span class="dot" style="background:var(--jade)"></span></div>
    <div class="it">${ic('check',{c:'var(--ok)',s:28})}<div class="fl"><div class="b">Đã xác minh 3 video</div><div class="cp">Hôm qua</div></div></div>
  </div>`,{tab:'notif'}));

// ---------- Ngoại lệ ----------
add('J04','UI-J04','Bộ nhớ sắp đầy','Ngoại lệ', scr(`
  ${appbar('',{close:true})}<div class="pad"><div class="card" style="height:260px"></div></div>
  ${sheet(`<div class="row g12"><div style="width:44px;height:44px;border-radius:12px;background:var(--wnb);display:flex;align-items:center;justify-content:center">${ic('disk',{c:'var(--wn)'})}</div><div class="fl"><div class="h2">Bộ nhớ sắp đầy</div><div class="cp">Còn 480 MB. Đủ quay khoảng 5 phút.</div></div></div>${btn('Giải phóng an toàn','p')}${btn('Vẫn quay','s')}`)}`));

add('J05','UI-J05','Hết bộ nhớ khi đang quay','Ngoại lệ', scr(`
  ${appbar('Phiên quay dừng',{back:false})}
  <div class="pad c" style="padding-top:12px"><div class="ill er">${ic('disk')}</div><div class="h1 mt24">Máy hết bộ nhớ khi đang quay</div><div class="bd mt8" style="color:var(--tx2)">Đoạn đã quay (01:48) được giữ lại. Phiên được ghi là chưa hoàn chỉnh.</div></div>
  <div class="pad mt16">${banner('er','Video có thể thiếu phần cuối. Hồ sơ sẽ ghi đúng điều này.')}</div>
  ${grow}${foot(btn('Giải phóng bộ nhớ','p'),btn('Xem đoạn đã lưu','s'))}`));

add('J06','UI-J06','Khôi phục sau khi app bị đóng','Ngoại lệ', scr(`
  ${appbar('',{back:false})}<div class="pad"><div class="card" style="height:260px"></div></div>
  ${dlg(`<div class="ill wn" style="width:72px;height:72px">${ic('video',{s:34})}</div><div class="h2 c">Có phiên quay chưa kết thúc</div><div class="bd c" style="color:var(--tx2)">Ứng dụng bị đóng khi đang quay đơn 250611AB3K7Q. Đã khôi phục 00:36 video.</div>${btn('Xem và lưu phần đã khôi phục','p')}${btn('Để sau','t')}`)}`));

add('J07','UI-J07','Mất mạng khi đang tải','Ngoại lệ', scr(`
  <div style="background:var(--wnb);padding:10px 16px;display:flex;gap:10px;align-items:center;color:#7A3A06;font-size:14px">${ic('off',{c:'var(--wn)',s:20})}<div><b>Mất kết nối.</b> Video vẫn an toàn trên máy.</div></div>
  <div class="big">Đồng bộ</div><div class="lst">${syncRow('2506117781204','84 MB · tạm dừng ở 38%',ev('wait'),38)}</div>
  <div class="pad mt12">${banner('in','Sẽ tự thử lại khi có mạng. Không mất lượt thử vì mất mạng.')}</div>`,{tab:'notif'}));

add('J08','UI-J08','Máy chủ nhận tệp nhưng mất phản hồi','Ngoại lệ', scr(`
  ${appbar('Đang đối soát')}
  <div class="pad c" style="padding-top:12px"><div class="ill in">${ic('refresh')}</div><div class="h1 mt24">Đang kiểm tra với máy chủ</div><div class="bd mt8" style="color:var(--tx2)">Máy chủ có thể đã nhận video nhưng chưa trả lời. Ứng dụng sẽ kiểm tra trước khi tải lại, để không tạo bản trùng.</div></div>
  <div class="pad mt16"><div class="card"><div class="kv"><span>Hồ sơ</span><span>SPX0412889</span></div><div class="kv"><span>Trạng thái</span><span>${ev('up')}</span></div></div></div>`));

add('J09','UI-J09','Mã băm không khớp','Ngoại lệ', scr(`
  ${appbar('Xác minh không khớp')}
  <div class="pad c" style="padding-top:12px"><div class="ill er">${ic('hash')}</div><div class="h1 mt24">Mã băm không khớp</div><div class="bd mt8" style="color:var(--tx2)">Tệp trên máy chủ khác tệp trên máy. Hồ sơ không được đánh dấu “Đã xác minh”.</div></div>
  <div class="pad mt16"><div class="card"><div class="kv"><span>Trên máy</span><span style="font-family:monospace">a3f9…7c21</span></div><div class="kv"><span>Máy chủ</span><span style="font-family:monospace">91be…02d4</span></div></div></div>
  ${grow}${foot(btn('Tải lại bản gốc từ máy','p','refresh'),btn('Báo lỗi cho hỗ trợ','s'))}`));

add('J10','UI-J10','Gói hết hạn','Ngoại lệ', scr(`
  ${appbar('Gói đã hết hạn')}
  <div class="pad c" style="padding-top:12px"><div class="ill wn">${ic('card')}</div><div class="h1 mt24">Gói của bạn đã hết hạn</div></div>
  <div class="pad mt16 col g12">${banner('ok','Bằng chứng hiện có vẫn xem được. Không có gì bị xóa ngầm.','check')}${banner('wn','Video mới vẫn được lưu trên máy. Tải lên sẽ tiếp tục sau khi gia hạn.')}</div>
  ${grow}${foot(btn('Xem các gói','p'))}`));

add('J11','UI-J11','Sắp xóa theo thời hạn lưu','Ngoại lệ', scr(`
  ${appbar('Sắp hết hạn lưu')}
  <div class="pad c" style="padding-top:12px"><div class="ill wn">${ic('clock')}</div><div class="h1 mt24">8 video sắp hết hạn lưu</div><div class="bd mt8" style="color:var(--tx2)">Sẽ bị xóa khỏi máy chủ sau 7 ngày. Bằng chứng đang tranh chấp được giữ lại.</div></div>
  <div class="pad mt16">${banner('in','2 video thuộc hồ sơ tranh chấp sẽ không bị xóa.','lock')}</div>
  ${grow}${foot(btn('Xuất hồ sơ trước','p','share'),btn('Xem danh sách','s'))}`));

add('J13','UI-J13','Đơn bị sửa ở thiết bị khác','Ngoại lệ', scr(`
  ${appbar('Đơn đã thay đổi')}
  <div class="pad col g12"><div class="bn wn">${ic('alert')}<div><b>Thông tin đơn đã đổi ở thiết bị khác.</b> Chọn bản muốn giữ. Cả hai đều được lưu vào lịch sử.</div></div>
    <div class="it" style="border:2px solid var(--jade)"><div class="fl"><div class="xs">Bản trên máy này</div><div class="b">Số lượng: 2</div></div><div class="rad on"></div></div>
    <div class="it"><div class="fl"><div class="xs">Bản của Thu Hà · 10:20</div><div class="b">Số lượng: 3</div></div><div class="rad"></div></div></div>
  ${grow}${foot(btn('Giữ bản đã chọn','p'))}`));

add('J15','UI-J15','Đăng xuất khi còn tệp chưa tải','Ngoại lệ', scr(`
  ${appbar('Cá nhân',{back:false})}<div class="pad"><div class="card" style="height:240px"></div></div>
  ${sheet(`<div class="h2">Đăng xuất?</div>${banner('wn','Còn <b>2 video</b> chưa tải lên. Đăng xuất có thể khiến chúng không tải được.')}${btn('Ở lại và tải lên','p')}${btn('Vẫn đăng xuất','d')}`)}`));

add('X01','—','Snackbar hoàn tác','Ngoại lệ', scr(`
  ${appbar('Hàng hoàn')}<div class="lst mt8">${orderRow('SP','250611AB3K7Q','Đã lưu','ver')}</div>
  <div class="snack"><span>Đã bỏ đơn khỏi phiên</span><b style="color:var(--scan)">HOÀN TÁC</b></div>`,{tab:'orders'}));

module.exports = S;
