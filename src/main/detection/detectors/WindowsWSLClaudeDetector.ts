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
    console.log(wslInfo.distributions)
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

      // 列出发行版 - 尝试多种编码方式
      console.log('Listing WSL distributions...')
      const listResult = await this.executeWSLListCommand()

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
   * 执行 WSL 列表命令，尝试不同编码
   */
  private async executeWSLListCommand(): Promise<ProcessResult> {
    // 首先尝试使用 chcp 65001 强制 UTF-8 输出
    const commands = [
      'chcp 65001 >nul 2>&1 && wsl --list --verbose',
      'wsl --list --verbose'
    ]
    
    for (const command of commands) {
      try {
        console.log(`Trying WSL command: ${command}`)
        const result = await executeCommand(command, { 
          timeout: 10000,
          encoding: 'utf8'
        })
        
        if (result.exitCode === 0 && result.stdout) {
          console.log('WSL command succeeded')
          console.log('Raw output length:', result.stdout.length)
          console.log('Raw output sample:', JSON.stringify(result.stdout.substring(0, 100)))
          
          // 检查输出是否可用
          if (this.isValidWSLOutput(result.stdout)) {
            return result
          }
        }
      } catch (error) {
        console.warn(`WSL command failed: ${command}`, error)
        continue
      }
    }
    
    // 如果常规方法失败，尝试 PowerShell 包装
    try {
      console.log('Trying PowerShell wrapper for WSL command')
      const psCommand = `powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; wsl --list --verbose"`
      const result = await executeCommand(psCommand, { 
        timeout: 15000,
        encoding: 'utf8'
      })
      
      if (result.exitCode === 0 && result.stdout) {
        console.log('PowerShell WSL command succeeded')
        return result
      }
    } catch (error) {
      console.warn('PowerShell WSL command failed:', error)
    }
    
    // 最后尝试：使用 binary 模式并手动转换
    try {
      console.log('Trying binary mode with manual conversion')
      const result = await executeCommand('wsl --list --verbose', { 
        timeout: 10000,
        encoding: 'binary' as any
      })
      
      if (result.exitCode === 0 && result.stdout) {
        // 手动转换 UTF-16LE 到 UTF-8
        const converted = this.convertUTF16LEToUTF8(result.stdout)
        return {
          ...result,
          stdout: converted
        }
      }
    } catch (error) {
      console.warn('Binary mode WSL command failed:', error)
    }
    
    // 如果所有方法都失败，返回错误结果
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'Failed to execute WSL list command with any method'
    }
  }

  /**
   * 检查 WSL 输出是否有效
   */
  private isValidWSLOutput(output: string): boolean {
    // 检查是否包含预期的关键词
    const hasKeywords = output.toLowerCase().includes('name') || 
                       output.toLowerCase().includes('state') ||
                       /ubuntu|debian|fedora|opensuse|alpine/i.test(output)
    
    // 检查是否有过多的控制字符或空字节
    const controlCharRatio = (output.match(/[\x00-\x1F]/g) || []).length / output.length
    
    return hasKeywords && controlCharRatio < 0.5
  }

  /**
   * 手动转换 UTF-16LE 到 UTF-8
   */
  private convertUTF16LEToUTF8(binaryString: string): string {
    try {
      // 将 binary 字符串转换为 Buffer
      const buffer = Buffer.from(binaryString, 'binary')
      
      // 尝试 UTF-16LE 解码
      if (buffer.length % 2 === 0) {
        const utf16Result = buffer.toString('utf16le')
        
        // 移除可能的 BOM
        const cleaned = utf16Result.replace(/^\uFEFF/, '')
        
        console.log('UTF-16LE conversion result:', JSON.stringify(cleaned.substring(0, 100)))
        return cleaned
      }
    } catch (error) {
      console.warn('UTF-16LE conversion failed:', error)
    }
    
    // 如果转换失败，尝试直接清理 binary 字符串
    return binaryString.replace(/\x00/g, '')
  }

  /**
   * 解析 WSL 发行版列表
   */
  private parseWSLDistributions(output: string): WSLDistribution[] {
    // 智能编码检测和清理
    let cleanOutput = this.detectAndCleanWSLOutput(output)
    
    console.log('Cleaned output before line split:', JSON.stringify(cleanOutput))
    
    // 按行分割，保持原有的空白结构用于列解析
    const lines = cleanOutput.split('\n').filter((line) => line.trim())
    console.log('Cleaned WSL output lines:', lines)
    console.log('Number of lines:', lines.length)
    
    const distributions: WSLDistribution[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      console.log(`Processing line ${i}:`, JSON.stringify(line))
      
      // 跳过标题行和空行
      if (this.isHeaderLine(line) || !line.trim()) {
        console.log(`Skipping line ${i} (header or empty)`)
        continue
      }

      try {
        const distro = this.parseDistributionLine(line)
        if (distro) {
          distributions.push(distro)
          console.log(`Parsed distribution: ${distro.name} (${distro.state}, v${distro.version})`)
        } else {
          console.log(`Failed to parse distribution from line ${i}`)
        }
      } catch (error) {
        console.warn(`Failed to parse WSL distribution line: ${line}`, error)
      }
    }

    console.log(`Found ${distributions.length} WSL distributions`)
    return distributions
  }

  /**
   * 检测并清理 WSL 输出
   */
  private detectAndCleanWSLOutput(output: string): string {
    // 检测是否为 UTF-16 编码（包含大量空字符）
    if (output.includes('\x00')) {
      console.log('Detected UTF-16 encoded output, converting...')
      
      // 直接移除空字符
      let cleaned = output.replace(/\x00/g, '')
      
      console.log('After removing null bytes:', JSON.stringify(cleaned.substring(0, 100)))
      
      output = cleaned
    }

    // 标准化换行符并清理空格
    const result = output
      .replace(/\r\n/g, '\n') // Windows 换行符
      .replace(/\r/g, '\n') // Mac 换行符
      .replace(/[ \t]+/g, ' ') // 压缩空格和制表符
      .trim()
      
    console.log('Final cleaned output:', JSON.stringify(result.substring(0, 200)))
    return result
  }

  /**
   * 检测是否包含乱码文本
   */
  private hasGarbledText(text: string): boolean {
    // 检查是否包含过多的特殊字符或控制字符
    const specialCharCount = (text.match(/[\u0000-\u001F\u007F-\u009F]/g) || []).length
    const totalLength = text.length
    
    return totalLength > 0 && (specialCharCount / totalLength) > 0.1
  }

  /**
   * 检查是否为标题行
   */
  private isHeaderLine(line: string): boolean {
    const upperLine = line.toUpperCase()
    return upperLine.includes('NAME') && 
           (upperLine.includes('STATE') || upperLine.includes('VERSION'))
  }

  /**
   * 解析单个发行版行
   */
  private parseDistributionLine(line: string): WSLDistribution | null {
    const trimmed = line.trim()
    const isDefault = trimmed.includes('*')

    // 移除 * 标记并分割
    const cleanLine = trimmed.replace(/[*]/g, '').trim()
    const parts = cleanLine.split(/\s+/).filter(part => part.length > 0)

    // 基本格式: Name State Version
    if (parts.length >= 2) {
      const name = parts[0]
      let state = parts[1] as 'Running' | 'Stopped'
      let version = parts[2] || '2'

      // 处理不同的状态表示
      state = this.normalizeState(state)
      
      // 验证状态值
      if (['Running', 'Stopped'].includes(state) && name && !this.isInvalidName(name)) {
        return {
          name,
          version,
          state,
          isDefault
        }
      }
    }

    return null
  }

  /**
   * 标准化状态字符串
   */
  private normalizeState(stateStr: string): 'Running' | 'Stopped' {
    const normalized = stateStr.toLowerCase().trim()
    
    // 支持多种状态表示
    if (normalized.includes('run') || normalized === 'started') {
      return 'Running'
    } else if (normalized.includes('stop') || normalized.includes('halt') || normalized === 'exited') {
      return 'Stopped'
    }
    
    // 默认假设是 Stopped
    return 'Stopped'
  }

  /**
   * 检查是否为无效的发行版名称
   */
  private isInvalidName(name: string): boolean {
    const invalidPatterns = [
      /^-+$/, // 只包含横线
      /^=+$/, // 只包含等号
      /^\s*$/, // 只包含空格
      /^[0-9]+$/, // 只包含数字
    ]
    
    return invalidPatterns.some(pattern => pattern.test(name)) || name.length < 2
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
    // 尝试多种命令组合来找到 Claude
    const commands = [
      // 1. 直接检测
      `wsl -d ${distro.name} -- which claude`,
      `wsl -d ${distro.name} -- command -v claude`,
      
      // 2. 通过登录 shell 执行（会加载 .bashrc/.zshrc 中的 fnm 等初始化）
      `wsl -d ${distro.name} -- bash -l -c "which claude"`,
      `wsl -d ${distro.name} -- bash -l -c "command -v claude"`,
      `wsl -d ${distro.name} -- zsh -l -c "which claude"`,
      `wsl -d ${distro.name} -- zsh -l -c "command -v claude"`,
      
      // 3. 尝试通过 fnm 环境检测
      `wsl -d ${distro.name} -- bash -l -c "eval \\"\\$(fnm env --use-on-cd)\\" && which claude"`,
      `wsl -d ${distro.name} -- bash -l -c "source ~/.bashrc && which claude"`,
      
      // 4. 检查常见的全局 npm 包路径
      `wsl -d ${distro.name} -- bash -l -c "ls ~/.local/share/fnm/*/bin/claude 2>/dev/null | head -1"`,
      `wsl -d ${distro.name} -- bash -l -c "find ~/.local/share/fnm -name claude -type f 2>/dev/null | head -1"`,
      `wsl -d ${distro.name} -- bash -l -c "find /usr/local/bin -name claude 2>/dev/null | head -1"`,
    ]

    for (const cmd of commands) {
      try {
        console.log(`Executing: ${cmd}`)
        const result = await executeCommand(cmd, { timeout: 15000 })

        if (result.exitCode === 0) {
          const claudePath = result.stdout.trim()
          console.log(`Command succeeded with output: ${claudePath}`)

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
    const commands = [
      // 1. 直接验证
      `wsl -d ${distroName} -- "${claudePath}" --version`,
      
      // 2. 通过登录 shell 验证
      `wsl -d ${distroName} -- bash -l -c "\"${claudePath}\" --version"`,
      `wsl -d ${distroName} -- bash -l -c "source ~/.bashrc && \"${claudePath}\" --version"`,
      
      // 3. 通过 fnm 环境验证
      `wsl -d ${distroName} -- bash -l -c "eval \\"\\$(fnm env --use-on-cd)\\" && \"${claudePath}\" --version"`,
    ]

    for (const cmd of commands) {
      try {
        console.log(`Verifying Claude with: ${cmd}`)
        const result = await executeCommand(cmd, { timeout: 10000 })

        if (result.exitCode === 0 && result.stdout.toLowerCase().includes('claude')) {
          console.log(`Claude verification successful: ${result.stdout.trim()}`)
          return true
        }
      } catch (error) {
        console.warn(
          `Claude verification failed with command: ${cmd}`,
          error instanceof Error ? error.message : String(error)
        )
        continue
      }
    }

    return false
  }

  /**
   * 获取 WSL 中 Claude 的版本
   */
  private async getClaudeVersionInWSL(
    distroName: string,
    claudePath: string
  ): Promise<string | null> {
    const commands = [
      // 1. 直接获取版本
      `wsl -d ${distroName} -- "${claudePath}" --version`,
      
      // 2. 通过登录 shell 获取
      `wsl -d ${distroName} -- bash -l -c "\"${claudePath}\" --version"`,
      `wsl -d ${distroName} -- bash -l -c "source ~/.bashrc && \"${claudePath}\" --version"`,
      
      // 3. 通过 fnm 环境获取
      `wsl -d ${distroName} -- bash -l -c "eval \\"\\$(fnm env --use-on-cd)\\" && \"${claudePath}\" --version"`,
    ]

    for (const cmd of commands) {
      try {
        console.log(`Getting Claude version with: ${cmd}`)
        const result = await executeCommand(cmd, { timeout: 10000 })

        if (result.exitCode === 0) {
          const version = this.parseVersion(result.stdout)
          if (version) {
            console.log(`Claude version detected: ${version}`)
            return version
          }
        }
      } catch (error) {
        console.warn(
          `Failed to get Claude version with: ${cmd}`,
          error instanceof Error ? error.message : String(error)
        )
        continue
      }
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
    const argsString = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')

    // 尝试多种执行方式，优先使用能够正确加载 fnm 环境的方法
    const commands = [
      // 1. 通过登录 shell 执行（推荐，会加载完整环境）
      `wsl -d ${this.wslDistro} --cd "${wslWorkingDir}" -- bash -l -c "source ~/.bashrc && \"${this.claudePath}\" ${argsString}"`,
      
      // 2. 通过 fnm 环境执行
      `wsl -d ${this.wslDistro} --cd "${wslWorkingDir}" -- bash -l -c "eval \\"\\$(fnm env --use-on-cd)\\" && \"${this.claudePath}\" ${argsString}"`,
      
      // 3. 直接执行（备用）
      `wsl -d ${this.wslDistro} --cd "${wslWorkingDir}" -- "${this.claudePath}" ${argsString}`,
    ]

    for (const wslCommand of commands) {
      try {
        console.log(`Attempting to execute WSL Claude command: ${wslCommand}`)

        return await executeCommand(wslCommand, {
          cwd: workingDir,
          timeout: 300000, // 5 分钟默认超时
          ...options
        })
      } catch (error) {
        console.warn(`WSL Claude execution failed with command: ${wslCommand}`, error)
        continue
      }
    }

    throw new Error('All WSL Claude execution methods failed')
  }

  /**
   * 启动交互式 Claude 会话
   */
  async startInteractiveSession(workingDir: string, args: string[] = []): Promise<ChildProcess> {
    if (!this.claudePath || !this.wslDistro || !this.pathMapper) {
      throw new Error('WSL Claude not properly initialized')
    }

    const wslWorkingDir = this.pathMapper.windowsToWSL(workingDir)
    const argsString = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ')

    console.log(`Starting interactive WSL Claude session in ${wslWorkingDir}`)

    // 优先使用登录 shell 来启动交互式会话，确保加载完整的环境
    const command = 'wsl'
    const shellArgs = [
      '-d', this.wslDistro,
      '--cd', wslWorkingDir,
      '--',
      'bash', '-l', '-c',
      `source ~/.bashrc && "${this.claudePath}" ${argsString}`
    ]

    try {
      return spawnProcess(command, shellArgs, {
        cwd: workingDir
      })
    } catch (error) {
      console.warn('Failed to start interactive session with login shell, trying fallback')
      
      // 备用方案：直接启动
      return spawnProcess(
        'wsl',
        ['-d', this.wslDistro, '--cd', wslWorkingDir, '--', this.claudePath, ...args],
        {
          cwd: workingDir
        }
      )
    }
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
