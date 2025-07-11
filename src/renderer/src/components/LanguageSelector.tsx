import React from 'react'
import { useLanguage } from '@/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface LanguageSelectorProps {
  className?: string
}

/**
 * Language selector component for changing the application language
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
  const { currentLanguage, languages, changeLanguage } = useLanguage()

  const handleLanguageChange = (value: string) => {
    changeLanguage(value as 'en' | 'zh')
  }

  return (
    <div className={className || ''}>
      <Select value={currentLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger id="language-select">
          <SelectValue placeholder={currentLanguage === 'zh' ? '选择语言' : 'Select language'} />
        </SelectTrigger>
        <SelectContent align="end">
          {languages.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              {language.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default LanguageSelector
