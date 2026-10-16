# Edumin

Hệ thống quản lý đào tạo gồm hai package độc lập:

```text
edumin_react/
├── frontend/   # React 18 + Vite + Tailwind + TanStack Query
├── backend/    # Express + Mongoose (REST API, JWT, Cloudinary)
├── docs/       # API.md, MIGRATION.md
└── README.md
```

Ba vai trò: **Phòng đào tạo** (`dao-tao`), **Giáo viên** (`giao-vien`),
**Sinh viên** (`sinh-vien`).

## Yêu cầu

- Node.js 18+
- MongoDB (khuyến nghị Atlas hoặc replica set để dùng transaction)
- Tài khoản Cloudinary (cho ảnh đại diện và tài liệu)

## Cài đặt

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Cấu hình môi trường

**backend/.env** (mẫu ở `backend/.env.example`):

| Biến | Ý nghĩa |
| --- | --- |
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | Cổng API (mặc định 4000) |
| `MONGO_URI` | Chuỗi kết nối MongoDB (nên kèm tên DB, vd `/edumin`) |
| `JWT_SECRET` | Chuỗi bí mật ký JWT (bắt buộc đặt mạnh khi production) |
| `JWT_EXPIRES_IN` | Thời hạn token, vd `8h` |
| `CLIENT_ORIGIN` | Origin của frontend cho CORS |
| `UPLOAD_MAX_MB` | Giới hạn dung lượng tệp tải lên |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_FOLDER` | Cấu hình Cloudinary |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Tài khoản admin do script seed tạo |

**frontend/.env** (mẫu ở `frontend/.env.example`):

| Biến | Ý nghĩa |
| --- | --- |
| `VITE_API_URL` | URL gốc của backend, vd `http://localhost:4000` |

> Lưu ý Cloudinary: tài khoản miễn phí cần bật **"Allow delivery of PDF and ZIP
> files"** trong Settings → Security để link tải tài liệu hoạt động.

## Khởi tạo dữ liệu

Script seed **xóa sạch** database rồi tạo admin + dữ liệu mẫu (khoa, giáo viên,
sinh viên, học phần, một lớp đang mở và một đăng ký).

```bash
npm run seed                 # từ thư mục gốc
# hoặc: cd backend && npm run seed
# npm run seed -- --minimal  # chỉ admin + 3 khoa, không có dữ liệu mẫu
```

Sau khi seed, đăng nhập admin bằng `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
Giáo viên và sinh viên mẫu dùng mật khẩu in ra ở cuối log seed.

## Chạy dự án

Mở hai terminal tại thư mục gốc:

```bash
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

## Kiểm thử và lint

```bash
npm run test:backend   # Vitest + Supertest + Mongo in-memory (không đụng Atlas)
npm run test:frontend  # Vitest + Testing Library + MSW
npm run lint:backend
npm run lint:frontend
```

## Kiến trúc

- **Backend** module hóa theo tài nguyên trong `backend/src/modules/*`
  (`auth`, `accounts`, `departments`, `teachers`, `students`, `courses`,
  `classes`, `enrollments`, `documents`, `assignments`, `stats`). Mỗi module có
  `model`, `schema` (zod), `service`, `controller`, `routes`.
- **Xác thực**: mật khẩu hash bằng bcrypt, phiên đăng nhập dùng JWT. `tokenVersion`
  cho phép thu hồi token cũ ngay khi đổi mật khẩu / khóa / reset. FE không bao giờ
  nhận field mật khẩu.
- **Tệp**: avatar và tài liệu lưu trên Cloudinary; Mongo chỉ giữ metadata.
- **Frontend** tổ chức theo `app` (providers, router), `api`, `features`,
  `components`, `lib`. Dữ liệu server quản lý bằng TanStack Query.

## Tài liệu

- `docs/API.md` — danh sách endpoint theo module kèm quyền truy cập.
- `docs/MIGRATION.md` — hệ thống trước/sau khi refactor và các vấn đề đã xử lý.
