/**
 * Simple Claude detection status badge for integration into existing settings
 */

import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Terminal, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface ClaudeDetectionBadgeProps {
  className?: string
}

export const ClaudeDetectionBadge: React.FC<ClaudeDetectionBadgeProps> = ({ className }) => {
  const [detectionResult, setDetectionResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRedetecting, setIsRedetecting] = useState(false)

  useEffect(() => {
    loadDetectionStatus()
  }, [])

  const loadDetectionStatus = async () => {
    try {
      setIsLoading(true)

      // Try new API first, fallback to legacy
      try {
        const result = await (api as any).getLastDetectionResult?.()
        if (result) {
          setDetectionResult(result)
          return
        }
      } catch {
        // Use legacy detection
        const versionInfo = await api.checkClaudeVersion()
        setDetectionResult({
          success: versionInfo.is_installed,
          platform: window.electron.process.platform || 'unknown',
          executionMethod: window.electron.process.platform === 'win32' ? 'wsl' : 'native',
          version: versionInfo.version,
          detectionMethod: 'legacy'
        })
      }
    } catch (error) {
      console.error('Failed to load Claude detection status:', error)
      setDetectionResult({
        success: false,
        platform: window.electron.process.platform || 'unknown',
        executionMethod: window.electron.process.platform === 'win32' ? 'wsl' : 'native',
        error: {
          message: (error instanceof Error ? error.message : String(error)) || 'Detection failed'
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRedetect = async () => {
    try {
      setIsRedetecting(true)

      try {
        const result = await (api as any).redetectClaude?.()
        if (result) {
          setDetectionResult(result)
        }
      } catch {
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
      return <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
    }

    if (detectionResult?.success) {
      return <CheckCircle className="h-3 w-3 text-green-500" />
    } else {
      return <XCircle className="h-3 w-3 text-red-500" />
    }
  }

  const getStatusText = () => {
    if (isLoading) return 'Detecting...'
    if (isRedetecting) return 'Re-detecting...'

    if (detectionResult?.success) {
      return `Detected (${detectionResult.version || 'unknown version'})`
    } else {
      return 'Not detected'
    }
  }

  const getExecutionMethodBadge = () => {
    if (!detectionResult?.success) return null

    const method = detectionResult.executionMethod
    const variant = method === 'wsl' ? 'secondary' : 'outline'
    const icon = method === 'wsl' ? <Terminal className="h-3 w-3 mr-1" /> : null

    return (
      <Badge variant={variant} className="text-xs ml-2">
        {icon}
        {method === 'wsl' ? 'WSL' : 'Native'}
      </Badge>
    )
  }

  return (
    <div
      className={`flex items-center justify-between p-3 bg-muted/30 rounded-lg border ${className}`}
    >
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <div className="text-sm">
          <span className="font-medium">Detection Status: </span>
          <span className={detectionResult?.success ? 'text-green-600' : 'text-red-600'}>
            {getStatusText()}
          </span>
          {getExecutionMethodBadge()}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {detectionResult?.detectionMethod && (
          <Badge variant="outline" className="text-xs">
            <Info className="h-3 w-3 mr-1" />
            {detectionResult.detectionMethod}
          </Badge>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleRedetect}
          disabled={isLoading || isRedetecting}
          className="text-xs h-7"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRedetecting ? 'animate-spin' : ''}`} />
          Re-detect
        </Button>
      </div>
    </div>
  )
}
