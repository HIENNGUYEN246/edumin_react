import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '../../../api/assignmentsApi.js';
import { useToast } from '../../../app/providers/ToastProvider.jsx';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Full-page quiz. On submit the server grades and returns the answer key,
 * which is used to reveal correct/incorrect choices. `initialResult` (from a
 * prior submission) puts the player straight into review mode.
 */
export function QuizPlayer({ assignment, initialResult, initialAnswers }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [result, setResult] = useState(initialResult || null); // { score, correctCount, total, answerKey }

  const questions = assignment.questions || [];
  const submitted = Boolean(result);
  const keyById = useMemo(
    () => new Map((result?.answerKey || []).map((k) => [k.id, k.correctIndex])),
    [result]
  );

  const answeredCount = Object.keys(answers).length;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const mutation = useMutation({
    mutationFn: () => assignmentsApi.submit(assignment._id, answers),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['assignments', assignment._id, 'my-submission'] });
      toast.success(`Điểm của bạn: ${data.score}/10`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error) => toast.error(error.message, 5000),
  });

  const submit = () => {
    if (answeredCount < questions.length) return toast.error('Vui lòng trả lời đầy đủ câu hỏi');
    mutation.mutate();
  };

  return (
    <div className="pb-28">
      {/* Result banner */}
      {submitted && (
        <div className="mb-6 rounded-3xl overflow-hidden border border-teal-200 bg-gradient-to-br from-teal-600 via-emerald-600 to-teal-700 text-white shadow-xl">
          <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/20 flex flex-col items-center justify-center border-2 border-white/30 shadow-inner">
              <span className="text-3xl font-extrabold leading-none">{result.score}</span>
              <span className="text-xs opacity-90 font-medium">/ 10</span>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs uppercase tracking-widest opacity-90 font-bold">Kết quả bài làm</p>
              <p className="text-2xl font-black mt-1">
                Đúng {result.correctCount}/{result.total} câu
              </p>
              <p className="text-xs opacity-90 mt-1">Xem lại các câu trả lời đúng và sai bên dưới.</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress (only while taking) */}
      {!submitted && (
        <div className="mb-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between text-sm font-semibold text-gray-600 mb-2">
            <span className="text-teal-800 font-bold">Tiến độ làm bài</span>
            <span className="text-teal-700 font-bold">
              {answeredCount}/{questions.length} câu
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((question, index) => {
          const correctIndex = keyById.get(question.id);
          const chosen = answers[question.id];
          return (
            <article key={question.id} className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:border-teal-100 transition">
              <div className="flex items-start gap-4 p-5 md:p-6">
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-lg font-extrabold shadow-md shadow-teal-500/20">
                  {index + 1}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-600 mb-1">Câu hỏi {index + 1}</p>
                  <p className="text-lg font-bold text-gray-900 leading-7">{question.text}</p>
                </div>
                {!submitted && chosen !== undefined && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-full">
                    <i className="fas fa-check" /> Đã chọn
                  </span>
                )}
              </div>

              <div className="px-5 md:px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                {question.options.map((option, optIdx) => {
                  const selected = chosen === optIdx;
                  const isCorrect = submitted && optIdx === correctIndex;
                  const isWrongPick = submitted && selected && optIdx !== correctIndex;

                  let box = 'border-gray-200 bg-white hover:border-teal-300';
                  let badge = 'bg-gray-100 text-gray-500';
                  if (isCorrect) {
                    box = 'border-emerald-300 bg-emerald-50';
                    badge = 'bg-emerald-500 text-white';
                  } else if (isWrongPick) {
                    box = 'border-red-300 bg-red-50';
                    badge = 'bg-red-500 text-white';
                  } else if (!submitted && selected) {
                    box = 'border-teal-500 bg-teal-50/80 ring-2 ring-teal-300 shadow-xs';
                    badge = 'bg-teal-600 text-white';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [question.id]: optIdx }))}
                      className={`flex items-center gap-3 border rounded-2xl p-3.5 text-left transition ${box} ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-extrabold ${badge}`}>
                        {isCorrect ? <i className="fas fa-check" /> : isWrongPick ? <i className="fas fa-xmark" /> : LETTERS[optIdx]}
                      </span>
                      <span className="text-sm text-gray-800">{option}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {/* Sticky submit bar (only while taking) */}
      {!submitted && (
        <div className="fixed bottom-0 left-0 right-0 z-30 md:pl-64">
          <div className="mx-auto max-w-5xl m-4 rounded-2xl bg-white border border-gray-200 shadow-2xl px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              {answeredCount === questions.length ? 'Đã trả lời hết, sẵn sàng nộp bài.' : `Còn ${questions.length - answeredCount} câu chưa trả lời.`}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={mutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 shadow-lg shadow-teal-600/30 transition disabled:opacity-60"
            >
              {mutation.isPending ? 'Đang nộp...' : 'Nộp bài'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPlayer;
