import { QueryClient } from '@tanstack/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { getAuthorizationHeader } from '../router/auth';

type AppRouter = any;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/trpc`,
      transformer: superjson,
      headers() {
        const authorization = getAuthorizationHeader();
        return authorization
          ? {
              authorization,
            }
          : {};
      },
    }),
  ],
});
