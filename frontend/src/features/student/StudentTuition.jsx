import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { tuitionApi } from '../../api/tuitionApi.js';
import { formatCurrency, formatDate, formatStudentCode } from '../../lib/format.js';

export function StudentTuition() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: resData, isLoading, refetch } = useQuery({
    queryKey: ['tuition', 'me'],
    queryFn: tuitionApi.myTuition,
  });

  const tuitions = resData?.data || [];
  const studentCode = profile?.id != null ? formatStudentCode(profile.id) : (user?.id ? formatStudentCode(user.id) : 'SV');
  const studentName = profile?.hoTen || user?.hoTen || 'Sinh viên';

  const totalAmount = tuitions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalDiscount = tuitions.reduce((sum, t) => sum + (t.discount || 0), 0);
  const totalPaid = tuitions.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
  const totalDue = tuitions.reduce((sum, t) => sum + (t.amountDue || 0), 0);
  const isAllSettled = tuitions.length > 0 && totalDue === 0;

  const transferSyntax = `${studentCode} - ${studentName} - Hoc phi`;

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success('Đã sao chép nội dung chuyển khoản vào clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Đã đóng':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <i className="fas fa-check-circle text-xs" />
            Đã hoàn thành
          </span>
        );
      case 'Đang nợ':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <i className="fas fa-clock text-xs" />
            Đang còn nợ
          </span>
        );
      case 'Chưa đóng':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <i className="fas fa-exclamation-circle text-xs" />
            Chưa đóng
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tra cứu học phí" subtitle="Tình trạng học phí và lịch sử nộp tiền" />
        <div className="py-12"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tra cứu học phí"
        subtitle="Theo dõi tình trạng học phí, học bổng và lịch sử đóng tiền của bạn"
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition"
          >
            <i className="fas fa-sync-alt" />
            <span>Cập nhật</span>
          </button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <i className="fas fa-file-invoice-dollar text-xl" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-400">Tổng học phí các kỳ</div>
            <div className="text-lg font-extrabold text-gray-900 mt-0.5">{formatCurrency(totalAmount)}</div>
            {totalDiscount > 0 && (
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                Được miễn giảm: {formatCurrency(totalDiscount)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <i className="fas fa-check-double text-xl" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-400">Đã thanh toán</div>
            <div className="text-lg font-extrabold text-emerald-600 mt-0.5">{formatCurrency(totalPaid)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Đã được kế toán xác nhận</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <i className="fas fa-hand-holding-usd text-xl" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-400">Còn phải đóng</div>
            <div className="text-lg font-extrabold text-rose-600 mt-0.5">{formatCurrency(totalDue)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {totalDue === 0 ? 'Không còn nợ' : 'Cần hoàn tất trước hạn'}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isAllSettled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <i className={`fas ${isAllSettled ? 'fa-shield-alt' : 'fa-info-circle'} text-xl`} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-400">Trạng thái công nợ</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">
              {tuitions.length === 0 ? 'Chưa phát sinh' : isAllSettled ? 'Đã hoàn tất 100%' : 'Chưa hoàn tất'}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">{tuitions.length} học kỳ ghi nhận</div>
          </div>
        </div>
      </div>

      {/* Payment Guide & Bank Info */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 text-white rounded-3xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-sm">
              <i className="fas fa-university" />
              <span>Cổng thanh toán học phí trực tuyến</span>
            </div>
            <h3 className="text-xl font-bold">Thông tin tài khoản nhận học phí</h3>
            <p className="text-xs text-indigo-200/90 leading-relaxed">
              Sinh viên có thể đóng học phí trực tiếp tại Phòng Tài chính - Kế toán hoặc chuyển khoản qua ngân hàng trực tuyến 24/7 với thông tin dưới đây:
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl w-full lg:w-auto min-w-[320px] space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-indigo-200">Ngân hàng:</span>
              <span className="font-bold text-right text-white">BIDV - Chi nhánh Hà Nội</span>
              <span className="text-indigo-200">Số tài khoản:</span>
              <span className="font-mono font-bold text-right text-emerald-300 text-sm tracking-wider">123456789999</span>
              <span className="text-indigo-200">Chủ tài khoản:</span>
              <span className="font-bold text-right text-white">TRƯỜNG ĐẠI HỌC EDUMIN</span>
            </div>

            <div className="pt-2 border-t border-white/15">
              <div className="text-[11px] text-indigo-200 mb-1 flex items-center justify-between">
                <span>Cú pháp nộp học phí gợi ý:</span>
                <span className="text-emerald-300 font-medium">Bấm sao chép</span>
              </div>
              <div
                onClick={() => copyToClipboard(transferSyntax)}
                className="bg-black/30 hover:bg-black/40 cursor-pointer p-2.5 rounded-xl border border-white/15 flex items-center justify-between gap-2 transition"
                title="Bấm để sao chép"
              >
                <code className="text-xs font-mono text-emerald-300 font-semibold truncate">
                  {transferSyntax}
                </code>
                <i className={`fas ${copied ? 'fa-check text-emerald-400' : 'fa-copy text-indigo-200'} text-xs shrink-0`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tuitions per semester list */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <i className="fas fa-list-alt text-indigo-600" />
          <span>Chi tiết học phí theo học kỳ</span>
        </h3>

        {tuitions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300 mb-3">
              <i className="fas fa-receipt text-2xl" />
            </div>
            <p className="text-sm font-semibold text-gray-600">Chưa có thông tin học phí</p>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Nhà trường chưa phát sinh thông báo học phí cho bạn. Vui lòng liên hệ Phòng Kế toán hoặc chờ thông báo chính thức.
            </p>
          </div>
        ) : (
          tuitions.map((t) => (
            <div
              key={t._id || t.id}
              className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden transition-all hover:border-indigo-100"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-50 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    <i className="fas fa-graduation-cap" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-gray-900">{t.semester}</h4>
                      {t.className && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Lớp: {t.className}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Cập nhật lần cuối: {t.updatedAt ? formatDate(t.updatedAt) : 'Mới cập nhật'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(t.status)}
                </div>
              </div>

              {/* Financial Metrics Row */}
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Học phí gốc</span>
                  <span className="text-sm font-bold text-gray-800">{formatCurrency(t.amount)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Miễn giảm / Học bổng</span>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(t.discount || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Đã thanh toán</span>
                  <span className="text-sm font-bold text-indigo-600">{formatCurrency(t.amountPaid || 0)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Còn lại phải nộp</span>
                  <span className={`text-sm font-bold ${t.amountDue > 0 ? 'text-rose-600 font-extrabold' : 'text-gray-600'}`}>
                    {formatCurrency(t.amountDue || 0)}
                  </span>
                </div>
              </div>

              {/* Transactions History Sub-table */}
              <div className="px-5 pb-5 pt-2">
                <div className="bg-gray-50/75 rounded-2xl p-4 border border-gray-100 space-y-2">
                  <div className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-history text-indigo-500" />
                      <span>Lịch sử nộp tiền & biên lai ({t.transactions?.length || 0} giao dịch)</span>
                    </span>
                    {t.dueDate && (
                      <span className="text-[11px] font-normal text-gray-500">
                        Hạn đóng: <strong className="text-rose-600">{formatDate(t.dueDate)}</strong>
                      </span>
                    )}
                  </div>

                  {!t.transactions || t.transactions.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">Chưa ghi nhận phiếu thu hoặc giao dịch nào cho học kỳ này.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-200">
                            <th className="py-2 font-medium">Mã giao dịch</th>
                            <th className="py-2 font-medium">Ngày nộp</th>
                            <th className="py-2 font-medium">Số tiền</th>
                            <th className="py-2 font-medium">Hình thức</th>
                            <th className="py-2 font-medium">Người thu / Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {t.transactions.map((tx, idx) => (
                            <tr key={tx._id || idx} className="text-gray-700">
                              <td className="py-2 font-mono font-medium text-gray-500">
                                {tx.transactionCode || `TX-${String(idx + 1).padStart(4, '0')}`}
                              </td>
                              <td className="py-2">{formatDate(tx.paidAt)}</td>
                              <td className="py-2 font-bold text-emerald-600">{formatCurrency(tx.amount)}</td>
                              <td className="py-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200/70 text-gray-800">
                                  {tx.paymentMethod || 'Chuyển khoản'}
                                </span>
                              </td>
                              <td className="py-2 text-gray-500 italic">{tx.note || 'Thu học phí trực tuyến'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StudentTuition;
