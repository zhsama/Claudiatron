/**
 * @fileoverview Usage data aggregator and cost calculator
 * 使用量数据聚合器和成本计算器
 */

import { Result } from '@praha/byethrow'
import type { LoadedUsageEntry, UsageStats, ModelBreakdown, SessionBlock } from './types'
import { defaultUsageStats } from './types'
import { TokenUtils, DuplicationHandler } from './tokenUtils'
import { PricingFetcher } from '../pricing/PricingFetcher'
import type { CostMode } from '../pricing/types'
import { CostMode as CostModeValues } from '../pricing/types'
import { UsageCalculationError } from '../../utils/result'

/**
 * Cost calculation strategy interface
 * 成本计算策略接口
 */
interface CostCalculationStrategy {
  calculateCost(entry: LoadedUsageEntry): Promise<Result.Result<number, Error>>
}

/**
 * Auto cost calculation strategy
 * 自动成本计算策略
 */
class AutoCostStrategy implements CostCalculationStrategy {
  constructor(private _pricingFetcher: PricingFetcher) {}

  async calculateCost(entry: LoadedUsageEntry): Promise<Result.Result<number, Error>> {
    // 优先使用预计算值
    if (entry.costUSD && entry.costUSD > 0) {
      return Result.succeed(entry.costUSD)
    }

    // 否则动态计算
    return await this._pricingFetcher.calculateCostFromTokens(
      {
        input_tokens: entry.usage.inputTokens,
        output_tokens: entry.usage.outputTokens,
        cache_creation_input_tokens: entry.usage.cacheCreationInputTokens,
        cache_read_input_tokens: entry.usage.cacheReadInputTokens
      },
      entry.model
    )
  }
}

/**
 * Calculate cost calculation strategy
 * 计算成本计算策略
 */
class CalculateCostStrategy implements CostCalculationStrategy {
  constructor(private _pricingFetcher: PricingFetcher) {}

  async calculateCost(entry: LoadedUsageEntry): Promise<Result.Result<number, Error>> {
    // 始终动态计算
    return await this._pricingFetcher.calculateCostFromTokens(
      {
        input_tokens: entry.usage.inputTokens,
        output_tokens: entry.usage.outputTokens,
        cache_creation_input_tokens: entry.usage.cacheCreationInputTokens,
        cache_read_input_tokens: entry.usage.cacheReadInputTokens
      },
      entry.model
    )
  }
}

/**
 * Display cost calculation strategy
 * 显示成本计算策略
 */
class DisplayCostStrategy implements CostCalculationStrategy {
  async calculateCost(entry: LoadedUsageEntry): Promise<Result.Result<number, Error>> {
    // 始终使用预计算值
    return Result.succeed(entry.costUSD || 0)
  }
}

/**
 * Cost calculator with multiple calculation modes
 * 具有多种计算模式的成本计算器
 */
export class CostCalculator {
  private strategies: Map<CostMode, CostCalculationStrategy>

  constructor(pricingFetcher: PricingFetcher) {
    this.strategies = new Map([
      [CostModeValues.AUTO, new AutoCostStrategy(pricingFetcher)],
      [CostModeValues.CALCULATE, new CalculateCostStrategy(pricingFetcher)],
      [CostModeValues.DISPLAY, new DisplayCostStrategy()]
    ])
  }

  /**
   * Calculates cost for a single entry using the specified mode
   * 使用指定模式计算单个条目的成本
   */
  async calculateCost(
    entry: LoadedUsageEntry,
    mode: CostMode = CostModeValues.AUTO
  ): Promise<Result.Result<number, Error>> {
    const strategy = this.strategies.get(mode)
    if (!strategy) {
      return Result.fail(new UsageCalculationError(`Unknown cost mode: ${mode}`))
    }

    return await strategy.calculateCost(entry)
  }

  /**
   * Calculates costs for multiple entries
   * 计算多个条目的成本
   */
  async calculateCosts(
    entries: LoadedUsageEntry[],
    mode: CostMode = CostModeValues.AUTO
  ): Promise<Result.Result<LoadedUsageEntry[], Error>> {
    const processedEntries: LoadedUsageEntry[] = []

    for (const entry of entries) {
      const costResult = await this.calculateCost(entry, mode)

      if (Result.isFailure(costResult)) {
        console.warn(`Failed to calculate cost for entry ${entry.messageId}:`, costResult.error)
        // Use original cost or 0 as fallback
        processedEntries.push({ ...entry, costUSD: entry.costUSD || 0 })
      } else {
        processedEntries.push({ ...entry, costUSD: Result.unwrap(costResult) })
      }
    }

    return Result.succeed(processedEntries)
  }
}

/**
 * Session block functionality for 5-hour billing periods
 * 5小时计费周期的会话块功能
 */
export class SessionBlockManager {
  /**
   * Identifies session blocks from usage entries
   * 从使用条目识别会话块
   */
  static identifySessionBlocks(
    entries: LoadedUsageEntry[],
    sessionDurationHours = 5
  ): SessionBlock[] {
    if (entries.length === 0) return []

    const sortedEntries = entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    const blocks: SessionBlock[] = []
    let currentBlock: SessionBlock | null = null
    const sessionDurationMs = sessionDurationHours * 60 * 60 * 1000

    for (const entry of sortedEntries) {
      if (
        currentBlock == null ||
        entry.timestamp.getTime() - currentBlock.startTime.getTime() >= sessionDurationMs
      ) {
        // 创建新的 block
        if (currentBlock != null) {
          blocks.push(currentBlock)
        }

        currentBlock = {
          startTime: entry.timestamp,
          endTime: new Date(entry.timestamp.getTime() + sessionDurationMs),
          entries: [entry],
          costUSD: entry.costUSD,
          tokenCounts: {
            inputTokens: entry.usage.inputTokens,
            outputTokens: entry.usage.outputTokens,
            cacheCreationInputTokens: entry.usage.cacheCreationInputTokens,
            cacheReadInputTokens: entry.usage.cacheReadInputTokens
          },
          models: new Set([entry.model]),
          isActive: false
        }
      } else {
        // 添加到当前 block
        currentBlock.entries.push(entry)
        currentBlock.costUSD += entry.costUSD
        currentBlock.tokenCounts.inputTokens += entry.usage.inputTokens
        currentBlock.tokenCounts.outputTokens += entry.usage.outputTokens
        currentBlock.tokenCounts.cacheCreationInputTokens += entry.usage.cacheCreationInputTokens
        currentBlock.tokenCounts.cacheReadInputTokens += entry.usage.cacheReadInputTokens
        currentBlock.models.add(entry.model)
      }
    }

    if (currentBlock != null) {
      // 判断最后一个 block 是否为活跃状态
      const now = new Date()
      currentBlock.isActive = currentBlock.endTime > now
      blocks.push(currentBlock)
    }

    return blocks
  }
}

/**
 * Usage data aggregator with streaming support
 * 支持流式处理的使用量数据聚合器
 */
export class UsageAggregator {
  private duplicationHandler: DuplicationHandler
  private costCalculator: CostCalculator
  private batchSize: number

  constructor(pricingFetcher: PricingFetcher, batchSize = 1000) {
    this.duplicationHandler = new DuplicationHandler()
    this.costCalculator = new CostCalculator(pricingFetcher)
    this.batchSize = batchSize
  }

  /**
   * Aggregates usage data with deduplication and cost calculation
   * 聚合使用量数据，包括去重和成本计算
   */
  async aggregateUsage(
    entries: LoadedUsageEntry[],
    mode: CostMode = CostModeValues.AUTO
  ): Promise<Result.Result<UsageStats, Error>> {
    // Filter duplicates
    const deduplicatedEntries = this.filterDuplicates(entries)

    // Calculate costs if needed
    const costCalculationResult = await this.costCalculator.calculateCosts(
      deduplicatedEntries,
      mode
    )
    if (Result.isFailure(costCalculationResult)) {
      return Result.fail(costCalculationResult.error)
    }

    const processedEntries = Result.unwrap(costCalculationResult)

    // Calculate aggregated statistics
    const stats = this.calculateAggregatedStats(processedEntries)

    return Result.succeed(stats)
  }

  /**
   * Processes large datasets in batches
   * 批量处理大型数据集
   */
  async processLargeDataset(
    entries: LoadedUsageEntry[],
    mode: CostMode = CostModeValues.AUTO
  ): Promise<Result.Result<UsageStats, Error>> {
    const aggregatedStats = { ...defaultUsageStats }

    for (let i = 0; i < entries.length; i += this.batchSize) {
      const batch = entries.slice(i, i + this.batchSize)
      const batchResult = await this.aggregateUsage(batch, mode)

      if (Result.isFailure(batchResult)) {
        return Result.fail(batchResult.error)
      }

      // Merge batch results
      this.mergeBatchStats(aggregatedStats, Result.unwrap(batchResult))
    }

    return Result.succeed(aggregatedStats)
  }

  /**
   * Filters duplicate entries
   * 过滤重复条目
   */
  private filterDuplicates(entries: LoadedUsageEntry[]): LoadedUsageEntry[] {
    const filteredEntries: LoadedUsageEntry[] = []

    for (const entry of entries) {
      if (!this.duplicationHandler.isDuplicate(entry)) {
        filteredEntries.push(entry)
        this.duplicationHandler.markProcessed(entry)
      }
    }

    return filteredEntries
  }

  /**
   * Calculates aggregated statistics
   * 计算聚合统计信息
   */
  private calculateAggregatedStats(entries: LoadedUsageEntry[]): UsageStats {
    const totals = TokenUtils.calculateTotals(
      entries,
      (entry) => entry.usage,
      (entry) => entry.costUSD
    )

    // Calculate model breakdown
    const modelBreakdown = this.calculateModelBreakdown(entries)

    // Identify session blocks
    const sessionBlocks = SessionBlockManager.identifySessionBlocks(entries)

    return {
      totalCost: totals.totalCost,
      totalTokens:
        totals.inputTokens +
        totals.outputTokens +
        totals.cacheCreationTokens +
        totals.cacheReadTokens,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheCreationTokens: totals.cacheCreationTokens,
      cacheReadTokens: totals.cacheReadTokens,
      modelBreakdown,
      sessionBlocks
    }
  }

  /**
   * Calculates model breakdown statistics
   * 计算模型分解统计信息
   */
  private calculateModelBreakdown(entries: LoadedUsageEntry[]): ModelBreakdown[] {
    const modelStats = new Map<string, ModelBreakdown>()

    for (const entry of entries) {
      if (!modelStats.has(entry.model)) {
        modelStats.set(entry.model, {
          model: entry.model,
          totalCost: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          requestCount: 0
        })
      }

      const stats = modelStats.get(entry.model)!
      stats.totalCost += entry.costUSD
      stats.inputTokens += entry.usage.inputTokens
      stats.outputTokens += entry.usage.outputTokens
      stats.cacheCreationInputTokens += entry.usage.cacheCreationInputTokens
      stats.cacheReadInputTokens += entry.usage.cacheReadInputTokens
      stats.totalTokens += TokenUtils.getTotalTokens(entry.usage)
      stats.requestCount += 1
    }

    return Array.from(modelStats.values()).sort((a, b) => b.totalCost - a.totalCost)
  }

  /**
   * Merges batch statistics
   * 合并批次统计信息
   */
  private mergeBatchStats(target: UsageStats, source: UsageStats): void {
    target.totalCost += source.totalCost
    target.totalTokens += source.totalTokens
    target.inputTokens += source.inputTokens
    target.outputTokens += source.outputTokens
    target.cacheCreationTokens += source.cacheCreationTokens
    target.cacheReadTokens += source.cacheReadTokens

    // Merge model breakdown
    const modelMap = new Map<string, ModelBreakdown>()

    // Add existing models
    for (const model of target.modelBreakdown) {
      modelMap.set(model.model, { ...model })
    }

    // Merge source models
    for (const model of source.modelBreakdown) {
      if (modelMap.has(model.model)) {
        const existing = modelMap.get(model.model)!
        existing.totalCost += model.totalCost
        existing.totalTokens += model.totalTokens
        existing.inputTokens += model.inputTokens
        existing.outputTokens += model.outputTokens
        existing.cacheCreationInputTokens += model.cacheCreationInputTokens
        existing.cacheReadInputTokens += model.cacheReadInputTokens
        existing.requestCount += model.requestCount
      } else {
        modelMap.set(model.model, { ...model })
      }
    }

    target.modelBreakdown = Array.from(modelMap.values()).sort((a, b) => b.totalCost - a.totalCost)

    // Merge session blocks
    target.sessionBlocks.push(...source.sessionBlocks)
  }
}
