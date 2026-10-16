# Edumin — Tổng quan Migration

Tài liệu ngắn gọn cho người mới: hệ thống **trước** khi refactor có vấn đề gì và
**sau** khi refactor đã xử lý ra sao.

## Mục lục

- [Hệ thống là gì](#hệ-thống-là-gì)
- [Trước migrate — các vấn đề](#trước-migrate--các-vấn-đề)
- [Sau migrate — đã xử lý](#sau-migrate--đã-xử-lý)
- [Bảng tra nhanh: Vấn đề → Cách xử lý](#bảng-tra-nhanh-vấn-đề--cách-xử-lý)
- [Cách chạy](#cách-chạy)

## Hệ thống là gì

Edumin là hệ thống quản lý đào tạo cho ba vai trò: **phòng đào tạo** (admin),
**giáo viên**, **sinh viên**. Nó quản lý khoa, giáo viên, sinh viên, học phần,
lớp mở đăng ký, đăng ký học của sinh viên, thời khóa biểu, tài liệu và bài
tập/quiz.

| | Trước | Sau |
| --- | --- | --- |
| Frontend | React + Vite + `sweetalert2` + `xlsx`, không có state layer | React + Vite + **TanStack Query**, component/hook dùng chung |
| Backend | Express + Mongoose, 1 file route ~1100 dòng | Express + Mongoose **module hóa theo tài nguyên** + zod |
| Xác thực | Mật khẩu plaintext, session trong RAM | **bcrypt + JWT** với `tokenVersion` thu hồi token |
| Lưu tệp | base64 trong MongoDB | **Cloudinary**, Mongo chỉ giữ metadata |
| Kiểm thử | chỉ `node --check` | **Vitest** (BE: Supertest + Mongo in-memory; FE: Testing Library + MSW) |

## Trước migrate — các vấn đề

**Bảo mật**

- `GET/PUT /api/auth` và `PUT /api/auth/collections` **không kiểm tra đăng nhập**:
  bất kỳ ai cũng tải về hoặc ghi đè toàn bộ database.
- `GET` trả về cả **mật khẩu dạng plaintext** của mọi tài khoản.
- Mật khẩu được **so sánh ở phía client** và lưu trong `sessionStorage`; mật khẩu
  mặc định là `'123'`.
- Sinh viên nhận được **đáp án đúng của quiz** ngay trong dữ liệu API, có thể xem
  trước khi nộp.

**Kiến trúc**

- Một file route ~1100 dòng gộp seed, migration, mapping dữ liệu, auth, đăng ký và
  quiz.
- Code chết: `controllers/authController.js`, `services/authService.js` (bản sao,
  không dùng); controller còn bị dán lẫn nội dung một route file.
- Bug thật: gán lại một biến `const` trong `prepareDocumentsForModel` gây
  TypeError khi thiếu `regId`.
- Session lưu trong `Map` ở RAM → mất hết khi khởi động lại server.

**Hiệu năng**

- Mỗi lần mở trang tải **toàn bộ database** (kể cả tài liệu base64).
- Sửa một trường cũng **ghi lại nguyên mảng** của collection (xóa hết rồi chèn
  lại phía server).
- Không lazy-load route; `xlsx` bị gộp vào bundle chính; có heartbeat 5 giây ghi
  `localStorage` mà không ai đọc.

**Chất lượng**

- Trùng lặp nặng: hai trang quản lý giáo viên/sinh viên gần giống nhau, hai trang
  tài khoản, hai hook khóa tài khoản; luồng đổi mật khẩu lặp 5 lần, logout ~8 lần.
- Ba hệ thống thông báo song song (toast tự viết, `sweetalert2`, `alert`).
- Thiếu dependency trong `useEffect`, `setTimeout` không cleanup, import vòng.
- Không có test, ESLint hay Prettier.

## Sau migrate — đã xử lý

**Bảo mật**

- Mọi endpoint dữ liệu đều qua middleware `authenticate` + `authorize(role)`.
- Mật khẩu **hash bằng bcrypt**, trường `passwordHash` đặt `select: false` nên
  không bao giờ rời khỏi server. Đổi mật khẩu kiểm tra ở server.
- **JWT** kèm `tokenVersion`; đổi mật khẩu / khóa / reset sẽ tăng version và vô
  hiệu token cũ ngay ở request kế tiếp.
- Quiz: server trả cho sinh viên bản DTO **đã bỏ `correctIndex`**; đáp án chỉ trả
  về **sau khi nộp**. Chấm điểm ở server theo thang 10.

**Kiến trúc**

- Backend chia thành module theo tài nguyên trong `backend/src/modules/*`, mỗi
  module có `model`, `schema` (zod), `service`, `controller`, `routes`.
- Lỗi trả về theo một định dạng chung `{ error: { code, message, details? } }`.
- MongoDB Atlas là replica set → dùng **transaction** cho thao tác ghi nhiều
  collection (tạo tài khoản kèm hồ sơ, xóa khoa/tài khoản kéo theo tham chiếu).
- Quan hệ dùng ObjectId + populate; xóa khoa đặt tham chiếu về `null` và FE hiển
  thị "Chưa xác định".

**Hiệu năng**

- FE gọi API **theo từng tài nguyên**, có phân trang, tìm kiếm, sắp xếp. TanStack
  Query lo cache, dedupe và invalidate — thay cho cache tự viết và các
  `CustomEvent`.
- Tệp lưu trên **Cloudinary**; API danh sách không trả nội dung tệp; tải tài liệu
  qua **signed URL** có hạn và kiểm tra quyền.
- Route **lazy-load** + `React.lazy`/`Suspense`; Vite `manualChunks` tách vendor;
  `xlsx` chỉ tải động từ CDN khi người dùng import/export.

**Chất lượng**

- Dùng chung: `AppLayout` + sidebar theo vai trò, `PersonManager` cho giáo
  viên/sinh viên, `AccountManager` cho hai trang tài khoản, `ScheduleGrid` cho
  thời khóa biểu, một `ToastProvider` và một `ConfirmProvider` duy nhất.
- ESLint + Prettier + Vitest cho cả hai phía; backend có ~83 test.

## Bảng tra nhanh: Vấn đề → Cách xử lý

| Vấn đề trước đây | Cách xử lý sau migrate |
| --- | --- |
| API không xác thực, ai cũng dump/ghi đè DB | `authenticate` + `authorize(role)` trên mọi route dữ liệu |
| Mật khẩu plaintext, lưu ở client | bcrypt hash, `passwordHash` `select:false`, kiểm tra ở server |
| Session trong RAM, mất khi restart | JWT stateless + `tokenVersion` để thu hồi |
| Lộ đáp án quiz | DTO bỏ `correctIndex`, chỉ trả sau khi nộp |
| Route 1100 dòng, code chết, bug `const` | Module hóa theo tài nguyên, xóa code chết |
| Tải cả DB mỗi lần mở trang | REST theo tài nguyên + TanStack Query cache |
| Ghi lại nguyên mảng collection | CRUD từng bản ghi có validate |
| File base64 phình DB | Cloudinary + metadata + signed URL |
| xlsx trong bundle, không lazy route | manualChunks + lazy route + xlsx động từ CDN |
| Trùng lặp trang/hook, 3 kiểu thông báo | Component/hook dùng chung, 1 toast + 1 confirm |
| Reset mật khẩu luôn là '123' | Mật khẩu tạm ngẫu nhiên, hiển thị một lần cho admin |
| Không test/lint | Vitest + ESLint + Prettier |

## Cách chạy

```bash
# 1) Cài đặt
cd backend && npm install
cd ../frontend && npm install

# 2) Cấu hình
#   - backend/.env  (xem backend/.env.example): MONGO_URI, JWT_SECRET,
#     CLIENT_ORIGIN, CLOUDINARY_*, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
#   - frontend/.env: VITE_API_URL=http://localhost:4000

# 3) Khởi tạo dữ liệu (XÓA SẠCH DB rồi tạo admin + dữ liệu mẫu)
npm run seed            # từ thư mục gốc

# 4) Chạy (hai terminal)
npm run dev:backend     # http://localhost:4000
npm run dev:frontend    # http://localhost:5173

# 5) Kiểm thử
npm run test:backend
npm run test:frontend
```

**Lưu ý Cloudinary:** tài khoản miễn phí cần bật *"Allow delivery of PDF and ZIP
files"* trong Settings → Security, nếu không link tải tài liệu sẽ trả lỗi 401.

Chi tiết endpoint xem [docs/API.md](./API.md).
