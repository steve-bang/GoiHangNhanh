# platform/

Adapter mỏng cho API native/thư viện bên thứ ba (camera, máy quét mã, hệ tệp, mạng, kho khóa,
sinh ID, tải nền). `domain/` định nghĩa giao diện cần có; `platform/` hiện thực chúng, để thay
thư viện (đề xuất trong `docs/engineering/decisions.md`) mà không đụng nghiệp vụ và để mock trong test.
Chưa có mã: thêm cùng tính năng đầu tiên cần đến.
