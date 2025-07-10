import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { appSettingsService } from './database/services'

export interface ClaudeInstallation {
  path: string
  version?: string
  source: string
  installation_type: 'bundled' | 'system' | 'custom'
}

export interface ClaudeVersionInfo {
  is_installed: boolean
  version?: string
  output: string
}

class ClaudeBinaryManager {
  private cachedBinaryPath: string | null = null

  /**
   * Find the Claude binary path
   */
  async findClaudeBinary(): Promise<string> {
    console.log('Searching for Claude binary...')

    // Check cached path first
    if (this.cachedBinaryPath) {
      return this.cachedBinaryPath
    }

    // Check stored path in database
    const storedPath = await appSettingsService.getClaudeBinaryPath()
    if (storedPath) {
      console.log('Found stored Claude path in database:', storedPath)

      // If it's a sidecar reference, return it directly
      if (storedPath === 'claude-code') {
        this.cachedBinaryPath = storedPath
        return storedPath
      }

      // Otherwise check if the path still exists
      try {
        await fs.access(storedPath)
        this.cachedBinaryPath = storedPath
        return storedPath
      } catch {
        console.warn('Stored Claude path no longer exists:', storedPath)
      }
    }

    // Check user preference
    const preference = await appSettingsService.getClaudeInstallationPreference()
    console.log('User preference for Claude installation:', preference)

    // Check if sidecar is available
    const sidecarAvailable = await this.isSidecarAvailable()

    // If user prefers bundled and it's available, use it
    if (preference === 'bundled' && sidecarAvailable) {
      console.log('Using bundled Claude Code sidecar per user preference')
      this.cachedBinaryPath = 'claude-code'
      return 'claude-code'
    }

    // If no user preference and sidecar is available, use it
    if (!preference && sidecarAvailable) {
      console.log('Found bundled Claude Code sidecar')
      this.cachedBinaryPath = 'claude-code'
      return 'claude-code'
    }

    // Discover system installations
    const installations = await this.discoverSystemInstallations()

    // If user prefers bundled but it's not available, try system installations
    if (preference === 'bundled' && !sidecarAvailable && installations.length > 0) {
      console.log('Bundled Claude not available, falling back to system installation')
    }

    if (installations.length === 0) {
      throw new Error(
        "Claude Code not found. Please ensure it's installed via npm (npm install -g @anthropic-ai/claude-code) or available in PATH. Searched locations: system PATH, /usr/local/bin, /opt/homebrew/bin, ~/.nvm/versions/node/*/bin, ~/.local/state/fnm_multishells/*/bin, ~/.claude/local, ~/.local/bin"
      )
    }

    // Use the first available installation
    const selectedInstallation = installations[0]
    console.log('Selected Claude installation:', selectedInstallation)

    this.cachedBinaryPath = selectedInstallation.path
    return selectedInstallation.path
  }

  /**
   * Check if bundled sidecar is available
   */
  private async isSidecarAvailable(): Promise<boolean> {
    try {
      // Try to execute claude-code command to see if it's available in PATH
      const result = await this.executeCommand('claude-code', ['--version'])
      return result.success
    } catch {
      // If command fails, sidecar is not available
      return false
    }
  }

  /**
   * Discover system Claude installations
   */
  private async discoverSystemInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []

    // Search locations for both 'claude' and 'claude-code' commands
    const commandNames = ['claude', 'claude-code']
    const basePaths = [
      // Standard system paths
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',

      // User-specific paths
      join(process.env.HOME || '', '.local/bin'),
      join(process.env.HOME || '', '.claude/local'),

      // Package manager paths
      join(process.env.HOME || '', '.npm/bin'),
      join(process.env.HOME || '', '.yarn/bin'),
      join(process.env.HOME || '', '.pnpm/bin')
    ]

    const searchPaths: string[] = []
    for (const basePath of basePaths) {
      for (const command of commandNames) {
        searchPaths.push(join(basePath, command))
      }
    }

    // Check PATH using shell environment for both command names
    for (const commandName of commandNames) {
      try {
        // Use shell to check if command exists and get its path
        const checkResult = await this.executeShellCommand(`command -v ${commandName}`)
        if (checkResult.success && checkResult.stdout.trim()) {
          const pathLocation = checkResult.stdout.trim()
          const version = await this.getVersionFromPath(pathLocation)
          installations.push({
            path: pathLocation,
            version,
            source: 'Shell PATH',
            installation_type: 'system'
          })
        }
      } catch {
        // Shell command failed for this command name, continue with next
      }
    }

    // Check specific paths
    for (const path of searchPaths) {
      try {
        await fs.access(path)
        const version = await this.getVersionFromPath(path)
        installations.push({
          path,
          version,
          source: 'direct',
          installation_type: 'system'
        })
      } catch {
        // Path doesn't exist, continue
      }
    }

    // Check Node.js version managers
    const nvmInstallations = await this.checkNVMInstallations()
    installations.push(...nvmInstallations)

    const fnmInstallations = await this.checkFNMInstallations()
    installations.push(...fnmInstallations)

    // Remove duplicates based on path
    const uniqueInstallations = installations.filter(
      (installation, index, self) => index === self.findIndex((i) => i.path === installation.path)
    )

    return uniqueInstallations
  }

  /**
   * Check NVM installations
   */
  private async checkNVMInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    const nvmDir = join(process.env.HOME || '', '.nvm/versions/node')

    try {
      const nodeVersions = await fs.readdir(nvmDir)

      for (const version of nodeVersions) {
        // Check for both command names in NVM
        for (const commandName of ['claude', 'claude-code']) {
          const claudePath = join(nvmDir, version, 'bin', commandName)

          try {
            await fs.access(claudePath)
            const claudeVersion = await this.getVersionFromPath(claudePath)
            installations.push({
              path: claudePath,
              version: claudeVersion,
              source: `nvm (Node ${version})`,
              installation_type: 'system'
            })
          } catch {
            // This Node version doesn't have this Claude command
          }
        }
      }
    } catch {
      // NVM not installed or no versions
    }

    return installations
  }

  /**
   * Check FNM (Fast Node Manager) installations with intelligent deduplication
   */
  private async checkFNMInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []
    const commandNames = ['claude', 'claude-code']
    const foundVersions = new Map<string, ClaudeInstallation>() // key: nodeVersion-claudeVersion-commandName

    try {
      // Check FNM state directories
      const fnmStateDir = join(process.env.HOME || '', '.local/state/fnm_multishells')

      try {
        const fnmDirs = await fs.readdir(fnmStateDir)

        for (const dir of fnmDirs) {
          const binPath = join(fnmStateDir, dir, 'bin')

          // Try to get the Node.js version from this fnm directory
          const nodeVersion = await this.getFnmNodeVersion(binPath)

          for (const commandName of commandNames) {
            const claudePath = join(binPath, commandName)

            try {
              await fs.access(claudePath)
              const claudeVersion = await this.getVersionFromPath(claudePath)

              // Create a unique key combining node version, claude version, and command name
              const key = `${nodeVersion || 'unknown'}-${claudeVersion || 'unknown'}-${commandName}`

              // Only keep the first occurrence of each unique combination
              if (!foundVersions.has(key)) {
                const installation: ClaudeInstallation = {
                  path: claudePath,
                  version: claudeVersion,
                  source: nodeVersion ? `fnm (Node ${nodeVersion})` : `fnm (${dir})`,
                  installation_type: 'system'
                }

                foundVersions.set(key, installation)
                installations.push(installation)
              }
            } catch {
              // This FNM shell doesn't have this Claude command
            }
          }
        }
      } catch {
        // FNM multishells directory doesn't exist
      }

      // Also check standard FNM node_modules/.bin paths
      const fnmDir = join(process.env.HOME || '', '.fnm')
      if (await this.pathExists(fnmDir)) {
        try {
          const nodeVersionsDir = join(fnmDir, 'node-versions')
          const nodeVersions = await fs.readdir(nodeVersionsDir)

          for (const nodeVersionDir of nodeVersions) {
            // Extract version from directory name (e.g., "v20.18.3" -> "20.18.3")
            const nodeVersion = nodeVersionDir.replace(/^v/, '')
            const binPath = join(nodeVersionsDir, nodeVersionDir, 'installation', 'bin')

            for (const commandName of commandNames) {
              const claudePath = join(binPath, commandName)

              try {
                await fs.access(claudePath)
                const claudeVersion = await this.getVersionFromPath(claudePath)

                const key = `${nodeVersion}-${claudeVersion || 'unknown'}-${commandName}`

                if (!foundVersions.has(key)) {
                  const installation: ClaudeInstallation = {
                    path: claudePath,
                    version: claudeVersion,
                    source: `fnm (Node ${nodeVersion})`,
                    installation_type: 'system'
                  }

                  foundVersions.set(key, installation)
                  installations.push(installation)
                }
              } catch {
                // This Node version doesn't have this Claude command
              }
            }
          }
        } catch {
          // FNM node-versions directory doesn't exist
        }
      }
    } catch {
      // FNM not installed
    }

    return installations
  }

  /**
   * Get Node.js version from FNM directory
   */
  private async getFnmNodeVersion(binPath: string): Promise<string | undefined> {
    try {
      // Try to execute node --version in the same directory
      const nodeCommand = join(binPath, 'node')
      const result = await this.executeCommand(nodeCommand, ['--version'])

      if (result.success) {
        // Remove 'v' prefix from version (e.g., "v20.18.3" -> "20.18.3")
        return result.stdout.trim().replace(/^v/, '')
      }
    } catch {
      // Node command failed or doesn't exist
    }

    // Fallback: try to extract version from path structure
    // Pattern: .../fnm_multishells/1234_1234567890123/bin
    // We need to find the actual node version somehow
    try {
      // Look for node executable and try to get its version
      const nodePath = join(binPath, 'node')
      await fs.access(nodePath)

      // If node exists, try to resolve its real path and extract version
      const realPath = await fs.realpath(nodePath)
      const versionMatch = realPath.match(/node-versions[\/\\]v?([^\/\\]+)/)
      if (versionMatch) {
        return versionMatch[1]
      }
    } catch {
      // Failed to resolve real path
    }

    return undefined
  }

  /**
   * Check if a path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get version from a Claude binary path
   */
  private async getVersionFromPath(path: string): Promise<string | undefined> {
    try {
      const result = await this.executeCommand(path, ['--version'])
      if (result.success) {
        return result.stdout.trim()
      }
    } catch {
      // Version check failed
    }
    return undefined
  }

  /**
   * Execute a shell command and return the result
   */
  private executeShellCommand(command: string): Promise<{
    success: boolean
    stdout: string
    stderr: string
  }> {
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
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
        resolve({
          success: code === 0,
          stdout,
          stderr
        })
      })

      child.on('error', () => {
        resolve({
          success: false,
          stdout,
          stderr
        })
      })
    })
  }

  /**
   * Execute a command and return the result
   */
  private executeCommand(
    command: string,
    args: string[]
  ): Promise<{
    success: boolean
    stdout: string
    stderr: string
  }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
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
        resolve({
          success: code === 0,
          stdout,
          stderr
        })
      })

      child.on('error', () => {
        resolve({
          success: false,
          stdout,
          stderr
        })
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        child.kill()
        resolve({
          success: false,
          stdout,
          stderr: 'Command timed out'
        })
      }, 5000)
    })
  }

  /**
   * Check Claude version
   */
  async checkClaudeVersion(): Promise<ClaudeVersionInfo> {
    try {
      const binaryPath = await this.findClaudeBinary()
      const result = await this.executeCommand(binaryPath, ['--version'])

      return {
        is_installed: result.success,
        version: result.success ? result.stdout.trim() : undefined,
        output: result.success ? result.stdout : result.stderr
      }
    } catch (error) {
      return {
        is_installed: false,
        output: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Set custom Claude binary path
   */
  async setCustomBinaryPath(path: string): Promise<void> {
    // Validate the path
    try {
      await fs.access(path)
      const version = await this.getVersionFromPath(path)

      if (!version) {
        throw new Error('Invalid Claude binary: version check failed')
      }

      // Save to database
      await appSettingsService.setClaudeBinaryPath(path)
      this.cachedBinaryPath = path

      console.log(`Custom Claude binary set: ${path} (version: ${version})`)
    } catch (error) {
      throw new Error(
        `Failed to set custom binary path: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Reset to auto-discovery
   */
  async resetToAutoDiscovery(): Promise<void> {
    await appSettingsService.deleteSetting('claude_binary_path')
    this.cachedBinaryPath = null
    console.log('Reset to auto-discovery mode')
  }

  /**
   * Get all available installations
   */
  async getAllInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = []

    // Check bundled sidecar
    if (await this.isSidecarAvailable()) {
      installations.push({
        path: 'claude-code',
        source: 'bundled',
        installation_type: 'bundled'
      })
    }

    // Add system installations
    const systemInstallations = await this.discoverSystemInstallations()
    installations.push(...systemInstallations)

    return installations
  }

  /**
   * List Claude installations (alias for getAllInstallations)
   */
  async listClaudeInstallations(): Promise<ClaudeInstallation[]> {
    return this.getAllInstallations()
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cachedBinaryPath = null
  }
}

// Global instance
export const claudeBinaryManager = new ClaudeBinaryManager()
