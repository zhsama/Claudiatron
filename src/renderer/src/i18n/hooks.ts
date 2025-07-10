import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import { LanguageCode, SUPPORTED_LANGUAGES } from './types'

/**
 * Hook for managing language switching
 */
export const useLanguage = () => {
  const { i18n } = useTranslation()

  const changeLanguage = useCallback(
    (language: LanguageCode) => {
      i18n.changeLanguage(language)
    },
    [i18n]
  )

  const currentLanguage = i18n.language as LanguageCode
  const languages = SUPPORTED_LANGUAGES

  return {
    currentLanguage,
    languages,
    changeLanguage,
    isLanguageChanging: i18n.isInitialized === false
  }
}

/**
 * Hook for typed translations with namespace support
 */
export const useTypedTranslation = <T extends keyof import('./types').TranslationResources>(
  namespace?: T
) => {
  return useTranslation(namespace)
}

/**
 * Hook for date formatting with current locale
 */
export const useLocalizedDate = () => {
  const { i18n } = useTranslation()

  const formatDate = useCallback(
    (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'

      return new Intl.DateTimeFormat(locale, options).format(dateObj)
    },
    [i18n.language]
  )

  const formatRelativeTime = useCallback(
    (date: Date | string) => {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      const now = new Date()
      const diffInMs = now.getTime() - dateObj.getTime()
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      const diffInDays = Math.floor(diffInHours / 24)

      if (diffInDays > 0) {
        return i18n.language === 'zh'
          ? `${diffInDays} 天前`
          : `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
      } else if (diffInHours > 0) {
        return i18n.language === 'zh'
          ? `${diffInHours} 小时前`
          : `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
      } else {
        return i18n.language === 'zh' ? '刚刚' : 'Just now'
      }
    },
    [i18n.language]
  )

  return {
    formatDate,
    formatRelativeTime,
    locale: i18n.language
  }
}
