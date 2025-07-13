/**
 * Windows Claude 检测器 (Git Bash 环境)
 * 替换原来的 WSL 检测方式，使用 Git Bash 进行原生 Windows 检测
 */

import { ChildProcess } from 'child_process'
import { PlatformClaudeDetector } from '../base/PlatformClaudeDetector'
import {
  detectGitBash,
  executeGitBashCommand,
  checkCommandInGitBash,
  getCommandPathInGitBash,
  verifyExecutableInGitBash,
  type GitBashInfo
} from '../utils/gitBashUtils'
import { spawnProcess } from '../utils/execUtils'
import type { ClaudeDetectionResult, ProcessResult, ExecutionOptions } from '../types'

export class WindowsClaudeDetector extends PlatformClaudeDetector {
  private gitBashInfo?: GitBashInfo

  /**
   * 执行 Claude 检测
   */
  async detect(): Promise<ClaudeDetectionResult> {
    console.log('Starting Windows Claude detection...')

    // 1. 检测 Git Bash 环境
    const gitBashInfo = await detectGitBash()
    if (!gitBashInfo.available || !gitBashInfo.bashPath) {
      console.log('Git Bash is not available on this system')
      const result = this.createGitBashNotAvailableResult()
      await this.cacheResult(result)
      return result
    }

    this.gitBashInfo = gitBashInfo
    console.log(`Git Bash found at: ${gitBashInfo.bashPath}`)

    // 2. Git Bash 环境检测（最可靠的方式）
    const bashResult = await this.detectViaGitBash()
    if (bashResult.success) {
      await this.cacheResult(bashResult)
      this.claudePath = bashResult.claudePath
      this.version = bashResult.version
      return bashResult
    }

    // 3. 检查用户配置（如果有的话）
    const userResult = await this.checkUserConfig()
    if (userResult.success) {
      this.claudePath = userResult.claudePath
      this.version = userResult.version
      return userResult
    }

    // 4. 未找到 Claude
    console.log('Claude not found on Windows system')
    const notFoundResult = this.createNotFoundResult()
    await this.cacheResult(notFoundResult)
    return notFoundResult
  }

  /**
   * 通过 Git Bash 环境检测 Claude
   */
  private async detectViaGitBash(): Promise<ClaudeDetectionResult> {
    if (!this.gitBashInfo?.bashPath) {
      return {
        success: false,
        platform: 'win32',
        executionMethod: 'native'
      }
    }

    console.log('Detecting Claude via Git Bash commands...')

    // 首先尝试通过 Node.js 包管理器检测
    const packageManagerResult = await this.detectViaPackageManagers()
    if (packageManagerResult.success) {
      return packageManagerResult
    }

    // 直接检测 claude 命令
    const claudePath = await getCommandPathInGitBash(this.gitBashInfo.bashPath, 'claude')
    if (claudePath && (await this.verify(claudePath))) {
      const environment = this.identifyClaudeEnvironment(claudePath)
      const version = await this.getClaudeVersion(claudePath)
      console.log(
        `Found Claude via Git Bash: ${claudePath} (${environment.description}), version: ${version}`
      )

      return {
        success: true,
        platform: 'win32',
        executionMethod: 'native',
        claudePath,
        version: version || 'unknown',
        detectionMethod: 'git-bash',
        metadata: {
          environment: environment.type,
          environmentDescription: environment.description
        }
      }
    }

    return {
      success: false,
      platform: 'win32',
      executionMethod: 'native'
    }
  }

  /**
   * 通过 Node.js 包管理器检测 Claude
   */
  private async detectViaPackageManagers(): Promise<ClaudeDetectionResult> {
    if (!this.gitBashInfo?.bashPath) {
      return {
        success: false,
        platform: 'win32',
        executionMethod: 'native'
      }
    }

    console.log('Detecting Claude via Node.js package managers in Git Bash...')

    const availableManagers = await this.detectNodePackageManagers()

    if (availableManagers.length === 0) {
      console.log('No Node.js package managers found in Git Bash')
      return {
        success: false,
        platform: 'win32',
        executionMethod: 'native'
      }
    }

    // 按优先级检测
    for (const manager of availableManagers) {
      try {
        let claudeCmd: string

        switch (manager.name) {
          case 'fnm':
            claudeCmd = `fnm exec --using=default -- command -v claude 2>/dev/null || true`
            break
          case 'nvm':
            claudeCmd = `source ~/.bashrc && nvm use default && command -v claude 2>/dev/null || true`
            break
          case 'volta':
            claudeCmd = `volta run command -v claude 2>/dev/null || true`
            break
          case 'nodenv':
            claudeCmd = `nodenv exec command -v claude 2>/dev/null || true`
            break
          case 'npm':
            claudeCmd = `command -v claude 2>/dev/null || true`
            break
          default:
            continue
        }

        const result = await executeGitBashCommand(this.gitBashInfo.bashPath, claudeCmd, {
          timeout: 10000
        })

        if (result.exitCode === 0 && result.stdout.trim()) {
          const claudePath = result.stdout.trim()
          const environment = this.identifyClaudeEnvironment(claudePath)

          console.log(
            `Found Claude via ${manager.name}: ${claudePath} (${environment.description})`
          )

          // 获取版本
          const version = await this.getClaudeVersion(claudePath)

          return {
            success: true,
            platform: 'win32',
            executionMethod: 'native',
            claudePath,
            version: version || 'unknown',
            detectionMethod: manager.name,
            metadata: {
              packageManager: manager.name,
              environment: environment.type,
              environmentDescription: environment.description
            }
          }
        }
      } catch (error) {
        console.warn(`${manager.name} detection failed:`, error)
        continue
      }
    }

    return {
      success: false,
      platform: 'win32',
      executionMethod: 'native'
    }
  }

  /**
   * 检测可用的 Node.js 包管理器
   */
  private async detectNodePackageManagers(): Promise<Array<{ name: string; command: string }>> {
    if (!this.gitBashInfo?.bashPath) {
      return []
    }

    const managers = [
      { name: 'fnm', command: 'fnm' },
      { name: 'nvm', command: 'nvm' },
      { name: 'volta', command: 'volta' },
      { name: 'nodenv', command: 'nodenv' },
      { name: 'npm', command: 'npm' }
    ]

    const availableManagers: Array<{ name: string; command: string }> = []

    for (const manager of managers) {
      try {
        const isAvailable = await checkCommandInGitBash(this.gitBashInfo.bashPath, manager.command)
        if (isAvailable) {
          availableManagers.push(manager)
          console.log(`Found package manager: ${manager.name}`)
        }
      } catch (error) {
        // 忽略错误，继续检测下一个
      }
    }

    return availableManagers
  }

  /**
   * 获取 Claude 版本
   */
  private async getClaudeVersion(claudePath: string): Promise<string | null> {
    if (!this.gitBashInfo?.bashPath) {
      return null
    }

    try {
      const result = await executeGitBashCommand(
        this.gitBashInfo.bashPath,
        `"${claudePath}" --version`,
        { timeout: 5000 }
      )

      if (result.exitCode === 0) {
        return this.parseVersion(result.stdout)
      }
    } catch (error) {
      console.warn(`Failed to get Claude version: ${error}`)
    }

    return null
  }

  /**
   * 检查用户配置的 Claude 路径
   */
  private async checkUserConfig(): Promise<ClaudeDetectionResult> {
    // TODO: 实现用户配置检查，从应用设置中读取用户自定义的 Claude 路径
    return {
      success: false,
      platform: 'win32',
      executionMethod: 'native'
    }
  }

  /**
   * 验证 Claude 可执行文件
   */
  async verify(path: string): Promise<boolean> {
    if (!this.gitBashInfo?.bashPath) {
      return false
    }

    try {
      const isExecutable = await verifyExecutableInGitBash(
        this.gitBashInfo.bashPath,
        path,
        '--version'
      )

      if (!isExecutable) {
        return false
      }

      // 进一步验证是否确实是 Claude
      const version = await this.getClaudeVersion(path)
      return version !== null
    } catch (error) {
      console.warn(`Failed to verify Claude at ${path}:`, error)
      return false
    }
  }

  /**
   * 执行 Claude 命令
   */
  async execute(
    args: string[],
    workingDir: string,
    options: ExecutionOptions = {}
  ): Promise<ProcessResult> {
    if (!this.claudePath || !this.gitBashInfo?.bashPath) {
      throw new Error('Claude not detected. Please run detection first.')
    }

    // 构造在 Git Bash 中执行的命令
    const command = `cd "${workingDir}" && "${this.claudePath}" ${args.join(' ')}`

    console.log(`Executing Claude command in Git Bash: ${command}`)

    return executeGitBashCommand(this.gitBashInfo.bashPath, command, {
      cwd: workingDir,
      timeout: 300000, // 5 分钟默认超时
      ...options
    })
  }

  /**
   * 启动交互式 Claude 会话
   */
  async startInteractiveSession(workingDir: string, args: string[] = []): Promise<ChildProcess> {
    if (!this.claudePath || !this.gitBashInfo?.bashPath) {
      throw new Error('Claude not detected. Please run detection first.')
    }

    console.log(`Starting interactive Claude session in ${workingDir}`)

    // 构造启动交互式会话的命令
    const sessionCommand = `cd "${workingDir}" && "${this.claudePath}" ${args.join(' ')}`

    // 使用 Git Bash 启动交互式会话
    return spawnProcess(this.gitBashInfo.bashPath, ['-l', '-i', '-c', sessionCommand], {
      cwd: workingDir
    })
  }

  /**
   * 创建 Git Bash 不可用的错误结果
   */
  private createGitBashNotAvailableResult(): ClaudeDetectionResult {
    return {
      success: false,
      platform: 'win32',
      executionMethod: 'native',
      error: {
        type: 'NOT_FOUND',
        message: 'Git Bash is required for Claude Code on Windows',
        platform: 'win32',
        details: 'Git for Windows not found'
      },
      suggestions: this.generateInstallationSuggestions()
    }
  }

  /**
   * 创建未找到 Claude 的错误结果
   */
  protected createNotFoundResult(): ClaudeDetectionResult {
    return {
      success: false,
      platform: 'win32',
      executionMethod: 'native',
      error: {
        type: 'NOT_FOUND',
        message: 'Claude Code not found in Git Bash environment',
        platform: 'win32',
        details: 'Claude not found in PATH or package managers'
      },
      suggestions: this.generateInstallationSuggestions()
    }
  }

  /**
   * 识别 Claude 路径的环境类型
   */
  private identifyClaudeEnvironment(path: string): {
    type: 'git-bash' | 'wsl' | 'native' | 'unknown'
    description: string
  } {
    if (!path) return { type: 'unknown', description: 'Unknown' }

    // WSL 环境
    if (path.includes('/mnt/') || path.includes('/wsl/') || path.toLowerCase().includes('wsl')) {
      return { type: 'wsl', description: 'WSL Environment' }
    }

    // Unix 路径（可能是 WSL 或其他 Unix 子系统）
    if (path.startsWith('/usr/') || path.startsWith('/bin/') || path.startsWith('/home/')) {
      return { type: 'wsl', description: 'Unix-like Environment (possibly WSL)' }
    }

    // Windows 原生路径
    if (path.includes('\\') || path.includes('Program Files') || path.includes('AppData')) {
      return { type: 'native', description: 'Windows Native' }
    }

    // Node.js 模块路径（通常是原生）
    if (
      path.includes('node_modules') ||
      path.includes('npm') ||
      path.includes('.cmd') ||
      path.includes('.exe')
    ) {
      return { type: 'native', description: 'Node.js Package (Native)' }
    }

    // Git Bash 转换的路径
    if (/^\/[a-zA-Z]\//.test(path)) {
      return { type: 'git-bash', description: 'Git Bash Environment' }
    }

    return { type: 'unknown', description: 'Unknown Environment' }
  }

  /**
   * 生成平台特定的安装建议
   */
  protected generateInstallationSuggestions(): string[] {
    return [
      'Install Git for Windows from https://git-scm.com/download/win',
      'Install Node.js from https://nodejs.org/',
      'Install Claude Code: npm install -g @anthropic-ai/claude-code',
      'Restart the application after installation',
      'Verify installation: open Git Bash and run "claude --version"'
    ]
  }
}
