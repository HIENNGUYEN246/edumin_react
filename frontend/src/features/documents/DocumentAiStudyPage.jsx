import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../api/documentsApi.js';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { ROLES } from '../../app/navConfig.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { formatDate } from '../../lib/format.js';

export function DocumentAiStudyPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isTeacherOrAdmin =
    user?.role === ROLES.TEACHER ||
    user?.role === ROLES.ADMIN ||
    user?.role === 'giao-vien' ||
    user?.role === 'dao-tao' ||
    user?.role === 'admin';

  const activeTab = searchParams.get('tab') === 'quiz' ? 'quiz' : 'summary';

  // Sync activeTab with URL search params
  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  // Fetch AI study data
  const {
    data: studyResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['document-ai-study', id],
    queryFn: () => documentsApi.getAiStudy(id),
    enabled: Boolean(id),
  });

  const studyData = studyResponse?.data || studyResponse;
  const doc = studyData?.document;
  const summaryData = studyData?.summary;
  const quizData = studyData?.quiz;

  // ==================== SUMMARY STATE (TEACHER) ====================
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryMarkdown, setSummaryMarkdown] = useState('');
  const [keyConcepts, setKeyConcepts] = useState([]);
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);

  // Current values from server for viewing
  const currentSummaryText =
    summaryData?.publishedSummary || summaryData?.content || summaryData?.aiSummary || '';

  const currentKeyConcepts = useMemo(() => {
    return (
      (summaryData?.publishedKeyConcepts?.length
        ? summaryData.publishedKeyConcepts
        : summaryData?.keyConcepts?.length
        ? summaryData.keyConcepts
        : summaryData?.aiKeyConcepts) || []
    );
  }, [summaryData]);

  const handleStartEditSummary = () => {
    setSummaryMarkdown(currentSummaryText);
    setKeyConcepts(
      currentKeyConcepts.map((c) => ({
        concept: c.concept || '',
        definition: c.definition || '',
        formula: c.formula || '',
      }))
    );
    setIsEditingSummary(true);
  };

  // ==================== QUIZ STATE ====================
  // Teacher Quiz Editing
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [isRegeneratingQuiz, setIsRegeneratingQuiz] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizCount, setQuizCount] = useState(5);

  // Student Quiz Taking State
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionIndex]: optionIndex }
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // Server quiz questions list (fallback chain)
  const serverQuizList = useMemo(() => {
    if (isTeacherOrAdmin) {
      if (quizData?.publishedQuizzes?.length) return quizData.publishedQuizzes;
      if (quizData?.aiQuizzes?.length) return quizData.aiQuizzes;
      if (quizData?.questions?.length) return quizData.questions;
      return [];
    }
    return quizData?.questions || [];
  }, [isTeacherOrAdmin, quizData]);

  const currentQuizList = isEditingQuiz ? quizzes : serverQuizList;

  const handleStartEditQuiz = () => {
    const sourceList = serverQuizList.length > 0 ? serverQuizList : [];
    setQuizzes(
      sourceList.map((q) => ({
        question: q.question || '',
        options: Array.isArray(q.options) && q.options.length ? [...q.options] : ['A', 'B', 'C', 'D'],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || '',
        concept: q.concept || '',
      }))
    );
    setIsEditingQuiz(true);
  };

  // Reset local edit / quiz submission state when document ID changes
  useEffect(() => {
    setIsEditingSummary(false);
    setIsEditingQuiz(false);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScore(0);
  }, [id]);

  // ==================== MUTATIONS ====================
  const publishSummaryMutation = useMutation({
    mutationFn: (payload) => documentsApi.publishSummary(id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['document-ai-study', id] });
      toast.success(res?.message || 'Lưu & Phát hành tóm tắt thành công');
      setIsEditingSummary(false);
    },
    onError: (err) => {
      toast.error(err?.message || 'Lỗi khi lưu tóm tắt');
    },
  });

  const publishQuizMutation = useMutation({
    mutationFn: (payload) => documentsApi.publishQuiz(id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['document-ai-study', id] });
      toast.success(res?.message || 'Lưu & Phát hành bộ câu hỏi Quiz thành công');
      setIsEditingQuiz(false);
    },
    onError: (err) => {
      toast.error(err?.message || 'Lỗi khi lưu bộ câu hỏi Quiz');
    },
  });

  // Re-generate Summary via AI
  const handleRegenerateSummary = async () => {
    try {
      setIsRegeneratingSummary(true);
      toast.info('Trí tuệ nhân tạo đang phân tích tài liệu và tóm tắt lại...');
      const res = await documentsApi.summarize(id);
      const newSummary = res?.summaryMarkdown || res?.data?.summaryMarkdown || res?.summary;
      const newConcepts = res?.coreConcepts || res?.keyConcepts || res?.data?.coreConcepts;
      if (newSummary) {
        setSummaryMarkdown(newSummary);
        if (newConcepts?.length) setKeyConcepts(newConcepts);
        toast.success('Đã làm mới nội dung tóm tắt bằng AI');
        setIsEditingSummary(true);
      }
    } catch (err) {
      toast.error(err?.message || 'Không thể tạo lại tóm tắt');
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  // Re-generate Quiz via AI
  const handleRegenerateQuiz = async () => {
    try {
      setIsRegeneratingQuiz(true);
      toast.info('Trí tuệ nhân tạo đang sinh bộ câu hỏi trắc nghiệm mới...');
      const res = await documentsApi.generateQuiz(id, {
        count: Number(quizCount) || 5,
        difficulty: quizDifficulty,
      });
      const newQuizzes = res?.quizzes || res?.questions || res?.data?.quizzes || res?.data?.questions;
      if (newQuizzes?.length) {
        setQuizzes(newQuizzes);
        toast.success(`Đã sinh ${newQuizzes.length} câu hỏi trắc nghiệm mới bằng AI`);
        setIsEditingQuiz(true);
      }
    } catch (err) {
      toast.error(err?.message || 'Không thể tạo lại bộ câu hỏi');
    } finally {
      setIsRegeneratingQuiz(false);
    }
  };

  // Save Summary Handler
  const handleSaveSummary = (publish = true) => {
    publishSummaryMutation.mutate({
      summary: summaryMarkdown,
      keyConcepts,
      isPublished: publish,
    });
  };

  // Add Concept Row
  const handleAddConcept = () => {
    setKeyConcepts((prev) => [
      ...prev,
      { concept: '', definition: '', formula: '' },
    ]);
  };

  const handleUpdateConcept = (idx, field, value) => {
    setKeyConcepts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleDeleteConcept = (idx) => {
    setKeyConcepts((prev) => prev.filter((_, i) => i !== idx));
  };

  // Quiz Editor Handlers
  const handleAddQuestion = () => {
    setQuizzes((prev) => [
      ...prev,
      {
        question: 'Câu hỏi mới',
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
        correctIndex: 0,
        explanation: 'Giải thích lý do lựa chọn đáp án đúng...',
        concept: '',
      },
    ]);
  };

  const handleUpdateQuestion = (qIdx, field, val) => {
    setQuizzes((prev) => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], [field]: val };
      return copy;
    });
  };

  const handleUpdateOption = (qIdx, optIdx, val) => {
    setQuizzes((prev) => {
      const copy = [...prev];
      const opts = [...(copy[qIdx].options || ['A', 'B', 'C', 'D'])];
      opts[optIdx] = val;
      copy[qIdx] = { ...copy[qIdx], options: opts };
      return copy;
    });
  };

  const handleDeleteQuestion = (qIdx) => {
    setQuizzes((prev) => prev.filter((_, i) => i !== qIdx));
  };

  const handleSaveQuiz = (publish = true) => {
    publishQuizMutation.mutate({
      quizzes,
      isPublished: publish,
    });
  };

  // Student Quiz Interaction Handlers
  const handleSelectOption = (qIdx, optIdx) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleGradeQuiz = () => {
    if (!currentQuizList.length) return;
    let correctCount = 0;
    currentQuizList.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });
    setScore(correctCount);
    setIsSubmitted(true);
    toast.success(`Đã nộp bài! Bạn đạt ${correctCount}/${currentQuizList.length} điểm.`);
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScore(0);
  };

  const handleCopySummary = () => {
    const textToCopy = currentSummaryText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    toast.success('Đã sao chép nội dung tóm tắt vào clipboard');
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isTeacherOrAdmin ? '/teacher/documents' : '/student/documents');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-4">
        <Spinner />
        <p className="text-xs text-slate-500 font-medium">Đang tải trung tâm AI Tóm tắt & Ôn tập Quiz...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-2xl border border-rose-100">
            <i className="fas fa-file-circle-xmark" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base">Không tìm thấy tài liệu</h3>
            <p className="text-xs text-slate-500">{error?.message || 'Tài liệu không khả dụng hoặc bạn chưa có quyền truy cập.'}</p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow cursor-pointer"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const isSummaryPublished = Boolean(summaryData?.isPublished || summaryData?.isTeacherPublished);
  const isQuizPublished = Boolean(quizData?.isPublished || quizData?.isTeacherPublished);

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans">
      {/* Header Sticky Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/90 shadow-2xs px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back button & Document Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer shadow-2xs hover:shadow active:scale-95 shrink-0"
              title="Quay lại danh sách"
            >
              <i className="fas fa-arrow-left text-xs" />
              <span className="hidden sm:inline">Quay lại</span>
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs text-base">
              <i className="fas fa-brain" />
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase shrink-0">
                  Trung tâm AI Study
                </span>
                <h1 className="font-bold text-slate-800 text-sm sm:text-base truncate max-w-lg" title={doc.name}>
                  {doc.name}
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Môn: <span className="font-semibold text-slate-700">{doc.courseName || doc.courseId}</span>
                {doc.classId && <span> · Lớp: <span className="font-semibold text-slate-700">{doc.className || doc.classId}</span></span>}
                {doc.uploadedBy && <span> · Đăng bởi: <span className="text-slate-600">{doc.uploadedBy}</span></span>}
              </p>
            </div>
          </div>

          {/* Right: Tab Switching Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs self-start md:self-auto shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => handleTabChange('summary')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-book-open text-xs" />
              <span>AI Tóm tắt bài học</span>
              {isSummaryPublished && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đã phát hành" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('quiz')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'quiz'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-spell-check text-xs" />
              <span>Ôn tập Quiz trắc nghiệm</span>
              {isQuizPublished && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đã phát hành" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: AI TÓM TẮT BÀI HỌC                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Status & Control Banner */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base ${
                  isSummaryPublished ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-purple-50 text-purple-600 border border-purple-200'
                }`}>
                  <i className={`fas ${isSummaryPublished ? 'fa-circle-check' : 'fa-wand-magic-sparkles'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      {isSummaryPublished ? 'Bản Tóm tắt đã được Giáo viên phát hành' : 'Tóm tắt bài học & Khái niệm cốt lõi'}
                    </h3>
                    {isSummaryPublished ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đã công khai cho Sinh viên
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Bản tự động tạo bởi AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSummaryPublished
                      ? `Hiệu đính bởi: ${summaryData?.publishedBy || 'Giáo viên phụ trách'} · Cập nhật: ${summaryData?.publishedAt ? formatDate(summaryData.publishedAt) : 'Mới đây'}`
                      : 'Trợ lý AI EduMin tự động phân tích và trích xuất cấu trúc kiến thức trọng tâm.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                {isTeacherOrAdmin ? (
                  <>
                    <button
                      type="button"
                      disabled={isRegeneratingSummary}
                      onClick={handleRegenerateSummary}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition border border-purple-200 shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Yêu cầu AI phân tích lại toàn bộ tài liệu"
                    >
                      <i className={`fas fa-rotate ${isRegeneratingSummary ? 'fa-spin' : ''} text-[11px]`} />
                      <span>{isRegeneratingSummary ? 'Đang tạo lại...' : 'Tạo lại bằng AI'}</span>
                    </button>

                    {!isEditingSummary ? (
                      <button
                        type="button"
                        onClick={handleStartEditSummary}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                      >
                        <i className="fas fa-pen-to-square text-[11px]" />
                        <span>Chỉnh sửa nội dung</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingSummary(false)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSummary(true)}
                          disabled={publishSummaryMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <i className="fas fa-paper-plane text-[11px]" />
                          <span>{publishSummaryMutation.isPending ? 'Đang lưu...' : 'Lưu & Phát hành'}</span>
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition border border-indigo-200 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <i className="fas fa-copy text-[11px]" />
                    <span>Sao chép tóm tắt</span>
                  </button>
                )}
              </div>
            </div>

            {/* Teacher Edit Mode */}
            {isTeacherOrAdmin && isEditingSummary ? (
              <div className="space-y-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="font-bold text-slate-800 text-sm">Chỉnh sửa nội dung tóm tắt & Khái niệm trọng tâm</h4>
                  <p className="text-xs text-slate-500">Giáo viên có thể sửa lại câu từ, bổ sung công thức và điều chỉnh nội dung trước khi phát hành cho sinh viên.</p>
                </div>

                {/* Markdown text editor */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Nội dung tóm tắt chính (Hỗ trợ cú pháp Markdown)
                  </label>
                  <textarea
                    rows={12}
                    value={summaryMarkdown}
                    onChange={(e) => setSummaryMarkdown(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3.5 text-xs text-slate-800 font-mono leading-relaxed focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                    placeholder="Nhập nội dung tóm tắt..."
                  />
                </div>

                {/* Core concepts table editor */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Danh sách Khái niệm & Công thức then chốt ({keyConcepts.length})
                    </label>
                    <button
                      type="button"
                      onClick={handleAddConcept}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer"
                    >
                      <i className="fas fa-plus text-[10px]" />
                      <span>Thêm khái niệm</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {keyConcepts.map((kc, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 relative">
                        <button
                          type="button"
                          onClick={() => handleDeleteConcept(idx)}
                          className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition"
                          title="Xóa khái niệm này"
                        >
                          <i className="fas fa-trash-can text-xs" />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                          <div>
                            <span className="text-[11px] font-bold text-slate-600">Thuật ngữ / Khái niệm:</span>
                            <input
                              type="text"
                              value={kc.concept || ''}
                              onChange={(e) => handleUpdateConcept(idx, 'concept', e.target.value)}
                              className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:border-indigo-500 outline-none"
                              placeholder="VD: Tiến trình (Process)"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-600">Công thức / Cú pháp (nếu có):</span>
                            <input
                              type="text"
                              value={kc.formula || ''}
                              onChange={(e) => handleUpdateConcept(idx, 'formula', e.target.value)}
                              className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:border-indigo-500 outline-none"
                              placeholder="VD: TAT = CT - AT"
                            />
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-600">Định nghĩa / Giải thích ngắn gọn:</span>
                          <textarea
                            rows={2}
                            value={kc.definition || ''}
                            onChange={(e) => handleUpdateConcept(idx, 'definition', e.target.value)}
                            className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-indigo-500 outline-none"
                            placeholder="Mô tả ý nghĩa của khái niệm..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Save buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingSummary(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveSummary(true)}
                    disabled={publishSummaryMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <i className="fas fa-check text-xs" />
                    <span>Lưu & Phát hành cho sinh viên</span>
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode for Summary */
              <div className="space-y-6">
                {/* Core Concepts Card Grid */}
                {currentKeyConcepts && currentKeyConcepts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <i className="fas fa-lightbulb text-sm" />
                      <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        Khái niệm cốt lõi & Công thức trọng tâm
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentKeyConcepts.map((kc, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50/80 to-white shadow-2xs space-y-2 hover:border-indigo-200 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-bold text-slate-800 text-xs text-indigo-700 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">
                                {idx + 1}
                              </span>
                              <span>{kc.concept || `Khái niệm ${idx + 1}`}</span>
                            </h5>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{kc.definition}</p>
                          {kc.formula && (
                            <div className="p-2 rounded-lg bg-indigo-50/60 border border-indigo-100/80 text-[11px] font-mono text-indigo-900 font-semibold">
                              ⚡ {kc.formula}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Markdown Text Box */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8">
                  <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-700">
                    {currentSummaryText || 'Chưa có nội dung tóm tắt cho tài liệu này.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ÔN TẬP QUIZ TRẮC NGHIỆM                                            */}
        {/* ========================================================================= */}
        {activeTab === 'quiz' && (
          <div className="space-y-6">
            {/* Status & Control Banner */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base ${
                  isQuizPublished ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}>
                  <i className={`fas ${isQuizPublished ? 'fa-clipboard-check' : 'fa-bolt'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      {isQuizPublished ? 'Bộ câu hỏi Quiz đã được Giáo viên phát hành' : 'Bộ câu hỏi trắc nghiệm ôn tập AI'}
                    </h3>
                    {isQuizPublished ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {currentQuizList.length} câu hỏi · Đã phát hành
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {currentQuizList.length} câu hỏi AI
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isQuizPublished
                      ? `Biên soạn & duyệt bởi: ${quizData?.publishedBy || 'Giáo viên'} · Ngày cập nhật: ${quizData?.publishedAt ? formatDate(quizData.publishedAt) : 'Mới đây'}`
                      : 'Hệ thống tự động biên soạn câu hỏi trắc nghiệm khách quan từ nội dung bài học.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Teacher */}
              {isTeacherOrAdmin && (
                <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                  {!isEditingQuiz ? (
                    <>
                      {/* AI Generator options popup/controls */}
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                        <select
                          value={quizDifficulty}
                          onChange={(e) => setQuizDifficulty(e.target.value)}
                          className="bg-transparent font-semibold text-slate-700 py-1 px-2 outline-none cursor-pointer"
                        >
                          <option value="easy">Độ khó: Dễ</option>
                          <option value="medium">Độ khó: Trung bình</option>
                          <option value="hard">Độ khó: Nâng cao</option>
                        </select>
                        <select
                          value={quizCount}
                          onChange={(e) => setQuizCount(Number(e.target.value))}
                          className="bg-transparent font-semibold text-slate-700 py-1 px-2 outline-none cursor-pointer"
                        >
                          <option value={5}>5 câu</option>
                          <option value={10}>10 câu</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={isRegeneratingQuiz}
                        onClick={handleRegenerateQuiz}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition border border-amber-200 shadow-2xs cursor-pointer disabled:opacity-50"
                        title="Tạo lại bộ câu hỏi bằng AI"
                      >
                        <i className={`fas fa-bolt ${isRegeneratingQuiz ? 'fa-spin' : ''} text-[11px]`} />
                        <span>{isRegeneratingQuiz ? 'Đang tạo...' : 'Tạo mới bằng AI'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStartEditQuiz}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                      >
                        <i className="fas fa-pen-to-square text-[11px]" />
                        <span>Chỉnh sửa câu hỏi</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleAddQuestion}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer"
                      >
                        <i className="fas fa-plus text-[10px]" />
                        <span>Thêm câu hỏi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingQuiz(false)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveQuiz(true)}
                        disabled={publishQuizMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <i className="fas fa-paper-plane text-[11px]" />
                        <span>{publishQuizMutation.isPending ? 'Đang lưu...' : 'Lưu & Phát hành'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* TEACHER EDIT MODE */}
            {isTeacherOrAdmin && isEditingQuiz ? (
              <div className="space-y-6">
                {quizzes.map((q, qIdx) => (
                  <div key={qIdx} className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4 relative">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <span className="font-bold text-indigo-600 text-xs uppercase tracking-wide">
                        Câu hỏi số #{qIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(qIdx)}
                        className="text-slate-400 hover:text-rose-600 text-xs font-bold inline-flex items-center gap-1 transition"
                      >
                        <i className="fas fa-trash-can" />
                        <span>Xóa câu hỏi</span>
                      </button>
                    </div>

                    {/* Question text */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nội dung câu hỏi:
                      </label>
                      <textarea
                        rows={2}
                        value={q.question || ''}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'question', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:border-indigo-500 outline-none transition"
                        placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
                      />
                    </div>

                    {/* Options (A, B, C, D) with Radio to pick correct option */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Các phương án trả lời (Tích chọn nút tròn cho đáp án đúng):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A', 'B', 'C', 'D'].map((label, optIdx) => (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                              q.correctIndex === optIdx
                                ? 'border-emerald-300 bg-emerald-50/50'
                                : 'border-slate-200 bg-slate-50/60'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correctIndex === optIdx}
                              onChange={() => handleUpdateQuestion(qIdx, 'correctIndex', optIdx)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              title="Đặt làm đáp án đúng"
                            />
                            <span className="font-bold text-xs text-slate-700">{label}.</span>
                            <input
                              type="text"
                              value={q.options?.[optIdx] || ''}
                              onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                              className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-indigo-500 outline-none"
                              placeholder={`Nội dung lựa chọn ${label}...`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Giải thích đáp án & Gợi ý cho sinh viên:
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => handleUpdateQuestion(qIdx, 'explanation', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-indigo-500 outline-none"
                        placeholder="Giải thích vì sao đáp án này là chính xác..."
                      />
                    </div>
                  </div>
                ))}

                {/* Footer Controls */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer"
                  >
                    <i className="fas fa-plus text-xs" />
                    <span>Thêm câu hỏi mới</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingQuiz(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveQuiz(true)}
                      disabled={publishQuizMutation.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <i className="fas fa-check text-xs" />
                      <span>Lưu & Phát hành cho sinh viên</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* VIEW / INTERACTIVE QUIZ MODE */
              <div className="space-y-6">
                {/* Result Score Banner when submitted */}
                {isSubmitted && (
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider">
                        Kết quả bài ôn tập trắc nghiệm
                      </span>
                      <h3 className="text-2xl font-black">
                        Bạn đạt {score} / {currentQuizList.length} câu đúng ({currentQuizList.length ? Math.round((score / currentQuizList.length) * 100) : 0}%)
                      </h3>
                      <p className="text-xs text-indigo-100">
                        {score === currentQuizList.length
                          ? 'Xuất sắc! Bạn đã nắm vững toàn bộ kiến thức trọng tâm của bài học.'
                          : 'Bạn đã hoàn thành bài ôn tập. Hãy xem lại phần giải thích chi tiết bên dưới nhé!'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetQuiz}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
                    >
                      <i className="fas fa-rotate-right text-xs" />
                      <span>Làm lại Quiz</span>
                    </button>
                  </div>
                )}

                {/* Questions List */}
                {currentQuizList.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-8 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                      <i className="fas fa-inbox" />
                    </div>
                    <p className="text-xs text-slate-500">Chưa có câu hỏi trắc nghiệm nào cho tài liệu này.</p>
                    {isTeacherOrAdmin && (
                      <button
                        type="button"
                        onClick={handleRegenerateQuiz}
                        disabled={isRegeneratingQuiz}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                      >
                        <i className={`fas fa-bolt ${isRegeneratingQuiz ? 'fa-spin' : ''}`} />
                        <span>Tạo câu hỏi ngay bằng AI</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {currentQuizList.map((q, qIdx) => {
                      const isChosen = selectedAnswers[qIdx] !== undefined;
                      const isCorrect = isSubmitted && selectedAnswers[qIdx] === q.correctIndex;

                      return (
                        <div
                          key={qIdx}
                          className={`bg-white rounded-2xl border transition shadow-2xs p-5 sm:p-6 space-y-4 ${
                            isSubmitted
                              ? isCorrect
                                ? 'border-emerald-300 ring-1 ring-emerald-200'
                                : 'border-rose-300 ring-1 ring-rose-200'
                              : 'border-slate-200/90'
                          }`}
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-black">
                                {qIdx + 1}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                                Câu hỏi #{qIdx + 1}
                              </span>
                            </div>

                            {isSubmitted && (
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                <i className={`fas ${isCorrect ? 'fa-check' : 'fa-xmark'}`} />
                                <span>{isCorrect ? 'Chính xác' : 'Chưa đúng'}</span>
                              </span>
                            )}
                          </div>

                          {/* Question Title */}
                          <p className="font-bold text-slate-800 text-sm sm:text-base leading-snug">
                            {q.question}
                          </p>

                          {/* 4 Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {(q.options || []).map((opt, optIdx) => {
                              const isOptionSelected = selectedAnswers[qIdx] === optIdx;
                              const isRightAnswer = q.correctIndex === optIdx;

                              let optionStyle = 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 text-slate-700';

                              if (isSubmitted) {
                                if (isRightAnswer) {
                                  optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-400';
                                } else if (isOptionSelected && !isRightAnswer) {
                                  optionStyle = 'border-rose-500 bg-rose-50 text-rose-900 line-through ring-1 ring-rose-400';
                                } else {
                                  optionStyle = 'border-slate-200 bg-slate-50/40 opacity-60 text-slate-500';
                                }
                              } else if (isOptionSelected) {
                                optionStyle = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold ring-1 ring-indigo-500 shadow-2xs';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={isSubmitted}
                                  onClick={() => handleSelectOption(qIdx, optIdx)}
                                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left text-xs transition cursor-pointer disabled:cursor-default ${optionStyle}`}
                                >
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isOptionSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-600'
                                  }`}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span className="leading-relaxed">{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Explanation Box (Visible after submission or for teacher) */}
                          {(isSubmitted || isTeacherOrAdmin) && q.explanation && (
                            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                              <span className="font-bold flex items-center gap-1.5 text-amber-800">
                                <i className="fas fa-lightbulb text-[11px]" />
                                <span>Giải thích đáp án:</span>
                              </span>
                              <p className="leading-relaxed text-slate-700">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Submit button for Student */}
                {!isTeacherOrAdmin && !isSubmitted && currentQuizList.length > 0 && (
                  <div className="sticky bottom-6 z-20 flex justify-center">
                    <button
                      type="button"
                      disabled={Object.keys(selectedAnswers).length === 0}
                      onClick={handleGradeQuiz}
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-lg hover:shadow-indigo-500/30 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-paper-plane" />
                      <span>
                        Nộp bài ({Object.keys(selectedAnswers).length}/{currentQuizList.length} câu đã chọn)
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default DocumentAiStudyPage;
