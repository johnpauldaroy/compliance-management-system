import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'react-vant'
import { enUS } from 'react-vant/es/locale'
import App from './App.tsx'
import 'react-vant/lib/index.css'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
})

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ConfigProvider
                locale={{
                    ...enUS,
                    vanCalendar: {
                        ...enUS.vanCalendar,
                        weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    },
                }}
            >
                <App />
            </ConfigProvider>
        </QueryClientProvider>
    </StrictMode>,
)
