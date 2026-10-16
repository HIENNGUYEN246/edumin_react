# Edumin API

Base URL: `http://localhost:4000/api`

## Conventions

- **Auth:** send `Authorization: Bearer <token>`. Tokens come from `POST /auth/login`.
- **Roles:** `dao-tao` (admin/đào tạo), `giao-vien` (teacher), `sinh-vien` (student).
- **List responses:** `{ data: [...], meta: { page, limit, total } }`.
- **List query params:** `page`, `limit`, `search`, `sort`.
- **Errors:** `{ "error": { "code": string, "message": string, "details?": [...] } }`.
  - Common codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
    `NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), `LOCKED` (423), `CONFLICT` / `DUPLICATE_KEY` (409).

## Health

| Method | Path          | Auth | Description        |
| ------ | ------------- | ---- | ------------------ |
| GET    | `/api/health` | none | Liveness/uptime.   |

## Auth (`/auth`)

| Method | Path                 | Auth        | Description                                                        |
| ------ | -------------------- | ----------- | ------------------------------------------------------------------ |
| POST   | `/auth/login`        | none        | `{ email, password }` → `{ token, user, profile }`. Rate limited.  |
| GET    | `/auth/me`           | any         | Current user + role profile (never includes the password hash).    |
| PATCH  | `/auth/me/password`  | any         | `{ oldPassword, newPassword }` → `{ token }`. Revokes old tokens.  |

Notes:

- Passwords are stored as bcrypt hashes and never returned to the client.
- Changing a password / locking / resetting bumps `tokenVersion`, which immediately
  invalidates any previously issued JWT.

## Departments (`/departments`)

| Method | Path                | Auth  | Description                                                  |
| ------ | ------------------- | ----- | ------------------------------------------------------------ |
| GET    | `/departments`      | any   | Paginated list. Query: `page`, `limit`, `search`, `sort`.    |
| GET    | `/departments/:id`  | any   | Single department by Mongo `_id`.                            |
| POST   | `/departments`      | admin | `{ id, name, head? }` → created department. 409 on dup `id`. |
| PATCH  | `/departments/:id`  | admin | `{ name?, head? }` → updated department.                     |
| DELETE | `/departments/:id`  | admin | Deletes and detaches references in a transaction.            |

Deleting a department clears `departmentRef` on teachers, students and courses
(within one transaction), so the frontend shows "Chưa xác định" for them.

## Teachers (`/teachers`)

| Method | Path                     | Auth  | Description                                                        |
| ------ | ------------------------ | ----- | ------------------------------------------------------------------ |
| GET    | `/teachers`              | any   | Paginated list (`page`, `limit`, `search`, `sort`).                |
| GET    | `/teachers/:id`          | any   | Single teacher.                                                    |
| POST   | `/teachers`              | admin | Create teacher + account in one transaction. `password?` optional. |
| PATCH  | `/teachers/:id`          | admin | Update profile; syncs account display name.                        |
| PUT    | `/teachers/:id/avatar`   | admin | `multipart/form-data` field `file` (image). Uploads to Cloudinary. |
| POST   | `/teachers/import`       | admin | `{ rows: [...] }` → `{ created, failed: [{ row, email, message }] }`. |
| DELETE | `/teachers/:id`          | admin | Deletes teacher + account; clears any department head reference.   |

- Numeric `id` is assigned by an atomic counter and shown as `GV-00x`.
- Avatars/documents are stored on Cloudinary; Mongo keeps only metadata
  (`publicId`, `url`, `resourceType`, `bytes`, `format`).
- Department `head` (set via `PATCH /departments/:id` with a teacher `_id`) is
  cleared automatically when that teacher is deleted.

## Students (`/students`)

| Method | Path                    | Auth          | Description                                          |
| ------ | ----------------------- | ------------- | ---------------------------------------------------- |
| GET    | `/students`             | admin/teacher | Paginated list.                                     |
| GET    | `/students/:id`         | admin/teacher | Single student.                                     |
| POST   | `/students`             | admin         | Create student + account (transaction).             |
| PATCH  | `/students/:id`         | admin         | Update profile.                                     |
| PUT    | `/students/:id/avatar`  | admin         | Upload avatar (multipart `file`).                   |
| POST   | `/students/import`      | admin         | Bulk import; per-row error report.                  |
| DELETE | `/students/:id`         | admin         | Delete student + account + enrollments (transaction).|

## Self-registration (public, under `/auth`)

| Method | Path                         | Auth | Description                                                     |
| ------ | ---------------------------- | ---- | --------------------------------------------------------------- |
| GET    | `/auth/registration-options` | none | `{ departments: [{ id, name }] }` for the register form.        |
| POST   | `/auth/register`             | none | `{ hoTen, email, password, departmentId, className? }` → `{ token, user, profile }`. Rate limited. |

## Accounts (`/accounts`, admin only)

| Method | Path                            | Description                                                       |
| ------ | ------------------------------- | ----------------------------------------------------------------- |
| GET    | `/accounts?role=`               | List accounts (populates profile). No password hash returned.     |
| PATCH  | `/accounts/:id/status`          | `{ status: 'Active'\|'Locked', lockReason? }`. Locking bumps `tokenVersion`. |
| POST   | `/accounts/:id/reset-password`  | Returns `{ tempPassword }` once. Bumps `tokenVersion`.            |
| DELETE | `/accounts/:id`                 | Deletes account + profile + avatar + enrollments (transaction).   |

- Admins cannot lock or delete their own account.
- Locking or resetting a password revokes the target's active JWTs immediately.

## Courses (`/courses`)

| Method | Path               | Auth  | Description                                          |
| ------ | ------------------ | ----- | ---------------------------------------------------- |
| GET    | `/courses`         | any   | Paginated list.                                     |
| GET    | `/courses/:id`     | any   | Single course.                                      |
| POST   | `/courses`         | admin | `{ id, name, credits?, fee?, departmentId? }`. 409 on dup id. |
| PATCH  | `/courses/:id`     | admin | Update; re-resolves department from `departmentId`.  |
| POST   | `/courses/import`  | admin | Bulk import; per-row error report.                  |
| DELETE | `/courses/:id`     | admin | 409 if the course has opened classes.               |

## Course classes (`/classes`)

| Method | Path              | Auth  | Description                                                          |
| ------ | ----------------- | ----- | -------------------------------------------------------------------- |
| GET    | `/classes/open`             | any           | Classes with status `Đang mở` (students). Includes `enrolledCount`/`capacity`. |
| GET    | `/classes/by-course/:courseId` | admin/teacher | All classes of a course with `enrolledCount`/`capacity` (course-detail page). |
| GET    | `/classes`                  | any           | Paginated list. `?teacher=me` scopes to the caller (teacher); `?courseId`, `?status`. |
| GET    | `/classes/:id`              | any           | Single class.                                                       |
| GET    | `/classes/:id/students`     | admin/teacher | Enrolled students (teacher: own class only).                        |
| POST   | `/classes`                  | admin         | Create; 409 on teacher/room schedule conflict.                      |
| PATCH  | `/classes/:id`              | admin         | Update; re-checks conflicts.                                        |
| PATCH  | `/classes/:id/status`       | admin         | `{ status }` → change lifecycle only.                               |
| DELETE | `/classes/:id`              | admin         | Delete class + its enrollments (transaction).                        |

- **Status lifecycle:** `Nháp` (draft, hidden) → `Đang mở` (open) → `Đã đóng` / `Đã hủy`.
  A class is available to students purely by its `Đang mở` status (no separate
  registration time window).
- **Capacity:** `capacity` (0 = unlimited). Enrollment is rejected when `enrolledCount >= capacity`.
- **Conflict rule:** two classes clash if they share a day+shift slot, their study
  periods overlap, and they share the same teacher or room (`Đã hủy` classes are ignored).
  Slots use `dayId` ∈ {2..7, CN} and `shiftId` ∈ {S1,S2,C1,C2,T1}.

Enrollment rules (student): the class must be `Đang mở`, cannot enroll twice in the
same class, cannot take two classes of the same course (one class per course),
cannot exceed capacity, and cannot clash with an already-enrolled slot. A student
can self-cancel only while the class is still `Đang mở`.

## Enrollments (`/enrollments`, student only)

| Method | Path                    | Description                                                        |
| ------ | ----------------------- | ------------------------------------------------------------------ |
| GET    | `/enrollments/me`       | The caller's enrollments with the class object attached.           |
| POST   | `/enrollments`          | `{ classId }`. Checks window, duplicate, and schedule clash.       |
| DELETE | `/enrollments/:classId` | Cancel. Allowed until the registration window closes; works even if the class was deleted. |

- Unique index on `(student, classRef)` prevents double enrollment under races.

## Teacher self views

| Method | Path                     | Auth          | Description                                             |
| ------ | ------------------------ | ------------- | ------------------------------------------------------- |
| GET    | `/teachers/me`           | teacher       | The caller's teacher profile.                          |
| GET    | `/classes?teacher=me`    | teacher       | Classes the caller teaches.                            |
| GET    | `/classes/:id/students`  | admin/teacher | Enrolled students. Teachers may only view their own class. |

## Documents (`/documents`)

| Method | Path                      | Auth          | Description                                                       |
| ------ | ------------------------- | ------------- | ----------------------------------------------------------------- |
| GET    | `/documents?courseId=`    | any           | List documents (students see only `Công khai`). File meta stripped.|
| POST   | `/documents`              | admin/teacher | `multipart` `file` + `courseId`, `name?`, `status?`. Teacher must teach the course. |
| PATCH  | `/documents/:id`          | admin/teacher | `{ name?, status? }`.                                             |
| DELETE | `/documents/:id`          | admin/teacher | Deletes DB row + Cloudinary asset.                               |
| GET    | `/documents/:id/download` | any           | Returns a short-lived signed URL after checking course access.    |

- Files are uploaded to Cloudinary as `type: authenticated`; the client never
  receives the `publicId`, only a signed URL via `/download`.
- Course access: admin always; teacher if they teach a class of the course;
  student if enrolled in a class of the course (`modules/shared/courseAccess.js`).

## Assignments & quizzes (`/assignments`)

| Method | Path                            | Auth          | Description                                                    |
| ------ | ------------------------------- | ------------- | -------------------------------------------------------------- |
| GET    | `/assignments?courseId=`        | any           | List. Students receive an answer-stripped DTO (no `correctIndex`). |
| GET    | `/assignments/:id`              | any           | Single assignment. Students: answer-stripped, requires enrollment. |
| POST   | `/assignments`                  | admin/teacher | Create file/quiz assignment. Teacher must teach the course.    |
| PATCH  | `/assignments/:id`              | admin/teacher | Update fields/questions.                                       |
| DELETE | `/assignments/:id`              | admin/teacher | Delete assignment + its submissions.                           |
| GET    | `/assignments/:id/submissions`  | admin/teacher | All submissions (course teacher/admin only).                   |
| POST   | `/assignments/:id/submissions`  | student       | `{ answers }` → `{ score, correctCount, total, answerKey }`. Grades 0-10. |
| GET    | `/assignments/:id/my-submission`| student       | The student's own submission + answer key (for review).        |

Security: the answer key (`correctIndex`) is only returned to a student **after**
they submit (or via `my-submission` once a submission exists). It is never in the
listing DTO. Enrollment is required to submit; past-due quizzes return 409;
re-submission overwrites the prior attempt (unique index on `assignment+student`).

## Stats & profile

| Method | Path              | Auth    | Description                                            |
| ------ | ----------------- | ------- | ------------------------------------------------------ |
| GET    | `/stats/overview` | admin   | Dashboard counts (teachers, students, courses, etc.).  |
| PUT    | `/auth/me/avatar` | teacher/student | `multipart` `file` (image) → updates own avatar. |
