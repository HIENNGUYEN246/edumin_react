export function Spinner({ label = 'Đang tải...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-gray-500">
      <i className="fas fa-circle-notch fa-spin text-2xl text-indigo-500" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export default Spinner;
