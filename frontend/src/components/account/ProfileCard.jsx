import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar.jsx';
import { Modal } from '../ui/Modal.jsx';
import { authApi } from '../../api/authApi.js';
import { profileRequestsApi } from '../../api/profileRequestsApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { EditProfileModal } from './EditProfileModal.jsx';

/** Profile summary with click-to-view/change avatar and profile update approval requests. */
export function ProfileCard({ profile, user, code, fields = [] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewAvatarOpen, setViewAvatarOpen] = useState(false);
  const [dismissedAlertId, setDismissedAlertId] = useState(null);

  useEffect(() => {
    setDismissedAlertId(null);
  }, [user?._id]);

  const isSelfService =
    user?.role === 'giao-vien' ||
    user?.role === 'teacher' ||
    user?.role === 'sinh-vien' ||
    user?.role === 'student';

  // Fetch the latest profile request for teacher/student
  const { data: latestRequest } = useQuery({
    queryKey: ['profile-requests', 'my-latest', user?._id],
    queryFn: profileRequestsApi.myLatest,
    enabled: Boolean(user && isSelfService),
    staleTime: 10000,
  });

  const isAlertDismissed = Boolean(
    dismissedAlertId &&
    (dismissedAlertId === latestRequest?._id || dismissedAlertId === latestRequest?.updatedAt || dismissedAlertId === 'dismissed')
  );

  const mutation = useMutation({
    mutationFn: (file) => authApi.updateAvatar(file),
    onSuccess: (data) => {
      if (data?.user) {
        queryClient.setQueryData(['auth', 'me'], (old) => ({
          ...old,
          user: { ...(old?.user || {}), ...data.user, avatar: data.avatar || data.user?.avatar },
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['profile-requests'] });
      window.dispatchEvent(new CustomEvent('edumin_profile_request_updated'));

      if (data?.approved && !data?.pending) {
        toast.success(data.message || 'Cập nhật ảnh đại diện thành công');
      } else if (data?.pending || data?.status === 'pending' || data?.success) {
        toast.success(data.message || 'Tải lên ảnh đại diện thành công! Yêu cầu đang chờ Phòng Đào tạo duyệt.');
      } else if (data?.status === 'rejected' || data?.success === false) {
        toast.error(data.message || 'Không thể cập nhật ảnh đại diện');
      } else {
        toast.success(data.message || 'Đã gửi yêu cầu đổi ảnh đại diện');
      }
    },
    onError: (error) => toast.error(error.message || 'Lỗi khi cập nhật ảnh đại diện'),
  });

  const name =
    profile?.hoTen ||
    profile?.name ||
    user?.hoTen ||
    user?.name ||
    (user?.role === 'dao-tao' || user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng');

  const avatar =
    profile?.avatar?.url ||
    profile?.avatar?.secure_url ||
    (typeof profile?.avatar === 'string' ? profile?.avatar : '') ||
    user?.avatar?.url ||
    user?.avatar?.secure_url ||
    (typeof user?.avatar === 'string' ? user?.avatar : '') ||
    profile?.avatarUrl ||
    user?.avatarUrl ||
    latestRequest?.requestedData?.avatar?.url ||
    latestRequest?.requestedData?.avatar?.secure_url ||
    (typeof latestRequest?.requestedData?.avatar === 'string' ? latestRequest?.requestedData?.avatar : '') ||
    '';

  return (
    <>
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-2xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full md:w-auto">
          {/* Avatar button opens big preview lightbox/modal */}
          <button
            type="button"
            onClick={() => setViewAvatarOpen(true)}
            className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shrink-0 cursor-pointer"
            title="Bấm để xem ảnh đại diện"
          >
            <Avatar src={avatar} name={name} size={96} />
            <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold gap-1 transition">
              <i className="fas fa-eye text-base" />
              <span>Xem ảnh</span>
            </span>
            {mutation.isPending && (
              <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-white text-sm font-semibold">
                <i className="fas fa-spinner fa-spin text-xl" />
              </span>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) mutation.mutate(file);
            }}
          />

          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-xl font-bold text-gray-800">{name}</h2>
              {code && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {code}
                </span>
              )}
              {latestRequest?.status === 'pending' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <i className="fas fa-clock text-[10px]" />
                  Đang chờ duyệt
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-gray-600">
              {(Array.isArray(fields) ? fields : [])
                .filter(
                  (f) =>
                    f &&
                    f.value !== undefined &&
                    f.value !== null &&
                    String(typeof f.value === 'object' ? (f.value?.name || f.value?.id || '') : f.value).trim() !== '' &&
                    String(typeof f.value === 'object' ? '' : f.value).trim() !== '—'
                )
                .map((f) => {
                  const valDisplay = typeof f.value === 'object' ? (f.value?.name || f.value?.id || '—') : f.value;
                  return (
                    <div key={f.label} className="truncate">
                      <span className="text-gray-400">{f.label}: </span>
                      <span className="font-medium text-gray-800">{valDisplay}</span>
                    </div>
                  );
                })}
            </div>

            {/* Pending request alert */}
            {latestRequest?.status === 'pending' && (
              <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
                <div className="w-6 h-6 rounded-lg bg-amber-200/60 flex items-center justify-center shrink-0 mt-0.5 text-amber-800">
                  <i className="fas fa-hourglass-half" />
                </div>
                <div>
                  <p className="font-bold">Yêu cầu thay đổi đang chờ Quản trị viên duyệt</p>
                  <p className="text-amber-800/90 mt-0.5 leading-relaxed">
                    Nội dung:{' '}
                    <span className="font-semibold">
                      {latestRequest.type === 'avatar'
                        ? 'Ảnh đại diện mới'
                        : latestRequest.type === 'profile'
                        ? 'Thông tin cá nhân'
                        : 'Ảnh đại diện và thông tin'}
                    </span>
                    . Sau khi được duyệt, hồ sơ của bạn sẽ tự động cập nhật.
                  </p>
                </div>
              </div>
            )}

            {/* Recently rejected alert */}
            {latestRequest?.status === 'rejected' && latestRequest.adminNote && !isAlertDismissed && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-rose-900">
                <div className="flex items-start gap-3">
                  <i className="fas fa-exclamation-circle text-rose-500 mt-0.5 text-sm" />
                  <div>
                    <p className="font-bold">Yêu cầu thay đổi gần đây bị từ chối</p>
                    <p className="text-rose-700 mt-0.5 font-medium">Lý do: {latestRequest.adminNote}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedAlertId(latestRequest._id || latestRequest.updatedAt || 'dismissed')}
                  className="text-rose-400 hover:text-rose-700 p-1 text-xs font-bold transition cursor-pointer"
                  title="Đóng thông báo"
                  aria-label="Đóng thông báo"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex md:flex-col items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <i className="fas fa-user-edit" />
            <span>{isSelfService ? 'Cập nhật thông tin' : 'Chỉnh sửa'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={mutation.isPending}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-60"
          >
            <i className="fas fa-camera text-gray-500" />
            <span>{mutation.isPending ? 'Đang tải...' : 'Đổi avatar'}</span>
          </button>
        </div>
      </div>

      {/* Modal xem trước & phóng to ảnh đại diện */}
      <Modal
        isOpen={viewAvatarOpen}
        onClose={() => setViewAvatarOpen(false)}
        title="Ảnh đại diện"
        icon="fa-id-badge"
        size="sm"
      >
        <div className="flex flex-col items-center text-center p-2 space-y-4">
          <div className="relative p-1 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 shadow-md">
            <Avatar src={avatar} name={name} size={180} className="border-4 border-white" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">{name}</h3>
            {code && (
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {code}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-1">{user?.email}</p>
          </div>

          {latestRequest?.status === 'pending' && latestRequest?.type?.includes('avatar') && (
            <div className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-center gap-2">
              <i className="fas fa-clock text-amber-600 animate-pulse" />
              <span>Ảnh đại diện mới đang trong hàng đợi chờ Quản trị viên duyệt</span>
            </div>
          )}

          <div className="flex items-center gap-3 w-full pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setViewAvatarOpen(false);
                fileRef.current?.click();
              }}
              disabled={mutation.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <i className="fas fa-camera" />
              <span>{mutation.isPending ? 'Đang tải...' : 'Đổi ảnh khác'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewAvatarOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        profile={profile}
      />
    </>
  );
}

export default ProfileCard;
