import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProfileCard } from '../../components/account/ProfileCard.jsx';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { formatStudentCode } from '../../lib/format.js';
import { useMyEnrollments } from './useEnrollments.js';

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const { data } = useMyEnrollments();
  const enrolledCount = data?.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" subtitle="Thông tin học tập của bạn" />
      <ProfileCard
        user={user}
        profile={profile}
        code={profile?.id != null ? formatStudentCode(profile.id) : ''}
        fields={[
          { label: 'Lớp', value: profile?.className },
          { label: 'Khoa', value: profile?.department },
          { label: 'Hệ đào tạo', value: profile?.education },
          { label: 'Học phần đã đăng ký', value: enrolledCount },
        ]}
      />
    </div>
  );
}

export default StudentDashboard;
