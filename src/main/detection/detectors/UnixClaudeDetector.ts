/**
 * Unix 平台 Claude 检测器（macOS 和 Linux）
 */

import { ChildProcess } from 'child_process'
import { PlatformClaudeDetector } from '../base/PlatformClaudeDetector'
import {
  executeCommand,
  getCommandPath,
  verifyExecutable,
  getProgramVersion,
  spawnProcess,
  resolveSymlink,
  extractFnmInfo
} from '../utils/execUtils'
import type { ClaudeDetectionResult, ProcessResult, ExecutionOptions } from '../types'

export class UnixClaudeDetector extends PlatformClaudeDetector {
  /**
   * 执行 Claude 检测
   */
  async detect(): Promise<ClaudeDetectionResult> {
    console.log('Starting Unix Claude detection...')

    // 跳过缓存检查，每次都重新检测以确保获取最新的安装信息

    // 1. Shell 环境检测（最可靠的方式）
    const shellResult = await this.detectViaShell()
    if (shellResult.success) {
      await this.cacheResult(shellResult)
      this.claudePath = shellResult.claudePath
      this.version = shellResult.version
      return shellResult
    }

    // 2. 直接执行尝试
    const directResult = await this.tryDirectExecution()
    if (directResult.success) {
      await this.cacheResult(directResult)
      this.claudePath = directResult.claudePath
      this.version = directResult.version
      return directResult
    }

    // 3. 检查用户配置
    const userResult = await this.checkUserConfig()
    if (userResult.success) {
      this.claudePath = userResult.claudePath
      this.version = userResult.version
      return userResult
    }

    // 5. 未找到 Claude
    console.log('Claude not found on Unix system')
    const notFoundResult = this.createNotFoundResult()
    await this.cacheResult(notFoundResult)
    return notFoundResult
  }

  /**
   * 通过 Shell 环境检测 Claude
   */
  private async detectViaShell(): Promise<ClaudeDetectionResult> {
    console.log('Detecting Claude via shell commands...')

    const commands = ['claude', 'claude-code']

    for (const cmd of commands) {
      try {
        const claudePath = await getCommandPath(cmd)
        if (claudePath && (await this.verify(claudePath))) {
          // 解析符号链接到实际路径
          const resolvedPath = await resolveSymlink(claudePath)
          const version = await getProgramVersion(claudePath)
          console.log(
            `Found Claude via shell: ${claudePath}, resolved to: ${resolvedPath}, version: ${version}`
          )

          // 提取 fnm 信息
          const fnmInfo = extractFnmInfo(resolvedPath)

          const result: ClaudeDetectionResult = {
            success: true,
            platform: process.platform as 'darwin' | 'linux',
            executionMethod: 'native',
            claudePath,
            version: version || 'unknown',
            detectionMethod: 'shell'
          }

          // 添加额外信息
          if (resolvedPath !== claudePath) {
            result.resolvedPath = resolvedPath
          }

          if (fnmInfo.isFromFnm) {
            result.metadata = {
              isFromFnm: true,
              nodeVersion: fnmInfo.nodeVersion,
              packageManager: 'fnm'
            }
          }

          return result
        }
      } catch (error) {
        console.warn(`Shell detection failed for ${cmd}:`, error.message)
        continue
      }
    }

    return {
      success: false,
      platform: process.platform as 'darwin' | 'linux',
      executionMethod: 'native'
    }
  }

  /**
   * 尝试直接执行检测
   */
  private async tryDirectExecution(): Promise<ClaudeDetectionResult> {
    console.log('Trying direct Claude execution...')

    const commands = ['claude', 'claude-code']

    for (const cmd of commands) {
      try {
        const result = await executeCommand(`${cmd} --version`, { timeout: 3000 })
        if (result.exitCode === 0 && result.stdout.includes('claude')) {
          const version = this.parseVersion(result.stdout)
          console.log(`Claude found via direct execution: ${cmd}, version: ${version}`)

          return {
            success: true,
            platform: process.platform as 'darwin' | 'linux',
            executionMethod: 'native',
            claudePath: cmd,
            version,
            detectionMethod: 'direct'
          }
        }
      } catch (error) {
        console.warn(`Direct execution failed for ${cmd}:`, error.message)
        continue
      }
    }

    return {
      success: false,
      platform: process.platform as 'darwin' | 'linux',
      executionMethod: 'native'
    }
  }

  /**
   * 检查用户配置的 Claude 路径
   */
  private async checkUserConfig(): Promise<ClaudeDetectionResult> {
    // TODO: 实现用户配置检查，从应用设置中读取用户自定义的 Claude 路径
    // 这将在后续的用户界面集成中实现
    return {
      success: false,
      platform: process.platform as 'darwin' | 'linux',
      executionMethod: 'native'
    }
  }

  /**
   * 验证 Claude 可执行文件
   */
  async verify(path: string): Promise<boolean> {
    try {
      const isExecutable = await verifyExecutable(path, '--version')
      if (!isExecutable) {
        return false
      }

      // 进一步验证是否确实是 Claude
      const version = await getProgramVersion(path)
      return version !== null
    } catch (error) {
      console.warn(`Failed to verify Claude at ${path}:`, error.message)
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
    if (!this.claudePath) {
      throw new Error('Claude not detected. Please run detection first.')
    }

    const command = `"${this.claudePath}" ${args.join(' ')}`
    console.log(`Executing Claude command: ${command}`)

    return executeCommand(command, {
      cwd: workingDir,
      timeout: 300000, // 5 分钟默认超时
      ...options
    })
  }

  /**
   * 启动交互式 Claude 会话
   */
  async startInteractiveSession(workingDir: string, args: string[] = []): Promise<ChildProcess> {
    if (!this.claudePath) {
      throw new Error('Claude not detected. Please run detection first.')
    }

    console.log(`Starting interactive Claude session in ${workingDir}`)

    return spawnProcess(this.claudePath, args, {
      cwd: workingDir
    })
  }

  /**
   * 生成平台特定的安装建议
   */
  protected generateInstallationSuggestions(): string[] {
    const platform = process.platform

    if (platform === 'darwin') {
      return [
        '使用 npm 安装: npm install -g @anthropic-ai/claude-code',
        '使用 Homebrew 安装: brew install claude-code',
        '确保 npm 全局 bin 目录在 PATH 中',
        '重启终端应用程序',
        '验证安装: claude --version'
      ]
    } else if (platform === 'linux') {
      return [
        '使用 npm 安装: npm install -g @anthropic-ai/claude-code',
        '或使用系统包管理器安装 Node.js',
        '检查 ~/.bashrc 或 ~/.zshrc 中的 PATH 配置',
        '重新加载 shell 配置: source ~/.bashrc',
        '验证安装: claude --version'
      ]
    }

    return super.generateInstallationSuggestions()
  }
}
