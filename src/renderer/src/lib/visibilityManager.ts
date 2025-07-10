import React from 'react'

/**
 * 页面可见性管理器
 * 用于在页面隐藏时降低轮询频率，节省资源
 */

type VisibilityCallback = (isVisible: boolean) => void

class VisibilityManager {
  private callbacks: Set<VisibilityCallback> = new Set()
  private isVisible: boolean = true
  private isInitialized: boolean = false

  constructor() {
    this.init()
  }

  private init() {
    if (this.isInitialized) return

    // 初始状态
    this.isVisible = document.visibilityState === 'visible'

    // 监听可见性变化
    document.addEventListener('visibilitychange', () => {
      const newIsVisible = document.visibilityState === 'visible'

      if (newIsVisible !== this.isVisible) {
        this.isVisible = newIsVisible
        this.notifyCallbacks()
      }
    })

    this.isInitialized = true
  }

  private notifyCallbacks() {
    this.callbacks.forEach((callback) => {
      try {
        callback(this.isVisible)
      } catch (error) {
        console.error('Error in visibility callback:', error)
      }
    })
  }

  /**
   * 订阅可见性变化
   */
  subscribe(callback: VisibilityCallback): () => void {
    this.callbacks.add(callback)

    // 立即调用一次，传递当前状态
    try {
      callback(this.isVisible)
    } catch (error) {
      console.error('Error in visibility callback:', error)
    }

    // 返回取消订阅函数
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * 获取当前可见性状态
   */
  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * 创建智能轮询间隔
   * 当页面隐藏时自动增加轮询间隔
   */
  createSmartInterval(
    callback: () => void | Promise<void>,
    visibleInterval: number,
    hiddenInterval: number = visibleInterval * 3
  ): () => void {
    let currentInterval: NodeJS.Timeout | null = null
    let isActive = true

    const updateInterval = (isVisible: boolean) => {
      if (!isActive) return

      if (currentInterval) {
        clearInterval(currentInterval)
        currentInterval = null
      }

      const interval = isVisible ? visibleInterval : hiddenInterval

      currentInterval = setInterval(async () => {
        if (!isActive) return

        try {
          await callback()
        } catch (error) {
          console.error('Error in smart interval callback:', error)
        }
      }, interval)
    }

    // 订阅可见性变化
    const unsubscribe = this.subscribe(updateInterval)

    // 返回清理函数
    return () => {
      isActive = false
      if (currentInterval) {
        clearInterval(currentInterval)
        currentInterval = null
      }
      unsubscribe()
    }
  }
}

// 导出单例实例
export const visibilityManager = new VisibilityManager()

/**
 * React Hook 用于监听页面可见性
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = React.useState(() => visibilityManager.getIsVisible())

  React.useEffect(() => {
    return visibilityManager.subscribe(setIsVisible)
  }, [])

  return isVisible
}
