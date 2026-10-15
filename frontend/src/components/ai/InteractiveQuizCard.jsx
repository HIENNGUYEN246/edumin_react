import React, { useState, useMemo } from 'react';

/**
 * Interactive Quiz Card for EduMin AI Chatbot.
 * Allows students to test their knowledge interactively in chat,
 * see immediate right/wrong feedback, and read detailed rationale explanations.
 */
export function InteractiveQuizCard({ card, onSendMessage, onNavigate }) {
  const questions = card.questions || [];
  const totalQuestions = questions.length;

  const [answers, setAnswers] = useState({});

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
                {q.question}
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

      {/* Card Action Buttons */}
      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70">
        <div className="flex items-center gap-1.5">
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
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('/student/assignments')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
          >
            <span>Mở Bài tập & Quiz</span>
            <i className="fas fa-arrow-right text-[10px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export default InteractiveQuizCard;

