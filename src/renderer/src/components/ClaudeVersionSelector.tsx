import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { api, type ClaudeInstallation } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CheckCircle, Settings } from 'lucide-react'

interface ClaudeVersionSelectorProps {
  /**
   * Currently selected installation path
   */
  selectedPath?: string | null
  /**
   * Callback when an installation is selected
   */
  onSelect: (installation: ClaudeInstallation) => void
  /**
   * Optional className for styling
   */
  className?: string
  /**
   * Whether to show the save button
   */
  showSaveButton?: boolean
  /**
   * Callback when save is clicked
   */
  onSave?: () => void
  /**
   * Whether save is in progress
   */
  isSaving?: boolean
  /**
   * Headless mode - render without Card wrapper
   */
  headless?: boolean
  /**
   * Custom title when in headless mode
   */
  title?: string
  /**
   * Custom description when in headless mode
   */
  description?: string
}

/**
 * ClaudeVersionSelector component for selecting Claude Code installations
 * Supports bundled sidecar, system installations, and user preferences
 *
 * @example
 * <ClaudeVersionSelector
 *   selectedPath={currentPath}
 *   onSelect={(installation) => setSelectedInstallation(installation)}
 * />
 */
export const ClaudeVersionSelector: React.FC<ClaudeVersionSelectorProps> = ({
  selectedPath,
  onSelect,
  className,
  showSaveButton = false,
  onSave,
  isSaving = false,
  headless = false,
  title,
  description
}) => {
  const { t } = useTranslation('settings')
  const [installations, setInstallations] = useState<ClaudeInstallation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInstallation, setSelectedInstallation] = useState<ClaudeInstallation | null>(null)

  useEffect(() => {
    loadInstallations()
  }, [])

  useEffect(() => {
    // Update selected installation when selectedPath changes
    if (selectedPath && installations.length > 0) {
      const found = installations.find((i) => i.path === selectedPath)
      if (found) {
        setSelectedInstallation(found)
      }
    }
  }, [selectedPath, installations])

  const loadInstallations = async () => {
    try {
      setLoading(true)
      setError(null)
      const foundInstallations = await api.listClaudeInstallations()

      // Deduplicate installations by resolved path
      const uniqueInstallations = foundInstallations.reduce((acc: ClaudeInstallation[], curr) => {
        const currResolvedPath = curr.resolvedPath || curr.path
        const exists = acc.find((item) => {
          const itemResolvedPath = item.resolvedPath || item.path
          return itemResolvedPath === currResolvedPath
        })
        if (!exists) {
          acc.push(curr)
        }
        return acc
      }, [])

      setInstallations(uniqueInstallations)

      // If we have a selected path, find and select it
      if (selectedPath) {
        const found = uniqueInstallations.find((i) => i.path === selectedPath)
        if (found) {
          setSelectedInstallation(found)
        }
      } else if (uniqueInstallations.length > 0) {
        // Auto-select the first (best) installation
        setSelectedInstallation(uniqueInstallations[0])
        onSelect(uniqueInstallations[0])
      } else {
        // No installations found - provide helpful error message
        setError(t('general.claudeInstallation.errors.notFound'))
      }
    } catch (err) {
      console.error('Failed to load Claude installations:', err)
      setError(
        err instanceof Error ? err.message : t('general.claudeInstallation.errors.loadFailed')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleInstallationChange = (installationPath: string) => {
    const installation = installations.find((i) => i.path === installationPath)
    if (installation) {
      setSelectedInstallation(installation)
      onSelect(installation)
    }
  }


  const getInstallationTypeColor = (installation: ClaudeInstallation) => {
    switch (installation.installation_type) {
      case 'Bundled':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'System':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'Custom':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const generateFriendlyName = (installation: ClaudeInstallation): string => {
    const basePrefix = 'Claude Code'
    const version = installation.version ? ` - ${installation.version}` : ''

    // For bundled installations
    if (installation.installation_type === 'Bundled') {
      return `${basePrefix} (${t('general.claudeInstallation.installationTypes.bundled')})${version}`
    }

    // For system installations, parse the source to create friendly names
    if (installation.source) {
      const source = installation.source.toLowerCase()

      // Handle fnm installations
      if (source.includes('fnm')) {
        if (installation.nodeVersion) {
          return `${basePrefix} (fnm - Node v${installation.nodeVersion})${version}`
        }
        // Fallback to existing source if no nodeVersion
        return `${basePrefix} (${installation.source})${version}`
      }

      // Handle nvm installations
      if (source.includes('nvm')) {
        if (installation.nodeVersion) {
          return `${basePrefix} (nvm - Node v${installation.nodeVersion})${version}`
        }
        return `${basePrefix} (${installation.source})${version}`
      }

      // Handle other known sources
      if (source.includes('homebrew')) {
        return `${basePrefix} (Homebrew)${version}`
      }

      if (source.includes('system') || source.includes('shell path')) {
        return `${basePrefix} (${t('general.claudeInstallation.installationTypes.system')})${version}`
      }

      // For any other source, use the original source but capitalize it
      const capitalizedSource =
        installation.source.charAt(0).toUpperCase() + installation.source.slice(1)
      return `${basePrefix} (${capitalizedSource})${version}`
    }

    // For custom installations or fallback
    return `${basePrefix} (${t('general.claudeInstallation.installationTypes.custom')})${version}`
  }

  if (loading) {
    const loadingContent = (
      <div className="space-y-4">
        {!headless && (
          <div>
            <h3 className="text-base font-semibold">
              {title || t('general.claudeInstallation.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {description || t('general.claudeInstallation.loadingMessage')}
            </p>
          </div>
        )}
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </div>
    )

    if (headless) {
      return <div className={className}>{loadingContent}</div>
    }

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t('general.claudeInstallation.title')}</CardTitle>
          <CardDescription>{t('general.claudeInstallation.loadingMessage')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    const errorContent = (
      <div className="space-y-4">
        {!headless && (
          <div>
            <h3 className="text-base font-semibold">
              {title || t('general.claudeInstallation.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {description || t('general.claudeInstallation.errors.loadFailed')}
            </p>
          </div>
        )}
        <div className="space-y-3">
          <div className="text-sm text-destructive">{error}</div>

          {error.includes('No Claude Code installations found') && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">To install Claude Code:</p>
              <ul className="list-disc list-inside space-y-1 text-xs ml-4">
                <li>
                  Visit{' '}
                  <a
                    href="https://docs.anthropic.com/claude/reference/claude-cli"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Claude Code documentation
                  </a>
                </li>
                <li>
                  Install via npm:{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </li>
                {process.platform === 'win32' && (
                  <li>{t('general.claudeInstallation.installGuide.windowsNote')}</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={loadInstallations} variant="outline" size="sm">
              {t('general.claudeInstallation.actions.retry')}
            </Button>
            {error.includes('No Claude Code installations found') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open('https://docs.anthropic.com/claude/reference/claude-cli', '_blank')
                }
              >
                {t('general.claudeInstallation.actions.viewGuide')}
              </Button>
            )}
          </div>
        </div>
      </div>
    )

    if (headless) {
      return <div className={className}>{errorContent}</div>
    }

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claude Code Installation</CardTitle>
          <CardDescription>Error loading installations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-destructive">{error}</div>

            {error.includes('No Claude Code installations found') && (
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">To install Claude Code:</p>
                <ul className="list-disc list-inside space-y-1 text-xs ml-4">
                  <li>
                    Visit{' '}
                    <a
                      href="https://docs.anthropic.com/claude/reference/claude-cli"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Claude Code documentation
                    </a>
                  </li>
                  <li>
                    Install via npm:{' '}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      npm install -g @anthropic-ai/claude-code
                    </code>
                  </li>
                  {process.platform === 'win32' && (
                    <li>On Windows, install within WSL for best compatibility</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={loadInstallations} variant="outline" size="sm">
                {t('general.claudeInstallation.actions.retry')}
              </Button>
              {error.includes('No Claude Code installations found') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open('https://docs.anthropic.com/claude/reference/claude-cli', '_blank')
                  }
                >
                  {t('general.claudeInstallation.actions.viewGuide')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const bundledInstallations = installations.filter((i) => i.installation_type === 'Bundled')
  const systemInstallations = installations.filter((i) => i.installation_type === 'System')
  const customInstallations = installations.filter((i) => i.installation_type === 'Custom')

  // If no installations and no error, show empty state
  if (!loading && !error && installations.length === 0) {
    const emptyContent = (
      <div className="space-y-4">
        {!headless && (
          <div>
            <h3 className="text-base font-semibold">{title || 'Claude Code Installation'}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {description || 'No installations found'}
            </p>
          </div>
        )}
        <div className="text-center py-8 space-y-4">
          <div className="text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">{t('general.claudeInstallation.empty.title')}</p>
            <p className="text-xs">{t('general.claudeInstallation.empty.description')}</p>
          </div>
          <div className="space-y-2">
            <Button onClick={loadInstallations} variant="outline" size="sm">
              {t('general.claudeInstallation.actions.retry')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open('https://docs.anthropic.com/claude/reference/claude-cli', '_blank')
              }
            >
              {t('general.claudeInstallation.actions.viewGuide')}
            </Button>
          </div>
        </div>
      </div>
    )

    if (headless) {
      return <div className={className}>{emptyContent}</div>
    }

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{t('general.claudeInstallation.title')}</CardTitle>
          <CardDescription>{t('general.claudeInstallation.empty.title')}</CardDescription>
        </CardHeader>
        <CardContent>{emptyContent}</CardContent>
      </Card>
    )
  }

  // Main content that can be rendered with or without Card wrapper
  const mainContent = (
    <div className="space-y-6">
      {/* Available Installations */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t('general.claudeInstallation.availableInstallations')}
        </Label>

        <Select value={selectedInstallation?.path || ''} onValueChange={handleInstallationChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('general.claudeInstallation.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {bundledInstallations.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t('general.claudeInstallation.installationTypes.bundled')}
                </div>
                {bundledInstallations.map((installation) => (
                  <SelectItem key={installation.path} value={installation.path}>
                    Claude Code ({t('general.claudeInstallation.installationTypes.bundled')}) -{' '}
                    {installation.version || t('general.claudeInstallation.unknownVersion')}
                  </SelectItem>
                ))}
              </>
            )}

            {systemInstallations.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t('general.claudeInstallation.systemInstallations')}
                </div>
                {systemInstallations.map((installation) => (
                  <SelectItem key={installation.path} value={installation.path}>
                    {generateFriendlyName(installation)}
                  </SelectItem>
                ))}
              </>
            )}

            {customInstallations.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t('general.claudeInstallation.customInstallations')}
                </div>
                {customInstallations.map((installation) => (
                  <SelectItem key={installation.path} value={installation.path}>
                    {generateFriendlyName(installation)}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Installation Details */}
      {selectedInstallation && (
        <div className="p-3 bg-muted rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t('general.claudeInstallation.selectedInstallation')}
            </span>
            <Badge className={cn('text-xs', getInstallationTypeColor(selectedInstallation))}>
              {selectedInstallation.installation_type}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <strong>{t('general.claudeInstallation.details.path')}:</strong>{' '}
              <code className="text-xs bg-background px-1 py-0.5 rounded">
                {selectedInstallation.path}
              </code>
            </div>
            {selectedInstallation.resolvedPath &&
              selectedInstallation.resolvedPath !== selectedInstallation.path && (
                <div>
                  <strong>{t('general.claudeInstallation.details.actualLocation')}:</strong>{' '}
                  <code className="text-xs bg-background px-1 py-0.5 rounded break-all">
                    {selectedInstallation.resolvedPath}
                  </code>
                </div>
              )}
            <div>
              <strong>{t('general.claudeInstallation.details.source')}:</strong>{' '}
              {selectedInstallation.source}
            </div>
            {selectedInstallation.version && (
              <div>
                <strong>{t('general.claudeInstallation.details.version')}:</strong>{' '}
                {selectedInstallation.version}
              </div>
            )}
            {selectedInstallation.nodeVersion && (
              <div>
                <strong>{t('general.claudeInstallation.details.nodeVersion')}:</strong> v
                {selectedInstallation.nodeVersion}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      {showSaveButton && (
        <Button onClick={onSave} disabled={isSaving || !selectedInstallation} className="w-full">
          {isSaving
            ? t('general.claudeInstallation.actions.saving')
            : t('general.claudeInstallation.actions.save')}
        </Button>
      )}
    </div>
  )

  // Render based on mode
  if (headless) {
    return (
      <div className={className}>
        {(title || description) && (
          <div className="mb-6">
            {title && <h3 className="text-base font-semibold mb-2">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        {mainContent}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {t('general.claudeInstallation.title')}
        </CardTitle>
        <CardDescription>{t('general.claudeInstallation.description')}</CardDescription>
      </CardHeader>
      <CardContent>{mainContent}</CardContent>
    </Card>
  )
}
