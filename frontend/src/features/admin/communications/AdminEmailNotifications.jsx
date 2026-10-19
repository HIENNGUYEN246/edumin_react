import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { communicationsApi } from '../../../api/communicationsApi.js';
import { useDebounce } from '../../../lib/useDebounce.js';
import { PageHeader, SearchInput } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { exportSheet, readSheet } from '../../../lib/excel.js';

const PAGE_SIZE = 20;
const MAX_RECIPIENTS = 100;
const EMPTY_RECIPIENTS = [];
const DIRECTORY_TABS = [
  { role: 'giao-vien', label: 'Giáo viên', shortLabel: 'Giáo viên', icon: 'fa-chalkboard-user' },
  { role: 'sinh-vien', label: 'Sinh viên', shortLabel: 'Sinh viên', icon: 'fa-user-graduate' },
];

function recipientKey(recipient) {
  return `${recipient.role}:${String(recipient.accountEmail || recipient.email)
    .trim()
    .toLowerCase()}`;
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRowValue(row, aliases) {
  const entry = Object.entries(row).find(([key]) => aliases.includes(normalizeHeader(key)));
  return String(entry?.[1] || '').trim();
}

function parseImportedRole(value, fallbackRole) {
  const role = normalizeHeader(value);
  if (!role) return fallbackRole;
  if (role === 'gv' || role.includes('giao vien') || role.includes('teacher')) return 'giao-vien';
  if (role === 'sv' || role.includes('sinh vien') || role.includes('student')) return 'sinh-vien';
  return null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function AdminEmailNotifications() {
  const toast = useToast();
  const confirm = useConfirm();
  const [role, setRole] = useState('giao-vien');
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const search = useDebounce(searchText);
  const [selectedRecipients, setSelectedRecipients] = useState(() => new Map());
  const [recipientEmails, setRecipientEmails] = useState(() => new Map());
  const [sending, setSending] = useState(false);
  const [lastResults, setLastResults] = useState(null);
  const fileRef = useRef(null);
  const activeTab = DIRECTORY_TABS.find((tab) => tab.role === role);

  const recipientsQuery = useQuery({
    queryKey: ['communications', 'recipients', role, page, search],
    queryFn: () => communicationsApi.recipients({ role, page, limit: PAGE_SIZE, search }),
    retry: false,
  });

  const recipients = recipientsQuery.data?.data || EMPTY_RECIPIENTS;
  const meta = recipientsQuery.data?.meta || { page: 1, pages: 0, total: 0 };
  const selectablePageRecipients = useMemo(
    () =>
      recipients.filter((recipient) => {
        const key = recipientKey({ email: recipient.email, role });
        const toEmail = recipientEmails.has(key)
          ? recipientEmails.get(key)
          : (recipient.emailNhanThongBao || '');
        return recipient.accountActive && recipient.email && isValidEmail(toEmail);
      }),
    [recipients, recipientEmails, role]
  );
  const allPageSelected =
    selectablePageRecipients.length > 0 &&
    selectablePageRecipients.every((recipient) =>
      selectedRecipients.has(recipientKey({ email: recipient.email, role }))
    );

  const changeRole = (nextRole) => {
    setRole(nextRole);
    setPage(1);
    setSearchText('');
    setLastResults(null);
  };

  const toggleRecipient = (recipient) => {
    const key = recipientKey({ email: recipient.email, role });
    setSelectedRecipients((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else {
        const toEmail = recipientEmails.has(key)
          ? recipientEmails.get(key)
          : (recipient.emailNhanThongBao || '');
        next.set(key, {
          role,
          accountEmail: recipient.email,
          recipientEmail: toEmail,
          hoTen: recipient.hoTen,
        });
      }
      return next;
    });
    setLastResults(null);
  };

  const updateRecipientEmail = (recipient, value) => {
    const key = recipientKey({ email: recipient.email, role });
    setRecipientEmails((current) => new Map(current).set(key, value));
    setSelectedRecipients((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.set(key, { ...next.get(key), recipientEmail: value });
      return next;
    });
  };

  const togglePage = () => {
    setSelectedRecipients((current) => {
      const next = new Map(current);
      const shouldSelect = !allPageSelected;
      selectablePageRecipients.forEach((recipient) => {
        const key = recipientKey({ email: recipient.email, role });
        const toEmail = recipientEmails.has(key)
          ? recipientEmails.get(key)
          : (recipient.emailNhanThongBao || '');
        if (shouldSelect && isValidEmail(toEmail)) {
          next.set(key, {
            role,
            accountEmail: recipient.email,
            recipientEmail: toEmail,
            hoTen: recipient.hoTen,
          });
        } else next.delete(key);
      });
      return next;
    });
    setLastResults(null);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const rows = await readSheet(file);
      const imported = [];
      let invalidRows = 0;
      rows.forEach((row) => {
        const accountEmail = getRowValue(row, [
          'email tai khoan',
          'email dang nhap',
          'account email',
          'login email',
        ]).toLowerCase();
        const toEmail = getRowValue(row, [
          'email gmail nhan',
          'gmail nhan',
          'email nhan',
          'recipient email',
          'gmail',
        ]).toLowerCase();
        const rowRole = parseImportedRole(
          getRowValue(row, ['vai tro', 'role', 'loai tai khoan']),
          role
        );
        if (!accountEmail && !toEmail) return;
        if (!isValidEmail(accountEmail) || !isValidEmail(toEmail) || !rowRole) {
          invalidRows += 1;
          return;
        }
        imported.push({
          role: rowRole,
          accountEmail,
          recipientEmail: toEmail,
          hoTen: getRowValue(row, ['ho ten', 'ho va ten', 'name']),
        });
      });

      if (!imported.length) {
        toast.error('Excel không có dòng hợp lệ. Cần cột Email tài khoản và Email Gmail nhận.');
        return;
      }
      const nextSelection = new Map(selectedRecipients);
      let overLimit = 0;
      imported.forEach((recipient) => {
        const key = recipientKey(recipient);
        if (nextSelection.has(key) || nextSelection.size < MAX_RECIPIENTS) {
          nextSelection.set(key, recipient);
        } else {
          overLimit += 1;
        }
      });
      setSelectedRecipients(nextSelection);
      setRecipientEmails((current) => {
        const next = new Map(current);
        imported.forEach((recipient) =>
          next.set(recipientKey(recipient), recipient.recipientEmail)
        );
        return next;
      });
      setLastResults(null);
      const skippedRows = invalidRows + overLimit;
      if (skippedRows) {
        toast.warning(
          `Đã nhập ${imported.length - overLimit} dòng; bỏ qua ${invalidRows} dòng sai và ${overLimit} dòng vượt giới hạn ${MAX_RECIPIENTS}.`
        );
      } else {
        toast.success(`Đã nhập ${imported.length} người nhận từ Excel.`);
      }
    } catch (error) {
      toast.error(error.message || 'Không đọc được file Excel');
    }
  };

  const downloadTemplate = async () => {
    try {
      await exportSheet(
        [
          {
            'Vai trò': 'Giáo viên',
            'Email tài khoản': 'hiennguyen123@university.edu.vn',
            'Email Gmail nhận': 'gmail-ca-nhan@gmail.com',
            'Họ tên (tùy chọn)': 'Nguyễn Hiển',
          },
        ],
        { fileName: 'mau-email-thong-bao-tai-khoan.xlsx', sheetName: 'NguoiNhan' }
      );
    } catch (error) {
      toast.error(error.message || 'Không tạo được file mẫu');
    }
  };

  const clearSelection = () => {
    setSelectedRecipients(new Map());
    setRecipientEmails(new Map());
    setLastResults(null);
  };

  const handleSend = async () => {
    const recipientsToSend = [...selectedRecipients.values()].map(
      ({ role: recipientRole, accountEmail, recipientEmail }) => ({
        role: recipientRole,
        accountEmail,
        recipientEmail,
      })
    );
    if (!recipientsToSend.length || recipientsToSend.length > MAX_RECIPIENTS) return;

    const accepted = await confirm({
      title: `Gửi thông tin tài khoản cho ${recipientsToSend.length} người?`,
      message:
        'Mỗi Gmail nhận sẽ được gửi riêng email đăng nhập trường và mật khẩu mặc định 123. Chỉ tài khoản hiện vẫn dùng mật khẩu mặc định mới được gửi.',
      confirmText: `Gửi ${recipientsToSend.length} email`,
      cancelText: 'Kiểm tra lại',
      tone: 'primary',
    });
    if (!accepted) return;
    const invalidRecipients = recipientsToSend.filter(
      ({ recipientEmail }) => !isValidEmail(recipientEmail)
    );
    if (invalidRecipients.length) {
      toast.error(`Vui lòng nhập đúng Gmail nhận cho ${invalidRecipients.length} người đã chọn.`);
      return;
    }

    try {
      setSending(true);
      const result = await communicationsApi.sendAccountCredentials(recipientsToSend);
      setLastResults(result);
      setSelectedRecipients((current) => {
        const next = new Map(current);
        result.results
          .filter((item) => item.status === 'sent' || item.status === 'skipped')
          .forEach((item) => next.delete(`${item.role}:${item.accountEmail.toLowerCase()}`));
        return next;
      });
      if (result.failed || result.skipped) {
        toast.warning(
          `Đã gửi ${result.sent}/${result.total}; lỗi ${result.failed}, bỏ qua ${result.skipped}.`
        );
      } else {
        toast.success(`Đã gửi ${result.sent} email thông báo tài khoản.`);
      }
    } catch (error) {
      toast.error(error.message || 'Không thể gửi email thông báo');
    } finally {
      setSending(false);
    }
  };

  const emailConfigured = recipientsQuery.data?.emailConfigured;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gửi thông báo Gmail"
        subtitle="Gửi email đăng nhập EduMin đến Gmail cá nhân mà giáo viên hoặc sinh viên đã cung cấp."
      />

      {emailConfigured === false && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <i className="fas fa-triangle-exclamation mt-0.5 text-amber-600" />
          <div>
            <p className="font-bold">Chưa cấu hình Gmail trên máy chủ</p>
            <p className="mt-1">
              Cần thiết lập <code>GMAIL_USER</code> và <code>GMAIL_APP_PASSWORD</code> bằng Google
              App Password rồi khởi động lại backend. Không nhập mật khẩu Gmail tại trang này.
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4 sm:p-5">
          <div
            className="flex rounded-xl bg-slate-100 p-1"
            role="tablist"
            aria-label="Loại người nhận"
          >
            {DIRECTORY_TABS.map((tab) => (
              <button
                key={tab.role}
                type="button"
                role="tab"
                aria-selected={role === tab.role}
                onClick={() => changeRole(tab.role)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  role === tab.role
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <i className={`fas ${tab.icon}`} />
                {tab.label}
              </button>
            ))}
          </div>
          <SearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              setPage(1);
            }}
            placeholder={`Tìm ${activeTab.shortLabel.toLowerCase()}...`}
            className="w-full sm:w-72"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 font-bold text-indigo-800">
              <i className="fas fa-users" />
              Đã chọn {selectedRecipients.size}
            </span>
            <span className="text-slate-500">Tối đa {MAX_RECIPIENTS} người mỗi lần gửi.</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              <i className="fas fa-file-import" />
              Nhập Excel
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <i className="fas fa-download" />
              File mẫu
            </button>
            {selectedRecipients.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                disabled={sending}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Bỏ chọn
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={
                sending ||
                selectedRecipients.size === 0 ||
                selectedRecipients.size > MAX_RECIPIENTS ||
                !emailConfigured
              }
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
              {sending
                ? 'Đang gửi...'
                : selectedRecipients.size === 1
                  ? 'Gửi email'
                  : `Gửi ${selectedRecipients.size} email`}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    aria-label={`Chọn tất cả ${activeTab.label.toLowerCase()} trên trang`}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    disabled={!selectablePageRecipients.length || sending}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Email tài khoản</th>
                <th className="min-w-64 px-4 py-3">Gmail nhận thông báo</th>
                <th className="px-4 py-3">{role === 'giao-vien' ? 'Khoa' : 'Lớp / Khoa'}</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recipientsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <i className="fas fa-spinner fa-spin mr-2" />
                    Đang tải danh sách...
                  </td>
                </tr>
              ) : recipientsQuery.isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-rose-600">
                    Không tải được danh sách. {recipientsQuery.error?.message}
                  </td>
                </tr>
              ) : recipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Không tìm thấy {activeTab.shortLabel.toLowerCase()} phù hợp.
                  </td>
                </tr>
              ) : (
                recipients.map((recipient) => {
                  const key = recipientKey({ email: recipient.email, role });
                  const checked = selectedRecipients.has(key);
                  const unavailable = !recipient.accountActive || !recipient.email;
                  const recipientEmail = recipientEmails.has(key)
                    ? recipientEmails.get(key)
                    : (recipient.emailNhanThongBao || '');
                  const canSelect = !unavailable && isValidEmail(recipientEmail);
                  const isAutoSynced = Boolean(!recipientEmails.has(key) && recipient.emailNhanThongBao);
                  return (
                    <tr key={key} className={checked ? 'bg-indigo-50/50' : 'hover:bg-slate-50/70'}>
                      <td className="px-4 py-3 text-center">
                        <input
                          aria-label={`Chọn ${recipient.hoTen || recipient.email}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRecipient(recipient)}
                          disabled={!canSelect || sending}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                        {role === 'giao-vien' ? 'GV' : 'SV'}-{String(recipient.id).padStart(3, '0')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {recipient.hoTen || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {recipient.email || 'Chưa có email'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <input
                            type="email"
                            value={recipientEmail}
                            onChange={(event) => {
                              updateRecipientEmail(recipient, event.target.value);
                              setLastResults(null);
                            }}
                            placeholder="Nhập Gmail cá nhân nhận tin"
                            aria-label={`Gmail nhận của ${recipient.hoTen || recipient.email}`}
                            disabled={unavailable || sending}
                            className={`w-full min-w-56 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 ${
                              isAutoSynced ? 'pr-8 bg-emerald-50/20' : ''
                            }`}
                          />
                          {recipient.emailNhanThongBao && (
                            <span
                              title="Email cá nhân đã tự động đồng bộ từ tài khoản"
                              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 text-xs"
                            >
                              <i className="fa-solid fa-arrows-rotate" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {role === 'sinh-vien' && recipient.className
                          ? `${recipient.className} · `
                          : ''}
                        {recipient.department || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {unavailable ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            Không khả dụng
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Sẵn sàng
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <Pagination
            page={meta.page || page}
            pages={meta.pages || 0}
            total={meta.total || 0}
            onPageChange={setPage}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-3 flex items-center gap-2 text-slate-800">
            <i className="fas fa-envelope-open-text text-indigo-600" />
            <h2 className="font-bold">Nội dung email sẽ gửi</h2>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <p>
              <strong>Gửi đến:</strong> Gmail cá nhân do Phòng Đào tạo nhập hoặc import Excel.
            </p>
            <p className="mt-2">
              <strong>Email đăng nhập trường:</strong> ví dụ hiennguyen123@university.edu.vn
            </p>
            <p>
              <strong>Mật khẩu khởi tạo:</strong> 123
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Mỗi người nhận một email riêng. Tài khoản đã đổi mật khẩu sẽ được bỏ qua để không gửi
              mật khẩu cũ.
            </p>
          </div>
        </div>

        {selectedRecipients.size > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-800">
                Người nhận đã chọn ({selectedRecipients.size})
              </h2>
              <span className="text-xs text-slate-500">Có thể chỉnh Gmail trước khi gửi.</span>
            </div>
            <ul className="max-h-64 space-y-3 overflow-y-auto">
              {[...selectedRecipients.entries()].map(([key, recipient]) => (
                <li
                  key={key}
                  className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {recipient.hoTen || recipient.accountEmail}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {recipient.role === 'giao-vien' ? 'Giáo viên' : 'Sinh viên'}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Tài khoản: {recipient.accountEmail}
                    </p>
                  </div>
                  <input
                    type="email"
                    value={recipient.recipientEmail}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedRecipients((current) => {
                        const next = new Map(current);
                        next.set(key, { ...next.get(key), recipientEmail: value });
                        return next;
                      });
                      setRecipientEmails((current) => new Map(current).set(key, value));
                    }}
                    aria-label={`Gmail nhận cho ${recipient.accountEmail}`}
                    placeholder="Gmail cá nhân nhận thông báo"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRecipients((current) => {
                        const next = new Map(current);
                        next.delete(key);
                        return next;
                      })
                    }
                    disabled={sending}
                    aria-label={`Bỏ chọn ${recipient.accountEmail}`}
                    className="justify-self-end rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Bỏ chọn
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastResults && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-800">Kết quả gửi</h2>
              <span className="text-xs text-slate-500">
                Thành công {lastResults.sent} · Lỗi {lastResults.failed} · Bỏ qua{' '}
                {lastResults.skipped}
              </span>
            </div>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {lastResults.results.map((item) => (
                <li key={`${item.role}:${item.id}`} className="flex items-start gap-2">
                  <i
                    className={`fas mt-0.5 ${
                      item.status === 'sent'
                        ? 'fa-circle-check text-emerald-600'
                        : item.status === 'skipped'
                          ? 'fa-circle-minus text-amber-600'
                          : 'fa-circle-xmark text-rose-600'
                    }`}
                  />
                  <span className="min-w-0 break-words text-slate-600">
                    <strong className="text-slate-800">{item.accountEmail}</strong>
                    {item.recipientEmail ? ` → ${item.recipientEmail}` : ''}
                    {item.message ? ` — ${item.message}` : ' — Đã gửi'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminEmailNotifications;
