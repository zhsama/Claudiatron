/**
 * 全平台 Claude Code 检测系统 - 类型定义
 */

import { ChildProcess } from 'child_process'

/**
 * Claude 检测结果
 */
export interface ClaudeDetectionResult {
  success: boolean
  platform: 'darwin' | 'linux' | 'win32'
  executionMethod: 'native' | 'wsl'
  claudePath?: string
  version?: string
  wslDistro?: string // Windows 特有
  pathMapper?: PathMapper // Windows 特有
  error?: ClaudeDetectionError
  suggestions?: string[]
  detectionMethod?: string // 'cache' | 'shell' | 'direct' | 'user'
  resolvedPath?: string // 解析后的实际路径（如果是符号链接）
  metadata?: {
    // 额外的元数据
    isFromFnm?: boolean
    nodeVersion?: string
    packageManager?: string
  }
}

/**
 * Claude 检测错误
 */
export interface ClaudeDetectionError {
  type:
    | 'NOT_FOUND'
    | 'WSL_NOT_AVAILABLE'
    | 'PERMISSION_DENIED'
    | 'VERSION_MISMATCH'
    | 'EXECUTION_FAILED'
  message: string
  platform: string
  details?: any
}

/**
 * 进程执行结果
 */
export interface ProcessResult {
  exitCode: number
  stdout: string
  stderr: string
  signal?: string
}

/**
 * WSL 信息
 */
export interface WSLInfo {
  available: boolean
  version: 'WSL1' | 'WSL2' | 'unknown'
  distributions: WSLDistribution[]
  defaultDistro?: string
}

/**
 * WSL 发行版信息
 */
export interface WSLDistribution {
  name: string
  version: string
  state: 'Running' | 'Stopped'
  isDefault: boolean
}

/**
 * WSL 中的 Claude 检测结果
 */
export interface WSLClaudeResult {
  success: boolean
  distro: string
  path?: string
  version?: string
  error?: string
}

/**
 * 路径映射器接口
 */
export interface PathMapper {
  windowsToWSL(windowsPath: string): string
  wslToWindows(wslPath: string): string
  getProjectPathForClaude(windowsProjectPath: string): string
}

/**
 * 检测缓存
 */
export interface ClaudeDetectionCache {
  timestamp: number
  platform: string
  result: ClaudeDetectionResult
  ttl: number // 缓存有效期（毫秒）
}

/**
 * 执行选项
 */
export interface ExecutionOptions {
  timeout?: number
  cwd?: string
  env?: Record<string, string>
  encoding?: BufferEncoding
  useLoginShell?: boolean // 是否使用登录 shell（用于 macOS/Linux）
}

/**
 * Claude 执行器接口
 */
export interface ClaudeExecutor {
  execute(args: string[], workingDir: string, options?: ExecutionOptions): Promise<ProcessResult>
  startInteractiveSession(workingDir: string, args?: string[]): Promise<ChildProcess>
  isAvailable(): boolean
  getVersion(): Promise<string>
}
