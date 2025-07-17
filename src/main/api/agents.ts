import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { agentService, agentRunService } from '../database/services'
import { processManager } from '../process/ProcessManager'
import { claudeBinaryManager } from '../detection/ClaudeBinaryManagerAdapter'

/**
 * Agent Management IPC handlers
 */
export function setupAgentsHandlers() {
  // List all agents
  ipcMain.handle('list-agents', async () => {
    console.log('Main: list-agents called')
    try {
      return await agentService.findAll()
    } catch (error) {
      console.error('Error listing agents:', error)
      return []
    }
  })

  // Get a single agent by ID
  ipcMain.handle('get-agent', async (_, id: number) => {
    console.log('Main: get-agent called with', id)
    try {
      return await agentService.findById(id)
    } catch (error) {
      console.error('Error getting agent:', error)
      throw new Error('Failed to get agent')
    }
  })

  // Create a new agent
  ipcMain.handle(
    'create-agent',
    async (
      _,
      agentData: {
        name: string
        icon: string
        systemPrompt: string
        defaultTask?: string
        model?: string
        enable_file_read?: boolean
        enable_file_write?: boolean
        enable_network?: boolean
        hooks?: string
      }
    ) => {
      console.log('Main: create-agent called with', agentData)
      try {
        // 转换为数据库需要的 snake_case 格式
        const dbData = {
          name: agentData.name,
          icon: agentData.icon,
          system_prompt: agentData.systemPrompt,
          default_task: agentData.defaultTask,
          model: agentData.model,
          enable_file_read: agentData.enable_file_read,
          enable_file_write: agentData.enable_file_write,
          enable_network: agentData.enable_network,
          hooks: agentData.hooks
        }
        return await agentService.create(dbData)
      } catch (error) {
        console.error('Error creating agent:', error)
        throw new Error('Failed to create agent')
      }
    }
  )

  // Update an existing agent
  ipcMain.handle(
    'update-agent',
    async (
      _,
      id: number,
      agentData: {
        name: string
        icon: string
        system_prompt: string
        default_task?: string
        model?: string
        enable_file_read?: boolean
        enable_file_write?: boolean
        enable_network?: boolean
        hooks?: string
      }
    ) => {
      console.log('Main: update-agent called with', id, agentData)
      try {
        return await agentService.update(id, agentData)
      } catch (error) {
        console.error('Error updating agent:', error)
        throw new Error('Failed to update agent')
      }
    }
  )

  // Delete an agent
  ipcMain.handle('delete-agent', async (_, id: number) => {
    console.log('Main: delete-agent called with', id)
    try {
      await agentService.delete(id)
      return 'Agent deleted successfully'
    } catch (error) {
      console.error('Error deleting agent:', error)
      throw new Error('Failed to delete agent')
    }
  })

  // Execute an agent
  ipcMain.handle(
    'execute-agent',
    async (
      _,
      {
        agentId,
        projectPath,
        task,
        model
      }: {
        agentId: number
        projectPath: string
        task: string
        model?: string
      }
    ) => {
      console.log('Main: execute-agent called with', {
        agentId,
        projectPath,
        projectPathType: typeof projectPath,
        task,
        model
      })

      // Validate projectPath
      if (typeof projectPath !== 'string') {
        throw new Error(`Invalid projectPath: expected string, got ${typeof projectPath}`)
      }

      if (!projectPath.trim()) {
        throw new Error('Invalid projectPath: path cannot be empty')
      }

      const normalizedProjectPath = projectPath.trim()

      try {
        // Get the agent from database
        const agent = await agentService.findById(agentId)
        if (!agent) {
          throw new Error('Agent not found')
        }

        const executionModel = model || agent.model || 'sonnet'

        // Create .claude/settings.json with agent hooks if it doesn't exist
        if (agent.hooks) {
          const claudeDir = join(normalizedProjectPath, '.claude')
          const settingsPath = join(claudeDir, 'settings.json')

          try {
            await fs.access(claudeDir)
          } catch {
            await fs.mkdir(claudeDir, { recursive: true })
          }

          try {
            await fs.access(settingsPath)
          } catch {
            // Settings file doesn't exist, create it with hooks
            const hooks = JSON.parse(agent.hooks)
            const settings = { hooks }
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
          }
        }

        // Create a new run record
        const agentRun = await agentRunService.create({
          agent_id: agentId,
          agent_name: agent.name,
          agent_icon: agent.icon,
          task,
          model: executionModel,
          project_path: normalizedProjectPath,
          session_id: '',
          status: 'pending'
        })

        // Find Claude binary
        const binaryPath = await claudeBinaryManager.findClaudeBinary()

        // Build arguments for Claude Code
        const args = [
          '-p',
          task,
          '--system-prompt',
          agent.system_prompt,
          '--model',
          executionModel,
          '--output-format',
          'stream-json',
          '--verbose',
          '--dangerously-skip-permissions'
        ]

        console.log('Agent execution parameters:', {
          agentId,
          projectPath: normalizedProjectPath,
          task: task.substring(0, 50) + (task.length > 50 ? '...' : ''),
          model: executionModel,
          binaryPath,
          systemPromptLength: agent.system_prompt?.length || 0,
          systemPromptPreview: agent.system_prompt?.substring(0, 100) + '...'
        })

        console.log(
          'Final args array:',
          args.map(
            (arg, i) =>
              `${i}: ${typeof arg === 'string' ? arg.substring(0, 50) + (arg.length > 50 ? '...' : '') : arg}`
          )
        )

        // Register the process with the process manager
        const runId = await processManager.registerAgentProcess(
          agentRun.id!,
          agent.name,
          normalizedProjectPath,
          task,
          executionModel,
          binaryPath,
          args,
          {}
        )

        return { success: true, runId, message: 'Agent execution started' }
      } catch (error) {
        console.error('Error executing agent:', error)
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  )

  // Kill a running agent session
  ipcMain.handle('kill-agent-session', async (_, runId: number) => {
    console.log('Main: kill-agent-session called with', runId)
    try {
      const success = await processManager.killProcess(runId)

      if (success) {
        // Update the run record status
        await agentRunService.updateStatus(runId, 'cancelled')
      }

      return {
        success,
        message: success ? 'Process cancelled successfully' : 'Failed to cancel process'
      }
    } catch (error) {
      console.error('Error cancelling agent session:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // List agent runs (optionally filtered by agent_id)
  ipcMain.handle('list-agent-runs', async (_, agentId?: number) => {
    console.log('Main: list-agent-runs called with', agentId)
    try {
      if (agentId) {
        return await agentRunService.findByAgentId(agentId)
      }
      return await agentRunService.findAll()
    } catch (error) {
      console.error('Error listing agent runs:', error)
      return []
    }
  })

  // Get a single agent run by ID
  ipcMain.handle('get-agent-run', async (_, id: number) => {
    console.log('Main: get-agent-run called with', id)
    try {
      return await agentRunService.findById(id)
    } catch (error) {
      console.error('Error getting agent run:', error)
      throw new Error('Failed to get agent run')
    }
  })

  // Get agent run with real-time metrics
  ipcMain.handle('get-agent-run-with-metrics', async (_, id: number) => {
    console.log('Main: get-agent-run-with-metrics called with', id)
    try {
      const run = await agentRunService.findById(id)
      if (!run) {
        throw new Error('Agent run not found')
      }

      // Try to read session JSONL file and calculate metrics
      let metrics: any = null
      let output: string | null = null

      if (run.session_id) {
        try {
          output = await readSessionJsonl(run.session_id, run.project_path)
          metrics = calculateMetricsFromJsonl(output)
        } catch (error) {
          console.warn('Failed to read JSONL for session:', run.session_id, error)
        }
      }

      return {
        ...run,
        metrics,
        output
      }
    } catch (error) {
      console.error('Error getting agent run with metrics:', error)
      throw new Error('Failed to get agent run with metrics')
    }
  })

  // List running agent sessions
  ipcMain.handle('list-running-agent-sessions', async () => {
    console.log('Main: list-running-agent-sessions called')
    try {
      // Get running sessions from database
      const runningRuns = await agentRunService.getAgentRunsByStatus('running')

      // Cross-check with process manager to ensure they're actually running
      const actuallyRunning: any[] = []
      for (const run of runningRuns) {
        if (run.id && processManager.isProcessRunning(run.id)) {
          actuallyRunning.push(run)
        }
      }

      return actuallyRunning
    } catch (error) {
      console.error('Error listing running sessions:', error)
      return []
    }
  })

  // Get session status
  ipcMain.handle('get-session-status', async (_, runId: number) => {
    console.log('Main: get-session-status called with', runId)
    try {
      const run = await agentRunService.findById(runId)
      return run?.status || null
    } catch (error) {
      console.error('Error getting session status:', error)
      return null
    }
  })

  // Get live session output
  ipcMain.handle('get-live-session-output', async (_, runId: number) => {
    console.log('Main: get-live-session-output called with', runId)
    try {
      return processManager.getLiveOutput(runId) || ''
    } catch (error) {
      console.error('Error getting live session output:', error)
      return ''
    }
  })

  // Get session output (combines JSONL file and live output)
  ipcMain.handle('get-session-output', async (_, runId: number) => {
    console.log('Main: get-session-output called with', runId)
    try {
      const run = await agentRunService.findById(runId)
      if (!run) {
        throw new Error('Agent run not found')
      }

      // If no session ID yet, try to get live output
      if (!run.session_id) {
        return processManager.getLiveOutput(runId) || ''
      }

      // Try to read from JSONL file first
      try {
        return await readSessionJsonl(run.session_id, run.project_path)
      } catch (error) {
        // Fallback to live output if file read fails
        return processManager.getLiveOutput(runId) || ''
      }
    } catch (error) {
      console.error('Error getting session output:', error)
      return ''
    }
  })

  // Export agent
  ipcMain.handle('export-agent', async (_, id: number) => {
    console.log('Main: export-agent called with', id)
    try {
      const agent = await agentService.findById(id)
      if (!agent) {
        throw new Error('Agent not found')
      }

      const exportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        agent: {
          name: agent.name,
          icon: agent.icon,
          system_prompt: agent.system_prompt,
          default_task: agent.default_task,
          model: agent.model,
          hooks: agent.hooks
        }
      }

      return JSON.stringify(exportData, null, 2)
    } catch (error) {
      console.error('Error exporting agent:', error)
      throw new Error('Failed to export agent')
    }
  })

  // Import agent
  ipcMain.handle('import-agent', async (_, jsonData: string) => {
    console.log('Main: import-agent called')
    try {
      const exportData = JSON.parse(jsonData)

      // Validate version
      if (exportData.version !== 1) {
        throw new Error(`Unsupported export version: ${exportData.version}`)
      }

      const agentData = exportData.agent

      // Check if agent with same name exists and modify name if needed
      const existingAgents = await agentService.findAll()
      const existingNames = existingAgents.map((a) => a.name)

      let finalName = agentData.name
      if (existingNames.includes(finalName)) {
        finalName = `${agentData.name} (Imported)`
      }

      // Create the agent
      return await agentService.create({
        name: finalName,
        icon: agentData.icon,
        system_prompt: agentData.system_prompt,
        default_task: agentData.default_task,
        model: agentData.model || 'sonnet',
        enable_file_read: true,
        enable_file_write: true,
        enable_network: false,
        hooks: agentData.hooks
      })
    } catch (error) {
      console.error('Error importing agent:', error)
      throw new Error('Failed to import agent')
    }
  })

  // Import agent from file
  ipcMain.handle('import-agent-from-file', async (_, filePath: string) => {
    console.log('Main: import-agent-from-file called with', filePath)
    try {
      // Read file content
      const fileContent = await fs.readFile(filePath, 'utf-8')

      // Parse and validate JSON
      let exportData
      try {
        exportData = JSON.parse(fileContent)
      } catch (parseError) {
        throw new Error('The selected file is not a valid JSON file')
      }

      // Validate export format
      if (!exportData.version || !exportData.agent) {
        throw new Error('Invalid agent export format')
      }

      // Validate version
      if (exportData.version !== 1) {
        throw new Error(`Unsupported export version: ${exportData.version}`)
      }

      const agentData = exportData.agent

      // Validate required fields
      if (!agentData.name || !agentData.icon || !agentData.system_prompt) {
        throw new Error('Invalid agent data: missing required fields')
      }

      // Check if agent with same name exists and modify name if needed
      const existingAgents = await agentService.findAll()
      const existingNames = existingAgents.map((a) => a.name)

      let finalName = agentData.name
      if (existingNames.includes(finalName)) {
        finalName = `${agentData.name} (Imported)`
      }

      // Create the agent
      return await agentService.create({
        name: finalName,
        icon: agentData.icon,
        system_prompt: agentData.system_prompt,
        default_task: agentData.default_task,
        model: agentData.model || 'sonnet',
        enable_file_read: true,
        enable_file_write: true,
        enable_network: false,
        hooks: agentData.hooks
      })
    } catch (error) {
      console.error('Error importing agent from file:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to import agent from file')
    }
  })

  // Cleanup finished processes
  ipcMain.handle('cleanup-finished-processes', async () => {
    console.log('Main: cleanup-finished-processes called')
    try {
      const runningRuns = await agentRunService.getAgentRunsByStatus('running')
      const cleanedUp: number[] = []

      for (const run of runningRuns) {
        if (run.id && !processManager.isProcessRunning(run.id)) {
          // Process has finished, update status
          await agentRunService.updateStatus(run.id, 'completed')
          cleanedUp.push(run.id)
        }
      }

      return cleanedUp
    } catch (error) {
      console.error('Error cleaning up finished processes:', error)
      return []
    }
  })
}

/**
 * Read JSONL content from a session file
 */
async function readSessionJsonl(sessionId: string, projectPath: string): Promise<string> {
  const claudeDir = join(homedir(), '.claude', 'projects')

  // Encode project path to match Claude Code's directory naming
  const encodedProject = projectPath.replace(/\//g, '-')
  const projectDir = join(claudeDir, encodedProject)
  const sessionFile = join(projectDir, `${sessionId}.jsonl`)

  try {
    return await fs.readFile(sessionFile, 'utf-8')
  } catch (error) {
    // Try to search for the session file in all project directories
    const entries = await fs.readdir(claudeDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const potentialFile = join(claudeDir, entry.name, `${sessionId}.jsonl`)
        try {
          return await fs.readFile(potentialFile, 'utf-8')
        } catch {
          // Continue searching
        }
      }
    }

    throw new Error(`Session file not found: ${sessionId}`)
  }
}

/**
 * Calculate metrics from JSONL content
 */
function calculateMetricsFromJsonl(jsonlContent: string) {
  let totalTokens = 0
  let costUsd = 0
  let messageCount = 0
  let startTime: Date | null = null
  let endTime: Date | null = null

  const lines = jsonlContent.split('\n').filter((line) => line.trim())

  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      messageCount++

      // Track timestamps
      if (json.timestamp) {
        const timestamp = new Date(json.timestamp)
        if (!startTime || timestamp < startTime) {
          startTime = timestamp
        }
        if (!endTime || timestamp > endTime) {
          endTime = timestamp
        }
      }

      // Extract token usage
      const usage = json.usage || (json.message && json.message.usage)
      if (usage) {
        if (usage.input_tokens) {
          totalTokens += usage.input_tokens
        }
        if (usage.output_tokens) {
          totalTokens += usage.output_tokens
        }
      }

      // Extract cost information
      if (json.cost) {
        costUsd += json.cost
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  const durationMs = startTime && endTime ? endTime.getTime() - startTime.getTime() : null

  return {
    duration_ms: durationMs,
    total_tokens: totalTokens > 0 ? totalTokens : null,
    cost_usd: costUsd > 0 ? costUsd : null,
    message_count: messageCount > 0 ? messageCount : null
  }
}
