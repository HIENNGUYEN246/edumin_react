import { AccountManager } from './AccountManager.jsx';
import { ROLES } from '../../../app/navConfig.js';
import { formatStudentCode } from '../../../lib/format.js';

export function ManageStudentAccounts() {
  return (
    <AccountManager
      config={{
        role: ROLES.STUDENT,
        title: 'Tài khoản sinh viên',
        subtitle: 'Khóa/mở khóa, đặt lại mật khẩu và xóa tài khoản',
        formatCode: formatStudentCode,
      }}
    />
  );
}

export default ManageStudentAccounts;
