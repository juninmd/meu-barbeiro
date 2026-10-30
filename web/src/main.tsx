import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import '@fontsource-variable/inter'
import App from './App'
import './index.css'

const routerBasename = window.location.pathname.match(/^\/b\/[a-z0-9-]+/)?.[0]

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  </React.StrictMode>,
)
