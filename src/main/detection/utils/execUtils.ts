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
  const {
    timeout = 30000,
    cwd = process.cwd(),
    env = process.env,
    encoding = 'utf8',
    useLoginShell = false
  } = options

  // 在 macOS/Linux 上，如果需要，使用登录 shell 执行命令
  let finalCommand = command
  if (useLoginShell && (process.platform === 'darwin' || process.platform === 'linux')) {
    const shell = process.env.SHELL || '/bin/bash'
    finalCommand = `${shell} -l -c "${command.replace(/"/g, '\\"')}"`
  }

  // 显示调试信息以便排查问题
  console.log(`Executing command: ${finalCommand.substring(0, 200)}...`)
  console.log(`Environment PATH: ${(env?.PATH || process.env.PATH || '').substring(0, 200)}...`)

  try {
    const result = await execAsync(finalCommand, {
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
  const path = await getCommandPath(command)
  return path !== null
}

/**
 * 获取命令的完整路径
 */
export async function getCommandPath(command: string): Promise<string | null> {
  // 在 macOS 上，GUI 应用不会继承用户的 shell 环境
  // 需要通过登录 shell 来获取正确的 PATH
  if (process.platform === 'darwin' || process.platform === 'linux') {
    // 获取用户的默认 shell
    const shell = process.env.SHELL || '/bin/bash'

    // 使用登录 shell 来执行 which 命令
    // -l 参数确保加载完整的用户环境（包括 .bashrc/.zshrc 等）
    const shellCommands = [
      `${shell} -l -c "which ${command}"`,
      `${shell} -l -c "command -v ${command}"`,
      // 也尝试直接执行，以防某些情况下登录 shell 失败
      `which ${command}`,
      `command -v ${command}`
    ]

    for (const cmd of shellCommands) {
      try {
        const result = await executeCommand(cmd, {
          timeout: 5000,
          env: {
            ...process.env,
            // 确保 PATH 包含常见的安装位置
            PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${process.env.HOME}/.local/bin:${process.env.HOME}/.npm/bin:${process.env.HOME}/.fnm:${process.env.HOME}/.nvm/versions/node/*/bin:${process.env.HOME}/.yarn/bin:${process.env.HOME}/.config/yarn/global/node_modules/.bin:/opt/local/bin`
          }
        })
        if (result.exitCode === 0 && result.stdout.trim()) {
          const path = result.stdout.trim().split('\n')[0]
          if (path) {
            return path
          }
        }
      } catch (error) {
        continue
      }
    }
  } else if (process.platform === 'win32') {
    // Windows 平台逻辑保持不变
    try {
      const result = await executeCommand(`where ${command}`, { timeout: 5000 })
      if (result.exitCode === 0 && result.stdout.trim()) {
        const path = result.stdout.trim().split('\n')[0]
        if (path) {
          return path
        }
      }
    } catch {
      // 忽略错误
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
    console.warn(
      `Failed to resolve symlink for ${path}:`,
      error instanceof Error ? error.message : String(error)
    )
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
