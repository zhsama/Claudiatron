import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { api, type UsageStats, type ProjectUsage } from '@/lib/api'
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Filter,
  Loader2,
  DollarSign,
  Activity,
  FileText,
  Briefcase
} from 'lucide-react'
import { cn, formatProjectPath, getProjectName } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface UsageDashboardProps {
  /**
   * Callback when back button is clicked
   */
  onBack: () => void
}

/**
 * UsageDashboard component - Displays Claude API usage statistics and costs
 *
 * @example
 * <UsageDashboard onBack={() => setView('welcome')} />
 */
export const UsageDashboard: React.FC<UsageDashboardProps> = ({ onBack }) => {
  const { t } = useTranslation('usageDashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [sessionStats, setSessionStats] = useState<ProjectUsage[] | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '7d' | '30d'>('all')
  const [activeTab, setActiveTab] = useState('overview')

  const loadUsageStats = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      let statsData: UsageStats
      let sessionData: ProjectUsage[]

      if (selectedDateRange === 'all') {
        statsData = await api.getUsageStats()
        sessionData = await api.getSessionStats(undefined, undefined, 'desc')
      } else {
        const endDate = new Date()
        const startDate = new Date()
        const days = selectedDateRange === '7d' ? 7 : 30
        startDate.setDate(startDate.getDate() - days)

        // Format dates as YYYY-MM-DD
        const formatDateForApi = (date: Date): string => {
          return date.toISOString().split('T')[0]
        }

        // Use the same getUsageStats API with date parameters
        statsData = await api.getUsageStats({
          startDate: formatDateForApi(startDate),
          endDate: formatDateForApi(endDate)
        })
        sessionData = await api.getSessionStats(
          formatDateForApi(startDate),
          formatDateForApi(endDate),
          'desc'
        )
      }

      setStats(statsData)
      setSessionStats(sessionData)
    } catch (err) {
      console.error('Failed to load usage stats:', err)
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }, [selectedDateRange, t])

  useEffect(() => {
    loadUsageStats()
  }, [loadUsageStats])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount)
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatTokens = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`
    }
    return formatNumber(num)
  }

  const getModelDisplayName = (model: string): string => {
    const modelMap: Record<string, string> = {
      'claude-4-opus': 'Opus 4',
      'claude-4-sonnet': 'Sonnet 4',
      'claude-3.5-sonnet': 'Sonnet 3.5',
      'claude-3-opus': 'Opus 3'
    }
    return modelMap[model] || model
  }

  const getModelColor = (model: string): string => {
    if (model.includes('opus')) return 'text-purple-500'
    if (model.includes('sonnet')) return 'text-blue-500'
    return 'text-gray-500'
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t('title')}</h1>
              <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {(['all', '30d', '7d'] as const).map((range) => (
                <Button
                  key={range}
                  variant={selectedDateRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedDateRange(range)}
                  className="text-xs"
                >
                  {range === 'all'
                    ? t('dateRange.allTime')
                    : range === '7d'
                      ? t('dateRange.last7Days')
                      : t('dateRange.last30Days')}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button onClick={loadUsageStats} size="sm">
                {t('tryAgain')}
              </Button>
            </div>
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Total Cost Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('summary.totalCost')}</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(stats.total_cost)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Sessions Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('summary.totalSessions')}</p>
                    <p className="text-2xl font-bold mt-1">{formatNumber(stats.total_sessions)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatNumber(stats.total_requests)} {t('summary.apiRequests')}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Total Tokens Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('summary.totalTokens')}</p>
                    <p className="text-2xl font-bold mt-1">{formatTokens(stats.total_tokens)}</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>

              {/* Average Cost per Request Card */}
              <Card className="p-4 shimmer-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t('summary.avgCostPerRequest')}
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {formatCurrency(
                        stats.total_requests > 0 ? stats.total_cost / stats.total_requests : 0
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('summary.perApiRequest')}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/20 rotating-symbol" />
                </div>
              </Card>
            </div>

            {/* Tabs for different views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
                <TabsTrigger value="models">{t('tabs.models')}</TabsTrigger>
                <TabsTrigger value="projects">{t('tabs.projects')}</TabsTrigger>
                <TabsTrigger value="sessions">{t('tabs.sessions')}</TabsTrigger>
                <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t('sections.tokenBreakdown')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('tokens.input')}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_input_tokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('tokens.output')}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_output_tokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('tokens.cacheWrite')}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_cache_creation_tokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('tokens.cacheRead')}</p>
                      <p className="text-lg font-semibold">
                        {formatTokens(stats.total_cache_read_tokens)}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">{t('sections.mostUsedModels')}</h3>
                    <div className="space-y-3">
                      {stats.by_model.slice(0, 3).map((model) => (
                        <div key={model.model} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', getModelColor(model.model))}
                            >
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {model.session_count} {t('details.sessions')} · {model.request_count}{' '}
                              {t('summary.apiRequests')}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-sm font-semibold mb-4">{t('sections.topProjects')}</h3>
                    <div className="space-y-3">
                      {stats.by_project.slice(0, 3).map((project) => (
                        <div
                          key={project.project_path}
                          className="flex items-center justify-between"
                        >
                          <div className="flex flex-col min-w-0">
                            <span
                              className="text-sm font-medium truncate"
                              title={project.project_path}
                            >
                              {getProjectName(project.project_path)}
                            </span>
                            <span
                              className="text-xs text-muted-foreground truncate"
                              title={project.project_path}
                            >
                              {formatProjectPath(project.project_path)}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1">
                              {project.session_count} {t('details.sessions')} ·{' '}
                              {project.request_count} {t('summary.apiRequests')}
                            </span>
                          </div>
                          <span className="text-sm font-medium flex-shrink-0 ml-2">
                            {formatCurrency(project.total_cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Models Tab */}
              <TabsContent value="models">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t('sections.usageByModel')}</h3>
                  <div className="space-y-4">
                    {stats.by_model.map((model) => (
                      <div key={model.model} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Badge
                              variant="outline"
                              className={cn('text-xs', getModelColor(model.model))}
                            >
                              {getModelDisplayName(model.model)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {model.session_count} {t('details.sessions')} · {model.request_count}{' '}
                              {t('summary.apiRequests')}
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(model.total_cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">
                              {t('tokens.inputShort')}:{' '}
                            </span>
                            <span className="font-medium">{formatTokens(model.input_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t('tokens.outputShort')}:{' '}
                            </span>
                            <span className="font-medium">{formatTokens(model.output_tokens)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t('tokens.cacheWriteShort')}:{' '}
                            </span>
                            <span className="font-medium">
                              {formatTokens(model.cache_creation_tokens)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t('tokens.cacheReadShort')}:{' '}
                            </span>
                            <span className="font-medium">
                              {formatTokens(model.cache_read_tokens)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t('sections.usageByProject')}</h3>
                  <div className="space-y-3">
                    {stats.by_project.map((project) => (
                      <div
                        key={project.project_path}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex flex-col min-w-0">
                          <span
                            className="text-sm font-medium truncate"
                            title={project.project_path}
                          >
                            {getProjectName(project.project_path)}
                          </span>
                          <span
                            className="text-xs text-muted-foreground truncate"
                            title={project.project_path}
                          >
                            {formatProjectPath(project.project_path)}
                          </span>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {project.session_count} {t('details.sessions')} ·{' '}
                              {project.request_count} {t('summary.apiRequests')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTokens(project.total_tokens)} {t('tokens.tokens')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-sm font-semibold">
                            {formatCurrency(project.total_cost)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(project.total_cost / project.session_count)}
                            {t('details.perSession')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Sessions Tab */}
              <TabsContent value="sessions">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">{t('sections.usageBySession')}</h3>
                  <div className="space-y-3">
                    {!sessionStats || sessionStats.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>{t('noData.noSessions')}</p>
                      </div>
                    ) : (
                      (Array.isArray(sessionStats) ? sessionStats : []).map((session) => (
                        <div
                          key={`${session.project_path}-${session.project_name}`}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <div className="flex flex-col min-w-0">
                            <span
                              className="text-sm font-medium truncate"
                              title={session.project_path}
                            >
                              {session.project_name || getProjectName(session.project_path)}
                            </span>
                            <div className="flex items-center space-x-2">
                              <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span
                                className="text-xs text-muted-foreground truncate"
                                title={session.project_path}
                              >
                                {formatProjectPath(session.project_path)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-sm font-semibold">
                              {formatCurrency(session.total_cost)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.last_used).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-6 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{t('sections.dailyUsage')}</span>
                  </h3>
                  {stats.by_date.length > 0 ? (
                    (() => {
                      const maxCost = Math.max(...stats.by_date.map((d) => d.total_cost), 0)
                      const halfMaxCost = maxCost / 2

                      return (
                        <div className="relative pl-8 pr-4">
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(maxCost)}</span>
                            <span>{formatCurrency(halfMaxCost)}</span>
                            <span>{formatCurrency(0)}</span>
                          </div>

                          {/* Chart container */}
                          <div className="flex items-end space-x-2 h-64 border-l border-b border-border pl-4">
                            {stats.by_date
                              .slice()
                              .reverse()
                              .map((day) => {
                                const heightPercent =
                                  maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0
                                const date = new Date(day.date.replace(/-/g, '/'))
                                const formattedDate = date.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })

                                return (
                                  <div
                                    key={day.date}
                                    className="flex-1 h-full flex flex-col items-center justify-end group relative"
                                  >
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                      <div className="bg-background border border-border rounded-lg shadow-lg p-3 whitespace-nowrap">
                                        <p className="text-sm font-semibold">{formattedDate}</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {t('details.cost')}: {formatCurrency(day.total_cost)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatTokens(day.total_tokens)} {t('tokens.tokens')}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {day.models_used.length}{' '}
                                          {day.models_used.length !== 1
                                            ? t('details.models')
                                            : t('details.model')}
                                        </p>
                                      </div>
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                        <div className="border-4 border-transparent border-t-border"></div>
                                      </div>
                                    </div>

                                    {/* Bar */}
                                    <div
                                      className="w-full bg-[#d97757] hover:opacity-80 transition-opacity rounded-t cursor-pointer"
                                      style={{ height: `${heightPercent}%` }}
                                    />

                                    {/* X-axis label – absolutely positioned below the bar so it doesn't affect bar height */}
                                    <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-xs text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap pointer-events-none">
                                      {date.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                          </div>

                          {/* X-axis label */}
                          <div className="mt-8 text-center text-xs text-muted-foreground">
                            {t('sections.dailyUsageOverTime')}
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {t('noData.noUsageData')}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
