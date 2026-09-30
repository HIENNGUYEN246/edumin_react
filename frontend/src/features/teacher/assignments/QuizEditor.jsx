import { FormField, inputClass } from '../../../components/ui/FormField.jsx';

const newQuestion = () => ({
  id: `q${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
});

/** Editor for a quiz's questions. `value` is the questions array. */
export function QuizEditor({ value, onChange }) {
  const update = (qid, patch) => onChange(value.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  const addQuestion = () => onChange([...value, newQuestion()]);
  const removeQuestion = (qid) => onChange(value.filter((q) => q.id !== qid));
  const setOption = (qid, idx, text) =>
    update(qid, { options: value.find((q) => q.id === qid).options.map((o, i) => (i === idx ? text : o)) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Câu hỏi</span>
        <button type="button" onClick={addQuestion} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
          <i className="fas fa-plus mr-1" /> Thêm câu
        </button>
      </div>

      {value.map((question, index) => (
        <div key={question.id} className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="font-bold text-gray-800">Câu {index + 1}</span>
            {value.length > 1 && (
              <button type="button" onClick={() => removeQuestion(question.id)} className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label={`Xóa câu ${index + 1}`}>
                <i className="fas fa-trash-alt" />
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            <FormField label="Nội dung">
              <textarea rows="2" className={inputClass} value={question.text} onChange={(e) => update(question.id, { text: e.target.value })} />
            </FormField>
            <div className="space-y-2">
              {question.options.map((opt, idx) => (
                <label key={idx} className={`flex items-center gap-3 border rounded-xl p-2.5 ${question.correctIndex === idx ? 'border-emerald-300 bg-emerald-50/70' : 'border-gray-200'}`}>
                  <input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === idx} onChange={() => update(question.id, { correctIndex: idx })} />
                  <input className="flex-1 bg-transparent outline-none text-sm" value={opt} onChange={(e) => setOption(question.id, idx, e.target.value)} placeholder={`Lựa chọn ${idx + 1}`} />
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { newQuestion };
export default QuizEditor;
