import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './providers/ToastProvider.jsx';
import { ConfirmProvider } from './providers/ConfirmProvider.jsx';
import { AuthProvider } from './providers/AuthProvider.jsx';
import { LockModal } from '../components/account/LockModal.jsx';
import { AppRouter } from './router.jsx';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30000,
      },
    },
  });
}

const defaultClient = createQueryClient();

export function App({ client = defaultClient }) {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ConfirmProvider>
              <AppRouter />
              <LockModal />
            </ConfirmProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
