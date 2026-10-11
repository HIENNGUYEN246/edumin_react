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
  return Boolean(strippedA && strippedB && strippedA === strippedB);
}

