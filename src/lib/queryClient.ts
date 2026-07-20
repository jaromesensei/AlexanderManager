import { QueryClient, MutationCache } from '@tanstack/react-query'
import { toastBus } from '@/lib/toastBus'

export const queryClient = new QueryClient({
  // הודעת שגיאה גלובלית לכל פעולת כתיבה שנכשלת
  mutationCache: new MutationCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'הפעולה נכשלה'
      toastBus('error', message)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // דקה
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
