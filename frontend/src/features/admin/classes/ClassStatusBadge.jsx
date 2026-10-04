const STYLES = {
  Nháp: 'text-gray-600 bg-gray-100',
  'Đang mở': 'text-emerald-700 bg-emerald-50',
  'Đã đóng': 'text-amber-700 bg-amber-50',
  'Đã hủy': 'text-red-700 bg-red-50',
};

const ICONS = {
  Nháp: 'fa-pen-ruler',
  'Đang mở': 'fa-lock-open',
  'Đã đóng': 'fa-lock',
  'Đã hủy': 'fa-ban',
};

export function ClassStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${STYLES[status] || STYLES.Nháp}`}>
      <i className={`fas ${ICONS[status] || ICONS.Nháp}`} />
      {status}
    </span>
  );
}

export default ClassStatusBadge;
