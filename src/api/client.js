import axios from 'axios'
import { supabase } from '../lib/supabase'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

// Log once in production if API URL is missing (common Netlify/deploy mistake)
if (!import.meta.env.DEV && !baseURL) {
  console.error(
    '[KashPoint] VITE_API_BASE_URL is not set. API requests will go to this domain and fail. ' +
    'Set it in Netlify: Site settings → Environment variables → VITE_API_BASE_URL = your backend URL (e.g. https://your-api.fly.dev)'
  )
}

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
})

// Attach Supabase access token to each request
api.interceptors.request.use(async (config) => {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('[API Client] Session error:', error.message)
    }
    const token = data.session?.access_token
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
      if (import.meta.env.DEV) {
        console.log('[API Client] Token attached:', token.substring(0, 20) + '...')
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('[API Client] No session token available')
      }
    }
  } catch (e) {
    console.error('[API Client] Error getting session:', e.message)
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    config.headers = config.headers || {}
    config.headers['X-App-Origin'] = window.location.origin
  }
  return config
})

// Helpers for endpoints
export const ProductsAPI = {
  list: (params) => api.get('/products', { params }).then(r => ({
    items: r.data,
    total: Number(r.headers?.['x-total-count'] || 0),
  })),
  create: (data) => api.post('/products', data).then(r => r.data),
  update: (id, data) => api.put(`/products/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/products/${id}`).then(r => r.data),
}

export const SalesAPI = {
  list: () => api.get('/sales').then(r => r.data),
  create: (data) => api.post('/sales', data).then(r => r.data),
}

export const ReturnsAPI = {
  create: (data) => api.post('/returns', data).then(r => r.data),
}

function getReportParams(date) {
  const params = { date_utc: date }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) params.timezone = tz
  } catch (_) {}
  return params
}

export const ReportsAPI = {
  get: (date) => api.get('/reports', { params: getReportParams(date) }).then(r => r.data),
  exportCSV: (date) => api.get('/reports/export', {
    params: getReportParams(date),
    responseType: 'blob'
  }).then(r => r.data),
}

export const BillingAPI = {
  checkout: ({ plan, email }) => api.post('/billing/checkout', { plan, email }).then(r => r.data),
  // Save a card during the trial: R1 refundable check now, first R150 on the trial's end date.
  cardSetup: ({ email }) => api.post('/billing/card-setup', { email }).then(r => r.data),
  cancel: () => api.post('/billing/cancel').then(r => r.data),
  paystackSync: (reference) => api.post('/billing/paystack/sync', { reference }).then(r => r.data),
  config: () => api.get('/billing/config').then(r => r.data),
}

export const PlanAPI = {
  get: () => api.get('/plan').then(r => r.data),
}

export const ProfileAPI = {
  get: () => api.get('/profile').then(r => r.data),
}

// The business details printed on receipts (name, logo, address, VAT number...).
export const StoreAPI = {
  get: () => api.get('/store').then(r => r.data),
  update: (data) => api.put('/store', data).then(r => r.data),
}

export const UsersAPI = {
  list: () => api.get('/users').then(r => r.data),
  invite: (data) => api.post('/users/invite', data).then(r => r.data),
  updateRole: (userId, role) => api.put(`/users/${userId}/role`, { role }).then(r => r.data),
  remove: (userId) => api.delete(`/users/${userId}`).then(r => r.data),
  getCredentials: (userId) => api.get(`/users/${userId}/credentials`).then(r => r.data),
}

export const AlertsAPI = {
  getLowStock: (threshold = 10) => api.get('/alerts/low-stock', { params: { threshold } }).then(r => r.data),
}

export const AuditAPI = {
  list: (limit = 50) => api.get('/audit-logs', { params: { limit } }).then(r => r.data),
}

export const AnalyticsAPI = {
  get: (days = 30) => api.get('/analytics', { params: { days } }).then(r => r.data),
}

export const NotificationsAPI = {
  status: () => api.get("/notifications/status").then((r) => r.data),
  sendLowStockAlert: (data) =>
    api.post("/notifications/low-stock", data).then((r) => r.data),
  sendDailySummary: (data) =>
    api.post("/notifications/daily-summary", data).then((r) => r.data),
  getSettings: () => api.get("/notifications/settings").then((r) => r.data),
  updateSettings: (data) =>
    api.put("/notifications/settings", data).then((r) => r.data),
  sendReceipt: (data) => api.post("/receipts/send", data).then((r) => r.data),
};

export const PushAPI = {
  vapidPublicKey: () => api.get("/push/vapid-public-key").then((r) => r.data),
  subscribe: (subscription) =>
    api.post("/push/subscribe", subscription).then((r) => r.data),
  unsubscribe: (endpoint) =>
    api.post("/push/unsubscribe", { endpoint }).then((r) => r.data),
  test: () => api.post("/push/test").then((r) => r.data),
  fcmStatus: () => api.get("/push/fcm/status").then((r) => r.data),
  fcmSubscribe: (data) =>
    api.post("/push/fcm/subscribe", data).then((r) => r.data),
  fcmUnsubscribe: (token) =>
    api.post("/push/fcm/unsubscribe", { token }).then((r) => r.data),
  fcmTest: () => api.post("/push/fcm/test").then((r) => r.data),
};

// Customers API
export const CustomersAPI = {
  list: (params = {}) => 
    api.get('/customers', { params }).then(r => r.data),
  get: (id) => api.get(`/customers/${id}`).then(r => r.data),
  getPurchases: (id, limit = 50) => 
    api.get(`/customers/${id}/purchases`, { params: { limit } }).then(r => r.data),
  create: (data) => api.post('/customers', data).then(r => r.data),
  update: (id, data) => api.put(`/customers/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/customers/${id}`).then(r => r.data),
  addPoints: (id, points) => 
    api.post(`/customers/${id}/add-points`, null, { params: { points } }).then(r => r.data),
};

// Barcode API
export const BarcodeAPI = {
  generate: (productId, barcodeType = 'CODE128') => 
    api.post(`/products/${productId}/barcode`, { product_id: productId, barcode_type: barcodeType }).then(r => r.data),
  lookup: (barcode) => api.get(`/barcode/lookup/${barcode}`).then(r => r.data),
};

// Expenses API
export const ExpensesAPI = {
  list: (params = {}) => api.get('/expenses', { params }).then(r => r.data),
  get: (id) => api.get(`/expenses/${id}`).then(r => r.data),
  create: (data) => api.post('/expenses', data).then(r => r.data),
  update: (id, data) => api.put(`/expenses/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/expenses/${id}`).then(r => r.data),
  getCategories: () => api.get('/expense-categories').then(r => r.data),
  getSummary: (startDate, endDate) => 
    api.get('/expenses/summary', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
};

// Enhanced Reports API
export const EnhancedReportsAPI = {
  getProfitLoss: (startDate, endDate) => 
    api.get('/reports/profit-loss', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),
  getTax: (startDate, endDate, taxRate = 15) => 
    api.get('/reports/tax', { params: { start_date: startDate, end_date: endDate, tax_rate: taxRate } }).then(r => r.data),
  getInventoryValuation: (threshold = 10) => 
    api.get('/reports/inventory-valuation', { params: { low_stock_threshold: threshold } }).then(r => r.data),
  exportProfitLossCSV: (startDate, endDate) => 
    api.get('/reports/export/profit-loss', { 
      params: { start_date: startDate, end_date: endDate },
      responseType: 'blob'
    }).then(r => r.data),
};

// Privacy & Compliance API
export const PrivacyAPI = {
  // Consents
  getConsents: () => api.get('/privacy/consents').then(r => r.data),
  updateConsent: (data) => api.post('/privacy/consents', data).then(r => r.data),
  
  // Privacy Settings
  getSettings: () => api.get('/privacy/settings').then(r => r.data),
  updateSettings: (data) => api.put('/privacy/settings', data).then(r => r.data),
  
  // Sessions
  getSessions: () => api.get('/privacy/sessions').then(r => r.data),
  revokeSession: (sessionId) => api.delete(`/privacy/sessions/${sessionId}`).then(r => r.data),
  revokeAllSessions: () => api.delete('/privacy/sessions').then(r => r.data),
  
  // Data Export
  requestDataExport: () => api.post('/privacy/data-export').then(r => r.data),
  getDataExportRequests: () => api.get('/privacy/data-export').then(r => r.data),
  
  // Account Deletion
  requestAccountDeletion: (data) => api.post('/privacy/delete-account', data).then(r => r.data),
  cancelAccountDeletion: (requestId) => api.delete(`/privacy/delete-account/${requestId}`).then(r => r.data),
  executeAccountDeletion: (data) => api.post('/privacy/delete-account/execute', data).then(r => r.data),
  getAccountDeletionRequests: () => api.get('/privacy/delete-account').then(r => r.data),
  
  // Cookies
  getCookiePreferences: () => api.get('/privacy/cookies').then(r => r.data),
  saveCookiePreferences: (data) => api.post('/privacy/cookies', data).then(r => r.data),
};

// The admin portal: KashPoint staff and hardware partners. Every route is
// gated server-side by the platform_admins table; the client only decides
// what to show.
export const AdminAPI = {
  me: () => api.get('/admin/me').then(r => r.data),
  overview: () => api.get('/admin/overview').then(r => r.data),
  stores: (params = {}) => api.get('/admin/stores', { params }).then(r => r.data),
  store: (id) => api.get(`/admin/stores/${id}`).then(r => r.data),
  extendTrial: (id, days) => api.post(`/admin/stores/${id}/trial`, { days }).then(r => r.data),
  grantComp: (id, body) => api.post(`/admin/stores/${id}/comp`, body).then(r => r.data),
  revokeComp: (id) => api.delete(`/admin/stores/${id}/comp`).then(r => r.data),
  suspend: (id, reason) => api.post(`/admin/stores/${id}/suspend`, { reason }).then(r => r.data),
  unsuspend: (id) => api.delete(`/admin/stores/${id}/suspend`).then(r => r.data),
  updateStore: (id, patch) => api.patch(`/admin/stores/${id}`, patch).then(r => r.data),
  passwordReset: (id) => api.post(`/admin/stores/${id}/password-reset`).then(r => r.data),
  partners: () => api.get('/admin/partners').then(r => r.data),
  createPartner: (body) => api.post('/admin/partners', body).then(r => r.data),
  updatePartner: (id, patch) => api.patch(`/admin/partners/${id}`, patch).then(r => r.data),
  addPartnerAdmin: (id, email) => api.post(`/admin/partners/${id}/admins`, { email }).then(r => r.data),
  removePartnerAdmin: (id, userId) => api.delete(`/admin/partners/${id}/admins/${userId}`).then(r => r.data),
  admins: () => api.get('/admin/admins').then(r => r.data),
  addAdmin: (email) => api.post('/admin/admins', { email }).then(r => r.data),
  removeAdmin: (userId) => api.delete(`/admin/admins/${userId}`).then(r => r.data),
  actions: (params = {}) => api.get('/admin/actions', { params }).then(r => r.data),
}

// Legal Documents API
export const LegalAPI = {
  getTerms: () => api.get('/legal/terms').then(r => r.data),
  getPrivacyPolicy: () => api.get('/legal/privacy').then(r => r.data),
};

// Dev instrumentation: log request durations to help diagnose slowness
if (import.meta.env.DEV) {
  api.interceptors.request.use((config) => {
    // attach start time for duration measurement
    config.metadata = { start: performance.now(), url: `${config.method?.toUpperCase()} ${config.baseURL}${config.url}` }
    return config
  })
  api.interceptors.response.use(
    (response) => {
      const meta = response.config.metadata
      if (meta?.start) {
        const ms = Math.round(performance.now() - meta.start)
        // eslint-disable-next-line no-console
        console.debug(`[API] ${meta.url} -> ${response.status} in ${ms}ms`)
      }
      return response
    },
    (error) => {
      const meta = error.config?.metadata
      if (meta?.start) {
        const ms = Math.round(performance.now() - meta.start)
        // eslint-disable-next-line no-console
        console.debug(`[API] ${meta.url} -> ERROR in ${ms}ms`, error.response?.status, error.message)
      }
      return Promise.reject(error)
    }
  )
}

// Production: log helpful message on first API failure (network/404/CORS)
let productionApiFailureLogged = false
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (!import.meta.env.DEV && !productionApiFailureLogged) {
      productionApiFailureLogged = true
      const status = error.response?.status
      const noResponse = error.code === 'ERR_NETWORK' || error.message === 'Network Error'
      const hint = !baseURL
        ? 'Set VITE_API_BASE_URL in Netlify (and redeploy) to your backend URL.'
        : noResponse
          ? `Backend may be down or CORS may be blocking. Allow origin ${window.location.origin} in your API.`
          : status === 404
            ? 'Backend returned 404. Check that VITE_API_BASE_URL points to the correct API root.'
            : ''
      if (hint) {
        console.error('[KashPoint] API request failed:', error.message, status || '', '\n→', hint)
      }
    }
    return Promise.reject(error)
  }
)


