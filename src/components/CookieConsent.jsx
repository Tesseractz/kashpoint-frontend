import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Cookie, X, Settings, Check } from 'lucide-react'
import { PrivacyAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'

const COOKIE_CONSENT_KEY = 'cookie_consent'

export default function CookieConsent() {
  const { user } = useAuth()
  const [isVisible, setIsVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({
    essential: true, // Always true
    analytics: false,
    marketing: false,
    functional: true,
  })

  useEffect(() => {
    // Check if consent has been given
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Delay showing banner for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    } else {
      try {
        setPreferences(JSON.parse(consent))
      } catch (e) {
        // Invalid consent, show banner
        setIsVisible(true)
      }
    }
  }, [])

  const savePreferences = async (prefs) => {
    const finalPrefs = { ...prefs, essential: true }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(finalPrefs))
    setPreferences(finalPrefs)
    setIsVisible(false)
    // lib/metaPixel listens for this, so the sign-up page can start the pixel
    // the moment someone accepts marketing cookies.
    window.dispatchEvent(new Event('kp:consent'))
    
    // If logged in, sync to server
    if (user) {
      try {
        await PrivacyAPI.saveCookiePreferences(finalPrefs)
      } catch (e) {
        console.error('Failed to sync cookie preferences:', e)
      }
    }
  }

  const acceptAll = () => {
    savePreferences({
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
    })
  }

  const acceptSelected = () => {
    savePreferences(preferences)
  }

  const rejectNonEssential = () => {
    savePreferences({
      essential: true,
      analytics: false,
      marketing: false,
      functional: true,
    })
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl animate-slide-up">
      <div className="max-w-6xl mx-auto">
        {!showSettings ? (
          // Simple consent banner
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0 mt-1">
                <Cookie className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">We use cookies</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  We use cookies to improve your experience, analyze site traffic, and personalize content. 
                  You can choose which cookies you allow.{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">Learn more</a>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Customize
              </Button>
              <Button variant="outline" size="sm" onClick={rejectNonEssential}>
                Reject All
              </Button>
              <Button size="sm" onClick={acceptAll}>
                Accept All
              </Button>
            </div>
          </div>
        ) : (
          // Detailed settings
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Cookie className="w-5 h-5" />
                Cookie Preferences
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Essential Cookies */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Essential</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Required</span>
                </div>
                <p className="text-xs text-gray-500">
                  Required for the website to function. Cannot be disabled.
                </p>
              </div>

              {/* Analytics Cookies */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Analytics</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Help us understand how you use our site to improve it.
                </p>
              </div>

              {/* Marketing Cookies */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Marketing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences(prev => ({ ...prev, marketing: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Used for personalized ads and marketing messages.
                </p>
              </div>

              {/* Functional Cookies */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Functional</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) => setPreferences(prev => ({ ...prev, functional: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Enable enhanced features like saved preferences.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" size="sm" onClick={rejectNonEssential}>
                Reject Non-Essential
              </Button>
              <Button size="sm" onClick={acceptSelected}>
                <Check className="w-4 h-4 mr-2" />
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
