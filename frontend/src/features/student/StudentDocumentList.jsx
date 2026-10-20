import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useCourseOptions } from '../shared/useCourseOptions.js';
import { useDocuments, downloadDocument } from '../shared/useDocuments.js';
import { enrollmentsApi } from '../../api/enrollmentsApi.js';
import { formatDate } from '../../lib/format.js';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMeta(format, link, hasFile, fileName = '') {
  if (link && !hasFile) {
    return {
      icon: 'fa-link',
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
      label: 'Liên kết',
      type: 'link',
    };
  }

  let ext = (format || '').toLowerCase().replace(/^\./, '');
  if (!ext || ext === 'raw' || ext === 'image' || ext === 'file') {
    const match = /\.([a-zA-Z0-9]+)$/i.exec(fileName || '');
    if (match) ext = match[1].toLowerCase();
  }

  if (ext === 'pdf') {
    return {
      icon: 'fa-file-pdf',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
      label: 'PDF',
      type: 'pdf',
      canPreview: true,
    };
  }

  if (['doc', 'docx'].includes(ext)) {
    return {
      icon: 'fa-file-word',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
      label: 'Word',
      type: 'word',
      canPreview: true,
    };
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      icon: 'fa-file-excel',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      label: ext === 'csv' ? 'CSV' : 'Excel',
      type: 'excel',
      canPreview: true,
    };
  }

  if (['ppt', 'pptx'].includes(ext)) {
    return {
      icon: 'fa-file-powerpoint',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      label: 'PowerPoint',
      type: 'powerpoint',
      canPreview: true,
    };
  }

  if (['txt', 'md', 'markdown', 'log', 'json'].includes(ext)) {
    return {
      icon: 'fa-file-lines',
      color: 'text-slate-600 bg-slate-100 border-slate-200',
      badgeColor: 'text-slate-700 bg-slate-100 border-slate-200',
      label: ext === 'md' ? 'Markdown' : 'Văn bản TXT',
      type: 'text',
      canPreview: true,
    };
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return {
      icon: 'fa-file-image',
      color: 'text-violet-600 bg-violet-50 border-violet-200',
      badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
      label: 'Hình ảnh',
      type: 'image',
      canPreview: true,
    };
  }

  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return {
      icon: 'fa-file-video',
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      label: 'Video',
      type: 'video',
      canPreview: true,
    };
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      icon: 'fa-file-zipper',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
      badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
      label: 'Tệp nén',
      type: 'archive',
      canPreview: false,
    };
  }

  return {
    icon: 'fa-file-lines',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    label: ext ? ext.toUpperCase() : 'Tài liệu',
    type: 'document',
    canPreview: true,
  };
}





export function StudentDocumentList() {
  const toast = useToast();

  const { data: enrollmentsData, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: enrollmentsApi.mine,
  });
  const enrollments = enrollmentsData?.data || [];

  const { courses, isLoading: loadingCourses } = useCourseOptions();

  // Load all available documents for student's courses
  const { data: docsData, isLoading: loadingDocs } = useDocuments('');
  const allDocs = docsData?.data || [];

  const [downloadingId, setDownloadingId] = useState(null);
  const [filterClass, setFilterClass] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [hasInitializedExpand, setHasInitializedExpand] = useState(false);

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

  const handleAiStudyAction = (doc, group, action = 'summarize') => {
    const documentName = doc.name || 'tài liệu học tập';
    const courseName = group.courseName || group.className || 'môn học';
    const courseId = group.courseId;
    const classId = group.classId;

    window.dispatchEvent(
      new CustomEvent('edumin:ai-study', {
        detail: {
          action: 'summarize',
          documentId: doc._id,
          documentName,
          courseName,
          courseId,
          classId,
          role: 'student',
        },
      })
    );
  };

  // Group documents by Class and Course
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
          docs: [],
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
        teacherName: '',
        credits: null,
        room: '',
        docs: unassigned,
      });
    }

    return list;
  }, [enrollments, courses, allDocs]);

  const isLoading = loadingEnrollments || loadingCourses || loadingDocs;

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

        if (filterType !== 'all') {
          docs = docs.filter((d) => {
            const meta = getFileMeta(d.format, d.link, d.hasFile || d.size > 0, d.fileName || d.name);
            return meta.type === filterType;
          });
        }

        if (searchKeyword.trim()) {
          const q = searchKeyword.trim().toLowerCase();
          const matchesClass =
            grp.courseName.toLowerCase().includes(q) ||
            grp.courseId.toLowerCase().includes(q) ||
            grp.classId.toLowerCase().includes(q) ||
            (grp.teacherName && grp.teacherName.toLowerCase().includes(q));

          if (!matchesClass) {
            docs = docs.filter((d) => (d.name || '').toLowerCase().includes(q));
          }
        }

        return { ...grp, docs };
      })
      .filter((grp) => {
        if (searchKeyword.trim()) {
          const q = searchKeyword.trim().toLowerCase();
          const matchesClass =
            grp.courseName.toLowerCase().includes(q) ||
            grp.courseId.toLowerCase().includes(q) ||
            grp.classId.toLowerCase().includes(q);
          return matchesClass || grp.docs.length > 0;
        }
        return true;
      });
  }, [classGroups, filterClass, filterType, searchKeyword]);

  const totalClassesCount = classGroups.length;
  const totalDocsCount = allDocs.length;
  const totalFilesCount = allDocs.filter((d) => d.hasFile || d.size > 0).length;
  const totalLinksCount = allDocs.filter((d) => d.link && !d.hasFile && !d.size).length;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Tài liệu học phần"
        subtitle="Kho tài liệu, bài giảng và giáo trình được gom nhóm theo từng lớp học phần bạn đang theo học"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 shadow-2xs">
              <i className="fas fa-layer-group text-indigo-500" />
              <span>{totalClassesCount} Lớp học phần</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 shadow-2xs">
              <i className="fas fa-file-lines text-emerald-500" />
              <span>{totalDocsCount} Tài liệu</span>
            </span>
          </div>
        }
      />

      {/* Toolbar: Search, Filters & Expand/Collapse actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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

            {/* Filter by Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="all">Tất cả định dạng</option>
              <option value="pdf">Tệp PDF</option>
              <option value="word">Văn bản Word (.docx, .doc)</option>
              <option value="excel">Bảng tính Excel (.xlsx, .xls)</option>
              <option value="powerpoint">Slide PowerPoint (.pptx, .ppt)</option>
              <option value="text">Văn bản TXT / Markdown</option>
              <option value="image">Hình ảnh</option>
              <option value="archive">Tệp nén (ZIP, RAR...)</option>
              <option value="video">Video bài giảng</option>
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

      {/* Main List: Grouped by Class (File/Folder Card View) */}
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
              {searchKeyword || filterClass !== 'all' || filterType !== 'all'
                ? 'Không tìm thấy tài liệu phù hợp'
                : 'Chưa có lớp học phần nào'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchKeyword || filterClass !== 'all' || filterType !== 'all'
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc để xem toàn bộ tài liệu các lớp.'
                : 'Bạn chưa đăng ký lớp học phần nào hoặc các lớp bạn học hiện chưa có tài liệu được tải lên.'}
            </p>
          </div>
          {(searchKeyword || filterClass !== 'all' || filterType !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('');
                setFilterClass('all');
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
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border transition-colors ${
                        hasDocs
                          ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/60 text-indigo-600 border-indigo-200/80'
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
                          <span className="font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
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

                  {/* Right: Document Count Badge & Chevron Toggle */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
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

                    <button
                      type="button"
                      aria-label={isExpanded ? 'Thu gọn thư mục lớp' : 'Mở rộng thư mục lớp'}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
                    >
                      <i
                        className={`fas fa-chevron-down text-xs transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-indigo-600' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Folder Body (Expanded Content) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-white">
                    {!hasDocs ? (
                      <div className="py-8 px-4 text-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 space-y-1.5">
                        <i className="far fa-folder-open text-2xl text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">
                          Lớp học phần này hiện chưa có tài liệu nào.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Giáo trình, slide bài giảng hoặc bài tập tham khảo sẽ xuất hiện tại đây khi giảng viên tải lên.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200/80">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                            <tr>
                              <th className="px-4 py-3">Tên tài liệu</th>
                              <th className="px-4 py-3 text-center whitespace-nowrap">Định dạng</th>
                              <th className="px-4 py-3 whitespace-nowrap">Dung lượng / Loại</th>
                              <th className="px-4 py-3 whitespace-nowrap">Người đăng</th>
                              <th className="px-4 py-3 whitespace-nowrap">Thời gian</th>
                              <th className="px-4 py-3 text-right whitespace-nowrap">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.docs.map((doc, idx) => {
                              const meta = getFileMeta(doc.format, doc.link, doc.hasFile || doc.size > 0, doc.fileName || doc.name);
                              const sizeText = formatFileSize(doc.size);
                              const isDownloading = downloadingId === doc._id;

                              return (
                                <tr key={doc._id || idx} className="hover:bg-slate-50/80 transition-colors">
                                  {/* Document Name & Icon */}
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border text-sm shadow-2xs ${meta.color}`}
                                      >
                                        <i className={`fas ${meta.icon}`} />
                                      </div>
                                      <div className="min-w-0">
                                        <a
                                          href={`/documents/${doc._id}/view`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-bold text-slate-800 text-xs hover:text-indigo-600 transition truncate max-w-sm inline-block"
                                          title="Nhấn để mở tài liệu trong trang riêng"
                                        >
                                          {doc.name}
                                        </a>
                                        {doc.link && (
                                          <p className="text-[10px] text-purple-600 font-mono truncate max-w-xs mt-0.5">
                                            {doc.link}
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

                                  {/* Size / Type */}
                                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                                    {sizeText ? (
                                      <span className="font-mono text-slate-700 font-semibold">{sizeText}</span>
                                    ) : doc.link ? (
                                      <span className="text-purple-600 italic">Đường dẫn ngoài</span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>

                                  {/* Uploader */}
                                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                                    {doc.uploadedBy || group.teacherName || 'Giảng viên'}
                                  </td>

                                  {/* Uploaded Date */}
                                  <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                                    {doc.createdAt ? formatDate(doc.createdAt) : '—'}
                                  </td>

                                  {/* Action buttons */}
                                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* AI Study Action: Tóm tắt bài học */}
                                      <button
                                        type="button"
                                        onClick={() => handleAiStudyAction(doc, group, 'summarize')}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-2xs"
                                        title="AI tóm tắt các ý chính và khái niệm của tài liệu này"
                                      >
                                        <i className="fas fa-wand-magic-sparkles text-[10px] text-purple-600" />
                                        <span>AI Tóm tắt</span>
                                      </button>

                                      <a
                                        href={`/documents/${doc._id}/view`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition shadow-2xs hover:shadow active:scale-95 cursor-pointer"
                                        title="Mở tài liệu trong trang riêng để xem trước"
                                      >
                                        <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                                        <span>Xem trước</span>
                                      </a>

                                      {(doc.hasFile || doc.size > 0 || (doc.format && doc.format !== 'Liên kết')) && (
                                        <button
                                          type="button"
                                          disabled={isDownloading}
                                          onClick={() => onDownload(doc)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs hover:shadow transition active:scale-95 cursor-pointer disabled:opacity-50"
                                          title="Tải tệp tài liệu về máy"
                                        >
                                          {isDownloading ? (
                                            <>
                                              <i className="fas fa-spinner fa-spin text-[10px]" />
                                              <span>Đang tải...</span>
                                            </>
                                          ) : (
                                            <>
                                              <i className="fas fa-download text-[10px]" />
                                              <span>Tải về</span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                      {doc.link && (
                                        <a
                                          href={doc.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition shadow-2xs hover:shadow active:scale-95 cursor-pointer"
                                          title="Mở liên kết bài giảng / tài liệu ngoài"
                                        >
                                          <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                                          <span>Mở liên kết</span>
                                        </a>
                                      )}
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
    </div>
  );
}

export default StudentDocumentList;
