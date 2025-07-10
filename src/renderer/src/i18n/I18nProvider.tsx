import React, { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './config'

interface I18nProviderProps {
  children: React.ReactNode
}

/**
 * I18n Provider component that wraps the app with internationalization support
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
    </I18nextProvider>
  )
}

export default I18nProvider
