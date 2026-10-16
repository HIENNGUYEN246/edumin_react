import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { Header } from './Header.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx';
import { EduMinAiAssistant, shouldShowAiAssistant } from '../ai/EduMinAiAssistant.jsx';

/** Shared shell for all three roles. Sidebar content is role-driven. */
export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const showAi = shouldShowAiAssistant(user, location?.pathname);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50/60">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar role={user?.role} />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-7 pb-28">
          <ErrorBoundary>
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {showAi && <EduMinAiAssistant />}
    </div>
  );
}

export default AppLayout;
