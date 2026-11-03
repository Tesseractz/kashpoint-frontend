import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase, authErrorInUrl, confirmedInUrl } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { Button } from "../components/ui/Button"
import { Card, CardContent } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import toast from "react-hot-toast"
import { Logo } from "../components/Logo"
import { normalizePhone } from "../lib/phone"
import {
  Store,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  ArrowLeft,
  CheckCircle,
  KeyRound,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react"

// Auth modes
const MODE = {
  SIGN_IN: "signin",
  SIGN_UP: "signup",
  FORGOT_PASSWORD: "forgot",
  RESET_PASSWORD: "reset",
  EMAIL_CONFIRMATION_SENT: "email_sent",
  PASSWORD_RESET_SENT: "reset_sent",
}

export default function AuthPage() {
  const { isAuthenticated, passwordRecovery, endPasswordRecovery } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [storeName, setStoreName] = useState("")
  const [phone, setPhone] = useState("")
  // Ads link to /auth?mode=signup so a new shop lands on the sign-up form.
  const [mode, setMode] = useState(() => {
    if (passwordRecovery) return MODE.RESET_PASSWORD
    const wanted = new URLSearchParams(window.location.search).get("mode")
    return wanted === "signup" ? MODE.SIGN_UP : MODE.SIGN_IN
  })
  const [loading, setLoading] = useState(false)

  // Privacy consents
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)

  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { theme, toggleTheme } = useTheme()

  const from = location.state?.from?.pathname || "/"

  // supabase-js strips the URL fragment while it initialises, so the markers it
  // carried are captured at import time in lib/supabase.js rather than read
  // from window.location here.
  useEffect(() => {
    if (passwordRecovery) setMode(MODE.RESET_PASSWORD)
  }, [passwordRecovery])

  useEffect(() => {
    if (confirmedInUrl) {
      toast.success("Email confirmed! You can now sign in.")
      setMode(MODE.SIGN_IN)
      window.history.replaceState(null, "", window.location.pathname)
    }

    if (authErrorInUrl) {
      // Reset links are single-use and expire in an hour; say so instead of
      // dropping the user on a sign-in form that looks like nothing happened.
      const expired = authErrorInUrl.code === "otp_expired"
      toast.error(
        expired
          ? "That password reset link has expired or was already used. Request a new one."
          : authErrorInUrl.description || "Authentication error"
      )
      setMode(expired ? MODE.FORGOT_PASSWORD : MODE.SIGN_IN)
      window.history.replaceState(null, "", window.location.pathname)
    }

    const error = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")
    if (error) toast.error(errorDescription || "Authentication error")
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated && mode !== MODE.RESET_PASSWORD) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from, mode])

  const validateForm = () => {
    if (mode === MODE.FORGOT_PASSWORD) {
      if (!email) { toast.error("Please enter your email"); return false }
      return true
    }
    if (mode === MODE.RESET_PASSWORD) {
      if (!password || password.length < 6) { toast.error("Password must be at least 6 characters"); return false }
      if (password !== confirmPassword) { toast.error("Passwords do not match"); return false }
      return true
    }
    if (!email || !password) { toast.error("Email and password are required"); return false }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return false }
    if (mode === MODE.SIGN_UP) {
      if (password !== confirmPassword) { toast.error("Passwords do not match"); return false }
      if (!storeName.trim()) { toast.error("Store name is required"); return false }
      if (!normalizePhone(phone)) { toast.error(t("auth.phone_invalid")); return false }
      if (!termsAccepted) { toast.error("You must accept the Terms of Service"); return false }
      if (!privacyAccepted) { toast.error("You must accept the Privacy Policy"); return false }
    }
    return true
  }

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    toast.success("Welcome back!")
    navigate(from, { replace: true })
  }

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          store_name: storeName.trim(),
          phone: normalizePhone(phone),
          marketing_opt_in: marketingOptIn,
        },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    })
    if (error) throw error
    if (data.user && !data.session) {
      setMode(MODE.EMAIL_CONFIRMATION_SENT)
    } else if (data.session) {
      toast.success("Account created successfully!")
      navigate("/")
    }
  }

  const handleForgotPassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    })
    if (error) throw error
    setMode(MODE.PASSWORD_RESET_SENT)
  }

  const handleResetPassword = async () => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    toast.success("Password updated successfully!")
    window.history.replaceState(null, "", window.location.pathname)
    // Release the reset screen before navigating, or ProtectedRoute bounces
    // straight back to it.
    endPasswordRecovery()
    setMode(MODE.SIGN_IN)
    setPassword("")
    setConfirmPassword("")
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      switch (mode) {
        case MODE.SIGN_IN: await handleSignIn(); break
        case MODE.SIGN_UP: await handleSignUp(); break
        case MODE.FORGOT_PASSWORD: await handleForgotPassword(); break
        case MODE.RESET_PASSWORD: await handleResetPassword(); break
        default: break
      }
    } catch (e) {
      toast.error(e.message || "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  const handleClearSession = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className="relative min-h-screen flex">
      <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />

      {/* Left brand panel — only visible on lg+ */}
      <aside className="hidden lg:flex relative flex-1 items-center justify-center bg-ink-gradient text-white overflow-hidden">
        {/* One restrained glow, low and off-centre. The previous panel stacked
            three blurred orbs over a saturated blue slab, which is the look of
            a template rather than a payments product. */}
        <div className="pointer-events-none absolute -bottom-40 -right-24 w-[34rem] h-[34rem] rounded-full bg-accent-500/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative max-w-md px-12 py-16 z-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] ring-1 ring-white/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300 mb-9">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
            One plan. Full access.
          </div>
          <h2 className="font-display text-4xl xl:text-[2.9rem] font-semibold leading-[1.12] tracking-tight">
            Every sale, every till,
            <br />
            <span className="text-accent-400">one set of numbers.</span>
          </h2>
          <p className="mt-5 text-slate-400 text-[15px] leading-relaxed">
            KashPoint runs in the browser, on the desktop and in your pocket —
            with offline mode for the moments your connection gives up.
          </p>

          <dl className="mt-11 grid grid-cols-3 gap-6 border-t border-white/10 pt-7">
            {[
              { value: "R150", label: "per month" },
              { value: "30 days", label: "free trial" },
              { value: "Offline", label: "ready" },
            ].map(({ value, label }) => (
              <div key={label}>
                <dt className="font-display text-xl font-semibold tracking-tight text-white">{value}</dt>
                <dd className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-9 space-y-3.5">
            {[
              { icon: TrendingUp, label: "Live profit on every sale" },
              { icon: Smartphone, label: "Same data on every device" },
              { icon: ShieldCheck, label: "Card billing through Paystack" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-slate-300">
                <Icon size={16} className="flex-shrink-0 text-accent-400" strokeWidth={2} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14 lg:px-12">
        <div className="w-full max-w-md animate-slide-up">
          <AuthHeader subtitle={subtitleFor(mode, t)} />
          {mode === MODE.EMAIL_CONFIRMATION_SENT && (
            <SuccessCard
              icon={Mail}
              tone="accent"
              title={t("auth.check_email")}
              body={<>
                {t("auth.email_sent")}{" "}
                <strong className="text-slate-900 dark:text-white">{email}</strong>
                . {t("auth.click_to_activate")}
              </>}
              onBack={() => { setMode(MODE.SIGN_IN); setEmail(""); setPassword("") }}
              backLabel={t("auth.back_to_signin")}
            />
          )}

          {mode === MODE.PASSWORD_RESET_SENT && (
            <SuccessCard
              icon={KeyRound}
              tone="brand"
              title={t("auth.check_email")}
              body={<>
                {t("auth.reset_sent")}{" "}
                <strong className="text-slate-900 dark:text-white">{email}</strong>
                . {t("auth.click_to_reset")}
              </>}
              onBack={() => { setMode(MODE.SIGN_IN); setEmail("") }}
              backLabel={t("auth.back_to_signin")}
            />
          )}

          {mode === MODE.RESET_PASSWORD && (
            <Card className="overflow-hidden">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={onSubmit} className="space-y-5">
                  <Input
                    label={t("auth.new_password")}
                    icon={Lock}
                    type="password"
                    placeholder={t("auth.new_password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Input
                    label={t("auth.confirm_new_password")}
                    icon={Lock}
                    type="password"
                    placeholder={t("auth.confirm_new_password")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Button type="submit" variant="accent" disabled={loading} className="w-full" size="lg">
                    {loading ? t("loading") : (<>{t("auth.update_password")}<CheckCircle size={18} /></>)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {mode === MODE.FORGOT_PASSWORD && (
            <Card>
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={onSubmit} className="space-y-5">
                  <Input
                    label={t("auth.email")}
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <Button type="submit" variant="accent" disabled={loading} className="w-full" size="lg">
                    {loading ? t("loading") : (<>{t("auth.send_reset_link")}<ArrowRight size={18} /></>)}
                  </Button>
                </form>
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setMode(MODE.SIGN_IN)}
                    className="text-sm text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium inline-flex items-center gap-1"
                  >
                    <ArrowLeft size={16} />
                    {t("auth.back_to_signin")}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {(mode === MODE.SIGN_IN || mode === MODE.SIGN_UP) && (
            <Card>
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={onSubmit} className="space-y-4">
                  {mode === MODE.SIGN_UP && (
                    <Input
                      label={t("auth.store_name")}
                      icon={Store}
                      type="text"
                      placeholder="My Shop"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                    />
                  )}

                  {mode === MODE.SIGN_UP && (
                    <Input
                      label={t("auth.phone")}
                      icon={Phone}
                      type="tel"
                      inputMode="tel"
                      placeholder="082 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      hint={t("auth.phone_hint")}
                    />
                  )}

                  <Input
                    label={t("auth.email")}
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        {t("auth.password")}
                      </label>
                      {mode === MODE.SIGN_IN && (
                        <button
                          type="button"
                          onClick={() => setMode(MODE.FORGOT_PASSWORD)}
                          className="text-xs text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium"
                        >
                          {t("auth.forgot_password")}
                        </button>
                      )}
                    </div>
                    <Input
                      icon={Lock}
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === MODE.SIGN_UP ? "new-password" : "current-password"}
                    />
                  </div>

                  {mode === MODE.SIGN_UP && (
                    <Input
                      label={t("auth.confirm_password")}
                      icon={Lock}
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  )}

                  {mode === MODE.SIGN_UP && (
                    <div className="space-y-2.5 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <ConsentCheckbox id="terms" checked={termsAccepted} onChange={setTermsAccepted} required>
                        I agree to the{" "}
                        <a href="/terms" target="_blank" rel="noreferrer" className="text-accent-600 dark:text-accent-400 hover:underline">Terms of Service</a>
                      </ConsentCheckbox>
                      <ConsentCheckbox id="privacy" checked={privacyAccepted} onChange={setPrivacyAccepted} required>
                        I have read and accept the{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer" className="text-accent-600 dark:text-accent-400 hover:underline">Privacy Policy</a>
                      </ConsentCheckbox>
                      <ConsentCheckbox id="marketing" checked={marketingOptIn} onChange={setMarketingOptIn}>
                        Send me product updates and tips (optional)
                      </ConsentCheckbox>
                    </div>
                  )}

                  <Button type="submit" variant="accent" disabled={loading} className="w-full" size="lg">
                    {loading ? t("loading") : (<>
                      {mode === MODE.SIGN_UP ? t("auth.sign_up") : t("auth.sign_in")}
                      <ArrowRight size={18} />
                    </>)}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === MODE.SIGN_UP ? MODE.SIGN_IN : MODE.SIGN_UP)
                      setConfirmPassword("")
                      setStoreName("")
                      setPhone("")
                    }}
                    className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    {mode === MODE.SIGN_UP ? t("auth.have_account") : t("auth.no_account")}{" "}
                    <span className="text-accent-600 dark:text-accent-400 font-medium">
                      {mode === MODE.SIGN_UP ? t("auth.sign_in") : t("auth.sign_up")}
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleClearSession}
              className="text-xs text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {t("auth.session_trouble")}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
            {t("auth.powered_by")}
          </p>
        </div>
      </main>
    </div>
  )
}

// Helpers -----------------------------------------------------------------

function subtitleFor(mode, t) {
  if (mode === MODE.SIGN_UP) return t("auth.create_account")
  if (mode === MODE.SIGN_IN) return t("auth.welcome_back")
  if (mode === MODE.FORGOT_PASSWORD) return "Reset your password"
  if (mode === MODE.RESET_PASSWORD) return "Choose a new password"
  return null
}

function AuthHeader({ subtitle }) {
  return (
    <div className="text-center mb-8">
      <div className="flex justify-center mb-5">
        <Logo size={48} showText={false} />
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
        <span className="text-accent-600 dark:text-accent-400">Kash</span>
        <span className="text-amber-500 dark:text-amber-400">Point</span>
      </h1>
      <p className="text-[11px] text-slate-500 dark:text-slate-500 tracking-[0.18em] uppercase mt-1.5">
        Point of Sale
      </p>
      {subtitle && (
        <p className="text-slate-600 dark:text-slate-400 mt-4 text-sm">{subtitle}</p>
      )}
    </div>
  )
}

function ThemeToggleButton({ theme, toggleTheme }) {
  return (
    <div className="absolute top-4 right-4 z-50 safe-top">
      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur ring-1 ring-slate-200 dark:ring-slate-800 text-slate-600 dark:text-slate-300 transition-colors hover:bg-white dark:hover:bg-slate-900 touch-target flex items-center justify-center"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  )
}

function ConsentCheckbox({ id, checked, onChange, required, children }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer group">
      <span className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className={`block w-4 h-4 rounded border transition-all
          border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
          peer-checked:bg-accent-600 peer-checked:border-accent-600
          group-hover:border-slate-400 dark:group-hover:border-slate-500
        `} />
        <CheckCircle size={12} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
      </span>
      <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
    </label>
  )
}

function SuccessCard({ icon: Icon, tone, title, body, onBack, backLabel }) {
  const toneStyles = tone === "accent"
    ? "bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300"
    : "bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-300"
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-slate-200/60 dark:ring-slate-800 ${toneStyles}`}>
          <Icon className="w-8 h-8" />
        </div>
        <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
          {title}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-relaxed">
          {body}
        </p>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft size={16} />
          {backLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
