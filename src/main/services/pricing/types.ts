/**
 * @fileoverview Pricing service type definitions
 * 价格服务类型定义
 */

import { z } from 'zod'

/**
 * Model pricing information from LiteLLM
 * 模型价格信息
 */
export const modelPricingSchema = z.object({
  input_cost_per_token: z.number().optional(),
  output_cost_per_token: z.number().optional(),
  cache_creation_input_token_cost: z.number().optional(),
  cache_read_input_token_cost: z.number().optional(),
  max_tokens: z.number().optional(),
  max_input_tokens: z.number().optional(),
  max_output_tokens: z.number().optional(),
  input_cost_per_second: z.number().optional(),
  output_cost_per_second: z.number().optional(),
  litellm_provider: z.string().optional(),
  mode: z.string().optional(),
  supports_function_calling: z.boolean().optional(),
  supports_parallel_function_calling: z.boolean().optional(),
  supports_vision: z.boolean().optional()
})

export type ModelPricing = z.infer<typeof modelPricingSchema>

/**
 * Token usage data structure
 * Token 使用量数据结构
 */
export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

/**
 * Cost calculation modes
 * 成本计算模式
 */
export const CostMode = {
  /** 优先使用预计算值，否则动态计算 */
  AUTO: 'auto',
  /** 始终动态计算 */
  CALCULATE: 'calculate',
  /** 始终使用预计算值 */
  DISPLAY: 'display'
} as const

export type CostMode = (typeof CostMode)[keyof typeof CostMode]

/**
 * Result type for operations that may fail
 * 可能失败的操作的结果类型
 */
export interface PricingResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Pricing fetcher configuration
 * 价格获取器配置
 */
export interface PricingConfig {
  offline: boolean
  cacheTimeout: number // in milliseconds
  litellmUrl?: string
}

/**
 * Normalized usage data with standard field names
 * 标准化的使用量数据
 */
export interface NormalizedUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

/**
 * Token statistics aggregation
 * Token 统计聚合
 */
export interface TokenStats {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  cost: number
}

/**
 * Default token stats
 * 默认 Token 统计
 */
export const defaultTokenStats: TokenStats = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  cost: 0
}
