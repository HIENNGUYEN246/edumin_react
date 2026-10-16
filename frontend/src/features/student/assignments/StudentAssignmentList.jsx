import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { useCourseOptions } from '../../shared/useCourseOptions.js';
import { useAssignments } from '../../shared/useAssignments.js';
import { enrollmentsApi } from '../../../api/enrollmentsApi.js';

function isPastDue(dueDate) {
  if (!dueDate) return false;
  const deadline = new Date(`${dueDate}T23:59:59`);
  return !Number.isNaN(deadline.valueOf()) && new Date() > deadline;
}

function AssignmentCard({ assignment, onOpen, courses = [] }) {
  const quiz = assignment.type === 'quiz';
  const submission = assignment.mySubmission;
  const overdue = isPastDue(assignment.dueDate);
  const missed = quiz && overdue && !submission;
  const count = assignment.questions?.length || 0;
  const course = courses.find((c) => c.id === assignment.courseId);
  const courseName = course?.name || assignment.courseName;

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all duration-200 flex flex-col justify-between">
      {/* Accent left line */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          quiz
            ? 'bg-gradient-to-b from-teal-500 via-emerald-500 to-teal-600'
            : 'bg-gradient-to-b from-cyan-500 to-blue-500'
        }`}
      />

      <div className="p-4 sm:p-5 pl-5 sm:pl-6 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Header row: Type badge, Course tag, Due date status tag */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  quiz
                    ? 'text-teal-700 bg-teal-50 border-teal-200'
                    : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                }`}
              >
                <i className={`fas ${quiz ? 'fa-list-check' : 'fa-file-lines'} text-[10px]`} />
                {quiz ? 'Trắc nghiệm' : 'Tệp bài'}
              </span>

              {assignment.courseId && (
                <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80">
                  {assignment.courseId}
                </span>
              )}
            </div>

            {/* Standardized Status Tag: Hết hạn vs Đang mở */}
            {overdue ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap px-2.5 py-1 rounded-full text-rose-700 bg-rose-50 border border-rose-200">
                <i className="fas fa-circle-xmark text-[10px] text-rose-500" />
                <span>Hết hạn</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap px-2.5 py-1 rounded-full text-emerald-700 bg-emerald-50 border border-emerald-200">
                <i className="fas fa-circle-check text-[10px] text-emerald-500" />
                <span>{assignment.dueDate ? `Đang mở (${assignment.dueDate})` : 'Đang mở'}</span>
              </span>
            )}
          </div>

          {/* Course Name */}
          {courseName && (
            <p className="mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {courseName}
            </p>
          )}

          {/* Title */}
          <h4 className="mt-1.5 text-base font-extrabold text-slate-800 leading-snug group-hover:text-teal-700 transition">
            {assignment.title}
          </h4>

          {/* Description */}
          {assignment.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {assignment.description}
            </p>
          )}
        </div>

        <div>
          {/* Teacher Info */}
          {assignment.createdBy && (
            <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <Avatar
                src={assignment.createdByRef?.avatar?.url || assignment.createdByRef?.avatar}
                name={assignment.createdBy}
                size={22}
              />
              <span className="font-medium text-slate-700 truncate">
                GV: {assignment.createdBy}
              </span>
            </div>
          )}

          {/* Footer Status & Action button */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            {submission ? (
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <i className="fas fa-circle-check" /> Hoàn thành
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Kết quả: <strong className="text-emerald-700 font-extrabold">{submission.score}/10</strong>
                </p>
              </div>
            ) : missed ? (
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
                  <i className="fas fa-circle-xmark" /> Quá hạn
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Kết quả: <strong className="text-rose-600 font-bold">0/10</strong>
                </p>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-500">
                {quiz ? `${count} câu hỏi trắc nghiệm` : 'Tài liệu đính kèm'}
              </span>
            )}

            {quiz ? (
              <button
                type="button"
                onClick={() => onOpen(assignment)}
                disabled={overdue && !submission}
                className={`h-8 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs hover:shadow active:scale-95 cursor-pointer ${
                  submission
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    : overdue
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                }`}
              >
                <span>{submission ? 'Xem kết quả' : overdue ? 'Đã đóng' : 'Làm bài'}</span>
                {(!overdue || submission) && <i className="fas fa-arrow-right text-[10px]" />}
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 italic">Xem ở mục Tài liệu</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function StudentAssignmentList() {
  const navigate = useNavigate();

  const { data: enrollmentsData, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: enrollmentsApi.mine,
  });
  const enrollments = enrollmentsData?.data || [];

  const { courses, isLoading: loadingCourses } = useCourseOptions();

  // Load all available assignments for student
  const { data: assignmentsData, isLoading: loadingAssignments } = useAssignments('');
  const allAssignments = assignmentsData?.data || [];

  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [hasInitializedExpand, setHasInitializedExpand] = useState(false);

  // Group assignments by Class & Course
  const classGroups = useMemo(() => {
    const classes = enrollments
      .map((e) => e.class)
      .filter(Boolean);

    const map = new Map();

    classes.forEach((c) => {
      const key = String(c.id || c._id);
      if (!map.has(key)) {
        map.set(key, {
          key,
          classId: c.id || key,
          className: c.className || 'Lớp học phần',
          courseId: c.courseId || '',
          courseName: c.courseName || c.name || c.courseId,
          teacherName: c.teacherName || c.teacher?.hoTen || '',
          credits: c.credits,
          room: c.room,
          assignments: [],
        });
      }
    });

    // Fallback: If student has enrolled courses that don't yet have a direct class object
    courses.forEach((crs) => {
      const existing = Array.from(map.values()).some((item) => item.courseId === crs.id);
      if (!existing && crs.id) {
        map.set(crs.id, {
          key: crs.id,
          classId: crs.id,
          className: 'Học phần',
          courseId: crs.id,
          courseName: crs.name || crs.id,
          teacherName: '',
          credits: crs.credits,
          room: '',
          assignments: [],
        });
      }
    });

    const list = Array.from(map.values());
    const assignedIds = new Set();

    list.forEach((cls) => {
      cls.assignments = allAssignments.filter((a) => {
        if (a.classRef && cls._id && String(a.classRef) === String(cls._id)) {
          assignedIds.add(a._id);
          return true;
        }
        if (a.classId) {
          const itemCId = String(a.classId).trim().toLowerCase();
          const grpCId = String(cls.classId || '').trim().toLowerCase();
          const grpKey = String(cls.key || '').trim().toLowerCase();
          if (itemCId === grpCId || itemCId === grpKey || itemCId.replace(/[-_]/g, '') === grpCId.replace(/[-_]/g, '')) {
            assignedIds.add(a._id);
            return true;
          }
          return false;
        }
        if (a.courseId && cls.courseId && a.courseId.trim().toUpperCase() === cls.courseId.trim().toUpperCase()) {
          assignedIds.add(a._id);
          return true;
        }
        return false;
      });
    });

    // Place any remaining unassigned assignments in a general section
    const unassigned = allAssignments.filter((a) => !assignedIds.has(a._id));
    if (unassigned.length > 0) {
      list.push({
        key: 'general-assignments',
        classId: 'CHUNG',
        className: 'Bài tập chung & Học phần khác',
        courseId: 'CHUNG',
        courseName: 'Bài tập chung',
        teacherName: '',
        credits: null,
        room: '',
        assignments: unassigned,
      });
    }

    return list;
  }, [enrollments, courses, allAssignments]);

  const isLoading = loadingEnrollments || loadingCourses || loadingAssignments;

  // Auto-expand all classes that have assignments on first load
  useEffect(() => {
    if (!isLoading && classGroups.length > 0 && !hasInitializedExpand) {
      const initialKeys = new Set();
      classGroups.forEach((g) => {
        if (g.assignments.length > 0) initialKeys.add(g.key);
      });
      if (initialKeys.size === 0 && classGroups[0]) {
        initialKeys.add(classGroups[0].key);
      }
      setExpandedKeys(initialKeys);
      setHasInitializedExpand(true);
    }
  }, [isLoading, classGroups, hasInitializedExpand]);

  const handleSelectClass = (val) => {
    setFilterClass(val);
    if (val !== 'all') {
      setExpandedKeys((prev) => new Set([...prev, val]));
    }
  };

  const expandAll = () => {
    setExpandedKeys(new Set(classGroups.map((g) => g.key)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  const toggleExpand = (key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filtered classes & assignments
  const filteredGroups = useMemo(() => {
    return classGroups
      .filter((grp) => {
        if (filterClass !== 'all' && grp.key !== filterClass && grp.courseId !== filterClass) {
          return false;
        }
        return true;
      })
      .map((grp) => {
        let items = grp.assignments;

        // Filter by Type
        if (filterType !== 'all') {
          items = items.filter((a) => a.type === filterType);
        }

        // Filter by Status
        if (filterStatus !== 'all') {
          items = items.filter((a) => {
            const overdue = isPastDue(a.dueDate);
            if (filterStatus === 'completed') return Boolean(a.mySubmission);
            if (filterStatus === 'pending') return !a.mySubmission && !overdue;
            if (filterStatus === 'overdue') return !a.mySubmission && overdue;
            return true;
          });
        }

        // Filter by Search Keyword
        if (searchKeyword.trim()) {
          const q = searchKeyword.trim().toLowerCase();
          const matchesClass =
            grp.courseName.toLowerCase().includes(q) ||
            grp.courseId.toLowerCase().includes(q) ||
            grp.classId.toLowerCase().includes(q) ||
            (grp.teacherName && grp.teacherName.toLowerCase().includes(q));

          if (!matchesClass) {
            items = items.filter(
              (a) =>
                (a.title || '').toLowerCase().includes(q) ||
                (a.description || '').toLowerCase().includes(q) ||
                (a.createdBy || '').toLowerCase().includes(q)
            );
          }
        }

        return { ...grp, assignments: items };
      })
      .filter((grp) => {
        if (searchKeyword.trim() || filterStatus !== 'all' || filterType !== 'all') {
          return grp.assignments.length > 0;
        }
        return true;
      });
  }, [classGroups, filterClass, filterType, filterStatus, searchKeyword]);

  // Overall Statistics
  const totalClassesCount = classGroups.length;
  const totalAssignmentsCount = allAssignments.length;
  const totalCompletedCount = allAssignments.filter((a) => a.mySubmission).length;
  const totalPendingCount = allAssignments.filter((a) => !a.mySubmission && !isPastDue(a.dueDate)).length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Bài tập & Đánh giá"
        subtitle="Làm bài trắc nghiệm và nộp bài tập được gom nhóm theo từng lớp học phần bạn đang theo học"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 shadow-2xs">
              <i className="fas fa-layer-group text-indigo-500" />
              <span>{totalClassesCount} Lớp học phần</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold border border-teal-100 shadow-2xs">
              <i className="fas fa-list-check text-teal-500" />
              <span>{totalAssignmentsCount} Bài tập</span>
            </span>
            {totalPendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 shadow-2xs animate-pulse">
                <i className="fas fa-hourglass-half text-amber-500" />
                <span>{totalPendingCount} Cần làm</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 shadow-2xs">
              <i className="fas fa-circle-check text-emerald-500" />
              <span>{totalCompletedCount} Đã nộp</span>
            </span>
          </div>
        }
      />

      {/* Toolbar: Search, Filters & Quick Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm kiếm bài tập, tiêu đề, môn học hoặc giảng viên..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <i className="fas fa-times-circle" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter by Class */}
            <select
              value={filterClass}
              onChange={(e) => handleSelectClass(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer max-w-[220px] truncate"
            >
              <option value="all">Tất cả lớp học phần ({classGroups.length})</option>
              {classGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.courseName} · {g.classId}
                </option>
              ))}
            </select>

            {/* Filter by Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Cần làm (chưa nộp)</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="overdue">Đã hết hạn</option>
            </select>

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
            >
              <option value="all">Tất cả loại bài</option>
              <option value="quiz">Trắc nghiệm</option>
              <option value="file">Tệp đính kèm</option>
            </select>
          </div>
        </div>

        {/* View toggles & Quick Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Hiển thị <strong>{filteredGroups.length}</strong> thư mục lớp</span>
            <span>•</span>
            <span>
              <strong>{filteredGroups.reduce((sum, g) => sum + g.assignments.length, 0)}</strong> bài tập
            </span>
            {searchKeyword && (
              <span className="text-teal-600 font-medium">
                (kết quả cho &quot;{searchKeyword}&quot;)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition cursor-pointer"
              title="Mở rộng tất cả các thư mục lớp"
            >
              <i className="fas fa-angles-down text-[10px]" />
              <span>Mở rộng tất cả</span>
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              title="Thu gọn tất cả các thư mục lớp"
            >
              <i className="fas fa-angles-up text-[10px]" />
              <span>Thu gọn tất cả</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main List: Grouped by Class (Folder & Accordion View) */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-16 flex justify-center">
          <Spinner />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-16 text-center text-slate-400 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 text-teal-500 flex items-center justify-center text-2xl">
            <i className="fas fa-folder-open" />
          </div>
          <div>
            <h4 className="font-bold text-slate-700 text-sm">
              {searchKeyword || filterClass !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                ? 'Không tìm thấy bài tập phù hợp'
                : 'Chưa có lớp học phần nào'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchKeyword || filterClass !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc để xem toàn bộ bài tập.'
                : 'Bạn chưa đăng ký lớp học phần nào hoặc các lớp bạn học hiện chưa có bài tập nào được giao.'}
            </p>
          </div>
          {(searchKeyword || filterClass !== 'all' || filterStatus !== 'all' || filterType !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('');
                setFilterClass('all');
                setFilterStatus('all');
                setFilterType('all');
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-bold transition cursor-pointer"
            >
              <i className="fas fa-rotate-left text-[11px]" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedKeys.has(group.key);
            const hasAssignments = group.assignments.length > 0;
            const completedCount = group.assignments.filter((a) => a.mySubmission).length;
            const pendingCount = group.assignments.filter(
              (a) => !a.mySubmission && !isPastDue(a.dueDate)
            ).length;
            const overdueCount = group.assignments.filter(
              (a) => !a.mySubmission && isPastDue(a.dueDate)
            ).length;

            return (
              <div
                key={group.key}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all duration-200 overflow-hidden"
              >
                {/* Folder Header (Click to expand/collapse) */}
                <div
                  onClick={() => toggleExpand(group.key)}
                  className={`p-4 sm:p-5 cursor-pointer select-none transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                    isExpanded ? 'bg-slate-50/70 border-b border-slate-100' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Left: Folder Icon & Class Information */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border transition-colors ${
                        hasAssignments
                          ? 'bg-gradient-to-br from-teal-50 to-emerald-100/60 text-teal-600 border-teal-200/80'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      <i className={`fas ${isExpanded ? 'fa-folder-open' : 'fa-folder'} text-lg`} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm sm:text-base text-slate-800 tracking-tight">
                          {group.courseName}
                        </span>
                        {group.courseId && (
                          <span className="font-mono text-[11px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-md border border-teal-100">
                            {group.courseId}
                          </span>
                        )}
                        {group.classId && group.classId !== group.courseId && (
                          <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80">
                            Lớp {group.classId}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {group.teacherName && (
                          <span className="inline-flex items-center gap-1">
                            <i className="fas fa-chalkboard-user text-slate-400 text-[11px]" />
                            <span>{group.teacherName}</span>
                          </span>
                        )}
                        {group.room && (
                          <span className="inline-flex items-center gap-1">
                            <i className="fas fa-door-open text-slate-400 text-[11px]" />
                            <span>Phòng {group.room}</span>
                          </span>
                        )}
                        {group.credits != null && (
                          <span className="text-slate-400">
                            • {group.credits} tín chỉ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Assignment Count & Status Badges & Chevron Toggle */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {/* Status Badges */}
                    {hasAssignments ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <i className="fas fa-list-check text-slate-400 text-[10px]" />
                          <span>{group.assignments.length} bài</span>
                        </span>

                        {completedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <i className="fas fa-check text-emerald-500 text-[10px]" />
                            <span>Đã nộp: {completedCount}</span>
                          </span>
                        )}

                        {pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <i className="fas fa-clock text-amber-500 text-[10px]" />
                            <span>Cần làm: {pendingCount}</span>
                          </span>
                        )}

                        {overdueCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <i className="fas fa-circle-exclamation text-rose-500 text-[10px]" />
                            <span>Quá hạn: {overdueCount}</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        <i className="fas fa-folder-closed text-slate-400 text-[11px]" />
                        <span>0 bài tập</span>
                      </span>
                    )}

                    <button
                      type="button"
                      aria-label={isExpanded ? 'Thu gọn thư mục lớp' : 'Mở rộng thư mục lớp'}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
                    >
                      <i
                        className={`fas fa-chevron-down text-xs transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-teal-600' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Folder Body (Expanded Content) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-white">
                    {!hasAssignments ? (
                      <div className="py-8 px-4 text-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 space-y-1.5">
                        <i className="fas fa-book-open text-2xl text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          Lớp học phần này hiện chưa có bài tập nào.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Các bài tập trắc nghiệm hoặc bài tập nộp tệp sẽ hiển thị tại đây khi giảng viên giao bài.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.assignments.map((assignment) => (
                          <AssignmentCard
                            key={assignment._id}
                            assignment={assignment}
                            courses={courses}
                            onOpen={(item) => navigate(`/student/assignments/${item._id}`)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StudentAssignmentList;
