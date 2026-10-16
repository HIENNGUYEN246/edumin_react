function dateTimeParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function todayDateString(now = new Date()) {
  const parts = dateTimeParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentDateTimeString(now = new Date()) {
  const parts = dateTimeParts(now);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function normalizeRegistrationDateTime(value, isEnd = false) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${isEnd ? '23:59:59' : '00:00:00'}`;
  }
  return value.length === 16 ? `${value}:00` : value;
}

export function isRegistrationWindowActive(courseClass, now = new Date()) {
  const current = currentDateTimeString(now);
  const start = normalizeRegistrationDateTime(courseClass.registrationStart);
  const end = normalizeRegistrationDateTime(courseClass.registrationEnd, true);
  return (!start || start <= current) && (!end || end >= current);
}

export function isRegistrationWindowExpired(courseClass, now = new Date()) {
  const end = normalizeRegistrationDateTime(courseClass.registrationEnd, true);
  return Boolean(end && end < currentDateTimeString(now));
}
