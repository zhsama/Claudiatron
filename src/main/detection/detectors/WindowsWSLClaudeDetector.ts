/**
 * Windows WSL Claude 检测器
 */

import { ChildProcess } from 'child_process'
import { PlatformClaudeDetector } from '../base/PlatformClaudeDetector'
import { WindowsWSLPathMapper } from '../utils/WindowsWSLPathMapper'
import { executeCommand, spawnProcess } from '../utils/execUtils'
import type {
  ClaudeDetectionResult,
  ProcessResult,
  ExecutionOptions,
  WSLInfo,
  WSLDistribution,
  WSLClaudeResult
} from '../types'

export class WindowsWSLClaudeDetector extends PlatformClaudeDetector {
  private pathMapper?: WindowsWSLPathMapper
  private wslDistro?: string

  /**
   * 执行 Claude 检测
   */
  async detect(): Promise<ClaudeDetectionResult> {
    console.log('Starting Windows WSL Claude detection...')

    // 跳过缓存检查，每次都重新检测以确保获取最新的安装信息

    // 1. WSL 可用性检测
    const wslInfo = await this.detectWSLEnvironment()
    if (!wslInfo.available) {
      console.log('WSL is not available on this system')
      const result = this.createWSLNotAvailableResult()
      await this.cacheResult(result)
      return result
    }

    console.log(`Found ${wslInfo.distributions.length} WSL distributions`)

    // 3. 在各 WSL 发行版中检测 Claude
    for (const distro of wslInfo.distributions) {
      console.log(`Checking Claude in WSL distribution: ${distro.name}`)

      const claudeResult = await this.detectClaudeInWSL(distro)
      if (claudeResult.success) {
        console.log(`Found Claude in WSL distro ${distro.name}: ${claudeResult.path}`)

        this.wslDistro = distro.name
        this.claudePath = claudeResult.path
        this.version = claudeResult.version
        this.pathMapper = new WindowsWSLPathMapper(distro.name)

        const result: ClaudeDetectionResult = {
          success: true,
          platform: 'win32',
          executionMethod: 'wsl',
          claudePath: claudeResult.path,
          version: claudeResult.version,
          wslDistro: distro.name,
          pathMapper: this.pathMapper,
          detectionMethod: 'wsl'
        }

        await this.cacheResult(result)
        return result
      }
    }

    // 4. 在所有发行版中都未找到 Claude
    console.log('Claude not found in any WSL distribution')
    const result = this.createWSLNotFoundResult()
    await this.cacheResult(result)
    return result
  }

  /**
   * 检测 WSL 环境
   */
  private async detectWSLEnvironment(): Promise<WSLInfo> {
    try {
      // 检测 WSL 版本
      console.log('Checking WSL version...')
      const versionResult = await executeCommand('wsl --version', { timeout: 5000 })

      // 列出发行版
      console.log('Listing WSL distributions...')
      const listResult = await executeCommand('wsl --list --verbose', { timeout: 10000 })

      if (versionResult.exitCode !== 0 || listResult.exitCode !== 0) {
        return {
          available: false,
          version: 'unknown',
          distributions: []
        }
      }

      const distributions = this.parseWSLDistributions(listResult.stdout)

      return {
        available: true,
        version: this.parseWSLVersion(versionResult.stdout),
        distributions,
        defaultDistro: distributions.find((d) => d.isDefault)?.name
      }
    } catch (error) {
      console.warn(
        'Failed to detect WSL environment:',
        error instanceof Error ? error.message : String(error)
      )
      return {
        available: false,
        version: 'unknown',
        distributions: []
      }
    }
  }

  /**
   * 解析 WSL 发行版列表
   */
  private parseWSLDistributions(output: string): WSLDistribution[] {
    const lines = output.split('\n').filter((line) => line.trim())
    const distributions: WSLDistribution[] = []

    for (const line of lines) {
      // 跳过标题行和空行
      if (line.includes('NAME') || line.includes('STATE') || !line.trim()) {
        continue
      }

      try {
        const trimmed = line.trim()
        const isDefault = trimmed.includes('*')

        // 移除 * 标记并分割
        const cleanLine = trimmed.replace('*', '').trim()
        const parts = cleanLine.split(/\s+/)

        if (parts.length >= 3) {
          const name = parts[0]
          const state = parts[1] as 'Running' | 'Stopped'
          const version = parts[2]

          distributions.push({
            name,
            version,
            state,
            isDefault
          })
        }
      } catch (error) {
        console.warn(`Failed to parse WSL distribution line: ${line}`, error)
      }
    }

    return distributions
  }

  /**
   * 解析 WSL 版本
   */
  private parseWSLVersion(output: string): 'WSL1' | 'WSL2' | 'unknown' {
    if (output.includes('WSL 2')) {
      return 'WSL2'
    } else if (output.includes('WSL 1')) {
      return 'WSL1'
    }
    return 'unknown'
  }

  /**
   * 在 WSL 发行版中检测 Claude
   */
  private async detectClaudeInWSL(distro: WSLDistribution): Promise<WSLClaudeResult> {
    const commands = [
      `wsl -d ${distro.name} -- which claude`,
      `wsl -d ${distro.name} -- which claude-code`,
      `wsl -d ${distro.name} -- command -v claude`,
      `wsl -d ${distro.name} -- command -v claude-code`
    ]

    for (const cmd of commands) {
      try {
        console.log(`Executing: ${cmd}`)
        const result = await executeCommand(cmd, { timeout: 10000 })

        if (result.exitCode === 0) {
          const claudePath = result.stdout.trim()

          if (claudePath && (await this.verifyClaudeInWSL(distro.name, claudePath))) {
            const version = await this.getClaudeVersionInWSL(distro.name, claudePath)

            return {
              success: true,
              distro: distro.name,
              path: claudePath,
              version: version || 'unknown'
            }
          }
        }
      } catch (error) {
        console.warn(
          `WSL command failed: ${cmd}`,
          error instanceof Error ? error.message : String(error)
        )
        continue
      }
    }

    return {
      success: false,
      distro: distro.name
    }
  }

  /**
   * 验证 WSL 中的 Claude
   */
  private async verifyClaudeInWSL(distroName: string, claudePath: string): Promise<boolean> {
    try {
      const cmd = `wsl -d ${distroName} -- "${claudePath}" --version`
      const result = await executeCommand(cmd, { timeout: 5000 })

      return result.exitCode === 0 && result.stdout.includes('claude')
    } catch (error) {
      console.warn(
        `Failed to verify Claude in WSL ${distroName}:`,
        error instanceof Error ? error.message : String(error)
      )
      return false
    }
  }

  /**
   * 获取 WSL 中 Claude 的版本
   */
  private async getClaudeVersionInWSL(
    distroName: string,
    claudePath: string
  ): Promise<string | null> {
    try {
      const cmd = `wsl -d ${distroName} -- "${claudePath}" --version`
      const result = await executeCommand(cmd, { timeout: 5000 })

      if (result.exitCode === 0) {
        return this.parseVersion(result.stdout)
      }
    } catch (error) {
      console.warn(
        `Failed to get Claude version in WSL ${distroName}:`,
        error instanceof Error ? error.message : String(error)
      )
    }

    return null
  }

  /**
   * 验证 Claude 可执行文件
   */
  async verify(path: string): Promise<boolean> {
    if (!this.wslDistro) {
      return false
    }

    return this.verifyClaudeInWSL(this.wslDistro, path)
  }

  /**
   * 执行 Claude 命令
   */
  async execute(
    args: string[],
    workingDir: string,
    options: ExecutionOptions = {}
  ): Promise<ProcessResult> {
    if (!this.claudePath || !this.wslDistro || !this.pathMapper) {
      throw new Error('WSL Claude not properly initialized')
    }

    const wslWorkingDir = this.pathMapper.windowsToWSL(workingDir)

    const wslCommand = [
      'wsl',
      '-d',
      this.wslDistro,
      '--cd',
      wslWorkingDir,
      '--',
      this.claudePath,
      ...args
    ].join(' ')

    console.log(`Executing WSL Claude command: ${wslCommand}`)

    return executeCommand(wslCommand, {
      cwd: workingDir,
      timeout: 300000, // 5 分钟默认超时
      ...options
    })
  }

  /**
   * 启动交互式 Claude 会话
   */
  async startInteractiveSession(workingDir: string, args: string[] = []): Promise<ChildProcess> {
    if (!this.claudePath || !this.wslDistro || !this.pathMapper) {
      throw new Error('WSL Claude not properly initialized')
    }

    const wslWorkingDir = this.pathMapper.windowsToWSL(workingDir)

    console.log(`Starting interactive WSL Claude session in ${wslWorkingDir}`)

    return spawnProcess(
      'wsl',
      ['-d', this.wslDistro, '--cd', wslWorkingDir, '--', this.claudePath, ...args],
      {
        cwd: workingDir
      }
    )
  }

  /**
   * 创建 WSL 不可用结果
   */
  private createWSLNotAvailableResult(): ClaudeDetectionResult {
    return {
      success: false,
      platform: 'win32',
      executionMethod: 'wsl',
      error: {
        type: 'WSL_NOT_AVAILABLE',
        message: 'WSL is not installed or not available',
        platform: 'win32'
      },
      suggestions: [
        '安装 WSL: wsl --install',
        '启用 Windows 功能: 适用于 Linux 的 Windows 子系统',
        '重启电脑以完成 WSL 安装',
        '安装推荐的 Ubuntu 发行版: wsl --install -d Ubuntu'
      ]
    }
  }

  /**
   * 创建 WSL 中未找到 Claude 的结果
   */
  private createWSLNotFoundResult(): ClaudeDetectionResult {
    return {
      success: false,
      platform: 'win32',
      executionMethod: 'wsl',
      error: {
        type: 'NOT_FOUND',
        message: 'Claude Code not found in any WSL distribution',
        platform: 'win32'
      },
      suggestions: [
        '在 WSL 中安装 Node.js: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -',
        '安装 npm: sudo apt-get install -y nodejs',
        '安装 Claude Code: npm install -g @anthropic-ai/claude-code',
        '验证安装: wsl -- claude --version',
        '确保 WSL 发行版正在运行'
      ]
    }
  }

  /**
   * 生成 Windows 特定的安装建议
   */
  protected generateInstallationSuggestions(): string[] {
    return [
      '安装 WSL（如果尚未安装）: wsl --install',
      '重启电脑以完成 WSL 安装',
      '在 WSL 中安装 Node.js 和 npm',
      '在 WSL 中安装 Claude Code: npm install -g @anthropic-ai/claude-code',
      '验证安装: wsl -- claude --version'
    ]
  }
}
