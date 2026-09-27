import { DAYS, SHIFTS } from '../../utils/registrationUtils';
import { formatStudentId } from '../../utils/studentUtils';

export function CourseRegModals(props) {
  const {
    saving,
    showRegModal,
    closeRegModal,
    regDept,
    syncDataByDept,
    departments,
    selectedCoursesLabel,
    openCourseListModal,
    studyStartDate,
    setStudyStartDate,
    studyEndDate,
    setStudyEndDate,
    regStartDate,
    setRegStartDate,
    regEndDate,
    setRegEndDate,
    today,
    nowLocal,
    selectedCourses,
    scheduleConfigs,
    deptTeachers,
    updateScheduleConfig,
    toggleDay,
    setDayShift,
    validateAndSubmit,
    showCourseListModal,
    setShowCourseListModal,
    courseChecklist,
    setCourseChecklist,
    confirmCourseSelection,
    showDetailModal,
    setShowDetailModal,
    detailReg,
    formatDetailDate,
    showStudentListModal,
    setShowStudentListModal,
    studentListCourse,
    signedUpForCourse,
    students,
    showConfirmModal,
    confirmAnimating,
    closeConfirmModal,
    executeDelete,
  } = props;

  return (
    <>
      {showRegModal && (
        <RegModal
          closeRegModal={closeRegModal}
          regDept={regDept}
          syncDataByDept={syncDataByDept}
          departments={departments}
          selectedCoursesLabel={selectedCoursesLabel}
          openCourseListModal={openCourseListModal}
          studyStartDate={studyStartDate}
          setStudyStartDate={setStudyStartDate}
          studyEndDate={studyEndDate}
          setStudyEndDate={setStudyEndDate}
          regStartDate={regStartDate}
          setRegStartDate={setRegStartDate}
          regEndDate={regEndDate}
          setRegEndDate={setRegEndDate}
          today={today}
          nowLocal={nowLocal}
          selectedCourses={selectedCourses}
          scheduleConfigs={scheduleConfigs}
          deptTeachers={deptTeachers}
          updateScheduleConfig={updateScheduleConfig}
          toggleDay={toggleDay}
          setDayShift={setDayShift}
          validateAndSubmit={validateAndSubmit}
          saving={saving}
        />
      )}

      {showCourseListModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Danh sách học phần Khoa</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              {courseChecklist.map((c, idx) => (
                <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-indigo-600"
                    checked={c.checked}
                    onChange={(e) => {
                      const next = [...courseChecklist];
                      next[idx] = { ...c, checked: e.target.checked };
                      setCourseChecklist(next);
                    }}
                  />
                  <CourseItemInner course={c} />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowCourseListModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
                Đóng
              </button>
              <button type="button" onClick={confirmCourseSelection} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && detailReg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-wider">Chi tiết Lớp Học Phần</h3>
                <p className="text-indigo-200 text-xs mt-1 font-mono">
                  Hạn đăng ký: {detailReg.start?.replace('T', ' ')} đến {detailReg.end?.replace('T', ' ')}
                </p>
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="text-white hover:rotate-90 transition-transform duration-300">
                <i className="fas fa-times text-2xl" />
              </button>
            </div>
            <div className="p-8">
              <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                <DetailBody detailReg={detailReg} formatDetailDate={formatDetailDate} />
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="w-full mt-8 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}

      {showStudentListModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold uppercase tracking-wider">Danh sách sinh viên đăng ký</h3>
                <p className="text-emerald-100 text-xs mt-1">
                  {studentListCourse?.courseId} - {studentListCourse?.courseName || 'N/A'}
                </p>
              </div>
              <button type="button" onClick={() => setShowStudentListModal(false)} className="text-white hover:scale-110 transition-transform">
                <i className="fas fa-times text-2xl" />
              </button>
            </div>
            <div className="p-6">
              <StudentListTable signedUpForCourse={signedUpForCourse} students={students} />
              <StudentFooter count={signedUpForCourse.length} onClose={() => setShowStudentListModal(false)} />
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div
            className={`bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all ${
              confirmAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
          >
            <div className="text-center">
              <ConfirmIcon />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Xác nhận xóa?</h3>
              <p className="text-gray-500 mb-8">Dữ liệu này sẽ bị xóa vĩnh viễn khỏi hệ thống!</p>
              <div className="flex gap-4">
                <button type="button" onClick={closeConfirmModal} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all">
                  Hủy
                </button>
                <button type="button" disabled={saving} onClick={executeDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 shadow-lg transition-all disabled:opacity-60">
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RegModal({
  closeRegModal,
  regDept,
  syncDataByDept,
  departments,
  selectedCoursesLabel,
  openCourseListModal,
  studyStartDate,
  setStudyStartDate,
  studyEndDate,
  setStudyEndDate,
  regStartDate,
  setRegStartDate,
  regEndDate,
  setRegEndDate,
  today,
  nowLocal,
  selectedCourses,
  scheduleConfigs,
  deptTeachers,
  updateScheduleConfig,
  toggleDay,
  setDayShift,
  validateAndSubmit,
  saving,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-6xl mx-4 overflow-y-auto max-h-[95vh]">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="text-xl font-bold text-gray-800">Thiết lập Lớp Học Phần Mới</h3>
          <button type="button" onClick={closeRegModal} className="text-gray-400 hover:text-red-500">
            <i className="fas fa-times" />
          </button>
        </div>
        <form className="grid grid-cols-2 gap-x-6 gap-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Chọn Khoa</label>
            <select
              value={regDept}
              onChange={(e) => syncDataByDept(e.target.value)}
              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Chọn Khoa quản lý</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Chọn Học Phần Muốn Mở</label>
            <div className="flex gap-2">
              <CourseLabel label={selectedCoursesLabel} />
              <button type="button" onClick={openCourseListModal} className="bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 transition">
                <i className="fas fa-list-check" />
              </button>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày bắt đầu học (Dùng chung)</label>
            <input type="date" value={studyStartDate} min={today} onChange={(e) => setStudyStartDate(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày kết thúc học (Dùng chung)</label>
            <input type="date" value={studyEndDate} min={today} onChange={(e) => setStudyEndDate(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="col-span-2 bg-indigo-50 p-6 rounded-xl border border-indigo-100">
            <p className="font-bold text-indigo-900 italic mb-4">
              <i className="fas fa-clock mr-2" />
              Chi tiết lịch học & Giảng viên cho từng học phần
            </p>
            {selectedCourses.length === 0 ? (
              <p className="text-center text-gray-400 py-4 italic">Vui lòng chọn học phần để thiết lập lịch học</p>
            ) : (
              <div className="space-y-6">
                {selectedCourses.map((course) => (
                  <CourseScheduleBlock
                    key={course.id}
                    course={course}
                    conf={scheduleConfigs[course.id] || { teacherId: '', room: '', days: {} }}
                    deptTeachers={deptTeachers}
                    updateScheduleConfig={updateScheduleConfig}
                    toggleDay={toggleDay}
                    setDayShift={setDayShift}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Bắt đầu đăng ký (Thời gian hệ thống)</label>
            <input type="datetime-local" value={regStartDate} min={nowLocal} onChange={(e) => setRegStartDate(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kết thúc đăng ký (Thời gian hệ thống)</label>
            <input type="datetime-local" value={regEndDate} min={nowLocal} onChange={(e) => setRegEndDate(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 mt-4 border-t pt-4">
            <button type="button" onClick={closeRegModal} className="px-5 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
              Hủy
            </button>
            <button type="button" disabled={saving} onClick={validateAndSubmit} className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition disabled:opacity-60">
              Mở lớp ngay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CourseScheduleBlock({ course, conf, deptTeachers, updateScheduleConfig, toggleDay, setDayShift }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-md border border-indigo-200">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <span className="font-bold text-indigo-700 text-lg underline">{course.name}</span>
        <span className="text-xs font-mono bg-indigo-50 px-2 py-1 rounded text-indigo-500">{course.id}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Giảng viên phụ trách</label>
          <select
            value={conf.teacherId}
            onChange={(e) => updateScheduleConfig(course.id, { teacherId: e.target.value })}
            className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Chọn giảng viên</option>
            {deptTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                GV-00{t.id} - {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-gray-400 uppercase block mb-1">Phòng học (Dùng cho tất cả buổi)</label>
          <input
            type="text"
            placeholder="A101"
            value={conf.room}
            onChange={(e) => updateScheduleConfig(course.id, { room: e.target.value })}
            className="w-full p-2.5 border rounded-lg text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className="text-[11px] font-bold text-gray-400 uppercase block mb-2">Chọn Thứ học & Ca học:</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {DAYS.map((day) => {
            const checked = Boolean(conf.days?.[day.id]);
            return (
              <div key={day.id} className="flex flex-col gap-1">
                <label className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    className="day-checkbox hidden"
                    checked={checked}
                    onChange={(e) => toggleDay(course.id, day.id, e.target.checked)}
                  />
                  <span className="day-label-span block text-center p-2 text-xs border rounded-lg font-bold text-gray-500 transition-all hover:bg-gray-50">
                    {day.label}
                  </span>
                </label>
                {checked && (
                  <div className="flex flex-col gap-1 p-1 bg-gray-50 rounded border border-dashed">
                    <p className="text-[9px] font-bold text-indigo-400 uppercase text-center">Chọn ca</p>
                    <select
                      value={conf.days[day.id]?.shiftId || 'S1'}
                      onChange={(e) => setDayShift(course.id, day.id, e.target.value)}
                      className="w-full text-[10px] p-1 border rounded outline-none"
                    >
                      {SHIFTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailBody({ detailReg, formatDetailDate }) {
  return (
    <>
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-bold text-indigo-900 text-xl underline">{detailReg.courseName}</h4>
        <span className="text-xs bg-white px-3 py-1 rounded shadow-sm font-mono font-bold">{detailReg.courseId}</span>
      </div>
      <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
        <TeacherBlock detailReg={detailReg} />
        <div className="p-3 bg-white rounded-lg shadow-sm border">
          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Phòng học</p>
          <p className="font-bold text-red-600">{detailReg.room}</p>
          <p className="text-xs text-gray-500 italic">
            ({formatDetailDate(detailReg.studyStart)} → {formatDetailDate(detailReg.studyEnd)})
          </p>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg border shadow-inner">
        <p className="text-[10px] text-gray-400 font-bold uppercase mb-3">
          <i className="fas fa-calendar-alt mr-1" />
          Chi tiết lịch học:
        </p>
        <div className="grid grid-cols-1 gap-2">
          {(detailReg.schedules || []).map((s, i) => (
            <div key={i} className="flex justify-between items-center text-sm p-2 bg-indigo-50 rounded border-l-4 border-indigo-500">
              <span className="font-bold text-gray-700">{s.dayLabel}</span>
              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[11px]">{s.shiftLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StudentListTable({ signedUpForCourse, students }) {
  return (
    <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
      <table className="w-full student-table">
        <thead>
          <tr>
            <th className="text-center">STT</th>
            <th>Mã SV</th>
            <th>Họ và Tên</th>
            <th>Ngày sinh</th>
            <th>Phái</th>
            <th>Địa chỉ</th>
            <th>Điện thoại</th>
            <th>Email</th>
            <th>Chuyên ngành</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {signedUpForCourse.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-12 text-gray-400 italic bg-gray-50/30">
                <i className="fas fa-user-slash block text-3xl mb-2 opacity-20" />
                Chưa có sinh viên nào đăng ký học phần này.
              </td>
            </tr>
          ) : (
            signedUpForCourse.map((reg, index) => {
              const info = students.find((s) => s.id === reg.studentId) || {};
              return (
                <tr key={`${reg.studentId}-${reg.regId}`} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="text-center font-medium text-gray-500">{index + 1}</td>
                  <td className="font-mono font-bold text-indigo-600">{formatStudentId(reg.studentId)}</td>
                  <td className="font-bold text-gray-800">{info.name || reg.studentName}</td>
                  <td className="text-gray-600">{info.dob || '---'}</td>
                  <td className="text-gray-600">{info.gender || '---'}</td>
                  <td className="text-gray-600 truncate max-w-[150px]">{info.address || '---'}</td>
                  <td className="text-gray-600">{info.phone || '---'}</td>
                  <td className="text-gray-600 italic">{info.email || '---'}</td>
                  <td>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold whitespace-nowrap">
                      {info.department || 'Chưa rõ'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function CourseItemInner({ course }) {
  return (
    <div className="text-sm">
      <p className="font-bold text-gray-700">{course.name}</p>
      <p className="text-xs text-gray-400 font-mono">{course.id}</p>
    </div>
  );
}

function CourseLabel({ label }) {
  return <div className="flex-1 p-2.5 border rounded-lg bg-gray-50 text-gray-500 text-sm truncate">{label}</div>;
}

function TeacherBlock({ detailReg }) {
  return (
    <div className="p-3 bg-white rounded-lg shadow-sm border">
      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Giảng viên phụ trách</p>
      <span className="text-[11px] font-bold text-indigo-600 font-mono">GV-00{detailReg.teacherId || 'N/A'}</span>
      <p className="font-bold text-gray-800">{detailReg.teacher}</p>
    </div>
  );
}

function StudentFooter({ count, onClose }) {
  return (
    <div className="mt-6 flex justify-between items-center border-t pt-4">
      <p className="text-sm font-bold text-gray-600">
        Tổng số sinh viên: <span className="text-emerald-600 text-lg">{count}</span>
      </p>
      <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200">
        Đóng
      </button>
    </div>
  );
}

function ConfirmIcon() {
  return (
    <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
      <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
    </div>
  );
}
