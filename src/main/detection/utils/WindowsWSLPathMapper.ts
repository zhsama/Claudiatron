/**
 * Windows WSL 路径映射工具
 */

import { PathMapper } from '../types'

export class WindowsWSLPathMapper implements PathMapper {
  constructor(private distroName: string) {}

  /**
   * Windows 路径转 WSL 路径
   * 例: C:\Users\username\project -> /mnt/c/Users/username/project
   */
  windowsToWSL(windowsPath: string): string {
    // 规范化路径分隔符
    const normalized = windowsPath.replace(/\\/g, '/')

    // 处理驱动器路径
    if (/^[A-Za-z]:/.test(normalized)) {
      const drive = normalized.charAt(0).toLowerCase()
      const pathWithoutDrive = normalized.substring(2)
      return `/mnt/${drive}${pathWithoutDrive}`
    }

    // 处理 UNC 路径（网络路径）
    if (normalized.startsWith('//')) {
      // UNC 路径在 WSL 中可能需要特殊处理
      throw new Error(`UNC paths are not supported: ${windowsPath}`)
    }

    // 相对路径或其他格式
    throw new Error(`Unsupported Windows path format: ${windowsPath}`)
  }

  /**
   * WSL 路径转 Windows 路径
   * 例: /mnt/c/Users/username/project -> C:\Users\username\project
   */
  wslToWindows(wslPath: string): string {
    if (wslPath.startsWith('/mnt/')) {
      const drive = wslPath.charAt(5).toUpperCase()
      const pathAfterDrive = wslPath.substring(6)
      return `${drive}:${pathAfterDrive.replace(/\//g, '\\')}`
    }

    // WSL 内部路径（如 /home/username）无法直接映射到 Windows
    throw new Error(`WSL internal path cannot be mapped to Windows: ${wslPath}`)
  }

  /**
   * 获取项目在 WSL 中的路径（供 Claude 使用）
   */
  getProjectPathForClaude(windowsProjectPath: string): string {
    return this.windowsToWSL(windowsProjectPath)
  }

  /**
   * 验证路径是否可以映射
   */
  canMapToWSL(windowsPath: string): boolean {
    try {
      this.windowsToWSL(windowsPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 验证 WSL 路径是否可以映射回 Windows
   */
  canMapToWindows(wslPath: string): boolean {
    try {
      this.wslToWindows(wslPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取 WSL 发行版名称
   */
  getDistroName(): string {
    return this.distroName
  }

  /**
   * 规范化 Windows 路径
   */
  static normalizeWindowsPath(path: string): string {
    return path.replace(/\\/g, '/')
  }

  /**
   * 规范化 WSL 路径
   */
  static normalizeWSLPath(path: string): string {
    return path.replace(/\\/g, '/')
  }

  /**
   * 检测路径类型
   */
  static detectPathType(path: string): 'windows' | 'wsl' | 'unknown' {
    // Windows 绝对路径模式
    if (/^[A-Za-z]:[\\\/]/.test(path)) {
      return 'windows'
    }

    // WSL 挂载路径模式
    if (path.startsWith('/mnt/')) {
      return 'wsl'
    }

    // Unix 绝对路径（可能是 WSL 内部路径）
    if (path.startsWith('/')) {
      return 'wsl'
    }

    return 'unknown'
  }

  /**
   * 智能路径转换（自动检测方向）
   */
  smartConvert(path: string): string {
    const pathType = WindowsWSLPathMapper.detectPathType(path)

    switch (pathType) {
      case 'windows':
        return this.windowsToWSL(path)
      case 'wsl':
        // 尝试转换为 Windows 路径
        if (this.canMapToWindows(path)) {
          return this.wslToWindows(path)
        }
        return path // 返回原路径（WSL 内部路径）
      default:
        throw new Error(`Cannot determine path type for: ${path}`)
    }
  }
}
