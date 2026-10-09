import { describe, expect, it } from 'vitest';
import { classExportRow, classImportPayload } from './classExcel.js';

const teachers = [
  { id: 1, hoTen: 'Nguyễn Minh An' },
  { id: 2, hoTen: 'Trần Thị Bình' },
];

function excelSerial(date, time = '00:00') {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const milliseconds = Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(1899, 11, 30);
  return milliseconds / 86_400_000;
}

describe('class Excel helpers', () => {
  it('converts a template row into a class creation payload', () => {
    const payload = classImportPayload({
      MaHP: 'IT101',
      MaLHP: '',
      TenLHP: 'Lớp nhập môn 03',
      Siso: 30,
      NgayBatDauHoc: '2026-11-01',
      NgayKetThucHoc: '2027-02-14',
      BatDauDK: '2026-10-10 08:00',
      KetThucDK: '2026-10-11 20:00',
      MaGV: 'GV-001',
      GiangVien: 'Nguyễn Minh An',
      Phong: 'A101',
      Thu: '2,4',
      Ca: 'S1,C1',
    }, 'IT101', teachers);

    expect(payload).toEqual({
      id: '',
      courseId: 'IT101',
      className: 'Lớp nhập môn 03',
      teacherId: 1,
      room: 'A101',
      capacity: 30,
      schedules: [{ dayId: '2', shiftId: 'S1' }, { dayId: '4', shiftId: 'C1' }],
      registrationStart: '2026-10-10T08:00',
      registrationEnd: '2026-10-11T20:00',
      studyStart: '2026-11-01',
      studyEnd: '2027-02-14',
      status: 'Nháp',
    });
  });

  it('rejects invalid capacity, teacher, and schedule values', () => {
    const base = {
      TenLHP: 'Lớp 03',
      MaGV: 'GV-001',
      Phong: 'A101',
      Siso: 10,
      Thu: '2',
      Ca: 'S1',
      BatDauDK: '2026-10-10 08:00',
      KetThucDK: '2026-10-11 20:00',
      NgayBatDauHoc: '2026-11-01',
      NgayKetThucHoc: '2027-02-14',
    };

    expect(() => classImportPayload({ ...base, Siso: 9 }, 'IT101', teachers))
      .toThrow(/lớn hơn hoặc bằng 10/);
    expect(() => classImportPayload({ ...base, MaGV: 'GV-999' }, 'IT101', teachers))
      .toThrow(/Không tìm thấy giáo viên/);
    expect(() => classImportPayload({ ...base, Ca: 'S9' }, 'IT101', teachers))
      .toThrow(/không hợp lệ/);
    expect(() => classImportPayload({ ...base, Thu: '2,4' }, 'IT101', teachers))
      .toThrow(/số giá trị trong cột Thứ và Ca phải bằng nhau/i);
  });

  it('continues to accept the previous single-column schedule format', () => {
    const payload = classImportPayload({
      'Tên lớp học phần': 'Lớp 03',
      'Mã giáo viên': 'GV-001',
      'Phòng học': 'A101',
      'Sĩ số tối đa': 10,
      'Lịch học': 'T2-S1;T4-C1',
      'Bắt đầu đăng ký': '2026-10-10 08:00',
      'Kết thúc đăng ký': '2026-10-11 20:00',
      'Bắt đầu học': '2026-11-01',
      'Kết thúc học': '2027-02-14',
      'Trạng thái': 'Nháp',
    }, 'IT101', teachers);

    expect(payload.schedules).toEqual([
      { dayId: '2', shiftId: 'S1' },
      { dayId: '4', shiftId: 'C1' },
    ]);
  });

  it('preserves Excel date serials and time values without timezone shifts', () => {
    const payload = classImportPayload({
      MaHP: 'IT101',
      MaLHP: 'IT101-04',
      TenLHP: 'Lớp nhập môn 04',
      Siso: 20,
      NgayBatDauHoc: excelSerial('2026-11-01'),
      NgayKetThucHoc: excelSerial('2027-02-14'),
      BatDauDK: excelSerial('2026-10-11', '06:00'),
      KetThucDK: excelSerial('2026-10-12', '23:59'),
      MaGV: 'GV-002',
      Phong: 'A104',
      Thu: '2,4',
      Ca: 'C1,C1',
    }, 'IT101', teachers);

    expect(payload.studyStart).toBe('2026-11-01');
    expect(payload.studyEnd).toBe('2027-02-14');
    expect(payload.registrationStart).toBe('2026-10-11T06:00');
    expect(payload.registrationEnd).toBe('2026-10-12T23:59');
  });

  it('exports class name, schedule, registration period, and teacher code', () => {
    const row = classExportRow({
      courseId: 'IT101',
      id: 'IT101-01',
      className: 'Lớp nhập môn 01',
      teacherId: 1,
      teacher: 'Nguyễn Minh An',
      room: 'A101',
      schedules: [{ dayId: '2', shiftId: 'S1' }],
      registrationStart: '2026-10-10T08:00',
      registrationEnd: '2026-10-11T20:00',
      studyStart: '2026-11-01',
      studyEnd: '2027-02-14',
      status: 'Đang mở',
      capacity: 30,
      enrolledCount: 5,
    });

    expect(row).toEqual({
      MaHP: 'IT101',
      MaLHP: 'IT101-01',
      TenLHP: 'Lớp nhập môn 01',
      Siso: 30,
      NgayBatDauHoc: '2026-11-01',
      NgayKetThucHoc: '2027-02-14',
      BatDauDK: '2026-10-10 08:00',
      KetThucDK: '2026-10-11 20:00',
      MaGV: 'GV-001',
      GiangVien: 'Nguyễn Minh An',
      Phong: 'A101',
      Thu: '2',
      Ca: 'S1',
    });
  });
});
