import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './helpers/testApp.js';
import { createUser, authHeader } from './helpers/factories.js';
import { ROLES } from '../src/lib/roles.js';
import { Department } from '../src/modules/departments/department.model.js';
import { User } from '../src/modules/auth/user.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';

// Mock Cloudinary so avatar tests never hit the network.
vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(async () => ({
    publicId: 'edumin/avatars/mock',
    url: 'https://cdn.test/mock.png',
    resourceType: 'image',
    bytes: 100,
    format: 'png',
    access: 'public',
  })),
  destroy: vi.fn(async () => {}),
  signedUrl: vi.fn(() => 'https://cdn.test/signed'),
}));

let adminToken;
beforeEach(async () => {
  const { token } = await createUser({ role: ROLES.ADMIN });
  adminToken = token;
  await Department.create({ id: 'CNTT', name: 'CNTT' });
});

const validTeacherPayload = (overrides = {}) => ({
  hoTen: 'Giáo viên thử nghiệm',
  email: 'teacher@university.edu.vn',
  dob: '1980-01-01',
  phone: '0900000000',
  address: '229/3 Tây Thạnh, phường Tây Thạnh, quận Tân Phú, TP.HCM',
  education: 'Thac si',
  departmentId: 'CNTT',
  ...overrides,
});

describe('Teachers', () => {
  it('creates a teacher with a User account and a GV counter id', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'Nguyễn Văn A', email: 'gv1@university.edu.vn', password: 'Passw0rd' }));

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.department).toBe('CNTT');
    expect(res.body.passwordHash).toBeUndefined();

    const user = await User.findOne({ email: 'gv1@university.edu.vn' });
    expect(user.role).toBe(ROLES.TEACHER);
    expect(String(user.teacher)).toBe(String(res.body._id));
  });

  it('rolls back when the email already exists (no orphan teacher)', async () => {
    await createUser({ email: 'dup@university.edu.vn' });
    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'Trùng Email', email: 'dup@university.edu.vn' }));
    expect(res.status).toBe(409);
    expect(await Teacher.countDocuments()).toBe(0);
  });

  it('assigns incrementing ids', async () => {
    await request(app).post('/api/teachers').set(authHeader(adminToken)).send(validTeacherPayload({ hoTen: 'GV Một', email: 'a@university.edu.vn' }));
    const second = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'GV Hai', email: 'b@university.edu.vn' }));
    expect(second.body.id).toBe(2);
  });

  it('rejects invalid teacher fields', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({
        hoTen: 'Nguyen@@ Van',
        email: 'teacher@gmail.com',
        phone: '1234567890',
        dob: '2008-02-30',
        address: 'So 1  Nguyen Trai',
        education: 'Thac si!',
        departmentId: '',
      }));
    expect(res.status).toBe(400);
    expect(await Teacher.countDocuments()).toBe(0);
  });

  it('requires a birth date and phone number', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ dob: '', phone: '' }));
    expect(res.status).toBe(400);
    expect(await Teacher.countDocuments()).toBe(0);
  });

  it('rejects leading, trailing, or repeated spaces in teacher text fields', async () => {
    const invalidValues = [
      { hoTen: ' Nguyễn Văn A' },
      { hoTen: 'Nguyễn  Văn A' },
      { address: 'Ha Noi ' },
      { education: 'Thac  si' },
      { email: 'teacher@university.edu.vn ' },
      { phone: '0900000000 ' },
    ];

    for (const invalidValue of invalidValues) {
      const res = await request(app)
        .post('/api/teachers')
        .set(authHeader(adminToken))
        .send(validTeacherPayload(invalidValue));
      expect(res.status).toBe(400);
    }
    expect(await Teacher.countDocuments()).toBe(0);
  });

  it('updates a teacher address and date of birth without changing immutable ids', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'GV Cập nhật', email: 'update@university.edu.vn' }));

    const res = await request(app)
      .patch(`/api/teachers/${created.body._id}`)
      .set(authHeader(adminToken))
      .send({ _id: 'invalid-id', address: 'TP HCM', dob: '1980-02-02' });

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(created.body._id);
    expect(res.body.address).toBe('TP HCM');
    expect(res.body.dob).toBe('1980-02-02');
  });

  it('uploads an avatar via the mocked service', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'GV Avatar', email: 'av@university.edu.vn' }));
    const res = await request(app)
      .put(`/api/teachers/${created.body._id}/avatar`)
      .set(authHeader(adminToken))
      .attach('file', Buffer.from('fake-image'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.avatar.url).toBe('https://cdn.test/mock.png');
  });

  it('imports rows and reports per-row failures', async () => {
    await Department.create({ id: 'CNTT-01', name: 'Khoa Công Nghệ Thông Tin' });
    const res = await request(app)
      .post('/api/teachers/import')
      .set(authHeader(adminToken))
      .send({
        rows: [
          {
            MaGV: 5,
            HoTen: 'Trần Thị Huế',
            TrinhDo: 'Tiến sĩ',
            NgaySinh: '1985-05-15',
            GioiTinh: 'Nữ',
            Khoa: 'Khoa Công Nghệ Thông Tin',
            SDT: 901234569,
            Email: 'huetran@university.edu.vn',
            DiaChi: 'Quận 3, TP.HCM',
          },
          { MaGV: 6, HoTen: 'X', Email: 'bad-email' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].row).toBe(2);
    const importedTeacher = await Teacher.findOne({ email: 'huetran@university.edu.vn' });
    expect(importedTeacher).toMatchObject({
      id: 5,
      hoTen: 'Trần Thị Huế',
      education: 'Tiến sĩ',
      dob: '1985-05-15',
      gender: 'Nữ',
      department: 'Khoa Công Nghệ Thông Tin',
      phone: '0901234569',
      address: 'Quận 3, TP.HCM',
    });
  });

  it('forbids a non-admin from creating a teacher', async () => {
    const { token } = await createUser({ role: ROLES.TEACHER });
    const res = await request(app).post('/api/teachers').set(authHeader(token)).send(validTeacherPayload({ hoTen: 'Nope', email: 'n@university.edu.vn' }));
    expect(res.status).toBe(403);
  });

  it('deletes a teacher and its account', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'GV Xóa', email: 'del@university.edu.vn' }));
    const res = await request(app).delete(`/api/teachers/${created.body._id}`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(await Teacher.countDocuments()).toBe(0);
    expect(await User.findOne({ email: 'del@university.edu.vn' })).toBeNull();
  });

  it('clears department head when the head teacher is deleted', async () => {
    const created = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'Trưởng Khoa', email: 'head@university.edu.vn' }));
    const dept = await Department.findOne({ id: 'CNTT' });
    dept.head = created.body._id;
    await dept.save();
    await request(app).delete(`/api/teachers/${created.body._id}`).set(authHeader(adminToken));
    const after = await Department.findById(dept._id);
    expect(after.head).toBeNull();
  });

<<<<<<< HEAD
  it('bulk deletes teachers and clears department head', async () => {
    const t1 = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'GV Một', email: 'gv1@university.edu.vn' }));
    const t2 = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send(validTeacherPayload({ hoTen: 'GV Hai', email: 'gv2@university.edu.vn' }));
    expect(await Teacher.countDocuments()).toBe(2);

    const dept = await Department.findOne({ id: 'CNTT' });
    dept.head = t1.body._id;
    await dept.save();

    const res = await request(app)
      .post('/api/teachers/bulk-delete')
      .set(authHeader(adminToken))
      .send({ ids: [t1.body._id, t2.body._id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedCount).toBe(2);
    expect(await Teacher.countDocuments()).toBe(0);
    expect(await User.countDocuments({ email: { $in: ['gv1@university.edu.vn', 'gv2@university.edu.vn'] } })).toBe(0);
    const after = await Department.findById(dept._id);
    expect(after.head).toBeNull();
=======
  it('updates all teacher profile info via PATCH and keeps User name in sync', async () => {
    await Department.create({ id: 'NNA', name: 'Khoa Ngôn Ngữ Anh' });
    const createRes = await request(app)
      .post('/api/teachers')
      .set(authHeader(adminToken))
      .send({ hoTen: 'Giáo Viên Gốc', email: 'allteach@edu.vn' });
    expect(createRes.status).toBe(201);
    const id = createRes.body._id;

    const updateRes = await request(app)
      .patch(`/api/teachers/${id}`)
      .set(authHeader(adminToken))
      .send({
        hoTen: 'Giáo Viên Đã Đổi Tên',
        phone: '0988776655',
        dob: '1988-11-20',
        gender: 'Nữ',
        address: 'Đà Nẵng',
        education: 'Tiến sĩ',
        departmentId: 'NNA',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.hoTen).toBe('Giáo Viên Đã Đổi Tên');
    expect(updateRes.body.phone).toBe('0988776655');
    expect(updateRes.body.dob).toBe('1988-11-20');
    expect(updateRes.body.gender).toBe('Nữ');
    expect(updateRes.body.address).toBe('Đà Nẵng');
    expect(updateRes.body.education).toBe('Tiến sĩ');
    expect(updateRes.body.department).toBe('Khoa Ngôn Ngữ Anh');
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
  });
});
