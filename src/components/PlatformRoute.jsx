import { Navigate, useLocation } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Card, CardContent } from './ui/Card'

// The admin portal's gate. The server checks platform_admins on every /admin
// request; this only keeps the pages from flashing for everyone else. It
// waits for the profile before deciding, so a staff member opening the portal
// on a cold load is not bounced while the request is still out.
export default function PlatformRoute({ children }) {
  const { isAuthenticated, loading, profile, profileLoading, isPlatformAdmin } = useAuth()
  const location = useLocation()

  if (loading || (isAuthenticated && !profile && profileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-busy="true">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <ShieldOff className="w-12 h-12 mx-auto mb-4 text-slate-400" aria-hidden />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">Staff only</h3>
            <p className="text-slate-500 dark:text-slate-400">
              This part of KashPoint is for the KashPoint team and its hardware partners.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return children
}
