import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { assignmentsApi } from '../../../api/assignmentsApi.js';
import { useToast } from '../../../app/providers/ToastProvider.jsx';

/**
 * Renders a quiz for a student to answer. On submit, the server grades and
 * returns the answer key, which is used to reveal correct/incorrect choices.
 */
export function QuizPlayer({ assignment, initialResult, onGraded }) {
  const toast = useToast();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(initialResult || null); // { score, answerKey }

  const mutation = useMutation({
    mutationFn: () => assignmentsApi.submit(assignment._id, answers),
    onSuccess: (data) => {
      setResult(data);
      onGraded?.(data);
      toast.success(`Điểm của bạn: ${data.score}/10`);
    },
    onError: (error) => toast.error(error.message, 5000),
  });

  const submitted = Boolean(result);
  const keyById = new Map((result?.answerKey || []).map((k) => [k.id, k.correctIndex]));

  const submit = (e) => {
    e.preventDefault();
    const unanswered = assignment.questions.some((q) => answers[q.id] === undefined);
    if (unanswered) return toast.error('Vui lòng trả lời đầy đủ câu hỏi');
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {submitted && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 text-center">
          <p className="text-sm text-indigo-500 font-semibold uppercase tracking-wider">Kết quả</p>
          <p className="text-3xl font-extrabold text-indigo-700">{result.score}/10</p>
        </div>
      )}

      {assignment.questions.map((question, index) => {
        const correctIndex = keyById.get(question.id);
        return (
          <article key={question.id} className="border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-500 mb-1">Câu {index + 1}</p>
            <p className="text-base font-bold text-gray-900 mb-4">{question.text}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {question.options.map((option, optIdx) => {
                const selected = answers[question.id] === optIdx;
                let cls = 'border-gray-200 bg-white hover:border-violet-300';
                if (submitted) {
                  if (optIdx === correctIndex) cls = 'border-emerald-300 bg-emerald-50';
                  else if (selected) cls = 'border-red-300 bg-red-50';
                } else if (selected) {
                  cls = 'border-violet-400 bg-violet-50';
                }
                return (
                  <label key={optIdx} className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition ${cls}`}>
                    <input
                      type="radio"
                      name={question.id}
                      disabled={submitted}
                      checked={selected}
                      onChange={() => setAnswers((a) => ({ ...a, [question.id]: optIdx }))}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                );
              })}
            </div>
          </article>
        );
      })}

      {!submitted && (
        <div className="flex justify-end">
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {mutation.isPending ? 'Đang nộp...' : 'Nộp bài'}
          </button>
        </div>
      )}
    </form>
  );
}

export default QuizPlayer;
