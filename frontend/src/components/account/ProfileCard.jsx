import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar.jsx';
import { authApi } from '../../api/authApi.js';
import { useToast } from '../../app/providers/ToastProvider.jsx';

/** Profile summary with click-to-change avatar (self-service via /auth/me/avatar). */
export function ProfileCard({ profile, user, code, fields = [] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (file) => authApi.updateAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Đã cập nhật ảnh đại diện');
    },
    onError: (error) => toast.error(error.message),
  });

  const name = profile?.hoTen || user?.hoTen || '';
  const avatar =
    profile?.avatar?.url ||
    (typeof profile?.avatar === 'string' ? profile?.avatar : '') ||
    user?.avatar?.url ||
    (typeof user?.avatar === 'string' ? user?.avatar : '') ||
    '';

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={mutation.isPending}
        className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        title="Bấm để đổi ảnh đại diện"
      >
        <Avatar src={avatar} name={name} size={96} />
        <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-lg transition">
          <i className="fas fa-camera" />
        </span>
        {mutation.isPending && (
          <span className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-white text-sm font-semibold">
            <i className="fas fa-spinner fa-spin text-xl" />
          </span>
        )}
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
      </button>

      <div className="text-center sm:text-left">
        <h2 className="text-xl font-bold text-gray-800">{name}</h2>
        {code && <p className="text-indigo-600 font-semibold">{code}</p>}
        <p className="text-sm text-gray-500">{user?.email}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
          {fields.map((f) => (
            <div key={f.label}>
              <span className="text-gray-400">{f.label}: </span>
              <span className="font-medium">{f.value || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProfileCard;
