import React from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { WindowControls } from './WindowControls'

interface TitleBarProps {
  /**
   * Optional className for styling
   */
  className?: string
}

/**
 * Custom title bar component that provides window dragging and displays app name
 * Designed to work consistently across platforms while solving macOS window control overlap
 */
export const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { t } = useTranslation('ui')

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        // Same styling as Topbar for consistency, with subtle bottom border
        'flex items-center justify-center h-8 border-b border-border/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'app-region-drag select-none', // Enable window dragging
        className
      )}
    >
      {/* App Name */}
      <div className="text-sm font-medium text-foreground">{t('titleBar.appName')}</div>

      {/* Window controls for Windows/Linux */}
      {!navigator.platform.includes('Mac') && (
        <WindowControls className="absolute right-0 top-0 h-full" />
      )}
    </motion.div>
  )
}
