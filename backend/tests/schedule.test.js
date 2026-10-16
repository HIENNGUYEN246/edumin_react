import { describe, it, expect } from 'vitest';
import { findScheduleConflict, rangesOverlap, slotsClash, validateSchedules } from '../src/lib/schedule.js';

describe('schedule lib', () => {
  it('detects clashing slots', () => {
    expect(slotsClash({ dayId: '2', shiftId: 'S1' }, { dayId: '2', shiftId: 'S1' })).toBe(true);
    expect(slotsClash({ dayId: '2', shiftId: 'S1' }, { dayId: '3', shiftId: 'S1' })).toBe(false);
  });

  it('detects overlapping ranges', () => {
    expect(rangesOverlap('2026-01-01', '2026-06-01', '2026-03-01', '2026-09-01')).toBe(true);
    expect(rangesOverlap('2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01')).toBe(false);
  });

  it('validates schedule slots', () => {
    expect(validateSchedules([{ dayId: '2', shiftId: 'S1' }])).toBe(true);
    expect(validateSchedules([{ dayId: '99', shiftId: 'ZZ' }])).toBe(false);
  });

  it('flags a teacher double-booking', () => {
    const candidate = {
      teacherId: 1,
      room: 'A1',
      studyStart: '2026-01-01',
      studyEnd: '2026-06-01',
      schedules: [{ dayId: '2', shiftId: 'S1' }],
    };
    const existing = [
      {
        teacherId: 1,
        room: 'B2',
        courseName: 'Toán',
        studyStart: '2026-02-01',
        studyEnd: '2026-05-01',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
    ];
    expect(findScheduleConflict(candidate, existing)).toMatch(/Giáo viên/);
  });

  it('flags a room double-booking', () => {
    const candidate = {
      teacherId: 2,
      room: 'A1',
      studyStart: '2026-01-01',
      studyEnd: '2026-06-01',
      schedules: [{ dayId: '3', shiftId: 'C1' }],
    };
    const existing = [
      {
        teacherId: 9,
        room: 'A1',
        courseName: 'Lý',
        studyStart: '2026-01-01',
        studyEnd: '2026-06-01',
        schedules: [{ dayId: '3', shiftId: 'C1' }],
      },
    ];
    expect(findScheduleConflict(candidate, existing)).toMatch(/Phòng A1/);
  });

  it('allows non-overlapping study periods to share a slot', () => {
    const candidate = {
      teacherId: 1,
      room: 'A1',
      studyStart: '2026-01-01',
      studyEnd: '2026-02-01',
      schedules: [{ dayId: '2', shiftId: 'S1' }],
    };
    const existing = [
      {
        teacherId: 1,
        room: 'A1',
        studyStart: '2026-03-01',
        studyEnd: '2026-04-01',
        schedules: [{ dayId: '2', shiftId: 'S1' }],
      },
    ];
    expect(findScheduleConflict(candidate, existing)).toBeNull();
  });
});
