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
  executionMethod: 'native'
  claudePath?: string
  version?: string
  error?: ClaudeDetectionError
  suggestions?: string[]
  detectionMethod?: string // 'cache' | 'shell' | 'direct' | 'user' | 'git-bash'
  resolvedPath?: string // 解析后的实际路径（如果是符号链接）
  metadata?: {
    // 额外的元数据
    isFromFnm?: boolean
    nodeVersion?: string
    packageManager?: string
    environment?: 'git-bash' | 'wsl' | 'native' | 'unknown' // 执行环境类型
    environmentDescription?: string // 环境描述
  }
}

/**
 * Claude 检测错误
 */
export interface ClaudeDetectionError {
  type: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'VERSION_MISMATCH' | 'EXECUTION_FAILED'
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
