/**
 * Claude 检测状态显示组件
 */

import React, { useState, useEffect } from 'react'
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Info,
  ExternalLink,
  Terminal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'

interface ClaudeDetectionResult {
  success: boolean
  platform: string
  executionMethod: 'native' | 'wsl'
  claudePath?: string
  version?: string
  wslDistro?: string
  detectionMethod?: string
  error?: {
    type: string
    message: string
  }
  suggestions?: string[]
}

interface DetectionStats {
  isDetected: boolean
  claudePath?: string
  version?: string
  platform: string
  executionMethod: string
  lastDetectionTime?: number
  cacheHit?: boolean
}

interface ClaudeDetectionStatusProps {
  className?: string
}

export const ClaudeDetectionStatus: React.FC<ClaudeDetectionStatusProps> = ({ className }) => {
  const [detectionResult, setDetectionResult] = useState<ClaudeDetectionResult | null>(null)
  const [stats, setStats] = useState<DetectionStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRedetecting, setIsRedetecting] = useState(false)

  useEffect(() => {
    loadDetectionStatus()
  }, [])

  const loadDetectionStatus = async () => {
    try {
      setIsLoading(true)

      // 尝试获取检测统计信息（如果新 API 可用）
      try {
        const detectionStats = await (api as any).getDetectionStats?.()
        if (detectionStats) {
          setStats(detectionStats)
        }
      } catch {
        // 如果新 API 不可用，使用旧的检测方法
        const versionInfo = await api.checkClaudeVersion()
        setStats({
          isDetected: versionInfo.is_installed,
          version: versionInfo.version,
          platform: 'unknown',
          executionMethod: 'native'
        })
      }

      // 尝试获取详细的检测结果（如果新 API 可用）
      try {
        const result = await (api as any).getLastDetectionResult?.()
        if (result) {
          setDetectionResult(result)
        }
      } catch {
        // 新 API 不可用，创建兼容的结果
        const versionInfo = await api.checkClaudeVersion()
        setDetectionResult({
          success: versionInfo.is_installed,
          platform: process.platform || 'unknown',
          executionMethod: process.platform === 'win32' ? 'wsl' : 'native',
          version: versionInfo.version,
          detectionMethod: 'legacy'
        })
      }
    } catch (error) {
      console.error('Failed to load Claude detection status:', error)
      setDetectionResult({
        success: false,
        platform: process.platform || 'unknown',
        executionMethod: process.platform === 'win32' ? 'wsl' : 'native',
        error: {
          type: 'DETECTION_FAILED',
          message:
            (error instanceof Error ? error.message : String(error)) || 'Failed to detect Claude'
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRedetect = async () => {
    try {
      setIsRedetecting(true)

      // 尝试使用新的重新检测 API
      try {
        const result = await (api as any).redetectClaude?.()
        if (result) {
          setDetectionResult(result)
        }
      } catch {
        // 如果新 API 不可用，清除缓存并重新加载
        await loadDetectionStatus()
      }
    } catch (error) {
      console.error('Failed to redetect Claude:', error)
    } finally {
      setIsRedetecting(false)
    }
  }

  const getStatusIcon = () => {
    if (isLoading || isRedetecting) {
      return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
    }

    if (detectionResult?.success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusText = () => {
    if (isLoading) return 'Detecting...'
    if (isRedetecting) return 'Re-detecting...'

    if (detectionResult?.success) {
      return `Claude Code detected (${detectionResult.version || 'unknown version'})`
    } else {
      return 'Claude Code not detected'
    }
  }

  const getExecutionMethodBadge = () => {
    if (!detectionResult) return null

    const method = detectionResult.executionMethod
    const variant = method === 'wsl' ? 'secondary' : 'outline'
    const icon = method === 'wsl' ? <Terminal className="h-3 w-3 mr-1" /> : null

    return (
      <Badge variant={variant} className="text-xs">
        {icon}
        {method === 'wsl' ? 'WSL' : 'Native'}
      </Badge>
    )
  }

  const getPlatformInfo = () => {
    if (!detectionResult) return null

    const platform = detectionResult.platform
    const platformNames = {
      win32: 'Windows',
      darwin: 'macOS',
      linux: 'Linux'
    }

    return platformNames[platform as keyof typeof platformNames] || platform
  }

  const openHelpLink = () => {
    const url =
      detectionResult?.platform === 'win32'
        ? 'https://docs.microsoft.com/en-us/windows/wsl/install'
        : 'https://docs.anthropic.com/claude/reference/claude-cli'

    window.open(url, '_blank')
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-base">{getStatusText()}</CardTitle>
              <CardDescription className="text-xs">
                Platform: {getPlatformInfo()} • Detection method:{' '}
                {detectionResult?.detectionMethod || 'unknown'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {getExecutionMethodBadge()}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedetect}
              disabled={isLoading || isRedetecting}
              className="text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRedetecting ? 'animate-spin' : ''}`} />
              Re-detect
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 检测详情 */}
        {detectionResult?.success && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Path:</span>
                <p className="font-mono text-xs bg-muted px-1 py-0.5 rounded mt-1 break-all">
                  {detectionResult.claudePath}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>
                <p className="mt-1">{detectionResult.version || 'unknown'}</p>
              </div>
            </div>

            {detectionResult.wslDistro && (
              <div className="text-xs">
                <span className="text-muted-foreground">WSL Distribution:</span>
                <Badge variant="outline" className="ml-1 text-xs">
                  {detectionResult.wslDistro}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* 错误信息和建议 */}
        {!detectionResult?.success && detectionResult?.error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <div className="space-y-2">
                <p>
                  <strong>Error:</strong> {detectionResult.error.message}
                </p>

                {detectionResult.suggestions && detectionResult.suggestions.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Suggested solutions:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      {detectionResult.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  variant="link"
                  size="sm"
                  onClick={openHelpLink}
                  className="p-0 h-auto text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View installation docs
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        {stats && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last detection time</span>
              <span>
                {stats.lastDetectionTime
                  ? new Date(stats.lastDetectionTime).toLocaleTimeString()
                  : 'unknown'}
              </span>
            </div>
            {stats.cacheHit && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cache hit</span>
                <Badge variant="outline" className="text-xs">
                  <Info className="h-3 w-3 mr-1" />
                  Yes
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
