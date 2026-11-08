import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'
import './lib/i18n' // Initialize i18n for translations
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App'
import ProtectedRoute from './components/ProtectedRoute'
import PlatformRoute from './components/PlatformRoute'
import RouteError from './components/RouteError'

// The till and the product list load with the app: a cashier must never wait
// for a chunk to download mid-sale, and this is often a phone on mobile data.
import Sell from './pages/Sell'
import Products from './pages/Products'
import AuthPage from './pages/Auth'

// Everything else is opened occasionally, by an owner rather than a cashier,
// so it is fetched on first visit instead of bloating the initial download.
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Transactions = React.lazy(() => import('./pages/Transactions'))
const Billing = React.lazy(() => import('./pages/Billing'))
const Profile = React.lazy(() => import('./pages/Profile'))
const Users = React.lazy(() => import('./pages/Users'))
const Customers = React.lazy(() => import('./pages/Customers'))
const Expenses = React.lazy(() => import('./pages/Expenses'))
const PrivacySettings = React.lazy(() => import('./pages/PrivacySettings'))
const Terms = React.lazy(() => import('./pages/Terms'))
const Privacy = React.lazy(() => import('./pages/Privacy'))
const RefundPolicy = React.lazy(() => import('./pages/RefundPolicy'))

// The admin portal: KashPoint staff and hardware partners only. Gated by
// PlatformRoute here and by the platform_admins table on every request.
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout'))
const AdminOverview = React.lazy(() => import('./pages/admin/AdminOverview'))
const AdminStores = React.lazy(() => import('./pages/admin/AdminStores'))
const AdminStoreDetail = React.lazy(() => import('./pages/admin/AdminStoreDetail'))
const AdminPartners = React.lazy(() => import('./pages/admin/AdminPartners'))
const AdminLog = React.lazy(() => import('./pages/admin/AdminLog'))

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-busy="true">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-brand-600 animate-spin dark:border-slate-700 dark:border-t-brand-400" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/** Wrap a lazily-loaded page so it has somewhere to render while it arrives. */
const page = (element) => <React.Suspense fallback={<PageLoading />}>{element}</React.Suspense>

// Register service worker (required for Web Push on supported browsers).
// `updateViaCache: 'none'` forces the browser to bypass HTTP cache when
// checking for SW updates, so a new sw.js ships within minutes instead
// of being held for up to 24h by Chromium's default caching policy.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Proactively check for an updated SW on registration. The browser
        // also checks ~hourly on its own, but this gives us a faster path
        // the first time a user opens the page after a deploy.
        try { reg.update() } catch (_) {}
      })
      .catch(() => {})
  })
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    // Catches the "failed to fetch dynamically imported module" a browser
    // throws when it is still running a previous build's index.html and asks
    // for chunk names that no longer exist. Reloads into the current build
    // instead of leaving the user on a dead end.
    errorElement: <RouteError />,
    children: [
      { 
        path: "/",
        element: (
          <ProtectedRoute>
            <Sell />
          </ProtectedRoute>
        ),
      },
      {
        path: "/sell",
        element: (
          <ProtectedRoute>
            <Sell />
          </ProtectedRoute>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <ProtectedRoute adminOnly>
            {page(<Dashboard />)}
          </ProtectedRoute>
        ),
      },
      { 
        path: "/products",
        element: (
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        ),
      },
      {
        path: "/users",
        element: (
          <ProtectedRoute adminOnly>
            {page(<Users />)}
          </ProtectedRoute>
        ),
      },
      {
        // Reports merged into Dashboard — keep old links working.
        path: "/reports",
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "/transactions",
        element: (
          <ProtectedRoute adminOnly>
            {page(<Transactions />)}
          </ProtectedRoute>
        ),
      },
      { 
        path: "/auth",
        element: <AuthPage />,
      },
      { 
        path: "/billing",
        element: (
          <ProtectedRoute adminOnly>
            {page(<Billing />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "/profile",
        element: (
          <ProtectedRoute>
            {page(<Profile />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "/customers",
        element: (
          <ProtectedRoute adminOnly>
            {page(<Customers />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "/expenses",
        element: (
          <ProtectedRoute adminOnly>
            {page(<Expenses />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "/privacy-settings",
        element: (
          <ProtectedRoute>
            {page(<PrivacySettings />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "/admin",
        element: (
          <PlatformRoute>
            {page(<AdminLayout />)}
          </PlatformRoute>
        ),
        children: [
          { index: true, element: page(<AdminOverview />) },
          { path: "stores", element: page(<AdminStores />) },
          { path: "stores/:storeId", element: page(<AdminStoreDetail />) },
          { path: "partners", element: page(<AdminPartners />) },
          { path: "log", element: page(<AdminLog />) },
        ],
      },
      {
        path: "/terms",
        element: page(<Terms />),
      },
      {
        path: "/refund-policy",
        element: page(<RefundPolicy />),
      },
      {
        path: "/privacy",
        element: page(<Privacy />),
      },
    ],
  },
]);

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  </ThemeProvider>
)
