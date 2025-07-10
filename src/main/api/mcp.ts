import { ipcMain, dialog } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { spawn } from 'child_process'
import { claudeBinaryManager } from '../detection/ClaudeBinaryManagerAdapter'

/**
 * MCP Error Types
 */
export enum MCPErrorType {
  CLAUDE_NOT_INSTALLED = 'claude_not_installed',
  COMMAND_FAILED = 'command_failed',
  NETWORK_ERROR = 'network_error',
  PERMISSION_DENIED = 'permission_denied',
  CONFIG_ERROR = 'config_error',
  SERVER_NOT_FOUND = 'server_not_found'
}

/**
 * MCP Operation Result
 */
export interface MCPOperationResult<T> {
  success: boolean
  data?: T
  error?: {
    type: MCPErrorType
    message: string
    suggestions: string[]
    technical_details?: string
  }
}

/**
 * MCP Server Configuration
 */
export interface MCPServer {
  name: string
  transport: string
  command?: string
  args: string[]
  env: Record<string, string>
  url?: string
  scope: string
  is_active: boolean
  status: ServerStatus
}

export interface ServerStatus {
  running: boolean
  error?: string
  last_checked?: number
}

export interface AddServerResult {
  success: boolean
  message: string
  server_name?: string
}

export interface ImportResult {
  imported_count: number
  failed_count: number
  servers: ImportServerResult[]
}

export interface ImportServerResult {
  name: string
  success: boolean
  error?: string
}

/**
 * MCP Management IPC handlers
 */
export function setupMCPHandlers() {
  // Add a new MCP server
  ipcMain.handle(
    'mcp-add',
    async (
      _,
      {
        name,
        transport,
        command,
        args,
        env,
        url,
        scope
      }: {
        name: string
        transport: string
        command?: string
        args: string[]
        env: Record<string, string>
        url?: string
        scope: string
      }
    ) => {
      console.log('Main: mcp-add called with', { name, transport, scope })
      try {
        const cmdArgs = ['mcp', 'add']

        // Add scope flag
        cmdArgs.push('-s', scope)

        // Add transport flag for SSE
        if (transport === 'sse') {
          cmdArgs.push('--transport', 'sse')
        }

        // Add environment variables
        for (const [key, value] of Object.entries(env)) {
          cmdArgs.push('-e', `${key}=${value}`)
        }

        // Add name
        cmdArgs.push(name)

        // Add command/URL based on transport
        if (transport === 'stdio') {
          if (!command) {
            return {
              success: false,
              message: 'Command is required for stdio transport',
              server_name: undefined
            }
          }

          // Add "--" separator before command to prevent argument parsing issues
          if (args.length > 0 || command.includes('-')) {
            cmdArgs.push('--')
          }
          cmdArgs.push(command)
          cmdArgs.push(...args)
        } else if (transport === 'sse') {
          if (!url) {
            return {
              success: false,
              message: 'URL is required for SSE transport',
              server_name: undefined
            }
          }
          cmdArgs.push(url)
        }

        const result = await executeClaudeMCPCommand(cmdArgs)
        if (result.success && result.data) {
          return {
            success: true,
            message: result.data.trim(),
            server_name: name
          }
        } else {
          return {
            success: false,
            message: result.error?.message || 'Unknown error',
            server_name: undefined,
            error: result.error
          }
        }
      } catch (error) {
        console.error('Error adding MCP server:', error)
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          server_name: undefined
        }
      }
    }
  )

  // List all configured MCP servers
  ipcMain.handle('mcp-list', async () => {
    console.log('Main: mcp-list called')
    const result = await executeClaudeMCPCommand(['mcp', 'list'])

    if (result.success && result.data) {
      const servers = parseMCPServerList(result.data)
      console.log('Main: mcp-list returning', servers.length, 'servers')
      return servers
    } else {
      console.error('Error listing MCP servers:', result.error)
      return []
    }
  })

  // Get a specific MCP server
  ipcMain.handle('mcp-get', async (_, name: string) => {
    console.log('Main: mcp-get called with', name)
    const result = await executeClaudeMCPCommand(['mcp', 'get', name])

    if (result.success && result.data) {
      return {
        success: true,
        data: parseMCPServerDetails(result.data, name),
        error: undefined
      }
    } else {
      console.error('Error getting MCP server:', result.error)
      return {
        success: false,
        data: null,
        error: result.error
      }
    }
  })

  // Remove an MCP server
  ipcMain.handle('mcp-remove', async (_, { name }: { name: string }) => {
    console.log('Main: mcp-remove called with', name, 'type:', typeof name)
    console.log('Main: mcp-remove name is:', JSON.stringify(name))
    const result = await executeClaudeMCPCommand(['mcp', 'remove', name])

    if (result.success && result.data) {
      return {
        success: true,
        message: result.data.trim(),
        error: undefined
      }
    } else {
      console.error('Error removing MCP server:', result.error)
      return {
        success: false,
        message: result.error?.message || 'Failed to remove MCP server',
        error: result.error
      }
    }
  })

  // Test MCP server connection
  ipcMain.handle('mcp-test', async (_, name: string) => {
    console.log('Main: mcp-test called with', name)
    const result = await executeClaudeMCPCommand(['mcp', 'test', name])

    if (result.success && result.data) {
      return {
        success: true,
        message: result.data.trim(),
        error: undefined
      }
    } else {
      console.error('Error testing MCP server:', result.error)
      return {
        success: false,
        message: result.error?.message || 'Unknown error',
        error: result.error
      }
    }
  })

  // Add MCP server from JSON configuration
  ipcMain.handle(
    'mcp-add-json',
    async (
      _,
      {
        name,
        jsonConfig,
        scope
      }: {
        name: string
        jsonConfig: string
        scope: string
      }
    ) => {
      console.log('Main: mcp-add-json called with', { name, scope })
      try {
        // Parse the JSON config to validate it
        const config = JSON.parse(jsonConfig)

        const cmdArgs = ['mcp', 'add', '-s', scope, '--json', name, jsonConfig]
        const output = await executeClaudeMCPCommandLegacy(cmdArgs)

        return {
          success: true,
          message: output.trim(),
          server_name: name
        }
      } catch (error) {
        console.error('Error adding MCP server from JSON:', error)
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          server_name: undefined
        }
      }
    }
  )

  // Import servers from Claude Desktop configuration
  ipcMain.handle(
    'mcp-import-from-claude-desktop',
    async (_, { scope, selectedServers }: { scope: string; selectedServers?: string[] }) => {
      console.log('Main: mcp-import-from-claude-desktop called with scope', scope)
      try {
        // Determine correct Claude Desktop config path based on platform
        let claudeDesktopConfigPath: string

        if (process.platform === 'darwin') {
          // macOS
          claudeDesktopConfigPath = join(
            homedir(),
            'Library',
            'Application Support',
            'Claude',
            'claude_desktop_config.json'
          )
        } else if (process.platform === 'linux' || process.platform === 'win32') {
          // Linux/WSL
          claudeDesktopConfigPath = join(
            homedir(),
            '.config',
            'Claude',
            'claude_desktop_config.json'
          )
        } else {
          throw new Error('Import from Claude Desktop is only supported on macOS and Linux/WSL')
        }

        let configExists = false
        try {
          await fs.access(claudeDesktopConfigPath)
          configExists = true
        } catch {
          // File doesn't exist
        }

        if (!configExists) {
          console.log('Claude Desktop config file not found at:', claudeDesktopConfigPath)
          return {
            imported_count: 0,
            failed_count: 0,
            servers: []
          }
        }

        // Read and parse the config file
        const configContent = await fs.readFile(claudeDesktopConfigPath, 'utf-8')
        const config = JSON.parse(configContent)

        const servers: ImportServerResult[] = []
        let importedCount = 0
        let failedCount = 0

        console.log('Claude Desktop config loaded:', {
          hasServers: !!config.mcpServers,
          serverCount: config.mcpServers ? Object.keys(config.mcpServers).length : 0,
          selectedServers: selectedServers?.length || 'all'
        })

        if (config.mcpServers) {
          for (const [serverName, serverConfig] of Object.entries(
            config.mcpServers as Record<string, any>
          )) {
            // Skip if selectedServers is specified and this server is not in the selection
            if (
              selectedServers &&
              selectedServers.length > 0 &&
              !selectedServers.includes(serverName)
            ) {
              continue
            }
            try {
              // Convert Claude Desktop format to our format
              const args = ['mcp', 'add', '-s', scope]

              // Add environment variables if present
              if (serverConfig.env) {
                for (const [key, value] of Object.entries(serverConfig.env)) {
                  args.push('-e', `${key}=${value}`)
                }
              }

              args.push(serverName)

              if (serverConfig.command) {
                args.push('--')
                args.push(serverConfig.command)
                if (serverConfig.args) {
                  args.push(...serverConfig.args)
                }
              }

              await executeClaudeMCPCommandLegacy(args)

              servers.push({
                name: serverName,
                success: true,
                error: undefined
              })
              importedCount++
            } catch (error) {
              servers.push({
                name: serverName,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
              failedCount++
            }
          }
        }

        return {
          imported_count: importedCount,
          failed_count: failedCount,
          servers
        }
      } catch (error) {
        console.error('Error importing from Claude Desktop:', error)
        throw new Error('Failed to import from Claude Desktop')
      }
    }
  )

  // Export MCP configuration to Claude Desktop format
  ipcMain.handle('mcp-export-to-claude-desktop', async () => {
    console.log('Main: mcp-export-to-claude-desktop called')
    try {
      const servers = await parseMCPServerList(await executeClaudeMCPCommandLegacy(['mcp', 'list']))

      const mcpServers: Record<string, any> = {}

      for (const server of servers) {
        if (server.transport === 'stdio' && server.command) {
          mcpServers[server.name] = {
            command: server.command,
            args: server.args,
            env: server.env
          }
        }
      }

      const config = {
        mcpServers
      }

      // Write to Claude Desktop config location
      const claudeDesktopDir = join(homedir(), '.claude_desktop')
      const configPath = join(claudeDesktopDir, 'config.json')

      try {
        await fs.mkdir(claudeDesktopDir, { recursive: true })
      } catch {
        // Directory already exists
      }

      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      return {
        success: true,
        message: `Exported ${Object.keys(mcpServers).length} servers to Claude Desktop config`,
        exported_count: Object.keys(mcpServers).length
      }
    } catch (error) {
      console.error('Error exporting to Claude Desktop:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        exported_count: 0
      }
    }
  })

  // Get project-specific MCP configuration (.mcp.json)
  ipcMain.handle('mcp-get-project-config', async (_, projectPath: string) => {
    console.log('Main: mcp-get-project-config called with', projectPath)
    try {
      const mcpConfigPath = join(projectPath, '.mcp.json')

      try {
        const configContent = await fs.readFile(mcpConfigPath, 'utf-8')
        return JSON.parse(configContent)
      } catch {
        // File doesn't exist or is invalid
        return { mcpServers: {} }
      }
    } catch (error) {
      console.error('Error getting project MCP config:', error)
      return { mcpServers: {} }
    }
  })

  // Set project-specific MCP configuration (.mcp.json)
  ipcMain.handle(
    'mcp-set-project-config',
    async (
      _,
      {
        projectPath,
        config
      }: {
        projectPath: string
        config: any
      }
    ) => {
      console.log('Main: mcp-set-project-config called with', projectPath)
      try {
        const mcpConfigPath = join(projectPath, '.mcp.json')
        await fs.writeFile(mcpConfigPath, JSON.stringify(config, null, 2))
        return 'Project MCP configuration saved successfully'
      } catch (error) {
        console.error('Error setting project MCP config:', error)
        throw new Error('Failed to save project MCP configuration')
      }
    }
  )
}

/**
 * Create error suggestions based on error type
 */
function createErrorSuggestions(errorType: MCPErrorType, errorMessage: string): string[] {
  switch (errorType) {
    case MCPErrorType.CLAUDE_NOT_INSTALLED:
      return [
        '安装 Claude Code CLI: npm install -g @anthropic-ai/claude-code',
        '检查 Claude Code 是否在 PATH 中',
        '尝试重启应用程序',
        '访问 https://docs.anthropic.com/claude/reference/claude-cli 获取安装指南'
      ]
    case MCPErrorType.COMMAND_FAILED:
      return [
        '检查 MCP 服务器配置是否正确',
        '验证命令参数格式',
        '确保有足够的权限执行操作',
        '查看技术详情获取更多信息'
      ]
    case MCPErrorType.NETWORK_ERROR:
      return ['检查网络连接', '验证服务器 URL 是否正确', '尝试重新连接', '检查防火墙设置']
    case MCPErrorType.PERMISSION_DENIED:
      return [
        '以管理员身份运行应用程序',
        '检查文件夹权限',
        '确保有权限访问配置文件',
        '验证用户权限设置'
      ]
    case MCPErrorType.CONFIG_ERROR:
      return [
        '检查配置文件格式',
        '验证 JSON 语法是否正确',
        '确保所有必需字段都已填写',
        '查看示例配置文档'
      ]
    case MCPErrorType.SERVER_NOT_FOUND:
      return [
        '检查服务器名称是否正确',
        '验证服务器是否已配置',
        '刷新服务器列表',
        '重新添加服务器配置'
      ]
    default:
      return ['重新尝试操作', '检查应用程序日志', '重启应用程序', '联系技术支持']
  }
}

/**
 * Execute Claude MCP command with enhanced error handling
 */
async function executeClaudeMCPCommand(args: string[]): Promise<MCPOperationResult<string>> {
  return new Promise(async (resolve) => {
    try {
      const binaryPath = await claudeBinaryManager.findClaudeBinary()

      const child = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            data: stdout
          })
        } else {
          const errorMessage = stderr || 'Unknown error'
          let errorType = MCPErrorType.COMMAND_FAILED

          // 分析错误类型
          if (errorMessage.includes('permission denied') || errorMessage.includes('EACCES')) {
            errorType = MCPErrorType.PERMISSION_DENIED
          } else if (
            errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection')
          ) {
            errorType = MCPErrorType.NETWORK_ERROR
          } else if (
            errorMessage.includes('not found') ||
            errorMessage.includes('does not exist')
          ) {
            errorType = MCPErrorType.SERVER_NOT_FOUND
          } else if (
            errorMessage.includes('json') ||
            errorMessage.includes('config') ||
            errorMessage.includes('parse')
          ) {
            errorType = MCPErrorType.CONFIG_ERROR
          }

          resolve({
            success: false,
            error: {
              type: errorType,
              message: errorMessage,
              suggestions: createErrorSuggestions(errorType, errorMessage),
              technical_details: `Command: ${args.join(' ')}\nExit code: ${code}\nStderr: ${stderr}`
            }
          })
        }
      })

      child.on('error', (error) => {
        resolve({
          success: false,
          error: {
            type: MCPErrorType.COMMAND_FAILED,
            message: error.message,
            suggestions: createErrorSuggestions(MCPErrorType.COMMAND_FAILED, error.message),
            technical_details: `Command: ${args.join(' ')}\nError: ${error.message}`
          }
        })
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorType = errorMessage.includes('Claude Code not found')
        ? MCPErrorType.CLAUDE_NOT_INSTALLED
        : MCPErrorType.COMMAND_FAILED

      resolve({
        success: false,
        error: {
          type: errorType,
          message: errorMessage,
          suggestions: createErrorSuggestions(errorType, errorMessage),
          technical_details: `Command: ${args.join(' ')}\nError: ${errorMessage}`
        }
      })
    }
  })
}

/**
 * Legacy executeClaudeMCPCommand for backward compatibility
 */
async function executeClaudeMCPCommandLegacy(args: string[]): Promise<string> {
  const result = await executeClaudeMCPCommand(args)
  if (result.success && result.data) {
    return result.data
  } else {
    throw new Error(result.error?.message || 'Unknown error')
  }
}

/**
 * Parse MCP server list output from Claude CLI
 */
function parseMCPServerList(output: string): MCPServer[] {
  const servers: MCPServer[] = []
  const trimmed = output.trim()

  // Check if no servers are configured
  if (trimmed.includes('No MCP servers configured') || trimmed === '') {
    console.log('parseMCPServerList: No servers configured')
    return servers
  }

  // Parse the text output
  const lines = trimmed.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Check if this line starts a new server entry
    const colonPos = line.indexOf(':')
    if (colonPos > 0) {
      const potentialName = line.slice(0, colonPos).trim()

      // Server names typically don't contain '/' or '\'
      if (!potentialName.includes('/') && !potentialName.includes('\\')) {
        const name = potentialName
        const restOfLine = line.slice(colonPos + 1).trim()

        let command = ''
        let args: string[] = []
        let transport = 'stdio'
        let url: string | undefined

        // Parse the command/URL from the rest of the line and subsequent lines
        let fullCommand = restOfLine
        i++

        // Check if the command continues on the next line (indented)
        while (i < lines.length && lines[i].startsWith('  ')) {
          fullCommand += ' ' + lines[i].trim()
          i++
        }

        // Parse the command
        if (fullCommand.startsWith('http://') || fullCommand.startsWith('https://')) {
          transport = 'sse'
          // Clean up URL by removing transport type annotations like (HTTP) or (SSE)
          url = fullCommand.replace(/\s+\((HTTP|SSE)\)$/, '')
        } else {
          const parts = fullCommand.split(/\s+/)
          if (parts.length > 0) {
            command = parts[0]
            args = parts.slice(1)
          }
        }

        const server = {
          name,
          transport,
          command: command || undefined,
          args,
          env: {}, // Environment variables aren't shown in list output
          url,
          scope: 'user', // Default scope, actual scope isn't shown in list
          is_active: true,
          status: {
            running: false,
            last_checked: Date.now()
          }
        }

        servers.push(server)

        continue
      }
    }

    i++
  }

  return servers
}

/**
 * Parse MCP server details from Claude CLI get command
 */
function parseMCPServerDetails(output: string, name: string): MCPServer {
  const lines = output.trim().split('\n')

  let command: string | undefined
  let args: string[] = []
  let transport = 'stdio'
  let url: string | undefined
  let env: Record<string, string> = {}

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('Command:')) {
      const commandLine = trimmedLine.slice(8).trim()
      if (commandLine.startsWith('http://') || commandLine.startsWith('https://')) {
        transport = 'sse'
        url = commandLine
      } else {
        const parts = commandLine.split(/\s+/)
        command = parts[0]
        args = parts.slice(1)
      }
    } else if (trimmedLine.startsWith('Environment:')) {
      // Parse environment variables if shown
      // This is a simplified parser - actual format may vary
    }
  }

  return {
    name,
    transport,
    command,
    args,
    env,
    url,
    scope: 'user', // Default scope
    is_active: true,
    status: {
      running: false,
      last_checked: Date.now()
    }
  }
}
