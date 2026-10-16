import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { classesApi } from '../../api/classesApi.js';
import { assignmentsApi } from '../../api/assignmentsApi.js';

function useSafeQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}

/**
 * Interactive Quiz Card for EduMin AI Chatbot.
 * Allows students to test their knowledge interactively in chat,
 * see immediate right/wrong feedback, and read detailed rationale explanations.
 * For Teachers, allows direct publishing to Assignments collection with one click.
 */
export function InteractiveQuizCard({ card, onSendMessage, onNavigate, userRole, classes }) {
  const questions = card.questions || [];
  const totalQuestions = questions.length;

  const [answers, setAnswers] = useState({});
  const [copied, setCopied] = useState(false);

  const toast = useToast();
  const queryClient = useSafeQueryClient();

  const isTeacher =
    userRole === 'teacher' ||
    userRole === 'giao-vien' ||
    userRole === 'dao-tao' ||
    userRole === 'admin' ||
    card?.role === 'teacher' ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/teacher'));

  // Load teacher classes for direct assignment publishing
  const [availableClasses, setAvailableClasses] = useState(classes || []);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (classes && classes.length > 0) {
      setAvailableClasses(classes);
      return;
    }
    if (!isTeacher) return;
    let mounted = true;
    setLoadingClasses(true);
    classesApi
      .list(userRole === 'teacher' || userRole === 'giao-vien' ? { teacher: 'me', limit: 200 } : { limit: 200 })
      .then((res) => {
        if (mounted && Array.isArray(res?.data) && res.data.length > 0) {
          setAvailableClasses(res.data);
        } else if (mounted) {
          classesApi
            .list({ limit: 100 })
            .then((fallbackRes) => {
              if (mounted && Array.isArray(fallbackRes?.data)) {
                setAvailableClasses(fallbackRes.data);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        classesApi
          .list({ limit: 100 })
          .then((fallbackRes) => {
            if (mounted && Array.isArray(fallbackRes?.data)) {
              setAvailableClasses(fallbackRes.data);
            }
          })
          .catch(() => {});
      })
      .finally(() => {
        if (mounted) setLoadingClasses(false);
      });
    return () => {
      mounted = false;
    };
  }, [isTeacher, userRole, classes]);

  const defaultClassCode = useMemo(() => {
    if (card.classId) return card.classId;
    if (card.code && card.code !== 'QUIZ') return card.code;
    return availableClasses[0]?.id || 'CNTT101-01';
  }, [card.classId, card.code, availableClasses]);

  const [selectedClassId, setSelectedClassId] = useState(defaultClassCode);

  useEffect(() => {
    if (defaultClassCode && (!selectedClassId || selectedClassId === 'QUIZ')) {
      setSelectedClassId(defaultClassCode);
    }
  }, [defaultClassCode]);

  const defaultDueDate = useMemo(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  }, []);

  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedClassId, setPublishedClassId] = useState('');

  const answeredCount = Object.keys(answers).length;

  const correctCount = useMemo(() => {
    return questions.reduce((acc, q, idx) => {
      const qId = q.id || idx;
      if (answers[qId] !== undefined && answers[qId] === q.correctIndex) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [questions, answers]);

  const score10 = totalQuestions > 0 ? ((correctCount / totalQuestions) * 10).toFixed(1) : 0;
  const isAllAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  const handleSelectOption = (qId, optionIndex) => {
    if (answers[qId] !== undefined) return; // Prevent changing after answered
    setAnswers((prev) => ({
      ...prev,
      [qId]: optionIndex,
    }));
  };

  const handleResetQuiz = () => {
    setAnswers({});
  };

  const handleCopyQuiz = async () => {
    try {
      const textLines = [
        `=== ${card.title || 'BỘ CÂU HỎI QUIZ TRẮC NGHIỆM'} ===`,
        card.subtitle || '',
        '',
        ...questions.map((q, idx) => {
          const qText = `Câu ${idx + 1}: ${q.question || q.text || ''}`;
          const opts = (q.options || []).map((opt, oIdx) => {
            const isCorrect = oIdx === q.correctIndex;
            const prefix = /^[A-D]\.\s*/i.test(opt) ? '' : `${String.fromCharCode(65 + oIdx)}. `;
            return `   ${prefix}${opt}${isCorrect ? ' (Đáp án đúng)' : ''}`;
          });
          const exp = q.explanation ? `   💡 Giải thích: ${q.explanation}` : '';
          return [qText, ...opts, exp, ''].filter(Boolean).join('\n');
        }),
      ];
      await navigator.clipboard.writeText(textLines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleUseAsAssignment = () => {
    const formattedQuestions = questions.map((q, idx) => ({
      id: `q${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      text: q.question || q.text || `Câu hỏi ${idx + 1}`,
      options: Array.isArray(q.options) && q.options.length > 0 ? [...q.options] : ['', '', '', ''],
      correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
    }));

    const payload = {
      title: card.title || `Bài tập Quiz: ${card.subtitle || ''}`,
      classId: selectedClassId || card.code || '',
      courseId: card.courseId || '',
      courseName: card.details?.find((d) => d.label === 'Học phần')?.value || '',
      description: `Bộ câu hỏi trắc nghiệm gồm ${questions.length} câu được tạo tự động từ ${
        card.details?.find((d) => d.label === 'Tài liệu nguồn')?.value || 'tài liệu học phần'
      }.`,
      questions: formattedQuestions,
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('edumin:import-quiz-to-assignment', {
          detail: payload,
        })
      );
    }

    if (onNavigate) {
      onNavigate('/teacher/assignments', { state: { importQuiz: payload } });
    }
  };

  const handleDirectPublish = async () => {
    if (isPublishing || isPublished) return;
    setIsPublishing(true);
    try {
      const targetClass = availableClasses.find(
        (c) => String(c.id || c._id).toLowerCase() === String(selectedClassId || '').toLowerCase()
      );
      const finalCourseId = card.courseId || targetClass?.courseId || card.code || '';
      const finalClassId = selectedClassId || card.classId || card.code || '';

      const formattedQuestions = questions.map((q, idx) => ({
        id: q.id || `q_${Date.now()}_${idx + 1}`,
        text: q.question || q.text || `Câu hỏi ${idx + 1}`,
        options: Array.isArray(q.options) && q.options.length >= 2 ? [...q.options] : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || '',
      }));

      const sourceDocTitle =
        card.details?.find((d) => d.label === 'Tài liệu nguồn')?.value || card.documentName || card.title || 'tài liệu học phần';

      const payload = {
        title: card.title?.replace(/^Bộ Quiz ôn tập:\s*/i, 'Quiz: ') || `Quiz: ${card.subtitle || 'Bài tập trắc nghiệm'}`,
        courseId: finalCourseId,
        classId: finalClassId,
        type: 'quiz',
        dueDate: dueDate || defaultDueDate,
        status: 'Công khai',
        description: `Bộ câu hỏi trắc nghiệm ${questions.length} câu được tạo tự động bởi AI từ ${sourceDocTitle}.`,
        questions: formattedQuestions,
      };

      await assignmentsApi.create(payload);

      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['assignments'] });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('edumin:assignment-created', { detail: payload }));
      }

      setIsPublished(true);
      setPublishedClassId(finalClassId);

      if (toast) {
        toast.success('Đã xuất bản bài tập thành công cho lớp học phần!');
      }
    } catch (error) {
      console.error('Lỗi khi xuất bản bài tập:', error);
      if (toast) {
        toast.error(error?.message || 'Không thể xuất bản bài tập. Vui lòng thử lại!');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="bg-slate-50/95 rounded-2xl p-3.5 sm:p-4 border border-indigo-100 shadow-sm space-y-3.5 text-slate-800 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <i className="fas fa-clipboard-question text-sm" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-[13px] text-slate-900 leading-snug">
              {card.title || 'Bộ câu hỏi Quiz ôn tập'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {card.subtitle || `${totalQuestions} câu hỏi trắc nghiệm ôn tập`}
            </p>
          </div>
        </div>
        {card.code && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
            {card.code}
          </span>
        )}
      </div>

      {/* Live Score & Progress Bar */}
      <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-600 font-medium">
            Tiến độ: <strong className="text-indigo-600">{answeredCount}/{totalQuestions}</strong> câu
          </span>
          <span className="font-semibold text-slate-800">
            Điểm: <span className={correctCount > 0 ? 'text-emerald-600 font-bold' : 'text-slate-700'}>{score10}</span>/10 ({correctCount} đúng)
          </span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* All Answered Celebration Card */}
      {isAllAnswered && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <div>
              <p className="font-bold text-emerald-900">
                Bạn đã hoàn thành bộ Quiz! Đạt {correctCount}/{totalQuestions} câu ({score10}/10 điểm)
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {parseFloat(score10) >= 8
                  ? 'Tuyệt vời! Bạn nắm rất vững kiến thức trong tài liệu.'
                  : parseFloat(score10) >= 6
                  ? 'Khá tốt! Hãy đọc lại phần giải thích bên dưới để củng cố các câu chưa đúng.'
                  : 'Cần ôn tập thêm! Bạn hãy xem kỹ phần giải thích (rationale) để ghi nhớ nhé.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetQuiz}
            className="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-white text-emerald-700 hover:bg-emerald-100/70 border border-emerald-300 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
          >
            Làm lại
          </button>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3.5">
        {questions.map((q, idx) => {
          const qId = q.id || idx;
          const selectedOption = answers[qId];
          const isAnswered = selectedOption !== undefined;
          const isCorrect = isAnswered && selectedOption === q.correctIndex;

          return (
            <div
              key={qId}
              className={`bg-white rounded-xl p-3 sm:p-3.5 border transition-all ${
                isAnswered
                  ? isCorrect
                    ? 'border-emerald-200 bg-emerald-50/20 shadow-2xs'
                    : 'border-rose-200 bg-rose-50/20 shadow-2xs'
                  : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
              }`}
            >
              {/* Question Header & Title */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Câu {idx + 1}
                  </span>
                  {q.concept && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {q.concept}
                    </span>
                  )}
                </div>
                {isAnswered && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      isCorrect
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <i className={`fas ${isCorrect ? 'fa-check' : 'fa-xmark'}`} />
                    <span>{isCorrect ? 'Chính xác' : 'Chưa đúng'}</span>
                  </span>
                )}
              </div>

              {/* Question Text */}
              <p className="text-xs sm:text-[13px] font-semibold text-slate-900 leading-snug mb-3">
                {q.question || q.text}
              </p>

              {/* Options */}
              <div className="grid grid-cols-1 gap-1.5">
                {(q.options || []).map((opt, optIdx) => {
                  const isThisSelected = selectedOption === optIdx;
                  const isThisCorrect = q.correctIndex === optIdx;

                  let optClass = 'bg-slate-50 hover:bg-indigo-50/70 border-slate-200 text-slate-800';
                  let icon = null;

                  if (isAnswered) {
                    if (isThisSelected && isThisCorrect) {
                      optClass = 'bg-emerald-100/80 border-emerald-500 text-emerald-950 font-bold shadow-2xs';
                      icon = <i className="fas fa-check text-emerald-600 shrink-0 text-xs" />;
                    } else if (isThisSelected && !isThisCorrect) {
                      optClass = 'bg-rose-100/80 border-rose-500 text-rose-950 font-bold shadow-2xs';
                      icon = <i className="fas fa-xmark text-rose-600 shrink-0 text-xs" />;
                    } else if (isThisCorrect) {
                      optClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold';
                      icon = <i className="fas fa-check text-emerald-500 shrink-0 text-xs" />;
                    } else {
                      optClass = 'bg-slate-50/60 border-slate-200 text-slate-400 opacity-70';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleSelectOption(qId, optIdx)}
                      className={`text-left px-3 py-2 text-xs rounded-lg border transition-all flex items-start justify-between gap-2 select-none ${optClass} ${
                        !isAnswered ? 'active:scale-[0.99] cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <span className="leading-snug">{opt}</span>
                      {icon}
                    </button>
                  );
                })}
              </div>

              {/* Detailed Rationale Explanation (shown after answered) */}
              {isAnswered && q.explanation && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] leading-relaxed text-amber-950 flex items-start gap-2 shadow-2xs">
                  <i className="fas fa-lightbulb text-amber-500 mt-0.5 shrink-0 text-xs" />
                  <div>
                    <strong className="font-bold text-amber-900 block mb-0.5">
                      💡 Giải thích chi tiết (Rationale):
                    </strong>
                    <span>{q.explanation}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Teacher Direct Publishing Panel */}
      {isTeacher && (
        <div className="bg-gradient-to-br from-indigo-50/70 via-teal-50/50 to-emerald-50/70 border border-teal-200/90 rounded-xl p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs shadow-2xs">
                <i className="fas fa-paper-plane" />
              </span>
              <span className="text-xs font-bold text-slate-900">
                Xuất bản Bài tập trực tiếp cho Sinh viên
              </span>
            </div>
            {isPublished && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <i className="fas fa-circle-check" />
                <span>Đã lưu vào CSDL</span>
              </span>
            )}
          </div>

          {isPublished ? (
            <div className="bg-white/95 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <i className="fas fa-check-circle text-emerald-600 text-sm shrink-0" />
                <span>
                  Đã xuất bản bài tập thành công cho lớp <strong>{publishedClassId}</strong>! Sinh viên đã có thể nhìn thấy và làm bài ngay lập tức tại mục Bài tập & Đánh giá.
                </span>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/teacher/assignments')}
                  className="shrink-0 px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  Xem bài tập
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Chọn lớp học phần áp dụng:
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition cursor-pointer shadow-2xs"
                  >
                    {availableClasses.length > 0 ? (
                      availableClasses.map((c) => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          {c.id || c._id} - {c.className || c.courseName || c.name || 'Lớp học phần'}
                        </option>
                      ))
                    ) : (
                      <option value={card.classId || card.code || 'CNTT101-01'}>
                        {card.classId || card.code || 'CNTT101-01'} (Lớp học phần)
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Hạn nộp bài (Due date):
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition cursor-pointer shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDirectPublish}
                disabled={isPublishing}
                className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-sm" />
                    <span>Đang lưu vào CSDL & xuất bản cho lớp...</span>
                  </>
                ) : (
                  <>
                    <span>🚀 Xuất bản thành Bài tập cho lớp</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Card Action Buttons */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetQuiz}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <i className="fas fa-rotate-left text-slate-400" />
            <span>Làm lại quiz</span>
          </button>
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage(`Tạo thêm 5 câu quiz trắc nghiệm ôn tập môn ${card.code || ''}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <i className="fas fa-plus text-indigo-500" />
              <span>Tạo thêm câu hỏi</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyQuiz}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
            title="Sao chép toàn bộ câu hỏi và đáp án vào bộ nhớ tạm"
          >
            <i className={`fas ${copied ? 'fa-check text-emerald-600' : 'fa-copy text-slate-400'}`} />
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isTeacher ? (
            <>
              <button
                type="button"
                onClick={handleUseAsAssignment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs transition active:scale-95 cursor-pointer"
                title="Chuyển toàn bộ câu hỏi này sang biểu mẫu Tạo bài tập cho lớp"
              >
                <i className="fas fa-file-pen text-amber-600" />
                <span>Dùng làm bài tập cho lớp</span>
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/teacher/assignments')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                >
                  <span>Mở Bài tập lớp</span>
                  <i className="fas fa-arrow-right text-[10px]" />
                </button>
              )}
            </>
          ) : (
            onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/student/assignments')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
              >
                <span>Mở Bài tập & Quiz</span>
                <i className="fas fa-arrow-right text-[10px]" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default InteractiveQuizCard;
