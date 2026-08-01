# Edumin React

Link vercel: https://edumin-he-thong-quan-ly-giao-duc-re.vercel.app/

## Cách chạy

1. Mở terminal trong thư mục `edumin-react`
2. Chạy `npm install`
3. Mở terminal mới trong thư mục `edumin-react/backend`
4. Chạy `npm install`
5. Quay lại terminal thư mục `edumin-react`
6. Chạy `npm run dev`
7. Mở `http://localhost:5173`

## Backend

Backend Express + MongoDB đã được cấu hình tại `backend/server.js`.

- Cấu hình kết nối MongoDB nằm ở `backend/.env`
- Backend lắng nghe mặc định trên `http://localhost:4000`
- API auth: `GET /api/auth`, `PUT /api/auth`
- Dữ liệu người dùng, giáo viên, sinh viên, khoa, học phần, đăng ký, bài tập, tài liệu được lưu trực tiếp vào MongoDB

## Lưu ý

- Nếu sử dụng môi trường mới, đặt `VITE_API_URL` trong file `.env` ở thư mục `edumin-react` hoặc dùng giá trị mặc định `http://localhost:4000`.
