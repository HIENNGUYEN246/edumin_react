import { describe, it, expect, vi } from 'vitest';
import { seed } from '../src/scripts/seed.js';
import { User } from '../src/modules/auth/user.model.js';
import { Teacher } from '../src/modules/teachers/teacher.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { Enrollment } from '../src/modules/enrollments/enrollment.model.js';

// Cloudinary isn't touched by seed (no avatars), but createTeacher/createStudent
// don't upload, so no mock is strictly needed. Keep files.service inert anyway.
vi.mock('../src/lib/files.service.js', () => ({
  uploadBuffer: vi.fn(),
  destroy: vi.fn(),
  signedUrl: vi.fn(),
}));

describe('seed', () => {
  it('creates admin, departments and sample data', async () => {
    const result = await seed({ withSamples: true });
    expect(result.departments).toBe(3);
    expect(result.teachers).toBe(2);
    expect(result.students).toBe(3);

    expect(await User.countDocuments({ role: 'dao-tao' })).toBe(1);
    expect(await Teacher.countDocuments()).toBe(2);
    expect(await Student.countDocuments()).toBe(3);
    expect(await Enrollment.countDocuments()).toBe(1);
  });

  it('supports a minimal seed without samples', async () => {
    const result = await seed({ withSamples: false });
    expect(result.departments).toBe(3);
    expect(await Teacher.countDocuments()).toBe(0);
  });
});
