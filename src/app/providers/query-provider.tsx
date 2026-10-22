import { hashKey, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { tokenStorage } from '@/shared/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      // Кэш первого аккаунта не подходит второму даже в пределах staleTime.
      queryKeyHashFn: (queryKey) => hashKey([tokenStorage.currentEpoch(), queryKey]),
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => tokenStorage.onSessionChange(() => {
    void queryClient.cancelQueries();
    queryClient.removeQueries();
  }), []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
