import { useState, useRef, useMemo, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../components/ui/FormField.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import { useCourseOptions } from '../shared/useCourseOptions.js';
import { useDocuments, useDocumentMutations, downloadDocument } from '../shared/useDocuments.js';
import { useMyTeacherClasses } from './useTeacherClasses.js';
import { formatDate } from '../../lib/format.js';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMeta(format, link, hasFile) {
  if (link && !hasFile) {
    return {
      icon: 'fa-link',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      label: 'Liên kết',
      type: 'link',
    };
  }
  const ext = (format || '').toLowerCase().replace(/^\./, '');
  if (ext === 'pdf') {
    return {
      icon: 'fa-file-pdf',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      label: 'PDF',
      type: 'pdf',
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      icon: 'fa-file-word',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      label: 'Word',
      type: 'word',
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      icon: 'fa-file-excel',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      label: 'Excel',
      type: 'excel',
    };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return {
      icon: 'fa-file-powerpoint',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      label: 'PowerPoint',
      type: 'powerpoint',
    };
  }
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
    return {
      icon: 'fa-file-video',
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      label: 'Video',
      type: 'video',
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      icon: 'fa-file-zipper',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      label: 'Tệp nén',
      type: 'archive',
    };
  }
  return {
    icon: 'fa-file-lines',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    label: ext ? ext.toUpperCase() : 'Tài liệu',
    type: 'document',
  };
}

export function TeacherDocumentList() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);

  const { data: classesData, isLoading: loadingClasses } = useMyTeacherClasses();
  const myClasses = classesData?.data || [];

  const { courses, isLoading: loadingCourses } = useCourseOptions();

  // Load all documents
  const { data: docsData, isLoading: loadingDocs } = useDocuments('');
  const allDocs = docsData?.data || [];

  const { create, update, remove } = useDocumentMutations();

  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    courseId: '',
    courseName: '',
    classId: '',
    className: '',
    isLockedContext: false,
    name: '',
    files: [],
    link: '',
  });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', link: '', status: 'Công khai', file: null });
  const editFileInputRef = useRef(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filters & State
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [hasInitializedExpand, setHasInitializedExpand] = useState(false);

  // Group documents by Class & Course
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
          docs: [],
        });
      }
    });

    // Fallback: If teacher has accessible courses without separate class sections
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
          docs: [],
        });
      }
    });

    const list = Array.from(map.values());
    const assignedIds = new Set();

    list.forEach((cls) => {
      cls.docs = allDocs.filter((d) => {
        if (d.classRef && cls._id && String(d.classRef) === String(cls._id)) {
          assignedIds.add(d._id);
          return true;
        }
        if (d.classId) {
          const itemCId = String(d.classId).trim().toLowerCase();
          const grpCId = String(cls.classId || '').trim().toLowerCase();
          const grpKey = String(cls.key || '').trim().toLowerCase();
          if (itemCId === grpCId || itemCId === grpKey || itemCId.replace(/[-_]/g, '') === grpCId.replace(/[-_]/g, '')) {
            assignedIds.add(d._id);
            return true;
          }
          return false;
        }
        if (d.courseId && cls.courseId && d.courseId.trim().toUpperCase() === cls.courseId.trim().toUpperCase()) {
          assignedIds.add(d._id);
          return true;
        }
        return false;
      });
    });

    // Place any remaining unassigned documents in a general section
    const unassigned = allDocs.filter((d) => !assignedIds.has(d._id));
    if (unassigned.length > 0) {
      list.push({
        key: 'general-docs',
        classId: 'CHUNG',
        className: 'Tài liệu chung & Học phần khác',
        courseId: 'CHUNG',
        courseName: 'Tài liệu chung',
        room: '',
        schedules: [],
        docs: unassigned,
      });
    }

    return list;
  }, [myClasses, courses, allDocs]);

  const isLoading = loadingClasses || loadingCourses || loadingDocs;

  // Auto-expand all classes that contain documents on first load
  useEffect(() => {
    if (!isLoading && classGroups.length > 0 && !hasInitializedExpand) {
      const initialKeys = new Set();
      classGroups.forEach((g) => {
        if (g.docs.length > 0) initialKeys.add(g.key);
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

  // Filtered classes & documents
  const filteredGroups = useMemo(() => {
    return classGroups
      .filter((grp) => {
        if (filterClass !== 'all' && grp.key !== filterClass && grp.courseId !== filterClass) {
          return false;
        }
        return true;
      })
      .map((grp) => {
        let docs = grp.docs;

        // Filter by Status
        if (filterStatus !== 'all') {
          docs = docs.filter((d) => d.status === filterStatus);
        }

        // Filter by Type
        if (filterType !== 'all') {
          docs = docs.filter((d) => {
            const meta = getFileMeta(d.format, d.link, d.hasFile || d.size > 0);
            return meta.type === filterType;
          });
        }

        // Filter by Keyword
        if (searchKeyword.trim()) {
          const q = searchKeyword.trim().toLowerCase();
          const matchesClass =
            grp.courseName.toLowerCase().includes(q) ||
            grp.courseId.toLowerCase().includes(q) ||
            grp.classId.toLowerCase().includes(q);

          if (!matchesClass) {
            docs = docs.filter(
              (d) =>
                (d.name || '').toLowerCase().includes(q) ||
                (d.link || '').toLowerCase().includes(q)
            );
          }
        }

        return { ...grp, docs };
      })
      .filter((grp) => {
        if (searchKeyword.trim() || filterStatus !== 'all' || filterType !== 'all') {
          return grp.docs.length > 0;
        }
        return true;
      });
  }, [classGroups, filterClass, filterStatus, filterType, searchKeyword]);

  // Handle Document Actions
  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setUploadForm((f) => ({ ...f, files: selected }));
  };

  const openUploadForClass = (group) => {
    setUploadForm({
      courseId: group.courseId && group.courseId !== 'CHUNG' ? group.courseId : '',
      courseName: group.courseName || '',
      classId: group.classId && group.classId !== 'CHUNG' && group.classId !== group.courseId ? group.classId : '',
      className: group.className || '',
      isLockedContext: Boolean(group.courseId && group.courseId !== 'CHUNG'),
      name: '',
      files: [],
      link: '',
    });
    setUploadModal(true);
  };

  const openUploadGeneric = () => {
    const activeGroup =
      filterClass !== 'all'
        ? classGroups.find(
            (g) => g.key === filterClass || g.classId === filterClass || g.courseId === filterClass
          )
        : null;

    if (activeGroup && activeGroup.courseId && activeGroup.courseId !== 'CHUNG') {
      openUploadForClass(activeGroup);
    } else {
      setUploadForm({
        courseId: '',
        courseName: '',
        classId: '',
        className: '',
        isLockedContext: false,
        name: '',
        files: [],
        link: '',
      });
      setUploadModal(true);
    }
  };

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.courseId) {
      toast.error('Vui lòng chọn học phần');
      return;
    }
    if (uploadForm.files.length === 0 && !uploadForm.link.trim()) {
      toast.error('Vui lòng chọn tệp tài liệu hoặc nhập đường link liên kết');
      return;
    }

    try {
      await create.mutateAsync({
        courseId: uploadForm.courseId,
        classId: uploadForm.classId || '',
        name: uploadForm.name.trim(),
        files: uploadForm.files,
        link: uploadForm.link.trim(),
      });
      const count = uploadForm.files.length;
      toast.success(count > 1 ? `Đã tải lên ${count} tài liệu thành công` : 'Đã tải lên tài liệu thành công');
      setUploadModal(false);
      setUploadForm({
        courseId: '',
        courseName: '',
        classId: '',
        className: '',
        isLockedContext: false,
        name: '',
        files: [],
        link: '',
      });
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openEdit = (d) => {
    setEditTarget(d);
    setEditForm({ name: d.name, link: d.link || '' });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Vui lòng nhập tên tài liệu');
      return;
    }
    try {
      await update.mutateAsync({
        id: editTarget._id,
        name: editForm.name.trim(),
        link: editForm.link.trim(),
      });
      toast.success('Đã cập nhật tài liệu');
      setEditTarget(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleStatus = async (doc) => {
    try {
      await update.mutateAsync({ id: doc._id, status: doc.status === 'Công khai' ? 'Ẩn' : 'Công khai' });
      toast.success(doc.status === 'Công khai' ? 'Đã ẩn tài liệu' : 'Đã công khai tài liệu');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onDelete = async (doc) => {
    const ok = await confirm({ title: 'Xóa tài liệu', message: `Xóa "${doc.name}"?`, confirmText: 'Xóa' });
    if (!ok) return;
    try {
      await remove.mutateAsync(doc._id);
      toast.success('Đã xóa tài liệu');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onDownload = async (doc) => {
    try {
      setDownloadingId(doc._id);
      await downloadDocument(doc._id);
    } catch (error) {
      toast.error(error.message || 'Không tải được tài liệu');
    } finally {
      setDownloadingId(null);
    }
  };

  const totalClassesCount = classGroups.length;
  const totalDocsCount = allDocs.length;
  const totalPublicCount = allDocs.filter((d) => d.status === 'Công khai').length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Tài liệu"
        subtitle="Tải lên và quản lý tài liệu học phần được gom nhóm theo từng lớp học phần phụ trách"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 shadow-2xs">
              <i className="fas fa-layer-group text-indigo-500" />
              <span>{totalClassesCount} Lớp học phần</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 shadow-2xs">
              <i className="fas fa-file-lines text-emerald-500" />
              <span>{totalDocsCount} Tài liệu</span>
            </span>
            <button
              type="button"
              onClick={openUploadGeneric}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 whitespace-nowrap transition flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow active:scale-95"
            >
              <i className="fas fa-upload text-xs" />
              <span>Tải lên tài liệu</span>
            </button>
          </div>
        }
      />

      {/* Toolbar: Search, Filters & Quick actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm kiếm tài liệu, tên tệp, môn học hoặc mã lớp..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
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
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer max-w-[220px] truncate"
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
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Công khai">Công khai ({totalPublicCount})</option>
              <option value="Ẩn">Ẩn ({totalDocsCount - totalPublicCount})</option>
            </select>

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="all">Tất cả định dạng</option>
              <option value="pdf">Tệp PDF</option>
              <option value="word">Văn bản Word</option>
              <option value="excel">Bảng tính Excel</option>
              <option value="powerpoint">Slide PowerPoint</option>
              <option value="video">Video</option>
              <option value="link">Liên kết ngoài</option>
            </select>
          </div>
        </div>

        {/* View toggles & Quick Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Hiển thị <strong>{filteredGroups.length}</strong> thư mục lớp</span>
            <span>•</span>
            <span>
              <strong>{filteredGroups.reduce((sum, g) => sum + g.docs.length, 0)}</strong> tài liệu
            </span>
            {searchKeyword && (
              <span className="text-indigo-600 font-medium">
                (kết quả cho &quot;{searchKeyword}&quot;)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
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
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl">
            <i className="far fa-folder-open" />
          </div>
          <div>
            <h4 className="font-bold text-slate-700 text-sm">
              {searchKeyword || filterClass !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                ? 'Không tìm thấy tài liệu phù hợp'
                : 'Chưa có lớp học phần nào'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchKeyword || filterClass !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc để xem toàn bộ tài liệu.'
                : 'Bạn chưa được phân công lớp học phần nào hoặc các lớp phụ trách chưa có tài liệu tải lên.'}
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
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition cursor-pointer"
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
            const hasDocs = group.docs.length > 0;

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
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border transition-colors ${
                        hasDocs
                          ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/60 text-indigo-600 border-indigo-200/80'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      <i className={`fas ${isExpanded ? 'fa-folder-open' : 'fa-folder'} text-lg`} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {group.classId && group.classId !== 'CHUNG' && (
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/80 shrink-0">
                          Lớp {group.classId}
                        </span>
                      )}
                      <h4 className="font-black text-sm sm:text-base text-slate-800 tracking-tight truncate">
                        {group.courseName}
                      </h4>
                      {group.courseId && group.courseId !== 'CHUNG' && group.classId !== group.courseId && (
                        <span className="font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                          {group.courseId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions, Badges & Chevron Toggle */}
                  <div
                    className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                        hasDocs
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <i className={`fas ${hasDocs ? 'fa-file-circle-check text-emerald-500' : 'fa-folder-closed text-slate-400'} text-[11px]`} />
                      <span>{group.docs.length} tài liệu</span>
                    </span>

                    {/* Quick upload button for this specific course */}
                    {group.courseId && group.courseId !== 'CHUNG' && (
                      <button
                        type="button"
                        onClick={() => openUploadForClass(group)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200/60 shadow-2xs transition active:scale-95 cursor-pointer"
                        title="Tải lên tài liệu cho học phần này"
                      >
                        <i className="fas fa-plus text-[10px]" />
                        <span>Thêm tài liệu</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(group.key)}
                      aria-label={isExpanded ? 'Thu gọn thư mục lớp' : 'Mở rộng thư mục lớp'}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                    >
                      <i
                        className={`fas ${
                          isExpanded ? 'fa-chevron-down rotate-180 text-indigo-600' : 'fa-chevron-down'
                        } text-xs transition-transform duration-200`}
                      />
                    </button>
                  </div>
                </div>

                {/* Folder Body (Expanded Content) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-white">
                    {!hasDocs ? (
                      <div className="py-8 px-4 text-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 space-y-2">
                        <i className="far fa-folder-open text-2xl text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          Học phần này hiện chưa có tài liệu nào được tải lên.
                        </p>
                        {group.courseId && group.courseId !== 'CHUNG' && (
                          <button
                            type="button"
                            onClick={() => openUploadForClass(group)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <i className="fas fa-upload text-[11px]" />
                            <span>Tải lên tài liệu ngay</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200/80">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                            <tr>
                              <th className="px-4 py-3">Tên tài liệu</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Định dạng</th>
                              <th className="px-4 py-3 whitespace-nowrap">Link cá nhân / Ngoài</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Trạng thái</th>
                              <th className="px-4 py-3 whitespace-nowrap">Thời gian</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.docs.map((d, idx) => {
                              const meta = getFileMeta(d.format, d.link, d.hasFile || d.size > 0);
                              const sizeText = formatFileSize(d.size);
                              const isDownloading = downloadingId === d._id;

                              return (
                                <tr key={d._id || idx} className="hover:bg-slate-50/80 transition-colors">
                                  {/* Document Name */}
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border text-sm shadow-2xs ${meta.color}`}
                                      >
                                        <i className={`fas ${meta.icon}`} />
                                      </div>
                                      <div className="min-w-0">
                                        <h5 className="font-bold text-slate-800 text-xs hover:text-indigo-600 transition truncate max-w-sm">
                                          {d.name}
                                        </h5>
                                        {sizeText && (
                                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            {sizeText}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Format badge */}
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${meta.color}`}
                                    >
                                      {meta.label}
                                    </span>
                                  </td>

                                  {/* Link */}
                                  <td className="px-4 py-3.5 whitespace-nowrap">
                                    {d.link ? (
                                      <a
                                        href={d.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition border border-blue-100 max-w-[200px] truncate"
                                        title={d.link}
                                      >
                                        <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                                        <span className="truncate">Mở link</span>
                                      </a>
                                    ) : (
                                      <span className="text-slate-300 text-xs italic">Không có</span>
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => toggleStatus(d)}
                                      className={`text-xs font-bold px-2.5 py-1 rounded-full transition cursor-pointer border ${
                                        d.status === 'Công khai'
                                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                          : 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200'
                                      }`}
                                      title="Nhấn để chuyển đổi trạng thái Công khai / Ẩn"
                                    >
                                      {d.status === 'Công khai' ? (
                                        <span className="inline-flex items-center gap-1">
                                          <i className="fas fa-eye text-[10px]" />
                                          <span>Công khai</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1">
                                          <i className="fas fa-eye-slash text-[10px]" />
                                          <span>Ẩn</span>
                                        </span>
                                      )}
                                    </button>
                                  </td>

                                  {/* Upload Date */}
                                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                                    {d.createdAt ? formatDate(d.createdAt) : '—'}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {(d.hasFile || d.size > 0) && (
                                        <button
                                          type="button"
                                          disabled={isDownloading}
                                          onClick={() => onDownload(d)}
                                          className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                                          title="Tải tệp về máy"
                                        >
                                          {isDownloading ? (
                                            <i className="fas fa-spinner fa-spin text-xs" />
                                          ) : (
                                            <i className="fas fa-download text-xs" />
                                          )}
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => openEdit(d)}
                                        className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer"
                                        title="Chỉnh sửa thông tin & link"
                                      >
                                        <i className="fas fa-pen text-xs" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDelete(d)}
                                        className="w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                                        title="Xóa tài liệu"
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

      {/* Upload Modal with multi-files and link input */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Tải lên tài liệu" size="md">
        <form onSubmit={submitUpload} className="space-y-4">
          {uploadForm.isLockedContext ? (
            <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 text-sm shadow-2xs">
                  <i className="fas fa-book-open" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Học phần & Lớp áp dụng</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="font-extrabold text-sm text-slate-800 truncate">
                      {uploadForm.courseName || uploadForm.courseId}
                    </span>
                    <span className="font-mono text-xs font-bold bg-white text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                      {uploadForm.courseId}
                    </span>
                    {uploadForm.classId && (
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        Lớp {uploadForm.classId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-white/90 px-2.5 py-1 rounded-lg border border-indigo-100 shadow-2xs">
                <i className="fas fa-lock text-[10px]" />
                <span>Tự động gán</span>
              </span>
            </div>
          ) : (
            <FormField label="Học phần" required>
              <select
                className={inputClass}
                value={uploadForm.courseId}
                onChange={(e) => {
                  const found = courses.find((c) => c.id === e.target.value);
                  setUploadForm((f) => ({
                    ...f,
                    courseId: e.target.value,
                    courseName: found?.name || '',
                  }));
                }}
              >
                <option value="">Chọn học phần</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField
            label="Chọn tệp tài liệu (chọn được 2 - 3 tệp cùng lúc)"
            hint="Hỗ trợ các định dạng PDF, Word, Excel, PowerPoint, ZIP, hình ảnh..."
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition cursor-pointer"
              onChange={handleFilesChange}
            />
            {uploadForm.files.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-gray-700">Đã chọn {uploadForm.files.length} tệp:</p>
                <div className="flex flex-wrap gap-1.5">
                  {uploadForm.files.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100"
                    >
                      <i className="fas fa-file-alt text-[10px]" />
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <span className="text-gray-400 text-[10px]">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </FormField>

          <FormField
            label="Đường link tài liệu cá nhân / ngoài (nếu có)"
            hint="VD: Liên kết chia sẻ Google Drive, OneDrive, GitHub, tài liệu tham khảo trực tuyến..."
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <i className="fas fa-link text-xs" />
              </div>
              <input
                type="url"
                className={`${inputClass} pl-9`}
                placeholder="https://drive.google.com/..."
                value={uploadForm.link}
                onChange={(e) => setUploadForm((f) => ({ ...f, link: e.target.value }))}
              />
            </div>
          </FormField>

          {uploadForm.files.length <= 1 && (
            <FormField label="Tên hiển thị (Tùy chọn)">
              <input
                className={inputClass}
                value={uploadForm.name}
                onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mặc định lấy tên tệp hoặc đường link"
              />
            </FormField>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setUploadModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
            >
              {create.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Đang tải lên...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-upload text-xs" />
                  <span>Tải lên</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal for Name & Link */}
      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Chỉnh sửa tài liệu" size="sm">
        <form onSubmit={submitEdit} className="space-y-4">
          <FormField label="Tên tài liệu" required>
            <input
              className={inputClass}
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>

          <FormField
            label="Đường link tài liệu cá nhân / ngoài"
            hint="Liên kết Google Drive, OneDrive, GitHub..."
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <i className="fas fa-link text-xs" />
              </div>
              <input
                type="url"
                className={`${inputClass} pl-9`}
                value={editForm.link}
                onChange={(e) => setEditForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              {update.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TeacherDocumentList;
