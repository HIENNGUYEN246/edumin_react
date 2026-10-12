import mongoose from 'mongoose';

/**
 * Normalize department string by trimming, lowercasing, and removing redundant whitespace.
 */
export function normalizeDept(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Strip common prefixes like 'khoa ' from a department string.
 */
export function stripDeptPrefix(str) {
  const norm = normalizeDept(str);
  return norm.replace(/^khoa\s+/i, '').trim();
}

export const KNOWN_DEPARTMENT_GROUPS = [
  ['cntt', 'công nghệ thông tin', 'khoa công nghệ thông tin', 'it', 'information technology'],
  ['nna', 'ngôn ngữ anh', 'khoa ngôn ngữ anh', 'tiếng anh', 'english'],
  ['cntp', 'công nghiệp thực phẩm', 'khoa công nghiệp thực phẩm', 'thực phẩm', 'food technology'],
  ['hoa', 'hóa học', 'khoa hóa học', 'hóa', 'chemistry'],
  ['xd', 'xây dựng', 'khoa xây dựng', 'civil engineering'],
  ['qtkd', 'quản trị kinh doanh', 'khoa quản trị kinh doanh', 'business administration'],
  ['khcb', 'khoa học cơ bản', 'khoa khoa học cơ bản', 'đại cương', 'khoa đại cương'],
];

export const GENERAL_DEPT_KEYWORDS = [
  'đại cương',
  'khoa đại cương',
  'giáo dục đại cương',
  'khoa học cơ bản',
  'khoa cơ bản',
  'toàn trường',
  'chung',
  'lý luận chính trị',
  'giáo dục thể chất',
  'quốc phòng',
  'general',
];

export function isGeneralEducation(dept) {
  if (!dept) return false;
  const raw = typeof dept === 'object' ? (dept.name || dept.id || '') : String(dept);
  const norm = normalizeDept(raw);
  const stripped = stripDeptPrefix(raw);
  return GENERAL_DEPT_KEYWORDS.some((k) => norm.includes(k) || stripped.includes(k));
}

/**
 * Build a department matcher for a given user department (string or Department object).
 * Returns an asynchronous matcher function `matcher(targetDept)` with `.accepted` and `.acceptedList`.
 */
export async function buildDepartmentMatcher(userDept, departmentRef = null) {
  if (!userDept && !departmentRef) {
    const passAll = () => true;
    passAll.accepted = new Set();
    passAll.acceptedList = [];
    return passAll;
  }

  const accepted = new Set();

  const addVariants = (val) => {
    if (!val) return;
    const raw = typeof val === 'object' ? (val.name || val.id || '') : String(val);
    const norm = normalizeDept(raw);
    if (!norm) return;
    accepted.add(norm);
    const stripped = stripDeptPrefix(raw);
    if (stripped) accepted.add(stripped);
  };

  addVariants(userDept);

  if (departmentRef && typeof departmentRef === 'object') {
    addVariants(departmentRef.id);
    addVariants(departmentRef.name);
  }

  // Expand with known alias groups
  for (const group of KNOWN_DEPARTMENT_GROUPS) {
    const hasOverlap = group.some((alias) => accepted.has(normalizeDept(alias)) || accepted.has(stripDeptPrefix(alias)));
    if (hasOverlap) {
      for (const alias of group) {
        accepted.add(normalizeDept(alias));
        const s = stripDeptPrefix(alias);
        if (s) accepted.add(s);
      }
    }
  }

  try {
    const Department = mongoose.models.Department || mongoose.model('Department');
    const allDepts = await Department.find({}).lean();
    for (const d of allDepts) {
      const dId = normalizeDept(d.id);
      const dName = normalizeDept(d.name);
      const dStripped = stripDeptPrefix(d.name);

      if (accepted.has(dId) || accepted.has(dName) || accepted.has(dStripped)) {
        if (dId) accepted.add(dId);
        if (dName) accepted.add(dName);
        if (dStripped) accepted.add(dStripped);
      }
    }
  } catch {
    // If Department query fails, fall back to already collected variants
  }

  const matcher = (targetDept) => {
    if (!targetDept) return false;
    if (isGeneralEducation(targetDept)) return true;
    const raw = typeof targetDept === 'object' ? (targetDept.name || targetDept.id || '') : String(targetDept);
    const norm = normalizeDept(raw);
    if (!norm) return false;
    const stripped = stripDeptPrefix(raw);
    return accepted.has(norm) || (stripped && accepted.has(stripped));
  };

  matcher.accepted = accepted;
  matcher.acceptedList = Array.from(accepted);
  return matcher;
}

/**
 * Synchronous equality check between two department values.
 */
export function isSameDepartment(deptA, deptB) {
  if (!deptA || !deptB) return false;
  const a = normalizeDept(typeof deptA === 'object' ? (deptA.name || deptA.id || '') : deptA);
  const b = normalizeDept(typeof deptB === 'object' ? (deptB.name || deptB.id || '') : deptB);
  if (a === b) return true;
  const strippedA = stripDeptPrefix(a);
  const strippedB = stripDeptPrefix(b);
  if (Boolean(strippedA && strippedB && strippedA === strippedB)) return true;

  for (const group of KNOWN_DEPARTMENT_GROUPS) {
    const matchA = group.some((alias) => normalizeDept(alias) === a || stripDeptPrefix(alias) === strippedA);
    const matchB = group.some((alias) => normalizeDept(alias) === b || stripDeptPrefix(alias) === strippedB);
    if (matchA && matchB) return true;
  }

  return false;
}

