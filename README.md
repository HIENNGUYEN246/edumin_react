# Edumin React

Hệ thống quản lý giáo dục gồm hai package độc lập:

```text
edumin-react/
├── frontend/       # React + Vite + Tailwind
├── backend/        # Express + MongoDB
├── docs/           # Tài liệu kỹ thuật dùng chung
└── README.md       # Tài liệu dùng chung
```

## Cài đặt

Chạy một lần trong mỗi package:

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Chạy dự án

Mở hai terminal tại thư mục `edumin-react`:

```bash
npm run dev:backend
npm run dev:frontend
```

Frontend chạy tại `http://localhost:5173`, backend chạy tại `http://localhost:4000`.

Có thể chạy trực tiếp trong từng package:

```bash
cd frontend && npm run dev
cd backend && npm run dev
```

## Frontend

- Mã React nằm trong `frontend/src`.
- Tài nguyên tĩnh nằm trong `frontend/public`.
- Biến môi trường frontend nằm trong `frontend/.env` với `VITE_API_URL`; file mẫu là `frontend/.env.example`.

## Backend

- Entry point: `backend/server.js`.
- API route nằm trong `backend/routes`.
- Model MongoDB nằm trong `backend/models`.
- Middleware dùng chung nằm trong `backend/middleware`.
- Script kiểm tra DB nằm trong `backend/scripts`.
- Script test thủ công nằm trong `backend/tests`.
- Cấu hình MongoDB nằm trong `backend/.env`; file mẫu là `backend/.env.example`.

## Tài liệu

- Hướng dẫn sử dụng API nằm trong `docs/API_USAGE_GUIDE.md`.
- Các script trong `backend/tests` là integration test thủ công, có thể thay đổi dữ liệu MongoDB. Chỉ chạy `npm run test:integration` khi backend và MongoDB đang sẵn sàng.

Backend cung cấp API auth và các API cho người dùng, giáo viên, sinh viên, khoa, học phần, đăng ký, bài tập và tài liệu.
