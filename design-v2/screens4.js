const L = require('./lib');
const { ic, scr, appbar, btn, chip, ev, src, banner, field, prog, pad, sec, foot, grow, sheet, dlg, gli, grp, scene, thumb } = L;
const { orderRow } = require('./screens1').helpers;
const S = [];
const add = (id, code, name, group, html) => S.push({ id, code, name, group, html });

const shield = (s = 56) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><path d="M32 4l24 8v18c0 15-10 26-24 30C18 56 8 45 8 30V12z" fill="#157852"/><path d="M32 4l24 8v18c0 15-10 26-24 30z" fill="#14382A" opacity=".18"/><path d="M21 32l8 8 15-17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const hero = (h = 200) => `<svg viewBox="0 0 358 ${h}" width="100%" height="${h}"><ellipse cx="179" cy="${h-22}" rx="150" ry="20" fill="#E6F0E9"/><circle cx="179" cy="${h/2-10}" r="${h/2-30}" fill="#E6F0E9"/>
<g transform="translate(60,${h-120})"><polygon points="0,40 70,40 80,100 -8,100" fill="#C79A5E"/><polygon points="0,40 70,40 60,26 12,26" fill="#D9AE72"/><rect x="26" y="40" width="22" height="9" fill="#C9A66B"/></g>
<g transform="translate(236,${h-96})"><polygon points="0,30 60,30 68,80 -6,80" fill="#B8864A"/><polygon points="0,30 60,30 52,18 10,18" fill="#D1A36A"/></g>
<g transform="translate(130,${h/2-68}) scale(1.6)"><path d="M32 4l24 8v18c0 15-10 26-24 30C18 56 8 45 8 30V12z" fill="#157852"/><path d="M21 32l8 8 15-17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const eye = `<div style="margin-left:auto">${ic('eye',{c:'#8A8F8C',s:22})}</div>`;
const inp = (icn, l, v, o = {}) => `<div><div class="fld ${o.f?'f':''} ${o.e?'e':''}" style="flex-direction:row;align-items:center;gap:12px">${ic(icn,{c:'#8A8F8C',s:22})}<div class="fl"><label>${l}</label>${v?`<div class="v">${v}</div>`:`<div class="ph">${o.ph||''}</div>`}</div>${o.eye?eye:''}</div>${o.err?`<div class="err">${o.err}</div>`:''}</div>`;
const social = `<div class="row g12"><div class="btn s" style="color:var(--tx);border-color:var(--line);background:#fff">Apple</div><div class="btn s" style="color:var(--tx);border-color:var(--line);background:#fff">Google</div></div>`;
const orline = (t) => `<div class="row g12 cp"><div class="fl div"></div><span>${t}</span><div class="fl div"></div></div>`;
const skel = (w, h = 14, r = 6) => `<div style="width:${w};height:${h}px;border-radius:${r}px;background:linear-gradient(90deg,#ECEAE3,#F6F4EE,#ECEAE3)"></div>`;
const skRow = () => `<div class="it">${skel('44px',44,12)}<div class="fl col g8">${skel('60%')}${skel('40%',12)}</div>${skel('64px',22,11)}</div>`;

// ---------- Vào app (bản dựng lại theo thiết kế đã duyệt) ----------
add('A01','UI-A01','Splash','Vào app & thiết lập', scr(`
  <div class="col" style="flex:1;align-items:center;justify-content:center;gap:16px;background:linear-gradient(#FAF8F2,#E6F0E9)">${shield(96)}<div style="font-size:34px;font-weight:800;color:var(--jade-d);letter-spacing:-.5px">Đơn Chứng</div><div class="cp">Bảo vệ đơn hàng – Vững bước kinh doanh</div></div>
  <div class="c cp" style="padding-bottom:60px;background:#E6F0E9">Đang chuẩn bị…</div>`));

add('A02','UI-A02','Chào mừng','Vào app & thiết lập', scr(`
  <div class="pad" style="padding-top:12px"><div class="row g8">${shield(34)}<span class="h2">Đơn chứng</span></div>
  <div style="font-size:30px;font-weight:800;letter-spacing:-.6px;line-height:1.15;margin-top:20px;color:var(--jade-d)">Bảo vệ bằng chứng<br>cho từng đơn hàng</div>
  <div class="bd mt8" style="color:var(--tx2)">Ghi hình đầy đủ · Lưu trữ rõ ràng · An tâm kinh doanh</div></div>
  <div class="pad mt16">${hero(210)}</div>
  ${grow}<div class="pad col g12">${btn('Đăng nhập','p')}${btn('Tạo tài khoản','s')}${orline('Hoặc tiếp tục với')}${social}
  <div class="xs c" style="padding-bottom:30px">Bằng việc tiếp tục, bạn đồng ý với <u>Điều khoản sử dụng</u> và <u>Chính sách quyền riêng tư</u></div></div>`));

add('A03a','UI-A03','Đăng nhập','Vào app & thiết lập', scr(`
  <div class="c" style="padding-top:8px">${shield(48)}<div class="h1 mt8" style="color:var(--jade-d)">Đơn Chứng</div></div>
  <div class="pad mt16"><div class="h1">Chào mừng bạn trở lại!</div><div class="cp mt4">Cùng Đơn Chứng bảo vệ từng đơn hàng của bạn.</div></div>
  <div class="pad col g12 mt16">${inp('mail','Email','',{ph:'shop@yourshop.com',f:true})}${inp('lock','Mật khẩu','••••••••••',{eye:1})}
  <div class="row sp"><div class="row g8"><div class="cb on">${ic('check')}</div><span class="cp">Duy trì đăng nhập</span></div><span class="cp b" style="color:var(--jade)">Quên mật khẩu?</span></div></div>
  ${grow}<div class="pad col g12">${btn('Đăng nhập','p')}${orline('Hoặc đăng nhập bằng')}${social}<div class="cp c" style="padding-bottom:30px">Bạn chưa có tài khoản? <b style="color:var(--jade)">Tạo tài khoản</b></div></div>`));

add('A03b','UI-A03','Đăng nhập — sai mật khẩu','Vào app & thiết lập', scr(`
  ${appbar('Đăng nhập')}
  <div class="pad col g12 mt8">${banner('er','Email hoặc mật khẩu chưa đúng. Hãy thử lại.')}${inp('mail','Email','lananh@minhanh.vn')}${inp('lock','Mật khẩu','••••••',{eye:1,e:1})}</div>
  ${grow}<div class="pad col g12" style="padding-bottom:30px">${btn('Đăng nhập','p')}${btn('Quên mật khẩu?','t')}</div>`));

add('A03c','UI-A03','Tạo tài khoản','Vào app & thiết lập', scr(`
  ${appbar('')}
  <div class="pad"><div style="font-size:30px;font-weight:800;letter-spacing:-.5px;line-height:1.15;color:var(--jade-d)">Tạo tài khoản<br>Đơn Chứng</div><div class="cp mt8">Bắt đầu bảo vệ đơn hàng chỉ trong vài phút.</div></div>
  <div class="pad col g12 mt16">${inp('mail','Email của bạn','',{ph:'shop@yourshop.com',f:true})}${inp('lock','Mật khẩu','',{ph:'Ít nhất 8 ký tự',eye:1})}</div>
  <div class="pad mt16">${btn('Tạo tài khoản','p')}</div>
  <div class="pad mt16">${orline('Hoặc đăng ký với')}<div class="mt12">${social}</div></div>
  ${grow}<div class="cp c" style="padding-bottom:30px">Bạn đã có tài khoản? <b style="color:var(--jade)">Đăng nhập</b></div>`));

add('A03d','UI-A03','Xác thực email','Vào app & thiết lập', scr(`
  ${appbar('Xác thực email')}
  <div class="pad c" style="padding-top:16px"><div class="ill in">${ic('mail')}</div><div class="h1 mt24">Kiểm tra hộp thư</div><div class="bd mt8" style="color:var(--tx2)">Chúng tôi đã gửi liên kết xác thực đến <b style="color:var(--tx)">lananh@minhanh.vn</b>.</div></div>
  ${grow}${foot(btn('Tôi đã xác thực','p'),btn('Gửi lại email','s'),`<div class="xs c">Không thấy email? Kiểm tra mục Spam.</div>`)}`));

add('A07','UI-A07','Quên mật khẩu','Vào app & thiết lập', scr(`
  ${appbar('Quên mật khẩu')}
  <div class="pad c" style="padding-top:8px"><div class="ill">${ic('lock')}</div><div class="h1 mt16">Đừng lo!</div><div class="bd mt4" style="color:var(--tx2)">Chỉ cần vài bước đơn giản,<br>bạn sẽ lấy lại được tài khoản.</div></div>
  <div class="pad mt24">${inp('mail','Email','',{ph:'Email đã đăng ký',f:true})}</div>
  <div class="pad mt16">${btn('Gửi mã xác nhận','p')}</div><div class="pad mt8">${btn('Quay lại đăng nhập','t')}</div>
  ${grow}<div class="pad" style="padding-bottom:30px">${banner('in','<b>Mẹo nhỏ:</b> Nếu email đã đăng ký, bạn sẽ nhận được mã. Kiểm tra cả mục Spam.','info')}</div>`));

add('A08','UI-A08','Nhập mã xác minh','Vào app & thiết lập', scr(`
  ${appbar('Nhập mã xác minh')}
  <div class="pad c" style="padding-top:8px"><div class="ill in">${ic('shield')}</div><div class="h1 mt16">Mã xác nhận đã được gửi!</div><div class="bd mt4" style="color:var(--tx2)">Nhập mã 6 chữ số gửi đến<br><b style="color:var(--tx)">l••••h@minhanh.vn</b></div></div>
  <div class="pad mt24"><div class="otp"><div style="border-color:var(--jade);border-width:2px">1</div><div>2</div><div>3</div><div></div><div></div><div></div></div></div>
  <div class="c cp mt16">Gửi lại mã sau 01:45</div><div class="c b mt8" style="color:var(--jade)">Đổi email</div>`));

add('A08b','UI-A08','Mã xác minh sai','Vào app & thiết lập', scr(`
  ${appbar('Nhập mã xác minh')}
  <div class="pad c" style="padding-top:8px"><div class="h1 mt16">Nhập mã xác minh</div></div>
  <div class="pad mt24"><div class="otp">${[4,8,1,5,0,2].map(n=>`<div style="border-color:var(--er);border-width:2px">${n}</div>`).join('')}</div><div class="err c mt8">Mã chưa đúng. Còn 2 lần thử.</div></div>
  <div class="c cp mt16">Gửi lại mã sau 00:12</div>`));

add('A09','UI-A09','Mật khẩu mới','Vào app & thiết lập', scr(`
  ${appbar('Mật khẩu mới')}
  <div class="pad c" style="padding-top:4px"><div class="ill">${ic('lock')}</div></div>
  <div class="pad mt16"><div class="h1">Tạo mật khẩu mới</div><div class="cp mt4">Vui lòng nhập mật khẩu mới cho tài khoản của bạn.</div></div>
  <div class="pad col g12 mt16">${inp('lock','Mật khẩu mới','••••••••••',{eye:1,f:1})}${inp('lock','Nhập lại mật khẩu','••••••••••',{eye:1})}
  <div class="card" style="background:var(--jade-l);border:0"><div class="cp b" style="color:var(--jade-d)">Mật khẩu nên có</div><div class="cp mt4 row g8">${ic('check',{s:16,c:'var(--ok)'})}Ít nhất 8 ký tự</div></div></div>
  ${grow}${foot(btn('Đặt lại mật khẩu','p'))}`));

add('A04','UI-A04','Tạo hồ sơ shop','Vào app & thiết lập', scr(`
  ${appbar('')}
  <div class="pad"><div class="prog"><i style="width:66%"></i></div><div class="xs mt4" style="text-align:right">Bước 2/3</div></div>
  <div class="pad mt8"><div class="h1" style="font-size:24px">Thông tin shop của bạn</div><div class="cp mt4">Giúp chúng tôi hiểu rõ hơn để phục vụ bạn tốt hơn.</div></div>
  <div class="pad col g16 mt16">${field('Tên shop *','Minh Anh Fashion',{f:1,hint:'17/50'})}
    <div><div class="cp b" style="margin-bottom:8px">Nguồn bán * <span style="font-weight:500">· Chọn các kênh đang dùng</span></div><div class="grp" style="margin:0">
      <div class="li">${src('SP')}<div class="fl b">Shopee</div><div class="cb on">${ic('check')}</div></div><div class="li">${src('TT')}<div class="fl b">TikTok Shop</div><div class="cb on">${ic('check')}</div></div><div class="li">${src('LZ')}<div class="fl b">Lazada</div><div class="cb"></div></div><div class="li">${src('KH')}<div class="fl b">Khác</div><div class="cb"></div></div></div></div></div>
  ${grow}${foot(btn('Tiếp tục','p'),btn('Bỏ qua, để sau','t'))}`));

add('A06','UI-A06','Hoàn tất thiết lập','Vào app & thiết lập', scr(`
  <div class="pad" style="padding-top:12px">${hero(190)}</div>
  <div class="pad c"><div class="h1" style="font-size:26px">Tuyệt vời!</div><div class="b mt4">Bạn đã sẵn sàng sử dụng Đơn Chứng</div><div class="cp mt8">Quét mã đơn để bắt đầu ghi hình và bảo vệ đơn hàng.</div></div>
  <div class="mt16">${grp(gli('store','Shop của bạn','Minh Anh Fashion'),gli('tag','Nguồn bán','Shopee, TikTok Shop'))}</div>
  ${grow}${foot(btn('Bắt đầu sử dụng','p'),btn('Xem hướng dẫn nhanh','t','play'))}`));

// ---------- Tài khoản: màn con ----------
add('I01b','UI-I01','Đổi họ tên','Cá nhân (màn con)', scr(`
  ${appbar('Họ và tên',{close:true})}<div class="pad mt8">${field('Họ và tên hiển thị','Nguyễn Lan Anh',{f:1,hint:'Chỉ hiển thị trong cửa hàng của bạn'})}</div>
  ${grow}${foot(btn('Lưu thay đổi','p'))}`));
add('I01c','UI-I01','Đổi mật khẩu','Cá nhân (màn con)', scr(`
  ${appbar('Đổi mật khẩu')}<div class="pad col g12 mt8">${inp('lock','Mật khẩu hiện tại','••••••••',{eye:1})}${inp('lock','Mật khẩu mới','',{ph:'Ít nhất 8 ký tự',eye:1,f:1})}${inp('lock','Nhập lại mật khẩu mới','',{eye:1,ph:'Nhập lại'})}</div>
  ${grow}${foot(btn('Cập nhật mật khẩu','p'))}`));
add('I02c','UI-I02','Sửa tên cửa hàng','Cá nhân (màn con)', scr(`
  ${appbar('Sửa tên cửa hàng',{close:true})}<div class="pad col g12 mt8">${field('Tên cửa hàng','Minh Anh Fashion',{f:1,hint:'17/50'})}${banner('in','Đổi tên không làm thay đổi lịch sử bằng chứng đã ghi.')}</div>
  ${grow}${foot(btn('Lưu','p'))}`));
add('I02d','UI-I02','Chuyển cửa hàng','Cá nhân (màn con)', scr(`
  ${appbar('Chuyển cửa hàng')}<div class="lst mt8"><div class="it" style="border:2px solid var(--jade)">${ic('store',{c:'var(--jade)'})}<div class="fl"><div class="b">Minh Anh Fashion</div><div class="cp">Đang dùng</div></div><div class="rad on"></div></div><div class="it">${ic('store',{c:'var(--tx2)'})}<div class="fl"><div class="b">Kho Hà Nội</div><div class="cp">Thành viên</div></div><div class="rad"></div></div></div>
  ${grow}${foot(btn('Xác nhận chuyển','p','check'))}`));
add('I05b','UI-I05','Dữ liệu bằng chứng','Cá nhân (màn con)', scr(`
  ${appbar('Dữ liệu bằng chứng')}<div class="pad col g12 mt8"><div class="card"><div class="kv"><span>Video trên máy</span><span>38 · 1,8 GB</span></div><div class="kv"><span>Đã tải lên máy chủ</span><span>31</span></div><div class="kv"><span>Chờ tải lên</span><span>2</span></div><div class="kv"><span>Chưa có thông tin</span><span>Số đếm nguồn máy chủ</span></div></div>${banner('in','Số liệu trên máy tính từ dữ liệu cục bộ.')}</div>`));
add('I05c','UI-I05','Thời hạn lưu','Cá nhân (màn con)', scr(`
  ${appbar('Thời hạn lưu')}<div class="pad col g12 mt8"><div class="card"><div class="h2">Chưa có thông tin gói</div><div class="cp mt8">Thời hạn lưu sẽ hiển thị khi gói dịch vụ được bật.</div></div>
  <div class="card"><div class="b">Nguyên tắc chung</div><div class="cp mt8">• Báo trước khi sắp hết hạn<br>• Bằng chứng đang tranh chấp được giữ lại<br>• Không xóa ngầm khi hạ gói</div></div></div>`));
add('I05d','UI-I05','Xóa tài khoản','Cá nhân (màn con)', scr(`
  ${appbar('Xóa tài khoản')}<div class="pad col g12 mt8">${banner('er','Xóa tài khoản không thể hoàn tác. Dữ liệu bằng chứng liên quan sẽ bị xóa theo chính sách.')}<div class="card"><div class="row g12"><div class="cb"></div><div class="fl cp">Tôi đã tải về dữ liệu cần giữ</div></div><div class="row g12 mt12"><div class="cb"></div><div class="fl cp">Không còn video chưa tải lên</div></div></div></div>
  ${grow}${foot(btn('Xóa tài khoản','dp','trash','off'),`<div class="xs c">Nút mở khi bạn đã xác nhận đủ điều kiện</div>`)}`));
add('I06b','UI-I06','Về Đơn Chứng','Cá nhân (màn con)', scr(`
  ${appbar('Về Đơn Chứng')}<div class="c" style="padding-top:24px">${shield(88)}<div class="h1 mt12">Đơn Chứng</div><div class="cp">Phiên bản 1.0.0 (1)</div></div>
  <div class="mt24">${grp(gli('file','Điều khoản sử dụng'),gli('shield','Chính sách quyền riêng tư'),gli('mail','Liên hệ hỗ trợ'))}</div>
  <div class="pad mt16 cp c">Mã băm chỉ cho biết tệp không đổi kể từ lúc tính. Không thay thế đánh giá pháp lý.</div>`));
add('H01b','UI-H01','Chi tiết gói','Gói dịch vụ', scr(`
  ${appbar('Chi tiết gói')}<div class="pad col g12 mt8"><div class="card"><div class="kv"><span>Tên gói</span><span>Chưa có thông tin</span></div><div class="kv"><span>Hạn lưu</span><span>Chưa có thông tin</span></div><div class="kv"><span>Dung lượng</span><span>Chưa có thông tin</span></div></div></div>`));
add('H01c','UI-H01','Lịch sử thanh toán','Gói dịch vụ', scr(`
  ${appbar('Lịch sử thanh toán')}<div class="pad col" style="align-items:center;text-align:center;margin-top:90px"><div class="ill in">${ic('card')}</div><div class="h1 mt24">Chưa có thanh toán</div><div class="bd mt8" style="color:var(--tx2);max-width:260px">Các khoản thanh toán sẽ hiện ở đây.</div></div>`));

// ---------- Đơn: sửa, trạng thái tải ----------
add('E02b','UI-E02','Sửa thông tin đơn','Đơn hàng (bổ sung)', scr(`
  ${appbar('Sửa thông tin đơn',{close:true})}<div class="pad col g16 mt8">${field('Mã đơn','250611AB3K7Q')}<div><div class="cp b" style="margin-bottom:8px">Nguồn bán</div><div class="row g8 wrap"><span class="fc on">Shopee</span><span class="fc">TikTok Shop</span><span class="fc">Lazada</span><span class="fc">Khác</span></div></div>${field('Sản phẩm','Áo sơ mi nữ cổ tròn',{f:1})}${banner('in','Chỉ sửa được khi đơn chưa có phiên quay. Mọi thay đổi đều lưu lịch sử.')}</div>
  ${grow}${foot(btn('Lưu thay đổi','p'))}`));
add('E02c','UI-E02','Không sửa được — đơn đã có phiên','Đơn hàng (bổ sung)', scr(`
  ${appbar('Chi tiết đơn')}<div class="pad"><div class="card" style="height:220px"></div></div>
  ${dlg(`<div class="h2">Chưa sửa được đơn này</div><div class="bd" style="color:var(--tx2)">Đơn đã có video. Để giữ nguyên bằng chứng, thông tin đơn không được sửa.</div>${btn('Đã hiểu','p')}`)}`));
add('E01d','UI-E01','Đang tải danh sách','Đơn hàng (bổ sung)', scr(`
  <div class="big">Đơn hàng</div><div class="pad">${skel('100%',48,12)}</div><div class="chips mt12">${skel('70px',36,18)}${skel('110px',36,18)}${skel('100px',36,18)}</div>
  <div class="lst mt16">${skRow()}${skRow()}${skRow()}${skRow()}${skRow()}</div>`,{tab:'orders'}));
add('E01e','UI-E01','Lỗi tải danh sách','Đơn hàng (bổ sung)', scr(`
  <div class="big">Đơn hàng</div><div class="pad col" style="align-items:center;text-align:center;margin-top:80px"><div class="ill er">${ic('off')}</div><div class="h1 mt24">Chưa tải được danh sách</div><div class="bd mt8" style="color:var(--tx2);max-width:270px">Kiểm tra kết nối rồi thử lại. Dữ liệu trên máy không bị mất.</div><div style="width:200px;margin-top:24px">${btn('Thử lại','p','refresh')}</div></div>`,{tab:'orders'}));
add('E01f','UI-E01','Bộ lọc','Đơn hàng (bổ sung)', scr(`
  <div class="big">Đơn hàng</div><div class="lst">${orderRow('SP','250611AB3K7Q','10:12 · 1 video','ver')}</div>
  ${sheet(`<div class="row sp"><div class="h2">Bộ lọc</div><span class="cp b" style="color:var(--jade)">Xóa hết</span></div>
  <div><div class="cp b" style="margin-bottom:8px">Nguồn bán</div><div class="row g8 wrap"><span class="fc on">Shopee</span><span class="fc">TikTok Shop</span><span class="fc">Lazada</span><span class="fc">Khác</span></div></div>
  <div><div class="cp b" style="margin-bottom:8px">Trạng thái bằng chứng</div><div class="row g8 wrap"><span class="fc on">Chờ tải lên</span><span class="fc">Đang tải</span><span class="fc">Đã xác minh</span><span class="fc">Lỗi</span><span class="fc">Chưa có video</span></div></div>
  <div><div class="cp b" style="margin-bottom:8px">Thời gian</div><div class="row g8 wrap"><span class="fc">Hôm nay</span><span class="fc on">7 ngày</span><span class="fc">30 ngày</span><span class="fc">Tùy chọn</span></div></div>${btn('Xem 14 đơn','p')}`)}`,{tab:'orders'}));
add('B01b','UI-B01','Trang chủ — mới dùng, chưa có đơn','Đóng gói', scr(`
  <div class="row sp pad" style="height:56px"><div><div class="xs">Cửa hàng</div><div class="h2">Minh Anh Fashion</div></div><div style="width:40px;height:40px;border-radius:20px;background:var(--jade-l);color:var(--jade-d);display:flex;align-items:center;justify-content:center;font-weight:800">LA</div></div>
  <div class="pad col g12 mt16"><div class="btn p" style="min-height:84px;border-radius:18px;justify-content:flex-start;padding:0 20px;gap:16px;font-size:20px">${ic('box',{s:34,c:'#fff'})}<div style="text-align:left"><div>Đóng gói đơn</div><div style="font-size:13px;font-weight:500;opacity:.85">Quét mã rồi quay video</div></div></div><div class="btn" style="min-height:68px;border-radius:18px;justify-content:flex-start;padding:0 20px;gap:16px;font-size:17px">${ic('ret',{s:28})}Nhận hàng hoàn</div></div>
  <div class="pad mt24"><div class="card c"><div class="b">Bắt đầu với đơn đầu tiên</div><div class="cp mt4">Quét mã đơn, quay video đóng gói, rồi lưu. Mất khoảng 1 phút.</div></div></div>`,{tab:'home'}));

module.exports = S;
