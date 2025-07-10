/**
 * 执行工具函数
 */

import { spawn, exec, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import type { ProcessResult, ExecutionOptions } from '../types'

const execAsync = promisify(exec)

/**
 * 异步执行命令
 */
export async function executeCommand(
  command: string,
  options: ExecutionOptions = {}
): Promise<ProcessResult> {
  const { timeout = 30000, cwd = process.cwd(), env = process.env, encoding = 'utf8' } = options

  try {
    const result = await execAsync(command, {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      encoding
    })

    return {
      exitCode: 0,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    }
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || '',
      signal: error.signal
    }
  }
}

/**
 * 启动子进程
 */
export function spawnProcess(
  command: string,
  args: string[] = [],
  options: ExecutionOptions = {}
): ChildProcess {
  const { cwd = process.cwd(), env = process.env } = options

  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe']
  })
}

/**
 * 检查命令是否可用
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  const checkCommand = process.platform === 'win32' ? `where ${command}` : `which ${command}`

  try {
    const result = await executeCommand(checkCommand, { timeout: 5000 })
    return result.exitCode === 0 && result.stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * 获取命令的完整路径
 */
export async function getCommandPath(command: string): Promise<string | null> {
  const commands =
    process.platform === 'win32'
      ? [`where ${command}`]
      : [`which ${command}`, `command -v ${command}`]

  for (const cmd of commands) {
    try {
      const result = await executeCommand(cmd, { timeout: 5000 })
      if (result.exitCode === 0 && result.stdout.trim()) {
        const path = result.stdout.trim().split('\n')[0]
        if (path) {
          return path
        }
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * 验证可执行文件
 */
export async function verifyExecutable(path: string, versionFlag = '--version'): Promise<boolean> {
  try {
    const result = await executeCommand(`"${path}" ${versionFlag}`, { timeout: 3000 })
    return result.exitCode === 0
  } catch {
    return false
  }
}

/**
 * 获取程序版本
 */
export async function getProgramVersion(
  path: string,
  versionFlag = '--version'
): Promise<string | null> {
  try {
    const result = await executeCommand(`"${path}" ${versionFlag}`, { timeout: 3000 })
    if (result.exitCode === 0) {
      // 尝试提取版本号
      const versionMatch = result.stdout.match(/(\d+\.\d+\.\d+)/)
      return versionMatch ? versionMatch[1] : result.stdout.trim()
    }
  } catch {
    // 忽略错误
  }

  return null
}

/**
 * 解析符号链接到实际路径
 */
export async function resolveSymlink(path: string): Promise<string> {
  try {
    // 使用 fs.realpath 来解析符号链接
    const resolvedPath = await fs.realpath(path)
    return resolvedPath
  } catch (error) {
    // 如果不是符号链接或解析失败，返回原路径
    console.warn(`Failed to resolve symlink for ${path}:`, error.message)
    return path
  }
}

/**
 * 获取 fnm 安装信息
 */
export function extractFnmInfo(path: string): { nodeVersion?: string; isFromFnm: boolean } {
  // 检查路径是否包含 fnm 特征
  const fnmNodeVersionMatch = path.match(/fnm[\/\\]node-versions[\/\\]v([^\/\\]+)/)
  const fnmMultishellMatch = path.match(/fnm_multishells[\/\\]/)

  if (fnmNodeVersionMatch) {
    return {
      nodeVersion: fnmNodeVersionMatch[1],
      isFromFnm: true
    }
  } else if (fnmMultishellMatch) {
    return {
      isFromFnm: true
    }
  }

  return {
    isFromFnm: false
  }
}
