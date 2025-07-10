// Electron IPC API wrapper - replacement for Tauri invoke API
import type { HooksConfiguration } from '@/types/hooks'

/** Process type for tracking in ProcessRegistry */
export type ProcessType =
  | { AgentRun: { agent_id: number; agent_name: string } }
  | { ClaudeSession: { session_id: string } }

/** Information about a running process */
export interface ProcessInfo {
  run_id: number
  process_type: ProcessType
  pid: number
  started_at: string
  project_path: string
  task: string
  model: string
}

/**
 * Represents a project in the ~/.claude/projects directory
 */
export interface Project {
  /** The project ID (derived from the directory name) */
  id: string
  /** The original project path (decoded from the directory name) */
  path: string
  /** List of session IDs (JSONL file names without extension) */
  sessions: string[]
  /** Unix timestamp when the project directory was created */
  created_at: number
}

/**
 * Represents a session with its metadata
 */
export interface Session {
  /** The session ID (UUID) */
  id: string
  /** The project ID this session belongs to */
  project_id: string
  /** The project path */
  project_path: string
  /** Optional todo data associated with this session */
  todo_data?: any
  /** Unix timestamp when the session file was created */
  created_at: number
  /** First user message content (if available) */
  first_message?: string
  /** Timestamp of the first user message (if available) */
  message_timestamp?: string
}

/**
 * Represents the settings from ~/.claude/settings.json
 */
export interface ClaudeSettings {
  [key: string]: any
}

/**
 * Represents the Claude Code version status
 */
export interface ClaudeVersionStatus {
  /** Whether Claude Code is installed and working */
  is_installed: boolean
  /** The version string if available */
  version?: string
  /** The full output from the command */
  output: string
}

/**
 * Mock API object that will be replaced with actual Electron IPC calls
 */
export const api = {
  // Basic placeholder functions that return empty data
  // These will be replaced with actual IPC calls later

  // Project Management
  async listProjects(): Promise<Project[]> {
    console.log('API: listProjects called')
    return []
  },

  async getProjectSessions(projectId: string): Promise<Session[]> {
    console.log('API: getProjectSessions called with', projectId)
    return []
  },

  // Claude Settings
  async getClaudeSettings(): Promise<ClaudeSettings> {
    console.log('API: getClaudeSettings called')
    return {}
  },

  async saveClaudeSettings(settings: ClaudeSettings): Promise<string> {
    console.log('API: saveClaudeSettings called with', settings)
    return 'Settings saved'
  },

  // Version Check
  async checkClaudeVersion(): Promise<ClaudeVersionStatus> {
    console.log('API: checkClaudeVersion called')
    return {
      is_installed: false,
      version: undefined,
      output: 'Claude Code not found'
    }
  },

  // Agent Management (placeholder functions)
  async listAgents(): Promise<any[]> {
    console.log('API: listAgents called')
    return []
  },

  async createAgent(name: string, icon: string, systemPrompt: string): Promise<any> {
    console.log('API: createAgent called with', { name, icon, systemPrompt })
    return { id: Date.now(), name, icon, systemPrompt }
  },

  // File Dialog Functions (placeholder)
  async showOpenDialog(options: any): Promise<string[] | null> {
    console.log('API: showOpenDialog called with', options)
    return null
  },

  async showSaveDialog(options: any): Promise<string | null> {
    console.log('API: showSaveDialog called with', options)
    return null
  },

  // Event Listeners (placeholder)
  onStreamOutput(callback: (event: any, data: any) => void): void {
    console.log('API: onStreamOutput listener registered')
    // This will be implemented with proper Electron IPC events
  },

  removeAllListeners(channel: string): void {
    console.log('API: removeAllListeners called for', channel)
  }
}

export default api
