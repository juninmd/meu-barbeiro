import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from './components/ui/Tooltip'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import App from './App'
import './index.css'

// Dados do painel ficam em cache por 30s e são revalidados ao voltar para a aba.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } } })

const routerBasename = window.location.pathname.match(/^\/b\/[a-z0-9-]+/)?.[0]

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename}>
        <TooltipProvider><App /></TooltipProvider>
        <Toaster position="top-center" closeButton toastOptions={{ style: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
