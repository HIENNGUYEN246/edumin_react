import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useCourseOptions } from '../../shared/useCourseOptions.js';
import { useAssignments, useAssignmentMutations } from '../../shared/useAssignments.js';
import { useMyTeacherClasses } from '../useTeacherClasses.js';
import { ScheduleRoomBadge } from '../../../components/schedule/ScheduleBadge.jsx';
import { QuizEditor, newQuestion } from './QuizEditor.jsx';
import { SubmissionTable } from './SubmissionTable.jsx';
import { getTodayDate } from '../../../lib/format.js';

function isPastDue(dueDate) {
  if (!dueDate) return false;
  const deadline = new Date(`${dueDate}T23:59:59`);
  return !Number.isNaN(deadline.valueOf()) && new Date() > deadline;
}

const emptyForm = (defaultCourseId = '') => ({
  courseId: defaultCourseId,
  type: 'quiz',
  title: '',
  description: '',
  dueDate: '',
  status: 'Công khai',
  questions: [newQuestion()],
});

export function TeacherAssignmentList() {
  const toast = useToast();
  const confirm = useConfirm();

  const { data: classesData, isLoading: loadingClasses } = useMyTeacherClasses();
  const myClasses = classesData?.data || [];

  const { courses, isLoading: loadingCourses } = useCourseOptions();

  // Load all assignments
  const { data: assignmentsData, isLoading: loadingAssignments } = useAssignments('');
  const allAssignments = assignmentsData?.data || [];

  const { create, update, remove } = useAssignmentMutations();

  const [editor, setEditor] = useState(null); // { mode: 'create' | 'edit', assignment? }
  const [form, setForm] = useState(emptyForm());
  const [viewing, setViewing] = useState(null); // assignment for submissions modal

  // Filters & State
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [hasInitializedExpand, setHasInitializedExpand] = useState(false);

  // Group assignments by Class & Course
  const classGroups = useMemo(() => {
    const map = new Map();

    myClasses.forEach((c) => {
      const key = String(c.id || c._id);
      if (!map.has(key)) {
        map.set(key, {
          key,
          classId: c.id || key,
          className: c.className || 'Lớp học phần',
          courseId: c.courseId || '',
          courseName: c.courseName || c.name || c.courseId,
          room: c.room,
          schedules: c.schedules,
          studyStart: c.studyStart,
          studyEnd: c.studyEnd,
          assignments: [],
        });
      }
    });

    // Fallback: Courses accessible to teacher
    courses.forEach((crs) => {
      const existing = Array.from(map.values()).some((item) => item.courseId === crs.id);
      if (!existing && crs.id) {
        map.set(crs.id, {
          key: crs.id,
          classId: crs.id,
          className: 'Học phần',
          courseId: crs.id,
          courseName: crs.name || crs.id,
          room: '',
          schedules: [],
          assignments: [],
        });
      }
    });

    const list = Array.from(map.values());
    const assignedIds = new Set();

    list.forEach((cls) => {
      cls.assignments = allAssignments.filter((a) => {
        if (a.classId) {
          if (a.classId === cls.classId || a.classId === cls.key) {
            assignedIds.add(a._id);
            return true;
          }
          return false;
        }
        if (a.courseId && a.courseId === cls.courseId) {
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
        room: '',
        schedules: [],
        assignments: unassigned,
      });
    }

    return list;
  }, [myClasses, courses, allAssignments]);

  const isLoading = loadingClasses || loadingCourses || loadingAssignments;

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
          items = items.filter((a) => a.status === filterStatus);
        }

        // Filter by Search Keyword
        if (searchKeyword.trim()) {
          const q = searchKeyword.trim().toLowerCase();
          const matchesClass =
            grp.courseName.toLowerCase().includes(q) ||
            grp.courseId.toLowerCase().includes(q) ||
            grp.classId.toLowerCase().includes(q);

          if (!matchesClass) {
            items = items.filter(
              (a) =>
                (a.title || '').toLowerCase().includes(q) ||
                (a.description || '').toLowerCase().includes(q)
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

  // Actions
  const openCreate = (defaultCourseId = '') => {
    setForm(emptyForm(defaultCourseId));
    setEditor({ mode: 'create' });
  };

  const openEdit = (a) => {
    setForm({
      courseId: a.courseId,
      type: a.type,
      title: a.title,
      description: a.description || '',
      dueDate: a.dueDate || '',
      status: a.status,
      questions: a.questions?.length ? a.questions : [newQuestion()],
    });
    setEditor({ mode: 'edit', assignment: a });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.courseId) return toast.error('Vui lòng chọn học phần');
    if (!form.title.trim()) return toast.error('Vui lòng nhập tiêu đề bài tập');
    const today = getTodayDate();
    if (editor.mode === 'create' && form.dueDate && form.dueDate < today) {
      return toast.error('Hạn nộp bài tập phải từ ngày hôm nay trở về sau');
    }
    try {
      if (editor.mode === 'create') {
        await create.mutateAsync({
          courseId: form.courseId,
          type: form.type,
          title: form.title.trim(),
          description: form.description,
          dueDate: form.dueDate,
          status: form.status,
          questions: form.type === 'quiz' ? form.questions : [],
        });
        toast.success('Đã tạo bài tập thành công');
      } else {
        await update.mutateAsync({
          id: editor.assignment._id,
          title: form.title.trim(),
          description: form.description,
          dueDate: form.dueDate,
          status: form.status,
          questions: form.type === 'quiz' ? form.questions : undefined,
        });
        toast.success('Đã cập nhật bài tập');
      }
      setEditor(null);
    } catch (error) {
      toast.error(error.message, 5000);
    }
  };

  const onDelete = async (a) => {
    const ok = await confirm({
      title: 'Xóa bài tập',
      message: `Xóa "${a.title}"? Toàn bộ kết quả bài nộp của sinh viên cũng sẽ bị xóa.`,
      confirmText: 'Xóa',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(a._id);
      toast.success('Đã xóa bài tập');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const totalClassesCount = classGroups.length;
  const totalAssignmentsCount = allAssignments.length;
  const totalQuizzesCount = allAssignments.filter((a) => a.type === 'quiz').length;
  const totalFilesCount = allAssignments.filter((a) => a.type !== 'quiz').length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Bài tập & Đánh giá"
        subtitle="Tạo và quản lý bài tập trắc nghiệm, bài nộp được gom nhóm theo từng lớp học phần bạn phụ trách"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 shadow-2xs">
              <i className="fas fa-layer-group text-indigo-500" />
              <span>{totalClassesCount} Lớp học phần</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold border border-teal-100 shadow-2xs">
              <i className="fas fa-list-check text-teal-500" />
              <span>{totalAssignmentsCount} Bài tập</span>
            </span>
            <button
              type="button"
              onClick={() => openCreate('')}
              className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 whitespace-nowrap transition flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow active:scale-95"
            >
              <i className="fas fa-plus text-xs" />
              <span>Tạo quiz</span>
            </button>
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
              placeholder="Tìm kiếm bài tập, tiêu đề, môn học hoặc mã lớp..."
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
              <option value="Công khai">Công khai</option>
              <option value="Ẩn">Ẩn</option>
            </select>

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
            >
              <option value="all">Tất cả loại ({totalAssignmentsCount})</option>
              <option value="quiz">Trắc nghiệm ({totalQuizzesCount})</option>
              <option value="file">Tệp đính kèm ({totalFilesCount})</option>
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
                : 'Bạn chưa được phân công lớp học phần nào hoặc các lớp phụ trách chưa có bài tập nào được tạo.'}
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
            const quizCount = group.assignments.filter((a) => a.type === 'quiz').length;
            const fileCount = group.assignments.filter((a) => a.type !== 'quiz').length;

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
                        {group.schedules?.length > 0 && (
                          <ScheduleRoomBadge
                            schedules={group.schedules}
                            room={group.room}
                            studyStart={group.studyStart}
                            studyEnd={group.studyEnd}
                          />
                        )}
                        {group.room && !group.schedules?.length && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <i className="fas fa-door-open text-slate-400 text-[11px]" />
                            <span>Phòng {group.room}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions, Badges & Chevron Toggle */}
                  <div
                    className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                        hasAssignments
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <i className={`fas ${hasAssignments ? 'fa-list-check text-emerald-500' : 'fa-folder-closed text-slate-400'} text-[11px]`} />
                      <span>{group.assignments.length} bài tập</span>
                    </span>

                    {/* Quick create quiz button for this course */}
                    {group.courseId && group.courseId !== 'CHUNG' && (
                      <button
                        type="button"
                        onClick={() => openCreate(group.courseId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold border border-teal-200/60 shadow-2xs transition active:scale-95 cursor-pointer"
                        title="Tạo bài tập / quiz cho học phần này"
                      >
                        <i className="fas fa-plus text-[10px]" />
                        <span>Tạo quiz</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(group.key)}
                      aria-label={isExpanded ? 'Thu gọn thư mục lớp' : 'Mở rộng thư mục lớp'}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                    >
                      <i
                        className={`fas ${
                          isExpanded ? 'fa-chevron-down rotate-180 text-teal-600' : 'fa-chevron-down'
                        } text-xs transition-transform duration-200`}
                      />
                    </button>
                  </div>
                </div>

                {/* Folder Body (Expanded Content) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-white">
                    {!hasAssignments ? (
                      <div className="py-8 px-4 text-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 space-y-2">
                        <i className="fas fa-book-open text-2xl text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          Học phần này hiện chưa có bài tập nào được tạo.
                        </p>
                        {group.courseId && group.courseId !== 'CHUNG' && (
                          <button
                            type="button"
                            onClick={() => openCreate(group.courseId)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <i className="fas fa-plus text-[11px]" />
                            <span>Tạo bài tập trắc nghiệm ngay</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200/80">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                            <tr>
                              <th className="px-4 py-3">Tiêu đề bài tập</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Loại bài</th>
                              <th className="px-4 py-3 whitespace-nowrap">Hạn nộp</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Trạng thái</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Cấu trúc</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.assignments.map((a, idx) => {
                              const isQuiz = a.type === 'quiz';
                              const overdue = isPastDue(a.dueDate);
                              const qCount = a.questions?.length || 0;

                              return (
                                <tr key={a._id || idx} className="hover:bg-slate-50/80 transition-colors">
                                  {/* Title & Description */}
                                  <td className="px-4 py-3.5">
                                    <div className="min-w-0">
                                      <h5 className="font-bold text-slate-800 text-xs hover:text-teal-700 transition truncate max-w-sm">
                                        {a.title}
                                      </h5>
                                      {a.description && (
                                        <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xs mt-0.5">
                                          {a.description}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* Type badge */}
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                        isQuiz
                                          ? 'text-teal-800 bg-teal-50 border-teal-200'
                                          : 'text-cyan-800 bg-cyan-50 border-cyan-200'
                                      }`}
                                    >
                                      <i className={`fas ${isQuiz ? 'fa-list-check' : 'fa-file-lines'} mr-1 text-[9px]`} />
                                      {isQuiz ? 'Trắc nghiệm' : 'Tệp'}
                                    </span>
                                  </td>

                                  {/* Due Date */}
                                  <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                                    {a.dueDate ? (
                                      <span
                                        className={`inline-flex items-center gap-1 text-xs ${
                                          overdue ? 'text-rose-600 font-semibold' : 'text-slate-600'
                                        }`}
                                      >
                                        <i className="far fa-clock text-[11px]" />
                                        <span>{a.dueDate}</span>
                                        {overdue && <span className="text-[10px] text-rose-500 font-bold">(Hết hạn)</span>}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                        a.status === 'Công khai'
                                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                          : 'text-slate-600 bg-slate-100 border-slate-200'
                                      }`}
                                    >
                                      {a.status}
                                    </span>
                                  </td>

                                  {/* Structure (quiz count) */}
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap text-slate-500 text-[11px]">
                                    {isQuiz ? (
                                      <span className="font-semibold text-slate-700">{qCount} câu hỏi</span>
                                    ) : (
                                      <span className="italic text-slate-400">Đính kèm</span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* View Submissions */}
                                      <button
                                        type="button"
                                        onClick={() => setViewing(a)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-700 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 text-xs font-semibold transition cursor-pointer"
                                        title="Xem danh sách bài nộp và kết quả"
                                      >
                                        <i className="fas fa-list-check text-[11px]" />
                                        <span>Bài nộp</span>
                                      </button>

                                      {/* Edit */}
                                      <button
                                        type="button"
                                        onClick={() => openEdit(a)}
                                        className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer"
                                        title="Chỉnh sửa bài tập"
                                      >
                                        <i className="fas fa-pen text-xs" />
                                      </button>

                                      {/* Delete */}
                                      <button
                                        type="button"
                                        onClick={() => onDelete(a)}
                                        className="w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                                        title="Xóa bài tập"
                                      >
                                        <i className="fas fa-trash-alt text-xs" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal for Create / Edit Assignment */}
      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? 'Tạo bài tập mới' : 'Chỉnh sửa bài tập'}
        size="xl"
      >
        {editor && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Học phần" required>
                <select
                  className={inputClass}
                  value={form.courseId}
                  disabled={editor.mode === 'edit'}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                >
                  <option value="">Chọn học phần</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Tiêu đề bài tập" required>
                <input
                  className={inputClass}
                  value={form.title}
                  placeholder="Ví dụ: Kiểm tra giữa kỳ, Bài tập trắc nghiệm..."
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </FormField>

              <FormField label="Hạn nộp bài">
                <input
                  type="date"
                  min={editor.mode === 'create' ? getTodayDate() : undefined}
                  className={inputClass}
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </FormField>

              <FormField label="Trạng thái">
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="Công khai">Công khai</option>
                  <option value="Ẩn">Ẩn</option>
                </select>
              </FormField>
            </div>

            <FormField label="Mô tả bài tập">
              <textarea
                rows="2"
                className={inputClass}
                placeholder="Nội dung tóm tắt hoặc hướng dẫn làm bài cho sinh viên..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </FormField>

            {form.type === 'quiz' && (
              <QuizEditor
                value={form.questions}
                onChange={(questions) => setForm((f) => ({ ...f, questions }))}
              />
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={create.isPending || update.isPending}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition cursor-pointer shadow-2xs"
              >
                {create.isPending || update.isPending ? 'Đang lưu...' : 'Lưu bài tập'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Submissions Modal */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={`Bài nộp — ${viewing?.title || ''}`}
        size="lg"
      >
        {viewing && <SubmissionTable assignmentId={viewing._id} />}
      </Modal>
    </div>
  );
}

export default TeacherAssignmentList;
