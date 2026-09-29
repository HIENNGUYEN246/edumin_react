import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

const DEFAULT_LOCK_MESSAGE = 'Tài khoản của bạn đã bị tạm khóa.';

export function useStudentLockMonitor(currentUser) {
  const navigate = useNavigate();
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState(DEFAULT_LOCK_MESSAGE);

  const applyLockState = useCallback((account) => {
    if (!account || account.status === 'Locked') {
      setLockReason(account?.lockReason?.trim() || DEFAULT_LOCK_MESSAGE);
      setShowLockModal(true);
      return true;
    }
    setShowLockModal(false);
    return false;
  }, []);

  const checkAccountStatus = useCallback(async () => {
    if (!currentUser?.email || !currentUser?.role) return;

    try {
      // Poll only the current account status instead of downloading all app data.
      const account = await apiClient.getAccountStatus(currentUser.email, currentUser.role);
      if (!account) {
        setLockReason('Tài khoản không còn tồn tại.');
        setShowLockModal(true);
        return true;
      }
      return applyLockState(account);
    } catch (error) {
      console.error('Không kiểm tra được trạng thái tài khoản sinh viên:', error);
    }
  }, [applyLockState, currentUser?.email, currentUser?.role]);

  const handleLogoutToLogin = useCallback(() => {
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    if (!currentUser?.email) return undefined;

    checkAccountStatus();
    const statusTimer = setInterval(checkAccountStatus, 30000);
    return () => clearInterval(statusTimer);
  }, [checkAccountStatus, currentUser?.email]);

  return { showLockModal, lockReason, handleLogoutToLogin, checkAccountStatus };
}
