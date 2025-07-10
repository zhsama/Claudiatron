// Export i18n configuration and provider
export { default as i18n } from './config'
export { I18nProvider } from './I18nProvider'

// Export hooks
export { useLanguage, useTypedTranslation, useLocalizedDate } from './hooks'

// Export types
export type {
  TranslationResources,
  LanguageCode,
  LanguageOption,
  CommonTranslations,
  UITranslations,
  SettingsTranslations,
  ErrorTranslations,
  NFOTranslations,
  SuccessTranslations,
  DialogTranslations
} from './types'

export { SUPPORTED_LANGUAGES } from './types'
