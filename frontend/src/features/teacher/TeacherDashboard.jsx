import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { formatTeacherCode } from '../../lib/format.js';
import { useMyTeacherClasses } from './useTeacherClasses.js';

export function TeacherDashboard() {
  const { user, profile } = useAuth();
  const { data } = useMyTeacherClasses();
  const classCount = data?.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" subtitle="Thông tin giảng dạy của bạn" />
      <ProfileCard
        user={user}
        profile={profile}
        code={profile?.id != null ? formatTeacherCode(profile.id) : ''}
        fields={[
          { label: 'Khoa', value: profile?.department },
          { label: 'Số điện thoại', value: profile?.phone },
          { label: 'Trình độ', value: profile?.education },
          { label: 'Số lớp phụ trách', value: classCount },
        ]}
      />
    </div>
  );
}

export default TeacherDashboard;
