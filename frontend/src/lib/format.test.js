import { describe, expect, it } from 'vitest';
import { formatRegistrationDateTime } from './format.js';

describe('formatRegistrationDateTime', () => {
  it('shows saved hours and minutes for registration periods', () => {
    expect(formatRegistrationDateTime('2026-11-10T08:30')).toBe('10/11/2026 08:30');
    expect(formatRegistrationDateTime('2026-11-17T17:15', true)).toBe('17/11/2026 17:15');
  });

  it('shows sensible times for legacy date-only registration periods', () => {
    expect(formatRegistrationDateTime('2026-11-10')).toBe('10/11/2026 00:00');
    expect(formatRegistrationDateTime('2026-11-17', true)).toBe('17/11/2026 23:59');
  });

  it('shows a dash when the registration time is missing', () => {
    expect(formatRegistrationDateTime('')).toBe('—');
    expect(formatRegistrationDateTime(null)).toBe('—');
  });
});
