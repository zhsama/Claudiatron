// Simple API wrapper for initial migration - replaces complex Tauri API
// This provides basic functionality to get the app running

export const api = {
  // Agent Management
  async listAgents() {
    return window.api?.listAgents() || []
  },

  async createAgent(
    name: string,
    icon: string,
    systemPrompt: string,
    defaultTask?: string,
    model?: string,
    hooks?: string
  ) {
    return (
      window.api?.createAgent(name, icon, systemPrompt, defaultTask, model, hooks) || {
        id: Date.now()
      }
    )
  },

  async updateAgent(
    id: number,
    name: string,
    icon: string,
    systemPrompt: string,
    defaultTask?: string,
    model?: string,
    hooks?: string
  ) {
    return window.api?.updateAgent(id, name, icon, systemPrompt, defaultTask, model, hooks) || {}
  },

  async deleteAgent(id: number) {
    return window.api?.deleteAgent(id) || {}
  },

  async getAgent(id: number) {
    return window.api?.getAgent(id) || {}
  },

  async executeAgent(agentId: number, projectPath: string, task: string, model?: string) {
    return window.api?.executeAgent(agentId, projectPath, task, model) || 1
  },

  // Project Management
  async listProjects() {
    return window.api?.listProjects() || []
  },

  async getProjectSessions(projectId: string) {
    return window.api?.getProjectSessions(projectId) || []
  },

  // Claude Settings
  async getClaudeSettings() {
    return window.api?.getClaudeSettings() || {}
  },

  async saveClaudeSettings(settings: any) {
    return window.api?.saveClaudeSettings(settings) || 'Settings saved'
  },

  // Version Check
  async checkClaudeVersion() {
    return window.api?.checkClaudeVersion() || { is_installed: false, output: 'Not implemented' }
  },

  // File Operations
  async readClaudeMdFile(filePath: string) {
    return window.api?.readClaudeMdFile(filePath) || ''
  },

  async saveClaudeMdFile(filePath: string, content: string) {
    return window.api?.saveClaudeMdFile(filePath, content) || 'File saved'
  },

  async findClaudeMdFiles(projectPath: string) {
    return window.api?.findClaudeMdFiles(projectPath) || []
  },

  // File Dialogs
  async showOpenDialog(options: any) {
    return window.api?.showOpenDialog(options) || null
  },

  async showSaveDialog(options: any) {
    return window.api?.showSaveDialog(options) || null
  },

  // Claude Code Execution
  async executeClaudeCode(projectPath: string, message: string, model?: string) {
    return window.api?.executeClaudeCode(projectPath, message, model) || {}
  },

  async continueClaudeCode(projectPath: string, message: string) {
    return window.api?.continueClaudeCode(projectPath, message) || {}
  },

  async cancelClaudeExecution(projectPath: string) {
    return window.api?.cancelClaudeExecution(projectPath) || {}
  }
}

// Event listener functions
export const listen = (event: string, callback: (data: any) => void) => {
  console.log(`Listen for event: ${event}`)
  // Placeholder for now
}

export const UnlistenFn = () => {
  console.log('Unlisten function called')
}

// Dialog functions
export const open = async (options?: any) => {
  return window.api?.showOpenDialog(options) || null
}

export const save = async (options?: any) => {
  return window.api?.showSaveDialog(options) || null
}

// Shell functions
export const openUrl = async (url: string) => {
  window.open(url, '_blank')
}

// File source conversion (placeholder)
export const convertFileSrc = (filePath: string) => {
  return `file://${filePath}`
}

// Window functions (placeholder)
export const getCurrentWebviewWindow = () => {
  return {
    setResizable: () => {},
    setAlwaysOnTop: () => {},
    show: () => {},
    hide: () => {}
  }
}

// Invoke function placeholder (like Tauri's invoke)
export const invoke = async (command: string, args?: any) => {
  console.log(`Invoke: ${command}`, args)
  return {}
}

// Export everything that components might need
export default api
