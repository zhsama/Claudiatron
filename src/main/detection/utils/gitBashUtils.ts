/**
 * Git Bash 工具函数
 * 用于在 Windows 环境下通过 Git Bash 执行命令
 */

import { executeCommand } from './execUtils'
import type { ProcessResult, ExecutionOptions } from '../types'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Git for Windows 常见安装路径
 */
const GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  'C:\\Git\\bin\\bash.exe',
  'D:\\Program Files\\Git\\bin\\bash.exe',
  'D:\\Git\\bin\\bash.exe'
]

/**
 * Git Bash 信息
 */
export interface GitBashInfo {
  available: boolean
  bashPath?: string
  gitVersion?: string
}

/**
 * 检测 Git Bash 是否可用
 */
export async function detectGitBash(): Promise<GitBashInfo> {
  console.log('Detecting Git Bash availability...')

  // 1. 尝试直接使用 where 命令查找 bash
  try {
    const result = await executeCommand('where bash.exe', { timeout: 3000 })
    if (result.exitCode === 0 && result.stdout.trim()) {
      const bashPath = result.stdout.trim().split('\n')[0]
      console.log(`Found Git Bash via 'where' command: ${bashPath}`)

      const gitVersion = await getGitVersion(bashPath)
      return {
        available: true,
        bashPath,
        gitVersion
      }
    }
  } catch (error) {
    console.log('Git Bash not found via where command')
  }

  // 2. 检查常见安装路径
  for (const path of GIT_BASH_PATHS) {
    try {
      await fs.access(path)
      console.log(`Found Git Bash at: ${path}`)

      const gitVersion = await getGitVersion(path)
      return {
        available: true,
        bashPath: path,
        gitVersion
      }
    } catch {
      // 继续检查下一个路径
    }
  }

  // 3. 尝试通过注册表查找（如果上述方法都失败）
  try {
    const regResult = await executeCommand(
      'reg query "HKLM\\SOFTWARE\\GitForWindows" /v InstallPath',
      { timeout: 3000 }
    )

    if (regResult.exitCode === 0) {
      const match = regResult.stdout.match(/InstallPath\s+REG_SZ\s+(.+)/)
      if (match) {
        const installPath = match[1].trim()
        const bashPath = join(installPath, 'bin', 'bash.exe')

        try {
          await fs.access(bashPath)
          console.log(`Found Git Bash via registry: ${bashPath}`)

          const gitVersion = await getGitVersion(bashPath)
          return {
            available: true,
            bashPath,
            gitVersion
          }
        } catch {
          // bash.exe 不存在
        }
      }
    }
  } catch (error) {
    console.log('Failed to query registry for Git installation')
  }

  console.log('Git Bash not found on this system')
  return { available: false }
}

/**
 * 获取 Git 版本
 */
async function getGitVersion(bashPath: string): Promise<string | undefined> {
  try {
    const result = await executeGitBashCommand(bashPath, 'git --version', { timeout: 3000 })
    if (result.exitCode === 0) {
      const match = result.stdout.match(/git version (.+)/)
      return match ? match[1].trim() : undefined
    }
  } catch (error) {
    console.warn(`Failed to get git version: ${error}`)
  }
  return undefined
}

/**
 * 在 Git Bash 环境中执行命令
 */
export async function executeGitBashCommand(
  bashPath: string,
  command: string,
  options: ExecutionOptions = {}
): Promise<ProcessResult> {
  const { timeout = 10000, cwd = process.cwd(), env = {} } = options

  // 构造 Git Bash 命令
  // 使用 -c 执行命令，不加载完整环境以提高速度
  const bashCommand = `"${bashPath}" -c "${command.replace(/"/g, '\\"')}"`

  console.log(`Executing Git Bash command: ${command}`)

  // 创建清洁的 Windows 路径环境，排除 WSL 路径
  const windowsOnlyPath = createWindowsOnlyPath()

  return executeCommand(bashCommand, {
    timeout,
    cwd,
    env: {
      ...env,
      // 使用清洁的 PATH，排除 WSL 路径
      PATH: windowsOnlyPath,
      // 确保使用正确的用户目录
      USERPROFILE: process.env.USERPROFILE || '',
      HOME: process.env.USERPROFILE || ''
    }
  })
}

/**
 * 创建只包含 Windows 路径的 PATH 环境变量
 */
function createWindowsOnlyPath(): string {
  const originalPath = process.env.PATH || ''
  const pathParts = originalPath.split(';')

  // 过滤掉 WSL 相关路径
  const windowsPaths = pathParts.filter((path) => {
    if (!path) return false

    // 排除 WSL 相关路径
    const lowerPath = path.toLowerCase()
    if (
      lowerPath.includes('wsl') ||
      lowerPath.includes('/mnt/') ||
      lowerPath.includes('\\wsl\\') ||
      lowerPath.includes('\\ubuntu\\') ||
      lowerPath.includes('\\debian\\')
    ) {
      return false
    }

    // 排除明显的 Linux 路径格式
    if (
      path.startsWith('/usr/') ||
      path.startsWith('/bin/') ||
      path.startsWith('/sbin/') ||
      path.startsWith('/tmp/') ||
      path.startsWith('/run/')
    ) {
      return false
    }

    return true
  })

  // 添加必要的 Git 路径
  const gitPaths = [
    'C:\\Program Files\\Git\\bin',
    'C:\\Program Files\\Git\\usr\\bin',
    'C:\\Program Files\\Git\\mingw64\\bin'
  ]

  // 合并路径，确保 Git 路径在前面
  return [...gitPaths, ...windowsPaths].join(';')
}

/**
 * 检查 Git Bash 中是否存在某个命令
 */
export async function checkCommandInGitBash(bashPath: string, command: string): Promise<boolean> {
  try {
    const result = await executeGitBashCommand(bashPath, `command -v ${command}`, { timeout: 3000 })
    return result.exitCode === 0 && result.stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * 在 Git Bash 中获取命令的完整路径
 */
export async function getCommandPathInGitBash(
  bashPath: string,
  command: string
): Promise<string | null> {
  try {
    // 使用简单快速的检测方式
    const result = await executeGitBashCommand(
      bashPath,
      `command -v ${command} 2>/dev/null || true`,
      { timeout: 3000 }
    )

    if (result.exitCode === 0 && result.stdout.trim()) {
      const claudePath = result.stdout.trim().split('\n')[0]

      if (claudePath) {
        return claudePath
      }
    }
  } catch {
    // 忽略错误
  }

  return null
}

/**
 * 验证 Git Bash 环境中的可执行文件
 */
export async function verifyExecutableInGitBash(
  bashPath: string,
  executablePath: string,
  versionFlag = '--version'
): Promise<boolean> {
  try {
    const result = await executeGitBashCommand(bashPath, `"${executablePath}" ${versionFlag}`, {
      timeout: 3000
    })
    return result.exitCode === 0
  } catch {
    return false
  }
}
