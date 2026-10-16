import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { User } from '../src/modules/auth/user.model.js';

vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({ publicId: 'p', url: 'u', resourceType: 'image', bytes: 1, format: 'png', access: 'public' })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'signed'),
}));

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
});

describe('Students CRUD', () => {
  it('creates a student with SV counter id', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        hoTen: 'Trần B',
        email: 'sv1@edu.vn',
        departmentId: 'CNTT',
        className: 'CNTT-K18',
        dob: '2005-06-15',
        phone: '0901234567',
        address: 'Quận 3, TP.HCM',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.className).toBe('CNTT-K18');
  });

  it('rejects invalid student fields', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({
        hoTen: 'Sinh  Viên',
        email: 'student@gmail.com',
        dob: '2030-01-01',
        phone: '1234567890',
        address: 'Quận 3, TP.HCM',
        className: 'CNTT-K18',
        departmentId: 'CNTT',
      });
    expect(res.status).toBe(400);
    expect(await Student.countDocuments()).toBe(0);
  });

  it('imports the MaSV/HoTen/NgaySinh student template', async () => {
    await Department.create({ id: 'CNTT', name: 'Khoa Công Nghệ Thông Tin' });
    const res = await request(app)
      .post('/api/students/import')
      .set(authHeader(adminToken))
      .send({ rows: [
        {
          MaSV: 4,
          HoTen: 'Hoàng Anh Dũng',
          NgaySinh: '05/12/2003',
          GioiTinh: 'Nam',
          SDT: 983445566,
          Email: 'dung@student.edu.vn',
          DiaChi: 'Hải Phòng',
          Khoa: 'Khoa Công Nghệ Thông Tin',
          Lop: '12DHTH13',
        },
      ] });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(0);
    const student = await Student.findOne({ email: 'dung@student.edu.vn' });
    expect(student).toMatchObject({
      id: 4,
      hoTen: 'Hoàng Anh Dũng',
      dob: '2003-12-05',
      phone: '0983445566',
      address: 'Hải Phòng',
      department: 'Khoa Công Nghệ Thông Tin',
      className: '12DHTH13',
    });
  });

  it('lets a teacher read but not create students', async () => {
    const { token } = await createUser({ role: ROLES.TEACHER });
    const list = await request(app).get('/api/students').set(authHeader(token));
    expect(list.status).toBe(200);
    const create = await request(app).post('/api/students').set(authHeader(token)).send({ hoTen: 'X', email: 'x@edu.vn' });
    expect(create.status).toBe(403);
  });
});

describe('Student self-registration', () => {
  it('lists registration options (public)', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app).get('/api/auth/registration-options');
    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(1);
  });

  it('registers a student and returns a working token', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ hoTen: 'Sinh Viên Mới', email: 'new@edu.vn', password: 'Passw0rd', departmentId: 'CNTT' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe(ROLES.STUDENT);

    const me = await request(app).get('/api/auth/me').set(authHeader(res.body.token));
    expect(me.status).toBe(200);
    expect(me.body.profile.hoTen).toBe('Sinh Viên Mới');
  });

  it('rejects duplicate email on register (no orphan)', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    await createUser({ email: 'dup@edu.vn' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ hoTen: 'Trùng', email: 'dup@edu.vn', password: 'Passw0rd', departmentId: 'CNTT' });
    expect(res.status).toBe(409);
    expect(await Student.countDocuments()).toBe(0);
  });

  it('rejects an unknown department', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ hoTen: 'Không Khoa', email: 'nk@edu.vn', password: 'Passw0rd', departmentId: 'ZZZ' });
    expect(res.status).toBe(400);
  });

  it('bulk deletes students by ids', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const s1 = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ hoTen: 'SV Một', email: 'sv1@edu.vn', departmentId: 'CNTT', className: 'K1', dob: '2005-01-01', phone: '0901234567', address: 'Q1' });
    const s2 = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ hoTen: 'SV Hai', email: 'sv2@edu.vn', departmentId: 'CNTT', className: 'K1', dob: '2005-01-01', phone: '0901234568', address: 'Q2' });
    expect(await Student.countDocuments()).toBe(2);

    const res = await request(app)
      .post('/api/students/bulk-delete')
      .set(authHeader(adminToken))
      .send({ ids: [s1.body._id, s2.body._id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBe(2);
    expect(await Student.countDocuments()).toBe(0);
    expect(await User.countDocuments({ email: { $in: ['sv1@edu.vn', 'sv2@edu.vn'] } })).toBe(0);
  });
});

describe('Student avatar update & ID validation', () => {
  it('updates avatar with valid ObjectId', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const createRes = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Student Avatar', email: 'avatar@edu.vn', departmentId: 'CNTT' });
    expect(createRes.status).toBe(201);
    const studentObjectId = createRes.body._id;

    const res = await request(app)
      .put(`/api/students/${studentObjectId}/avatar`)
      .set(authHeader(adminToken))
      .attach('file', Buffer.from('fake-bytes'), 'avatar.png');

    expect(res.status).toBe(200);
    expect(res.body.avatar?.url).toBe('u');
  });

  it('updates avatar with numeric student code (fallback resolution)', async () => {
    await Department.create({ id: 'CNTT', name: 'CNTT' });
    const createRes = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Student Avatar 2', email: 'avatar2@edu.vn', departmentId: 'CNTT' });
    expect(createRes.status).toBe(201);
    const numericCode = createRes.body.id;

    const res = await request(app)
      .put(`/api/students/${numericCode}/avatar`)
      .set(authHeader(adminToken))
      .attach('file', Buffer.from('fake-bytes'), 'avatar.png');

    expect(res.status).toBe(200);
    expect(res.body.avatar?.url).toBe('u');
  });

  it('rejects avatar update with invalid format _id', async () => {
    const res = await request(app)
      .put('/api/students/invalid-non-numeric-id/avatar')
      .set(authHeader(adminToken))
      .attach('file', Buffer.from('fake-bytes'), 'avatar.png');

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toMatch(/không hợp lệ/i);
  });

  it('updates all student profile info via PATCH and keeps User name in sync', async () => {
    await Department.create({ id: 'CNTT', name: 'Khoa Công Nghệ Thông Tin' });
    const createRes = await request(app)
      .post('/api/students')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Sinh Viên Gốc', email: 'allinfo@edu.vn', departmentId: 'CNTT' });
    expect(createRes.status).toBe(201);
    const id = createRes.body._id;

    const updateRes = await request(app)
      .patch(`/api/students/${id}`)
      .set(authHeader(adminToken))
      .send({
        hoTen: 'Sinh Viên Đã Sửa',
        phone: '0912345678',
        dob: '2004-05-15',
        gender: 'Nữ',
        address: 'Hà Nội',
        className: 'CNTT-K18A',
        education: 'Chất lượng cao',
        departmentId: 'CNTT',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.hoTen).toBe('Sinh Viên Đã Sửa');
    expect(updateRes.body.phone).toBe('0912345678');
    expect(updateRes.body.dob).toBe('2004-05-15');
    expect(updateRes.body.gender).toBe('Nữ');
    expect(updateRes.body.address).toBe('Hà Nội');
    expect(updateRes.body.className).toBe('CNTT-K18A');
    expect(updateRes.body.education).toBe('Chất lượng cao');
  });
});
