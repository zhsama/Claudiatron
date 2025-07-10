import { execa, type ResultPromise, type Result } from 'execa'
import treeKill from 'tree-kill'
import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'

/**
 * Type of process being tracked
 */
export enum ProcessType {
  AgentRun = 'AgentRun',
  ClaudeSession = 'ClaudeSession'
}

/**
 * Information about a running process
 */
export interface ProcessInfo {
  runId: number
  processType: ProcessType
  pid: number
  startedAt: Date
  projectPath: string
  task: string
  model: string
  // Agent-specific info
  agentId?: number
  agentName?: string
  // Claude session-specific info
  sessionId?: string
}

/**
 * Handle for a running process
 */
interface ProcessHandle {
  info: ProcessInfo
  process: ResultPromise<any> | null
  liveOutput: string[]
  isFinished: boolean
}

/**
 * Registry for tracking active processes (Claude sessions and agent runs)
 */
export class ProcessManager extends EventEmitter {
  private processes: Map<number, ProcessHandle> = new Map()
  private nextId: number = 1000000 // Start at high number to avoid conflicts
  private browserWindow: BrowserWindow | null = null

  constructor() {
    super()
  }

  /**
   * Set the browser window for sending IPC events
   */
  setBrowserWindow(window: BrowserWindow): void {
    this.browserWindow = window
  }

  /**
   * Generate a unique ID for processes
   */
  private generateId(): number {
    return this.nextId++
  }

  /**
   * Register a new running agent process
   */
  async registerAgentProcess(
    agentId: number,
    agentName: string,
    projectPath: string,
    task: string,
    model: string,
    command: string,
    args: string[] = [],
    options: any = {}
  ): Promise<number> {
    const runId = this.generateId()

    // Create process info
    const processInfo: ProcessInfo = {
      runId,
      processType: ProcessType.AgentRun,
      pid: 0, // Will be set when process starts
      startedAt: new Date(),
      projectPath,
      task,
      model,
      agentId,
      agentName
    }

    // Start the process with proper options
    const processOptions = {
      cwd: projectPath,
      stdout: 'pipe' as const,
      stderr: 'pipe' as const,
      ...options
    }

    const childProcess = execa(command, args, processOptions)

    // Update PID once available
    if (childProcess.pid) {
      processInfo.pid = childProcess.pid
    }

    // Create process handle
    const handle: ProcessHandle = {
      info: processInfo,
      process: childProcess,
      liveOutput: [],
      isFinished: false
    }

    this.processes.set(runId, handle)

    // Set up output streaming
    this.setupOutputStreaming(runId, childProcess)

    // Handle process completion
    childProcess.then(
      (result) => {
        this.handleProcessCompletion(runId, result)
      },
      (error) => {
        this.handleProcessError(runId, error)
      }
    )

    this.emit('processRegistered', processInfo)
    this.notifyUI('process-registered', processInfo)

    return runId
  }

  /**
   * Register a Claude session (for tracking, no direct process management)
   */
  registerClaudeSession(
    sessionId: string,
    pid: number,
    projectPath: string,
    task: string,
    model: string
  ): number {
    const runId = this.generateId()

    const processInfo: ProcessInfo = {
      runId,
      processType: ProcessType.ClaudeSession,
      pid,
      startedAt: new Date(),
      projectPath,
      task,
      model,
      sessionId
    }

    const handle: ProcessHandle = {
      info: processInfo,
      process: null, // Claude sessions managed separately
      liveOutput: [],
      isFinished: false
    }

    this.processes.set(runId, handle)

    this.emit('processRegistered', processInfo)
    this.notifyUI('process-registered', processInfo)

    return runId
  }

  /**
   * Set up output streaming for a process
   */
  private setupOutputStreaming(runId: number, childProcess: ResultPromise<any>): void {
    const handle = this.processes.get(runId)
    if (!handle) return

    // Handle stdout
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString()
        this.appendLiveOutput(runId, output)
        this.notifyUI('process-output', { runId, output, type: 'stdout' })
      })
    }

    // Handle stderr
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString()
        this.appendLiveOutput(runId, output)
        this.notifyUI('process-output', { runId, output, type: 'stderr' })
      })
    }
  }

  /**
   * Handle process completion
   */
  private handleProcessCompletion(runId: number, result: Result): void {
    const handle = this.processes.get(runId)
    if (!handle) return

    handle.isFinished = true
    this.emit('processCompleted', { runId, result })
    this.notifyUI('process-completed', { runId, result })
  }

  /**
   * Handle process error
   */
  private handleProcessError(runId: number, error: Error): void {
    const handle = this.processes.get(runId)
    if (!handle) return

    handle.isFinished = true
    this.emit('processError', { runId, error })
    this.notifyUI('process-error', { runId, error })
  }

  /**
   * Kill a running process
   */
  async killProcess(runId: number): Promise<boolean> {
    const handle = this.processes.get(runId)
    if (!handle) {
      return false
    }

    const { info, process } = handle

    try {
      if (process && !handle.isFinished) {
        // Try graceful termination first
        if (process.pid) {
          await new Promise<void>((resolve, reject) => {
            treeKill(process.pid!, 'SIGTERM', (error) => {
              if (error) {
                console.warn(`Failed to send SIGTERM to process ${runId}:`, error)
                // Try SIGKILL as fallback
                treeKill(process.pid!, 'SIGKILL', (killError) => {
                  if (killError) {
                    reject(killError)
                  } else {
                    resolve()
                  }
                })
              } else {
                resolve()
              }
            })
          })
        }

        // Wait for process to exit (with timeout)
        try {
          await Promise.race([
            process,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ])
        } catch (timeoutError) {
          console.warn(`Process ${runId} didn't exit within timeout, force killing`)
          if (process.pid) {
            treeKill(process.pid, 'SIGKILL')
          }
        }
      }

      // Mark as finished and remove from registry
      handle.isFinished = true
      this.processes.delete(runId)

      this.emit('processKilled', info)
      this.notifyUI('process-killed', { runId })

      return true
    } catch (error) {
      console.error(`Error killing process ${runId}:`, error)
      return false
    }
  }

  /**
   * Get all running Claude sessions
   */
  getRunningClaudeSessions(): ProcessInfo[] {
    return Array.from(this.processes.values())
      .filter(
        (handle) => handle.info.processType === ProcessType.ClaudeSession && !handle.isFinished
      )
      .map((handle) => handle.info)
  }

  /**
   * Get a Claude session by session ID
   */
  getClaudeSessionById(sessionId: string): ProcessInfo | null {
    for (const handle of this.processes.values()) {
      if (
        handle.info.processType === ProcessType.ClaudeSession &&
        handle.info.sessionId === sessionId &&
        !handle.isFinished
      ) {
        return handle.info
      }
    }
    return null
  }

  /**
   * Get all running agent processes
   */
  getRunningAgentProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values())
      .filter((handle) => handle.info.processType === ProcessType.AgentRun && !handle.isFinished)
      .map((handle) => handle.info)
  }

  /**
   * Get all running processes
   */
  getRunningProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values())
      .filter((handle) => !handle.isFinished)
      .map((handle) => handle.info)
  }

  /**
   * Get a specific process
   */
  getProcess(runId: number): ProcessInfo | null {
    const handle = this.processes.get(runId)
    return handle ? handle.info : null
  }

  /**
   * Check if a process is still running
   */
  isProcessRunning(runId: number): boolean {
    const handle = this.processes.get(runId)
    if (!handle) return false

    // If process is marked as finished, it's not running
    if (handle.isFinished) return false

    // For processes with child process, check if it's still alive
    if (handle.process) {
      return !handle.process.killed && handle.process.exitCode === null
    }

    // For Claude sessions (no child process), assume running unless marked finished
    return true
  }

  /**
   * Append to live output for a process
   */
  appendLiveOutput(runId: number, output: string): void {
    const handle = this.processes.get(runId)
    if (handle) {
      handle.liveOutput.push(output)

      // Keep only last 1000 output chunks to prevent memory issues
      if (handle.liveOutput.length > 1000) {
        handle.liveOutput = handle.liveOutput.slice(-1000)
      }
    }
  }

  /**
   * Get live output for a process
   */
  getLiveOutput(runId: number): string {
    const handle = this.processes.get(runId)
    return handle ? handle.liveOutput.join('') : ''
  }

  /**
   * Cleanup finished processes
   */
  async cleanupFinishedProcesses(): Promise<number[]> {
    const finishedRunIds: number[] = []

    for (const [runId, handle] of this.processes.entries()) {
      if (handle.isFinished || (handle.process && handle.process.killed)) {
        finishedRunIds.push(runId)
        this.processes.delete(runId)
      }
    }

    return finishedRunIds
  }

  /**
   * Send notification to UI
   */
  private notifyUI(event: string, data: any): void {
    if (this.browserWindow && !this.browserWindow.isDestroyed()) {
      this.browserWindow.webContents.send(event, data)
    }
  }

  /**
   * Unregister a process
   */
  unregisterProcess(runId: number): void {
    const handle = this.processes.get(runId)
    if (handle) {
      handle.isFinished = true
      this.processes.delete(runId)
    }
  }

  /**
   * Get process count for monitoring
   */
  getProcessCount(): { total: number; agents: number; claude: number } {
    let total = 0
    let agents = 0
    let claude = 0

    for (const handle of this.processes.values()) {
      if (!handle.isFinished) {
        total++
        if (handle.info.processType === ProcessType.AgentRun) {
          agents++
        } else if (handle.info.processType === ProcessType.ClaudeSession) {
          claude++
        }
      }
    }

    return { total, agents, claude }
  }
}

// Global instance
export const processManager = new ProcessManager()
