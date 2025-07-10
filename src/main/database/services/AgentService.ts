import { Repository } from 'typeorm'
import { Agent } from '../entities/Agent'
import { getAgentRepository } from '../connection'

export interface AgentCreateData {
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

export interface AgentUpdateData extends Partial<AgentCreateData> {
  id: number
}

export class AgentService {
  private async getRepository(): Promise<Repository<Agent>> {
    return await getAgentRepository()
  }

  /**
   * Create a new agent
   */
  async createAgent(data: AgentCreateData): Promise<Agent> {
    const repository = await this.getRepository()

    const agent = repository.create({
      ...data,
      model: data.model || 'sonnet',
      enable_file_read: data.enable_file_read ?? true,
      enable_file_write: data.enable_file_write ?? true,
      enable_network: data.enable_network ?? false
    })

    return await repository.save(agent)
  }

  /**
   * Get all agents
   */
  async listAgents(): Promise<Agent[]> {
    const repository = await this.getRepository()
    return await repository.find({
      order: {
        created_at: 'DESC'
      }
    })
  }

  /**
   * Get agent by ID
   */
  async getAgentById(id: number): Promise<Agent | null> {
    const repository = await this.getRepository()
    return await repository.findOne({
      where: { id },
      relations: ['runs']
    })
  }

  /**
   * Update agent
   */
  async updateAgent(data: AgentUpdateData): Promise<Agent | null> {
    const repository = await this.getRepository()

    const agent = await repository.findOne({ where: { id: data.id } })
    if (!agent) {
      return null
    }

    // Update fields
    Object.assign(agent, data)

    return await repository.save(agent)
  }

  /**
   * Delete agent
   */
  async deleteAgent(id: number): Promise<boolean> {
    const repository = await this.getRepository()

    const result = await repository.delete(id)
    return result.affected ? result.affected > 0 : false
  }

  /**
   * Get agents with run counts
   */
  async getAgentsWithRunCounts(): Promise<Array<Agent & { runCount: number }>> {
    const repository = await this.getRepository()

    const agents = await repository
      .createQueryBuilder('agent')
      .leftJoinAndSelect('agent.runs', 'runs')
      .loadRelationCountAndMap('agent.runCount', 'agent.runs')
      .orderBy('agent.created_at', 'DESC')
      .getMany()

    return agents as Array<Agent & { runCount: number }>
  }

  /**
   * Search agents by name
   */
  async searchAgents(query: string): Promise<Agent[]> {
    const repository = await this.getRepository()

    return await repository
      .createQueryBuilder('agent')
      .where('agent.name LIKE :query', { query: `%${query}%` })
      .orWhere('agent.system_prompt LIKE :query', { query: `%${query}%` })
      .orderBy('agent.created_at', 'DESC')
      .getMany()
  }

  /**
   * Get agents by model
   */
  async getAgentsByModel(model: string): Promise<Agent[]> {
    const repository = await this.getRepository()

    return await repository.find({
      where: { model },
      order: { created_at: 'DESC' }
    })
  }

  /**
   * Clone an agent
   */
  async cloneAgent(id: number, newName?: string): Promise<Agent | null> {
    const originalAgent = await this.getAgentById(id)
    if (!originalAgent) {
      return null
    }

    const cloneData: AgentCreateData = {
      name: newName || `${originalAgent.name} (Copy)`,
      icon: originalAgent.icon,
      system_prompt: originalAgent.system_prompt,
      default_task: originalAgent.default_task,
      model: originalAgent.model,
      enable_file_read: originalAgent.enable_file_read,
      enable_file_write: originalAgent.enable_file_write,
      enable_network: originalAgent.enable_network,
      hooks: originalAgent.hooks
    }

    return await this.createAgent(cloneData)
  }

  /**
   * Get agent statistics
   */
  async getAgentStats() {
    const repository = await this.getRepository()

    const [totalAgents, agentsWithRuns] = await Promise.all([
      repository.count(),
      repository.createQueryBuilder('agent').innerJoin('agent.runs', 'runs').getCount()
    ])

    // Get model distribution
    const modelStats = await repository
      .createQueryBuilder('agent')
      .select('agent.model', 'model')
      .addSelect('COUNT(*)', 'count')
      .groupBy('agent.model')
      .getRawMany()

    return {
      totalAgents,
      agentsWithRuns,
      agentsWithoutRuns: totalAgents - agentsWithRuns,
      modelDistribution: modelStats.reduce(
        (acc, stat) => {
          acc[stat.model] = parseInt(stat.count)
          return acc
        },
        {} as Record<string, number>
      )
    }
  }
}

// Global instance
export const agentService = new AgentService()
