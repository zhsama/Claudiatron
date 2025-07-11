import React, { useState, useEffect } from 'react'
import { X, Minus, Square, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WindowControlsProps {
  className?: string
}

export const WindowControls: React.FC<WindowControlsProps> = ({ className }) => {
  const [isMaximized, setIsMaximized] = useState(false)

  // 监听窗口最大化状态变化
  useEffect(() => {
    const checkMaximized = async () => {
      // TODO: 添加检查窗口是否最大化的逻辑
    }

    checkMaximized()
    // 监听窗口状态变化
    window.addEventListener('resize', checkMaximized)
    return () => window.removeEventListener('resize', checkMaximized)
  }, [])

  const handleMinimize = () => {
    window.electron.windowControl('min')
  }

  const handleMaximize = () => {
    window.electron.windowControl('max')
    setIsMaximized(!isMaximized)
  }

  const handleClose = () => {
    window.electron.windowControl('close')
  }

  return (
    <div className={cn('flex items-center app-region-no-drag', className)}>
      {/* 最小化按钮 */}
      <button
        onClick={handleMinimize}
        className="inline-flex items-center justify-center w-11 h-8 hover:bg-muted/50 transition-colors"
        aria-label="最小化"
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* 最大化/还原按钮 */}
      <button
        onClick={handleMaximize}
        className="inline-flex items-center justify-center w-11 h-8 hover:bg-muted/50 transition-colors"
        aria-label={isMaximized ? '还原' : '最大化'}
      >
        {isMaximized ? <Square className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>

      {/* 关闭按钮 */}
      <button
        onClick={handleClose}
        className="inline-flex items-center justify-center w-11 h-8 hover:bg-destructive hover:text-destructive-foreground transition-colors"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
