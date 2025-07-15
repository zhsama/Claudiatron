/**
 * @fileoverview Token utilities and deduplication strategies
 * Token 工具和去重策略
 */

import { Result } from '@praha/byethrow'
import type { UsageData, LoadedUsageEntry, NormalizedUsage } from './types'
import { TOKEN_FIELD_MAPPING } from './types'
import { ValidationError } from '../../utils/result'

/**
 * Token field mapper for standardization
 * Token 字段映射器以进行标准化
 */
export class TokenFieldMapper {
  /**
   * Normalizes usage data to use standard field names
   * 规范化使用量数据以使用标准字段名称
   */
  static normalizeUsageData(usage: Record<string, any>): NormalizedUsage {
    const normalized: NormalizedUsage = {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }

    // 处理缓存 token 字段映射
    for (const [oldField, newField] of Object.entries(TOKEN_FIELD_MAPPING)) {
      if (usage[oldField] != null) {
        normalized[newField as keyof NormalizedUsage] = usage[oldField]
      }
    }

    // 直接使用标准字段
    if (usage.cache_creation_input_tokens != null) {
      normalized.cache_creation_input_tokens = usage.cache_creation_input_tokens
    }
    if (usage.cache_read_input_tokens != null) {
      normalized.cache_read_input_tokens = usage.cache_read_input_tokens
    }

    return normalized
  }

  /**
   * Transforms raw usage data to LoadedUsageEntry
   * 将原始使用量数据转换为 LoadedUsageEntry
   */
  static transformToUsageEntry(
    data: UsageData,
    projectPath: string,
    sessionId: string
  ): LoadedUsageEntry {
    const normalizedUsage = this.normalizeUsageData(data.message.usage)

    return {
      timestamp: new Date(data.timestamp),
      model: data.message.model || 'unknown',
      usage: {
        inputTokens: normalizedUsage.input_tokens,
        outputTokens: normalizedUsage.output_tokens,
        cacheCreationInputTokens: normalizedUsage.cache_creation_input_tokens,
        cacheReadInputTokens: normalizedUsage.cache_read_input_tokens
      },
      costUSD: data.costUSD || 0,
      messageId: data.message.id,
      requestId: data.requestId,
      projectPath,
      sessionId
    }
  }
}

/**
 * Deduplication handler using composite keys
 * 使用复合键的去重处理器
 */
export class DuplicationHandler {
  private processedHashes = new Set<string>()
  private hashCleanupThreshold = 100000

  /**
   * Creates a unique hash for deduplication
   * 创建用于去重的唯一哈希
   */
  private createUniqueHash(data: LoadedUsageEntry): string | null {
    const messageId = data.messageId
    const requestId = data.requestId

    if (messageId == null || requestId == null) {
      return null
    }

    return `${messageId}:${requestId}`
  }

  /**
   * Checks if an entry is a duplicate
   * 检查条目是否为重复项
   */
  isDuplicate(data: LoadedUsageEntry): boolean {
    const hash = this.createUniqueHash(data)
    return hash != null && this.processedHashes.has(hash)
  }

  /**
   * Marks an entry as processed
   * 将条目标记为已处理
   */
  markProcessed(data: LoadedUsageEntry): void {
    const hash = this.createUniqueHash(data)
    if (hash != null) {
      this.processedHashes.add(hash)
    }

    // Cleanup hashes periodically to prevent memory leaks
    // 定期清理哈希以防止内存泄漏
    if (this.processedHashes.size > this.hashCleanupThreshold) {
      this.cleanupHashes()
    }
  }

  /**
   * Clears processed hashes to prevent memory leaks
   * 清除已处理的哈希以防止内存泄漏
   */
  cleanupHashes(): void {
    this.processedHashes.clear()
    console.info('Cleared processed hashes cache to prevent memory leak')
  }

  /**
   * Gets the current number of processed hashes
   * 获取当前已处理哈希的数量
   */
  getProcessedCount(): number {
    return this.processedHashes.size
  }
}

/**
 * Token calculation utilities
 * Token 计算工具
 */
export class TokenUtils {
  /**
   * Calculates total tokens from usage data
   * 从使用量数据计算总 token 数
   */
  static getTotalTokens(usage: LoadedUsageEntry['usage']): number {
    return (
      usage.inputTokens +
      usage.outputTokens +
      usage.cacheCreationInputTokens +
      usage.cacheReadInputTokens
    )
  }

  /**
   * Calculates tokens by type
   * 按类型计算 token
   */
  static getTokensByType(entries: LoadedUsageEntry[]): {
    input: number
    output: number
    cacheCreation: number
    cacheRead: number
    total: number
  } {
    let input = 0
    let output = 0
    let cacheCreation = 0
    let cacheRead = 0

    for (const entry of entries) {
      input += entry.usage.inputTokens
      output += entry.usage.outputTokens
      cacheCreation += entry.usage.cacheCreationInputTokens
      cacheRead += entry.usage.cacheReadInputTokens
    }

    return {
      input,
      output,
      cacheCreation,
      cacheRead,
      total: input + output + cacheCreation + cacheRead
    }
  }

  /**
   * Functional token aggregation with type safety
   * 具有类型安全的函数式 token 聚合
   */
  static calculateTotals<T>(
    entries: T[],
    getUsage: (entry: T) => LoadedUsageEntry['usage'],
    getCost: (entry: T) => number
  ): {
    inputTokens: number
    outputTokens: number
    cacheCreationTokens: number
    cacheReadTokens: number
    totalCost: number
  } {
    return entries.reduce(
      (acc, entry) => {
        const usage = getUsage(entry)
        const cost = getCost(entry)

        return {
          inputTokens: acc.inputTokens + usage.inputTokens,
          outputTokens: acc.outputTokens + usage.outputTokens,
          cacheCreationTokens: acc.cacheCreationTokens + usage.cacheCreationInputTokens,
          cacheReadTokens: acc.cacheReadTokens + usage.cacheReadInputTokens,
          totalCost: acc.totalCost + cost
        }
      },
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalCost: 0
      }
    )
  }

  /**
   * Validates token counts for reasonableness
   * 验证 token 计数的合理性
   */
  static validateTokenCounts(
    usage: LoadedUsageEntry['usage']
  ): Result.Result<void, ValidationError> {
    const totalTokens = this.getTotalTokens(usage)

    // Check for negative values
    if (
      usage.inputTokens < 0 ||
      usage.outputTokens < 0 ||
      usage.cacheCreationInputTokens < 0 ||
      usage.cacheReadInputTokens < 0
    ) {
      return Result.fail(new ValidationError('Token counts cannot be negative'))
    }

    // Check for unreasonably large values (more than 1M tokens)
    if (totalTokens > 1000000) {
      return Result.fail(new ValidationError(`Token count ${totalTokens} seems unreasonably large`))
    }

    return Result.succeed(undefined)
  }
}
