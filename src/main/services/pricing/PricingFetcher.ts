/**
 * @fileoverview Model pricing data fetcher for cost calculations
 * 模型价格数据获取器
 */

import { Result } from '@praha/byethrow'
import type { ModelPricing, TokenUsage, PricingConfig } from './types'
import { modelPricingSchema } from './types'
import {
  LITELLM_PRICING_URL,
  DEFAULT_PRICING_CONFIG,
  MODEL_NAME_MAPPING,
  FALLBACK_PRICING
} from './constants'
import { PricingFetchError, ResultUtils } from '../../utils/result'

/**
 * Fetches and caches model pricing information from LiteLLM
 * 从 LiteLLM 获取和缓存模型价格信息
 */
export class PricingFetcher implements Disposable {
  private cachedPricing: Map<string, ModelPricing> | null = null
  private cacheTimestamp: number = 0
  private readonly config: PricingConfig

  /**
   * Creates a new PricingFetcher instance
   * 创建新的 PricingFetcher 实例
   */
  constructor(config: Partial<PricingConfig> = {}) {
    this.config = { ...DEFAULT_PRICING_CONFIG, ...config }
  }

  /**
   * Implements Disposable interface for automatic cleanup
   * 实现 Disposable 接口以自动清理
   */
  [Symbol.dispose](): void {
    this.clearCache()
  }

  /**
   * Clears the cached pricing data
   * 清除缓存的价格数据
   */
  clearCache(): void {
    this.cachedPricing = null
    this.cacheTimestamp = 0
  }

  /**
   * Checks if cached data is still valid
   * 检查缓存数据是否仍然有效
   */
  private isCacheValid(): boolean {
    if (!this.cachedPricing || this.cacheTimestamp === 0) {
      return false
    }
    const now = Date.now()
    return now - this.cacheTimestamp < this.config.cacheTimeout
  }

  /**
   * Loads offline pricing data from fallback
   * 从降级数据加载离线价格数据
   */
  private loadOfflinePricing(): Result.Result<Map<string, ModelPricing>, Error> {
    return ResultUtils.fromSync(() => {
      const pricing = new Map<string, ModelPricing>()
      for (const [modelName, modelData] of Object.entries(FALLBACK_PRICING)) {
        pricing.set(modelName, modelData)
      }
      this.cachedPricing = pricing
      this.cacheTimestamp = Date.now()
      return pricing
    })
  }

  /**
   * Fetches pricing data from LiteLLM API
   * 从 LiteLLM API 获取价格数据
   */
  private async fetchOnlinePricing(): Promise<Result.Result<Map<string, ModelPricing>, Error>> {
    const url = this.config.litellmUrl || LITELLM_PRICING_URL

    return Result.pipe(
      await ResultUtils.fromPromise(fetch(url)),
      Result.andThen(async (response) => {
        if (!response.ok) {
          return Result.fail(
            new PricingFetchError(`HTTP ${response.status}: ${response.statusText}`)
          )
        }
        return Result.succeed(response)
      }),
      Result.andThen(async (response) => {
        return await ResultUtils.fromPromise(response.json() as Promise<Record<string, unknown>>)
      }),
      Result.map((data) => {
        const pricing = new Map<string, ModelPricing>()
        for (const [modelName, modelData] of Object.entries(data)) {
          if (typeof modelData === 'object' && modelData !== null) {
            const parsed = modelPricingSchema.safeParse(modelData)
            if (parsed.success) {
              pricing.set(modelName, parsed.data)
            }
          }
        }
        this.cachedPricing = pricing
        this.cacheTimestamp = Date.now()
        return pricing
      })
    )
  }

  /**
   * Handles fallback to offline pricing when online fetch fails
   * 当在线获取失败时处理降级到离线价格
   */
  private async handleFallbackToCachedPricing(
    originalError: Error
  ): Promise<Result.Result<Map<string, ModelPricing>, Error>> {
    console.warn(
      'Failed to fetch model pricing from LiteLLM, falling back to cached pricing data:',
      originalError.message
    )

    const fallbackResult = this.loadOfflinePricing()
    if (Result.isSuccess(fallbackResult)) {
      console.info(`Using cached pricing data for ${Result.unwrap(fallbackResult).size} models`)
      return Result.succeed(Result.unwrap(fallbackResult))
    } else {
      console.error('Failed to load cached pricing data as fallback:', fallbackResult.error)
      return Result.fail(
        new PricingFetchError('Both online and offline pricing failed', originalError)
      )
    }
  }

  /**
   * Ensures pricing data is loaded, either from cache or by fetching
   * 确保价格数据已加载，从缓存或通过获取
   */
  private async ensurePricingLoaded(): Promise<Result.Result<Map<string, ModelPricing>, Error>> {
    // Check if we have valid cached data
    if (this.isCacheValid()) {
      return Result.succeed(this.cachedPricing!)
    }

    // If we're in offline mode, use fallback data
    if (this.config.offline) {
      return this.loadOfflinePricing()
    }

    // Try to fetch online data
    console.log('Fetching latest model pricing from LiteLLM...')
    const onlineResult = await this.fetchOnlinePricing()

    if (Result.isSuccess(onlineResult)) {
      console.info(`Loaded pricing for ${Result.unwrap(onlineResult).size} models`)
      return onlineResult
    } else {
      // Fallback to offline data
      return await this.handleFallbackToCachedPricing(onlineResult.error)
    }
  }

  /**
   * Fetches all available model pricing data
   * 获取所有可用的模型价格数据
   */
  async fetchModelPricing(): Promise<Result.Result<Map<string, ModelPricing>, Error>> {
    return await this.ensurePricingLoaded()
  }

  /**
   * Normalizes model name for pricing lookup
   * 标准化模型名称以进行价格查找
   */
  private normalizeModelName(modelName: string): string[] {
    const variations = [modelName]

    // Check mapping table
    const mapped = MODEL_NAME_MAPPING[modelName as keyof typeof MODEL_NAME_MAPPING]
    if (mapped) {
      variations.push(mapped)
    }

    // Add provider prefix variations
    variations.push(`anthropic/${modelName}`)

    // Try with different pattern variations
    const lowerName = modelName.toLowerCase()
    if (lowerName.includes('claude')) {
      // Try various Claude naming patterns
      const patterns = [
        modelName,
        `claude-${modelName.replace('claude-', '')}`,
        `claude-3-${modelName.replace(/^claude-.*?-/, '')}`,
        `claude-3-5-${modelName.replace(/^claude-.*?-/, '')}`
      ]
      variations.push(...patterns)
    }

    return [...new Set(variations)] // Remove duplicates
  }

  /**
   * Gets pricing information for a specific model with fallback matching
   * 获取特定模型的价格信息，支持降级匹配
   */
  async getModelPricing(modelName: string): Promise<Result.Result<ModelPricing | null, Error>> {
    const pricingResult = await this.ensurePricingLoaded()

    if (Result.isFailure(pricingResult)) {
      return Result.fail(pricingResult.error)
    }

    const pricing = Result.unwrap(pricingResult)
    const variations = this.normalizeModelName(modelName)

    // Try exact matches first
    for (const variant of variations) {
      const match = pricing.get(variant)
      if (match) {
        return Result.succeed(match)
      }
    }

    // Try partial matches
    const lowerModel = modelName.toLowerCase()
    for (const [key, value] of pricing) {
      const lowerKey = key.toLowerCase()
      if (lowerKey.includes(lowerModel) || lowerModel.includes(lowerKey)) {
        return Result.succeed(value)
      }
    }

    return Result.succeed(null)
  }

  /**
   * Calculates the cost for given token usage and model
   * 计算给定 token 使用量和模型的成本
   */
  async calculateCostFromTokens(
    tokens: TokenUsage,
    modelName: string
  ): Promise<Result.Result<number, Error>> {
    const pricingResult = await this.getModelPricing(modelName)

    if (Result.isFailure(pricingResult)) {
      return Result.fail(pricingResult.error)
    }

    const pricing = Result.unwrap(pricingResult)
    if (!pricing) {
      console.warn(`No pricing found for model: ${modelName}, returning $0`)
      return Result.succeed(0)
    }

    return Result.succeed(this.calculateCostFromPricing(tokens, pricing))
  }

  /**
   * Calculates cost from token usage and pricing information
   * 从 token 使用量和价格信息计算成本
   */
  calculateCostFromPricing(tokens: TokenUsage, pricing: ModelPricing): number {
    let cost = 0

    // Input tokens cost
    if (pricing.input_cost_per_token != null) {
      cost += tokens.input_tokens * pricing.input_cost_per_token
    }

    // Output tokens cost
    if (pricing.output_cost_per_token != null) {
      cost += tokens.output_tokens * pricing.output_cost_per_token
    }

    // Cache creation tokens cost
    if (
      tokens.cache_creation_input_tokens != null &&
      pricing.cache_creation_input_token_cost != null
    ) {
      cost += tokens.cache_creation_input_tokens * pricing.cache_creation_input_token_cost
    }

    // Cache read tokens cost
    if (tokens.cache_read_input_tokens != null && pricing.cache_read_input_token_cost != null) {
      cost += tokens.cache_read_input_tokens * pricing.cache_read_input_token_cost
    }

    return cost
  }
}
