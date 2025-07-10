import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { logger } from '../logger'

export interface SlashCommand {
  /** Unique identifier for the command (derived from file path) */
  id: string
  /** Command name (without prefix) */
  name: string
  /** Full command with prefix (e.g., "/project:optimize") */
  full_command: string
  /** Command scope: "project" or "user" */
  scope: string
  /** Optional namespace (e.g., "frontend" in "/project:frontend:component") */
  namespace?: string
  /** Path to the markdown file */
  file_path: string
  /** Command content (markdown body) */
  content: string
  /** Optional description from frontmatter */
  description?: string
  /** Allowed tools from frontmatter */
  allowed_tools: string[]
  /** Whether the command has bash commands (!) */
  has_bash_commands: boolean
  /** Whether the command has file references (@) */
  has_file_references: boolean
  /** Whether the command uses $ARGUMENTS placeholder */
  accepts_arguments: boolean
}

/** Legacy JSON command format for migration */
interface LegacySlashCommand {
  id: string
  name: string
  description: string
  command: string
  enabled: boolean
  scope: 'global' | 'project'
  createdAt: string
  updatedAt: string
}

interface LegacySlashCommandsConfig {
  commands: LegacySlashCommand[]
  version: string
}

/** Migrate legacy JSON commands to new Markdown format */
async function migrateLegacyCommands(): Promise<void> {
  const legacyConfigPath = path.join(os.homedir(), '.claude', 'slash-commands.json')

  try {
    // Check if legacy config exists
    await fs.access(legacyConfigPath)

    logger.info('Found legacy slash commands, migrating to Markdown format...')

    // Read legacy config
    const content = await fs.readFile(legacyConfigPath, 'utf-8')
    const config: LegacySlashCommandsConfig = JSON.parse(content)

    if (!config.commands || config.commands.length === 0) {
      logger.info('No legacy commands to migrate')
      return
    }

    // Create user commands directory
    const userCommandsDir = path.join(os.homedir(), '.claude', 'commands')
    await fs.mkdir(userCommandsDir, { recursive: true })

    let migratedCount = 0

    for (const legacyCmd of config.commands) {
      try {
        // Skip disabled commands
        if (!legacyCmd.enabled) {
          logger.debug(`Skipping disabled command: ${legacyCmd.name}`)
          continue
        }

        // Clean up command name (remove leading /)
        const cleanName = legacyCmd.name.replace(/^\//, '')

        // Skip if file already exists (avoid overwriting)
        const filePath = path.join(userCommandsDir, `${cleanName}.md`)
        try {
          await fs.access(filePath)
          logger.debug(`Command ${cleanName} already exists, skipping`)
          continue
        } catch {
          // File doesn't exist, proceed with migration
        }

        // Build markdown content
        let content = ''

        // Add frontmatter if we have description
        if (legacyCmd.description) {
          content += '---\\n'
          content += `description: ${legacyCmd.description}\\n`
          content += '---\\n\\n'
        }

        // Add command content
        content += legacyCmd.command

        // Write to file
        await fs.writeFile(filePath, content, 'utf-8')
        migratedCount++

        logger.debug(`Migrated command: ${cleanName}`)
      } catch (error) {
        logger.error(`Failed to migrate command ${legacyCmd.name}:`, error)
      }
    }

    if (migratedCount > 0) {
      // Backup the original file
      const backupPath = legacyConfigPath + '.backup'
      await fs.copyFile(legacyConfigPath, backupPath)

      // Remove the original file
      await fs.unlink(legacyConfigPath)

      logger.info(`Successfully migrated ${migratedCount} commands to Markdown format`)
      logger.info(`Legacy config backed up to: ${backupPath}`)
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // Legacy config doesn't exist, nothing to migrate
      logger.debug('No legacy slash commands config found')
    } else {
      logger.error(
        'Failed to migrate legacy commands:',
        error instanceof Error ? error.message : String(error)
      )
    }
  }
}

/** YAML frontmatter structure */
interface CommandFrontmatter {
  description?: string
  'allowed-tools'?: string[]
}

/** Parse a markdown file with optional YAML frontmatter */
function parseMarkdownWithFrontmatter(content: string): {
  frontmatter?: CommandFrontmatter
  body: string
} {
  const lines = content.split('\n')

  // Check if the file starts with YAML frontmatter
  if (lines.length === 0 || lines[0] !== '---') {
    // No frontmatter
    return { body: content }
  }

  // Find the end of frontmatter
  let frontmatterEnd = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      frontmatterEnd = i
      break
    }
  }

  if (frontmatterEnd === -1) {
    // Malformed frontmatter, treat as regular content
    return { body: content }
  }

  try {
    // Extract frontmatter
    const frontmatterContent = lines.slice(1, frontmatterEnd).join('\n')
    const bodyContent = lines.slice(frontmatterEnd + 1).join('\n')

    // Simple YAML parsing for our specific needs
    const frontmatter: CommandFrontmatter = {}
    const yamlLines = frontmatterContent.split('\n')

    for (let i = 0; i < yamlLines.length; i++) {
      const line = yamlLines[i].trim()
      if (line.startsWith('description:')) {
        frontmatter.description = line
          .substring(12)
          .trim()
          .replace(/^["']|["']$/g, '')
      } else if (line === 'allowed-tools:') {
        // Parse array
        const tools: string[] = []
        for (let j = i + 1; j < yamlLines.length; j++) {
          const toolLine = yamlLines[j].trim()
          if (toolLine.startsWith('- ')) {
            tools.push(toolLine.substring(2).trim())
          } else if (toolLine && !toolLine.startsWith(' ')) {
            break
          }
        }
        frontmatter['allowed-tools'] = tools
      }
    }

    return { frontmatter, body: bodyContent }
  } catch (error) {
    logger.warn('Failed to parse frontmatter, treating as regular content:', error)
    return { body: content }
  }
}

/** Extract command name and namespace from file path */
function extractCommandInfo(
  filePath: string,
  basePath: string
): { name: string; namespace?: string } {
  const relativePath = path.relative(basePath, filePath)

  // Remove .md extension
  const pathWithoutExt = relativePath.replace(/\.md$/, '')

  // Split into components
  const components = pathWithoutExt.split(path.sep)

  if (components.length === 1) {
    // No namespace
    return { name: components[0] }
  } else {
    // Last component is the command name, rest is namespace
    const name = components[components.length - 1]
    const namespace = components.slice(0, -1).join(':')
    return { name, namespace }
  }
}

/** Load a single command from a markdown file */
async function loadCommandFromFile(
  filePath: string,
  basePath: string,
  scope: string
): Promise<SlashCommand> {
  logger.debug(`Loading command from: ${filePath}`)

  // Read file content
  const content = await fs.readFile(filePath, 'utf-8')

  // Parse frontmatter
  const { frontmatter, body } = parseMarkdownWithFrontmatter(content)

  // Extract command info
  const { name, namespace } = extractCommandInfo(filePath, basePath)

  // Build full command (no scope prefix, just /command or /namespace:command)
  const fullCommand = namespace ? `/${namespace}:${name}` : `/${name}`

  // Generate unique ID
  const id = `${scope}-${filePath.replace(/[/\\]/g, '-')}`

  // Check for special content
  const hasBashCommands = body.includes('!`')
  const hasFileReferences = body.includes('@')
  const acceptsArguments = body.includes('$ARGUMENTS')

  // Extract metadata from frontmatter
  const description = frontmatter?.description
  const allowedTools = frontmatter?.['allowed-tools'] || []

  return {
    id,
    name,
    full_command: fullCommand,
    scope,
    namespace,
    file_path: filePath,
    content: body,
    description,
    allowed_tools: allowedTools,
    has_bash_commands: hasBashCommands,
    has_file_references: hasFileReferences,
    accepts_arguments: acceptsArguments
  }
}

/** Recursively find all markdown files in a directory */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden files/directories
      if (entry.name.startsWith('.')) {
        continue
      }

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    logger.debug(`Cannot read directory ${dir}:`, error)
  }

  return files
}

/** Create default/built-in slash commands */
function createDefaultCommands(): SlashCommand[] {
  return [
    {
      id: 'default-add-dir',
      name: 'add-dir',
      full_command: '/add-dir',
      scope: 'default',
      file_path: '',
      content: 'Add additional working directories',
      description: 'Add additional working directories',
      allowed_tools: [],
      has_bash_commands: false,
      has_file_references: false,
      accepts_arguments: false
    },
    {
      id: 'default-init',
      name: 'init',
      full_command: '/init',
      scope: 'default',
      file_path: '',
      content: 'Initialize project with CLAUDE.md guide',
      description: 'Initialize project with CLAUDE.md guide',
      allowed_tools: [],
      has_bash_commands: false,
      has_file_references: false,
      accepts_arguments: false
    },
    {
      id: 'default-review',
      name: 'review',
      full_command: '/review',
      scope: 'default',
      file_path: '',
      content: 'Request code review',
      description: 'Request code review',
      allowed_tools: [],
      has_bash_commands: false,
      has_file_references: false,
      accepts_arguments: false
    }
  ]
}

/** Discover all custom slash commands */
async function getSlashCommands(projectPath?: string): Promise<SlashCommand[]> {
  try {
    // First, try to migrate any legacy commands
    await migrateLegacyCommands()

    const commands: SlashCommand[] = []

    // Add default commands
    commands.push(...createDefaultCommands())

    // Load project commands if project path is provided
    if (projectPath) {
      const projectCommandsDir = path.join(projectPath, '.claude', 'commands')
      const projectFiles = await findMarkdownFiles(projectCommandsDir)

      for (const filePath of projectFiles) {
        try {
          const cmd = await loadCommandFromFile(filePath, projectCommandsDir, 'project')
          logger.debug(`Loaded project command: ${cmd.full_command}`)
          commands.push(cmd)
        } catch (error) {
          logger.error(`Failed to load command from ${filePath}:`, error)
        }
      }
    }

    // Load user commands
    const userCommandsDir = path.join(os.homedir(), '.claude', 'commands')
    const userFiles = await findMarkdownFiles(userCommandsDir)

    for (const filePath of userFiles) {
      try {
        const cmd = await loadCommandFromFile(filePath, userCommandsDir, 'user')
        logger.debug(`Loaded user command: ${cmd.full_command}`)
        commands.push(cmd)
      } catch (error) {
        logger.error(`Failed to load command from ${filePath}:`, error)
      }
    }

    logger.info(`Found ${commands.length} slash commands`)
    return commands
  } catch (error) {
    logger.error('Failed to load slash commands:', error)
    return createDefaultCommands()
  }
}

/** Save a slash command to filesystem */
async function saveSlashCommand(
  scope: string,
  name: string,
  namespace: string | undefined,
  content: string,
  description: string | undefined,
  allowedTools: string[],
  projectPath?: string
): Promise<SlashCommand> {
  logger.info(`Saving slash command: ${name} in scope: ${scope}`)

  // Validate inputs
  if (!name) {
    throw new Error('Command name cannot be empty')
  }

  if (!['project', 'user'].includes(scope)) {
    throw new Error('Invalid scope. Must be "project" or "user"')
  }

  // Determine base directory
  let baseDir: string
  if (scope === 'project') {
    if (!projectPath) {
      throw new Error('Project path required for project scope')
    }
    baseDir = path.join(projectPath, '.claude', 'commands')
  } else {
    baseDir = path.join(os.homedir(), '.claude', 'commands')
  }

  // Build file path
  let filePath = baseDir
  if (namespace) {
    for (const component of namespace.split(':')) {
      filePath = path.join(filePath, component)
    }
  }

  // Create directories if needed
  await fs.mkdir(filePath, { recursive: true })

  // Add filename
  filePath = path.join(filePath, `${name}.md`)

  // Build content with frontmatter
  let fullContent = ''

  // Add frontmatter if we have metadata
  if (description || allowedTools.length > 0) {
    fullContent += '---\n'

    if (description) {
      fullContent += `description: ${description}\n`
    }

    if (allowedTools.length > 0) {
      fullContent += 'allowed-tools:\n'
      for (const tool of allowedTools) {
        fullContent += `  - ${tool}\n`
      }
    }

    fullContent += '---\n\n'
  }

  fullContent += content

  // Write file
  await fs.writeFile(filePath, fullContent, 'utf-8')

  // Load and return the saved command
  return await loadCommandFromFile(filePath, baseDir, scope)
}

export function setupSlashCommandsHandlers(): void {
  // 获取斜杠命令列表
  ipcMain.handle('slash-commands-list', async (_, projectPath?: string) => {
    try {
      return await getSlashCommands(projectPath)
    } catch (error) {
      logger.error('Failed to list slash commands:', error)
      throw error
    }
  })

  // 获取单个斜杠命令
  ipcMain.handle('slash-commands-get', async (_, commandId: string) => {
    try {
      // Parse the ID to determine scope and reconstruct file path
      const parts = commandId.split('-')
      if (parts.length < 2) {
        throw new Error('Invalid command ID')
      }

      // The actual implementation would need to reconstruct the path and reload the command
      // For now, we'll list all commands and find the matching one
      const commands = await getSlashCommands()

      const command = commands.find((cmd) => cmd.id === commandId)
      if (!command) {
        throw new Error(`Command not found: ${commandId}`)
      }

      return command
    } catch (error) {
      logger.error('Failed to get slash command:', error)
      throw error
    }
  })

  // 保存斜杠命令（创建或更新）
  ipcMain.handle(
    'slash-commands-save',
    async (
      _,
      scope: string,
      name: string,
      namespace: string | undefined,
      content: string,
      description: string | undefined,
      allowedTools: string[],
      projectPath?: string
    ) => {
      try {
        return await saveSlashCommand(
          scope,
          name,
          namespace,
          content,
          description,
          allowedTools,
          projectPath
        )
      } catch (error) {
        logger.error('Failed to save slash command:', error)
        throw error
      }
    }
  )

  // 删除斜杠命令
  ipcMain.handle('slash-commands-delete', async (_, commandId: string, projectPath?: string) => {
    try {
      logger.info(`Deleting slash command: ${commandId}`)

      // First, we need to determine if this is a project command by parsing the ID
      const isProjectCommand = commandId.startsWith('project-')

      // If it's a project command and we don't have a project path, error out
      if (isProjectCommand && !projectPath) {
        throw new Error('Project path required to delete project commands')
      }

      // List all commands (including project commands if applicable)
      const commands = await getSlashCommands(projectPath)

      // Find the command by ID
      const command = commands.find((cmd) => cmd.id === commandId)
      if (!command) {
        throw new Error(`Command not found: ${commandId}`)
      }

      // Delete the file
      await fs.unlink(command.file_path)

      // Clean up empty directories
      const parentDir = path.dirname(command.file_path)
      await removeEmptyDirs(parentDir)

      return `Deleted command: ${command.full_command}`
    } catch (error) {
      logger.error('Failed to delete slash command:', error)
      throw error
    }
  })

  logger.info('Slash commands handlers registered')
}

/** Remove empty directories recursively */
async function removeEmptyDirs(dir: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir)

    // Check if directory is empty
    if (entries.length === 0) {
      await fs.rmdir(dir)

      // Try to remove parent if it's also empty
      const parent = path.dirname(dir)
      if (parent !== dir) {
        await removeEmptyDirs(parent)
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be removed, that's fine
    logger.debug(`Cannot remove directory ${dir}:`, error)
  }
}
