import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface HooksConfiguration {
  beforeTool?: string
  afterTool?: string
  beforeGenerate?: string
  afterGenerate?: string
  [key: string]: string | undefined
}

/**
 * Hooks configuration IPC handlers
 */
export function setupHooksHandlers() {
  // Get hooks configuration
  ipcMain.handle(
    'get-hooks-config',
    async (
      _,
      {
        scope,
        projectPath
      }: {
        scope: 'user' | 'project' | 'local'
        projectPath?: string
      }
    ) => {
      console.log('Main: get-hooks-config called with', { scope, projectPath })
      try {
        return await getHooksConfig(scope, projectPath)
      } catch (error) {
        console.error('Error getting hooks config:', error)
        return {}
      }
    }
  )

  // Update hooks configuration
  ipcMain.handle(
    'update-hooks-config',
    async (
      _,
      {
        scope,
        hooks,
        projectPath
      }: {
        scope: 'user' | 'project' | 'local'
        hooks: HooksConfiguration
        projectPath?: string
      }
    ) => {
      console.log('Main: update-hooks-config called')
      try {
        await updateHooksConfig(scope, hooks, projectPath)
        return 'Hooks configuration updated successfully'
      } catch (error) {
        console.error('Error updating hooks config:', error)
        throw new Error('Failed to update hooks configuration')
      }
    }
  )

  // Validate hook command
  ipcMain.handle('validate-hook-command', async (_, { command }: { command: string }) => {
    console.log('Main: validate-hook-command called')
    try {
      const validation = validateHookCommand(command)
      return validation
    } catch (error) {
      console.error('Error validating hook command:', error)
      return { valid: false, message: 'Validation failed' }
    }
  })
}

/**
 * Get hooks configuration from file system
 */
async function getHooksConfig(
  scope: 'user' | 'project' | 'local',
  projectPath?: string
): Promise<HooksConfiguration> {
  const filePath = getHooksFilePath(scope, projectPath)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    // Return empty config if file doesn't exist
    return {}
  }
}

/**
 * Update hooks configuration
 */
async function updateHooksConfig(
  scope: 'user' | 'project' | 'local',
  hooks: HooksConfiguration,
  projectPath?: string
): Promise<void> {
  const filePath = getHooksFilePath(scope, projectPath)

  // Ensure directory exists
  const dir = join(filePath, '..')
  await fs.mkdir(dir, { recursive: true })

  await fs.writeFile(filePath, JSON.stringify(hooks, null, 2), 'utf-8')
}

/**
 * Get hooks file path based on scope
 */
function getHooksFilePath(scope: 'user' | 'project' | 'local', projectPath?: string): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'hooks.json')
    case 'project':
      if (!projectPath) throw new Error('Project path required for project scope')
      return join(projectPath, '.claude', 'hooks.json')
    case 'local':
      if (!projectPath) throw new Error('Project path required for local scope')
      return join(projectPath, 'hooks.json')
    default:
      throw new Error(`Invalid scope: ${scope}`)
  }
}

/**
 * Validate a hook command
 */
function validateHookCommand(command: string): { valid: boolean; message: string } {
  if (!command || command.trim().length === 0) {
    return { valid: false, message: 'Command cannot be empty' }
  }

  // Basic validation - check for dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s*\/\w*/, // rm -rf /
    /sudo\s+rm/, // sudo rm
    />\s*\/dev\/sd[a-z]/, // > /dev/sd*
    /format\s+[a-z]:/i // format c:
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, message: 'Command contains potentially dangerous operations' }
    }
  }

  return { valid: true, message: 'Command appears valid' }
}
