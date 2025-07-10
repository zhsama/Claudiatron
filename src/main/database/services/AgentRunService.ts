import { Repository } from 'typeorm'
import { AgentRun } from '../entities/AgentRun'
import { getAgentRunRepository } from '../connection'

export interface AgentRunCreateData {
  agent_id: number
  agent_name: string
  agent_icon: string
  task: string
  model: string
  project_path: string
  session_id: string
  status?: string
  pid?: number
  process_started_at?: Date
}

export interface AgentRunUpdateData {
  status?: string
  pid?: number
  process_started_at?: Date
  completed_at?: Date
}

export interface AgentRunMetrics {
  duration_ms?: number
  total_tokens?: number
  cost_usd?: number
  message_count?: number
}

export interface AgentRunWithMetrics extends AgentRun {
  metrics?: AgentRunMetrics
  output?: string
}

export class AgentRunService {
  private async getRepository(): Promise<Repository<AgentRun>> {
    return await getAgentRunRepository()
  }

  /**
   * Create a new agent run
   */
  async createAgentRun(data: AgentRunCreateData): Promise<AgentRun> {
    const repository = await this.getRepository()

    const agentRun = repository.create({
      ...data,
      status: data.status || 'pending'
    })

    return await repository.save(agentRun)
  }

  /**
   * Get all agent runs
   */
  async listAgentRuns(limit?: number, offset?: number): Promise<AgentRun[]> {
    const repository = await this.getRepository()

    const query = repository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.agent', 'agent')
      .orderBy('run.created_at', 'DESC')

    if (limit) {
      query.limit(limit)
    }
    if (offset) {
      query.offset(offset)
    }

    return await query.getMany()
  }

  /**
   * Get agent runs by agent ID
   */
  async getRunsByAgentId(agentId: number, limit?: number): Promise<AgentRun[]> {
    const repository = await this.getRepository()

    const query = repository
      .createQueryBuilder('run')
      .where('run.agent_id = :agentId', { agentId })
      .orderBy('run.created_at', 'DESC')

    if (limit) {
      query.limit(limit)
    }

    return await query.getMany()
  }

  /**
   * Get agent run by ID
   */
  async getAgentRunById(id: number): Promise<AgentRun | null> {
    const repository = await this.getRepository()
    return await repository.findOne({
      where: { id },
      relations: ['agent']
    })
  }

  /**
   * Get agent run by session ID
   */
  async getAgentRunBySessionId(sessionId: string): Promise<AgentRun | null> {
    const repository = await this.getRepository()
    return await repository.findOne({
      where: { session_id: sessionId },
      relations: ['agent']
    })
  }

  /**
   * Update agent run
   */
  async updateAgentRun(id: number, data: AgentRunUpdateData): Promise<AgentRun | null> {
    const repository = await this.getRepository()

    const agentRun = await repository.findOne({ where: { id } })
    if (!agentRun) {
      return null
    }

    Object.assign(agentRun, data)

    return await repository.save(agentRun)
  }

  /**
   * Delete agent run
   */
  async deleteAgentRun(id: number): Promise<boolean> {
    const repository = await this.getRepository()

    const result = await repository.delete(id)
    return result.affected ? result.affected > 0 : false
  }

  /**
   * Get running agent runs
   */
  async getRunningAgentRuns(): Promise<AgentRun[]> {
    const repository = await this.getRepository()

    return await repository.find({
      where: { status: 'running' },
      relations: ['agent'],
      order: { created_at: 'DESC' }
    })
  }

  /**
   * Get agent runs by status
   */
  async getAgentRunsByStatus(status: string): Promise<AgentRun[]> {
    const repository = await this.getRepository()

    return await repository.find({
      where: { status },
      relations: ['agent'],
      order: { created_at: 'DESC' }
    })
  }

  /**
   * Get agent runs by project path
   */
  async getAgentRunsByProject(projectPath: string): Promise<AgentRun[]> {
    const repository = await this.getRepository()

    return await repository.find({
      where: { project_path: projectPath },
      relations: ['agent'],
      order: { created_at: 'DESC' }
    })
  }

  /**
   * Calculate metrics from JSONL content
   */
  calculateMetricsFromJSONL(jsonlContent: string): AgentRunMetrics {
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
        const usage = json.usage || json.message?.usage
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
      } catch (error) {
        // Skip invalid JSON lines
        continue
      }
    }

    const durationMs = startTime && endTime ? endTime.getTime() - startTime.getTime() : undefined

    return {
      duration_ms: durationMs,
      total_tokens: totalTokens || undefined,
      cost_usd: costUsd || undefined,
      message_count: messageCount || undefined
    }
  }

  /**
   * Get agent run statistics
   */
  async getAgentRunStats() {
    const repository = await this.getRepository()

    const [totalRuns, runningRuns, completedRuns, failedRuns] = await Promise.all([
      repository.count(),
      repository.count({ where: { status: 'running' } }),
      repository.count({ where: { status: 'completed' } }),
      repository.count({ where: { status: 'failed' } })
    ])

    // Get model distribution
    const modelStats = await repository
      .createQueryBuilder('run')
      .select('run.model', 'model')
      .addSelect('COUNT(*)', 'count')
      .groupBy('run.model')
      .getRawMany()

    // Get status distribution
    const statusStats = await repository
      .createQueryBuilder('run')
      .select('run.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('run.status')
      .getRawMany()

    return {
      totalRuns,
      runningRuns,
      completedRuns,
      failedRuns,
      pendingRuns: totalRuns - runningRuns - completedRuns - failedRuns,
      modelDistribution: modelStats.reduce(
        (acc, stat) => {
          acc[stat.model] = parseInt(stat.count)
          return acc
        },
        {} as Record<string, number>
      ),
      statusDistribution: statusStats.reduce(
        (acc, stat) => {
          acc[stat.status] = parseInt(stat.count)
          return acc
        },
        {} as Record<string, number>
      )
    }
  }

  /**
   * Cleanup old completed runs (keep last N runs per agent)
   */
  async cleanupOldRuns(keepPerAgent: number = 10): Promise<number> {
    const repository = await this.getRepository()

    // Get all agent IDs
    const agentIds = await repository
      .createQueryBuilder('run')
      .select('DISTINCT run.agent_id', 'agent_id')
      .getRawMany()

    let deletedCount = 0

    for (const { agent_id } of agentIds) {
      // Get runs for this agent, ordered by creation date (newest first)
      const runs = await repository
        .createQueryBuilder('run')
        .where('run.agent_id = :agentId', { agentId: agent_id })
        .andWhere('run.status IN (:...statuses)', {
          statuses: ['completed', 'failed', 'cancelled']
        })
        .orderBy('run.created_at', 'DESC')
        .getMany()

      // Delete runs beyond the keep limit
      if (runs.length > keepPerAgent) {
        const runsToDelete = runs.slice(keepPerAgent)
        const idsToDelete = runsToDelete.map((run) => run.id)

        const result = await repository.delete(idsToDelete)
        deletedCount += result.affected || 0
      }
    }

    return deletedCount
  }
}

// Global instance
export const agentRunService = new AgentRunService()
