import { useState, useMemo } from 'react';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { formatStudentCode, formatDateTime, formatDueDate } from '../../../lib/format.js';
import { exportSheet } from '../../../lib/excel.js';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useSubmissions } from '../../shared/useAssignments.js';

export function SubmissionTable({ assignmentId, assignment, onBack }) {
  const toast = useToast();
  const { data, isLoading } = useSubmissions(assignmentId);
  const rows = data?.data || [];

  const [search, setSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('score-desc');
  const [inspectingSub, setInspectingSub] = useState(null);

  // Statistics
  const stats = useMemo(() => {
    if (!rows.length) return { total: 0, avg: 0, passed: 0, passRate: 0, maxScore: 0, minScore: 0 };
    const validScores = rows.map((r) => r.score).filter((s) => s != null && !Number.isNaN(Number(s)));
    if (!validScores.length) {
      return { total: rows.length, avg: 0, passed: 0, passRate: 0, maxScore: 0, minScore: 0 };
    }
    const sum = validScores.reduce((a, b) => a + Number(b), 0);
    const avg = Number((sum / validScores.length).toFixed(1));
    const passed = validScores.filter((s) => Number(s) >= 5.0).length;
    const passRate = Math.round((passed / validScores.length) * 100);
    const maxScore = Math.max(...validScores.map(Number));
    const minScore = Math.min(...validScores.map(Number));

    return {
      total: rows.length,
      avg,
      passed,
      passRate,
      maxScore,
      minScore,
    };
  }, [rows]);

  // Filtering & Sorting
  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) => {
        const name = (r.student?.hoTen || r.studentName || '').toLowerCase();
        const code = String(r.student?.id ?? r.studentId ?? '').toLowerCase();
        const email = (r.student?.email || '').toLowerCase();
        return name.includes(q) || code.includes(q) || email.includes(q);
      });
    }

    if (scoreFilter !== 'all') {
      result = result.filter((r) => {
        const score = Number(r.score);
        if (Number.isNaN(score)) return false;
        if (scoreFilter === 'excellent') return score >= 8.5;
        if (scoreFilter === 'good') return score >= 7.0 && score < 8.5;
        if (scoreFilter === 'average') return score >= 5.0 && score < 7.0;
        if (scoreFilter === 'failed') return score < 5.0;
        return true;
      });
    }

    result.sort((a, b) => {
      if (sortOrder === 'score-desc') return (Number(b.score) || 0) - (Number(a.score) || 0);
      if (sortOrder === 'score-asc') return (Number(a.score) || 0) - (Number(b.score) || 0);
      if (sortOrder === 'time-desc') {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
      }
      if (sortOrder === 'name-asc') {
        const nameA = a.student?.hoTen || a.studentName || '';
        const nameB = b.student?.hoTen || b.studentName || '';
        return nameA.localeCompare(nameB, 'vi');
      }
      return 0;
    });

    return result;
  }, [rows, search, scoreFilter, sortOrder]);

  const handleExportExcel = async () => {
    if (!rows.length) {
      toast.error('Chưa có bài nộp nào để xuất Excel');
      return;
    }
    try {
      const exportData = rows.map((r, idx) => ({
        STT: idx + 1,
        'Mã SV': formatStudentCode(r.student?.id ?? r.studentId),
        'Họ và tên': r.student?.hoTen || r.studentName,
        Email: r.student?.email || '—',
        Lớp: r.student?.className || assignment?.classId || '—',
        'Điểm số': r.score != null ? Number(r.score) : 'Chưa chấm',
        'Kết quả': r.score != null ? (Number(r.score) >= 5.0 ? 'Đạt' : 'Chưa đạt') : '—',
        'Thời gian nộp': r.submittedAt ? formatDateTime(r.submittedAt) : '—',
      }));

      const safeTitle = (assignment?.title || 'bai-nop').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '-');
      await exportSheet(exportData, {
        fileName: `Diem-bai-tap-${safeTitle}.xlsx`,
        sheetName: 'DanhSachNopBai',
      });
      toast.success('Đã xuất danh sách bài nộp ra Excel thành công!');
    } catch (err) {
      toast.error('Lỗi khi xuất file Excel');
    }
  };

  const getScoreBadge = (score) => {
    if (score == null) return <span className="text-slate-400 font-semibold">—</span>;
    const num = Number(score);
    if (num >= 8.5) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
          <i className="fas fa-star text-[10px] mr-1 text-emerald-600" />
          {num.toFixed(1)}/10
        </span>
      );
    }
    if (num >= 7.0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-800 border border-teal-200">
          {num.toFixed(1)}/10
        </span>
      );
    }
    if (num >= 5.0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
          {num.toFixed(1)}/10
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
        {num.toFixed(1)}/10
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 font-medium">Đang tải danh sách bài nộp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
              >
                <i className="fas fa-arrow-left text-xs" />
                <span>Quay lại bài tập</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {assignment?.type === 'quiz' ? 'Trắc nghiệm' : 'Bài nộp file'}
                </span>
                {assignment?.classId && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Lớp {assignment.classId}
                  </span>
                )}
                {assignment?.dueDate && (
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <i className="far fa-clock text-slate-400" />
                    Hạn: {formatDueDate(assignment.dueDate)}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                {assignment?.title || 'Danh sách bài nộp của sinh viên'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition cursor-pointer active:scale-95"
            >
              <i className="fas fa-file-excel text-sm" />
              <span>Xuất Excel ({rows.length})</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng bài nộp</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{stats.total} <span className="text-xs font-semibold text-slate-500">bài</span></p>
          </div>
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Điểm trung bình</p>
            <p className="text-xl font-black text-indigo-700 mt-0.5">{stats.avg} <span className="text-xs font-semibold text-indigo-500">/ 10</span></p>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tỉ lệ đạt (≥ 5.0)</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{stats.passRate}% <span className="text-xs font-semibold text-emerald-500">({stats.passed}/{stats.total})</span></p>
          </div>
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Điểm cao nhất</p>
            <p className="text-xl font-black text-amber-700 mt-0.5">{stats.maxScore} <span className="text-xs font-semibold text-amber-500">/ 10</span></p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
            placeholder="Tìm theo MSSV, họ tên, email sinh viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
          >
            <option value="all">Tất cả mức điểm</option>
            <option value="excellent">Xuất sắc & Giỏi (≥ 8.5)</option>
            <option value="good">Khá (7.0 - 8.4)</option>
            <option value="average">Trung bình (5.0 - 6.9)</option>
            <option value="failed">Chưa đạt (&lt; 5.0)</option>
          </select>

          <select
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="score-desc">Điểm: Cao đến thấp</option>
            <option value="score-asc">Điểm: Thấp đến cao</option>
            <option value="time-desc">Thời gian nộp mới nhất</option>
            <option value="name-asc">Tên sinh viên (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <i className="fas fa-inbox text-lg" />
            </div>
            <p className="text-sm font-bold text-slate-700">Chưa có bài nộp nào phù hợp</p>
            <p className="text-xs text-slate-400">
              {rows.length === 0 ? 'Sinh viên trong lớp chưa gửi bài nộp cho bài tập này.' : 'Không tìm thấy sinh viên theo điều kiện lọc hiện tại.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/90 text-slate-500 uppercase tracking-wider font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">STT</th>
                  <th className="px-4 py-3.5">Sinh viên</th>
                  <th className="px-4 py-3.5">Mã SV</th>
                  <th className="px-4 py-3.5 text-center">Điểm số</th>
                  <th className="px-4 py-3.5">Thời gian nộp</th>
                  <th className="px-4 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((s, idx) => {
                  const studentName = s.student?.hoTen || s.studentName || 'Sinh viên';
                  const studentCode = formatStudentCode(s.student?.id ?? s.studentId);
                  const studentEmail = s.student?.email;

                  return (
                    <tr key={s._id || idx} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={s.student?.avatar?.url || s.student?.avatar || s.studentAvatar}
                            name={studentName}
                            size={34}
                          />
                          <div>
                            <p className="font-bold text-slate-900 leading-tight">{studentName}</p>
                            {studentEmail && <p className="text-[11px] text-slate-400">{studentEmail}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{studentCode}</td>
                      <td className="px-4 py-3 text-center">{getScoreBadge(s.score)}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {s.submittedAt ? formatDateTime(s.submittedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingSub(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs transition cursor-pointer shadow-2xs"
                        >
                          <i className="fas fa-eye text-[10px]" />
                          <span>Xem bài làm</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Answer Inspector Modal */}
      {inspectingSub && (
        <Modal
          open={Boolean(inspectingSub)}
          onClose={() => setInspectingSub(null)}
          title={`Chi tiết bài làm — ${inspectingSub.student?.hoTen || inspectingSub.studentName || 'Sinh viên'}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {inspectingSub.student?.hoTen || inspectingSub.studentName}
                </p>
                <p className="text-xs text-slate-500">
                  Mã SV: {formatStudentCode(inspectingSub.student?.id ?? inspectingSub.studentId)} · Lớp: {inspectingSub.student?.className || assignment?.classId || '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Điểm tổng kết</p>
                <p className="text-xl font-black text-teal-600">{inspectingSub.score != null ? `${inspectingSub.score}/10` : '—'}</p>
              </div>
            </div>

            {/* Questions list if available in assignment */}
            {assignment?.questions && Array.isArray(assignment.questions) && assignment.questions.length > 0 ? (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Danh sách câu hỏi ({assignment.questions.length})
                </h4>
                {assignment.questions.map((q, qIdx) => {
                  if (!q) return null;
                  const studentAns = inspectingSub.answers?.[q.id || q._id || qIdx];
                  const isCorrect = studentAns !== undefined && Number(studentAns) === Number(q.correctIndex);

                  return (
                    <div
                      key={q.id || q._id || qIdx}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-800">
                          Câu {qIdx + 1}: {q.text || q.question || 'Câu hỏi'}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? 'Đúng (+ điểm)' : 'Sai'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(Array.isArray(q.options) ? q.options : []).map((opt, optIdx) => {
                          const isStudentSelected = Number(studentAns) === optIdx;
                          const isAnswerCorrect = Number(q.correctIndex) === optIdx;

                          let badgeClass = 'bg-white border-slate-200 text-slate-700';
                          if (isAnswerCorrect) badgeClass = 'bg-emerald-100/80 border-emerald-300 font-bold text-emerald-900';
                          if (isStudentSelected && !isAnswerCorrect) badgeClass = 'bg-rose-100 border-rose-300 font-bold text-rose-800';

                          return (
                            <div key={optIdx} className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${badgeClass}`}>
                              <span>
                                {String.fromCharCode(65 + optIdx)}. {opt}
                              </span>
                              {isStudentSelected && (
                                <span className="text-[10px] font-bold ml-1 text-slate-500">
                                  (SV chọn)
                                </span>
                              )}
                              {isAnswerCorrect && (
                                <i className="fas fa-check text-emerald-600 text-[10px] ml-1" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                {inspectingSub.file?.url ? (
                  <div className="space-y-3">
                    <p className="font-semibold text-slate-700">Tệp bài làm nộp kèm:</p>
                    <a
                      href={inspectingSub.file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition"
                    >
                      <i className="fas fa-download" />
                      <span>Tải về tệp {inspectingSub.file.originalName || 'bài làm'}</span>
                    </a>
                  </div>
                ) : (
                  <p>Không có dữ liệu chi tiết câu hỏi cho bài tập này.</p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectingSub(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SubmissionTable;
