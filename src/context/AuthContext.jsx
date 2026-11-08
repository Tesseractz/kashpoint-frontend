import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, recoveryInUrl } from '../lib/supabase'
import { ProfileAPI } from '../api/client'
import { readCachedProfile, writeCachedProfile, clearCachedProfile } from '../lib/profileCache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  // True from the first render when the page was opened from a password
  // recovery link. A recovery link also creates a real session, so without
  // this flag the app cannot tell 'reset your password' apart from a normal
  // sign-in and just drops the user on the dashboard.
  const [passwordRecovery, setPasswordRecovery] = useState(recoveryInUrl)

  const fetchProfile = async (currentSession = null) => {
    const sessionToUse = currentSession || session
    if (!sessionToUse?.user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    try {
      setProfileLoading(true)
      console.log('[AuthContext] Fetching profile...')
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )
      
      const data = await Promise.race([
        ProfileAPI.get(),
        timeoutPromise
      ])
      
      console.log('[AuthContext] Profile fetched:', data)
      setProfile(data)
      if (sessionToUse.user?.id) writeCachedProfile(sessionToUse.user.id, data)
    } catch (error) {
      console.error('[AuthContext] Failed to fetch profile:', error)
      console.error('[AuthContext] Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      })
      // Don't set profile to null on error - keep previous value if exists
      // This allows app to work even if profile fetch fails
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    const loadSession = async () => {
      try {
        console.log('[AuthContext] Loading session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('[AuthContext] Session loaded:', { hasSession: !!session, hasUser: !!session?.user, error })
        
        if (error) {
          console.error('[AuthContext] Session error:', error)
        }
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)  // Always set loading to false, even if profile fetch fails
        
        if (session?.user) {
          console.log('[AuthContext] User found, fetching profile...')
          // Render with the role this device last saw for THIS user, so an
          // owner is not shown a cashier's navigation while the request runs.
          const remembered = readCachedProfile(session.user.id)
          if (remembered) setProfile(remembered)
          // Fetch profile in background - don't await, don't block
          fetchProfile(session).catch(err => {
            console.error('[AuthContext] Background profile fetch failed:', err)
          })
        } else {
          console.log('[AuthContext] No user in session')
        }
      } catch (error) {
        console.error('[AuthContext] Error loading session:', error)
        setLoading(false)  // Always complete loading
      }
    }
    
    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        console.log('[AuthContext] Auth state changed:', { event: _event, hasSession: !!session, hasUser: !!session?.user })
        // Backstop for the case where the fragment was already gone by the
        // time this module loaded: supabase-js announces recovery itself.
        if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)  // Always set loading to false
        if (session?.user) {
          console.log('[AuthContext] User in state change, fetching profile...')
          const remembered = readCachedProfile(session.user.id)
          if (remembered) setProfile(remembered)
          // Fetch profile in background
          fetchProfile(session).catch(err => {
            console.error('[AuthContext] Background profile fetch failed:', err)
          })
        } else {
          console.log('[AuthContext] No user in state change')
          setProfile(null)
          setProfileLoading(false)
        }
      } catch (error) {
        console.error('[AuthContext] Error in auth state change:', error)
        setLoading(false)
      }
    })

    return () => subscription?.unsubscribe?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Called once the new password has actually been saved, so the app stops
  // holding the user on the reset screen.
  const endPasswordRecovery = () => setPasswordRecovery(false)

  const signOut = async () => {
    setPasswordRecovery(false)
    clearCachedProfile()
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  const value = {
    user,
    session,
    loading: loading,  // Don't block on profile loading - profile can load in background
    profileLoading,  // Expose separately so components can show profile loading state
    profile,
    role: profile?.role || null,
    isAdmin: profile?.role === 'admin',
    // The admin portal: 'owner' (KashPoint staff) or 'partner' (a hardware
    // reseller who sees the stores they brought in). Server-enforced; this
    // only decides whether the link is shown.
    platformRole: profile?.platform_role || null,
    isPlatformAdmin: !!profile?.platform_role,
    isPlatformOwner: profile?.platform_role === 'owner',
    signOut,
    isAuthenticated: !!user,
    refreshProfile: fetchProfile,
    passwordRecovery,
    endPasswordRecovery,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
