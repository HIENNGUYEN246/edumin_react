import { Suspense, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { ROLES } from '../../app/navConfig.js';
import { Header } from './Header.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { EduMinAiAssistant } from '../ai/EduMinAiAssistant.jsx';

/** Shared shell for all three roles. Sidebar content is role-driven. */
export function AppLayout() {
  const { user } = useAuth();
  const isStudent = user?.role === ROLES.STUDENT || user?.role === 'sinh-vien' || user?.role === 'student';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50/60">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar role={user?.role} />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-7 pb-28">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {isStudent && <EduMinAiAssistant />}
    </div>
  );
}

export default AppLayout;
