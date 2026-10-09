/**
 * SheetJS helpers with dynamic import so the heavy `xlsx` bundle only loads
 * when the user actually imports or exports. Uses the official SheetJS CDN
 * build (the npm 0.18.5 release has published advisories).
 */
const SHEETJS_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

let xlsxPromise = null;
function loadXlsx() {
  if (!xlsxPromise) {
    // @vite-ignore keeps Vite from trying to pre-bundle the remote module.
    xlsxPromise = import(/* @vite-ignore */ SHEETJS_CDN);
  }
  return xlsxPromise;
}

/** Read the first sheet of an uploaded file into an array of row objects. */
export async function readSheet(file) {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  // Excel date cells are timezone-free serial numbers. Keep them as numbers so
  // callers can convert their calendar/time fields without local timezone shifts.
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

/** Export an array of row objects to a downloaded .xlsx file. */
export async function exportSheet(rows, { fileName = 'export.xlsx', sheetName = 'Sheet1' } = {}) {
  const XLSX = await loadXlsx();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}
