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
  const { timeout = 30000, cwd = process.cwd(), env = {} } = options

  // 构造 Git Bash 命令
  // 使用 -l (login shell) 确保加载完整环境
  // 使用 -i (interactive) 确保加载 .bashrc 等配置
  const bashCommand = `"${bashPath}" -l -i -c "${command.replace(/"/g, '\\"')}"`

  console.log(`Executing Git Bash command: ${command}`)
  console.log(`Full command: ${bashCommand}`)

  return executeCommand(bashCommand, {
    timeout,
    cwd,
    env: {
      ...process.env,
      ...env,
      // 确保使用正确的 PATH
      PATH: `${process.env.PATH};C:\\Program Files\\Git\\bin;C:\\Program Files\\Git\\usr\\bin`
    }
  })
}

/**
 * 检查 Git Bash 中是否存在某个命令
 */
export async function checkCommandInGitBash(bashPath: string, command: string): Promise<boolean> {
  try {
    const result = await executeGitBashCommand(bashPath, `command -v ${command}`, { timeout: 5000 })
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
    const result = await executeGitBashCommand(bashPath, `which ${command}`, { timeout: 5000 })

    if (result.exitCode === 0 && result.stdout.trim()) {
      return result.stdout.trim().split('\n')[0]
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
