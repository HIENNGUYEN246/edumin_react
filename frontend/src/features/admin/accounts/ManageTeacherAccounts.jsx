import { AccountManager } from './AccountManager.jsx';
import { ROLES } from '../../../app/navConfig.js';
import { formatTeacherCode } from '../../../lib/format.js';

export function ManageTeacherAccounts() {
  return (
    <AccountManager
      config={{
        role: ROLES.TEACHER,
        title: 'Tài khoản giáo viên',
        subtitle: 'Khóa/mở khóa, đặt lại mật khẩu và xóa tài khoản',
        formatCode: formatTeacherCode,
      }}
    />
  );
}

export default ManageTeacherAccounts;
