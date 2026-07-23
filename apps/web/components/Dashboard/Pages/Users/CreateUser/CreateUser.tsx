'use client'
import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import { getErrorMessage } from '@services/utils/ts/errorMessage'
import { createOrgUser } from '@services/organizations/users'
import { queryKeys } from '@/lib/query/keys'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { UserPlus, Copy, Check, Mail, KeyRound, Loader2, RotateCcw } from 'lucide-react'

type CreateResult = {
  user: { email?: string; username?: string } & Record<string, unknown>
  username: string
  password: string
  email_sent: boolean
}

function CreateUser() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateResult | null>(null)
  const [copied, setCopied] = useState('')

  const reset = () => {
    setName('')
    setUsername('')
    setEmail('')
    setError('')
    setResult(null)
    setCopied('')
  }

  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(field)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  const submit = async () => {
    setError('')
    if (!name.trim() || !email.trim()) {
      setError(t('dashboard.users.create_user.errors.missing_fields'))
      return
    }
    if (!username.trim()) {
      setError(t('dashboard.users.create_user.errors.missing_username', { defaultValue: 'Username is required' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('dashboard.users.create_user.errors.invalid_email'))
      return
    }

    setSubmitting(true)
    const toastId = toast.loading(t('dashboard.users.create_user.toasts.creating'))
    try {
      const res = await createOrgUser(org.id, name.trim(), username.trim(), email.trim(), access_token)
      if (!res.success) {
        const msg = getErrorMessage(res.data?.detail, t('dashboard.users.create_user.errors.create_failed'))
        setError(msg)
        toast.error(msg, { id: toastId })
        return
      }
      const data = res.data as CreateResult
      setResult(data)
      queryClient.invalidateQueries({ queryKey: queryKeys.org.users(org.id) })
      if (data.email_sent) {
        toast.success(t('dashboard.users.create_user.toasts.success'), { id: toastId })
      } else {
        toast.error(t('dashboard.users.create_user.toasts.email_not_sent'), { id: toastId })
      }
    } catch (err) {
      const msg = getErrorMessage((err as any)?.data?.detail, t('dashboard.users.create_user.errors.create_failed'))
      setError(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Toast />
      <div className="h-6"></div>

      <div className="mx-4 sm:mx-10 bg-white rounded-xl nice-shadow">
        {!result ? (
          <>
            <div className="flex flex-wrap gap-3 items-start justify-between px-4 sm:px-6 py-5 border-b border-gray-100">
              <div className="flex-1">
                <h1 className="font-bold text-xl text-gray-800">{t('dashboard.users.create_user.title')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.users.create_user.subtitle')}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('dashboard.users.create_user.name_label')}
                </label>
                <input
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder={t('dashboard.users.create_user.name_placeholder')}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 bg-gray-50/50 placeholder:italic placeholder:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('dashboard.users.create_user.username_label', { defaultValue: 'Username' })}
                </label>
                <input
                  value={username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                  placeholder={t('dashboard.users.create_user.username_placeholder', { defaultValue: 'username' })}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 bg-gray-50/50 placeholder:italic placeholder:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('dashboard.users.create_user.email_label')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder={t('dashboard.users.create_user.email_placeholder')}
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 bg-gray-50/50 placeholder:italic placeholder:text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-sm text-white transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>{submitting ? t('dashboard.users.create_user.submitting') : t('dashboard.users.create_user.submit')}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-start justify-between px-4 sm:px-6 py-5 border-b border-gray-100">
              <div className="flex-1">
                <h1 className="font-bold text-xl text-gray-800">{t('dashboard.users.create_user.result.title')}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t('dashboard.users.create_user.result.intro', { email: result.user?.email || email })}
                </p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-3">
              <ResultRow icon={<Mail className="w-4 h-4 text-gray-400" />} label={t('dashboard.users.create_user.result.email_label')} value={result.user?.email || email} field="email" copied={copied} onCopy={copy} />
              <ResultRow icon={<UserPlus className="w-4 h-4 text-gray-400" />} label={t('dashboard.users.create_user.result.username_label')} value={result.username} field="username" copied={copied} onCopy={copy} />
              <ResultRow icon={<KeyRound className="w-4 h-4 text-gray-400" />} label={t('dashboard.users.create_user.result.password_label')} value={result.password} field="password" copied={copied} onCopy={copy} mono />

              <div className="flex justify-end pt-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-sm text-gray-700 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t('dashboard.users.create_user.result.create_another')}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function ResultRow({
  icon,
  label,
  value,
  field,
  copied,
  onCopy,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  field: string
  copied: string
  onCopy: (field: string, value: string) => void
  mono?: boolean
}) {
  const { t } = useTranslation()
  const isCopied = copied === field
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 bg-gray-50/50">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
          <div className={`text-sm text-gray-800 font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
        </div>
      </div>
      <button
        onClick={() => onCopy(field, value)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-gray-600 transition-all flex-shrink-0"
      >
        {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{isCopied ? t('dashboard.users.create_user.result.copied') : t('dashboard.users.create_user.result.copy')}</span>
      </button>
    </div>
  )
}

export default CreateUser
