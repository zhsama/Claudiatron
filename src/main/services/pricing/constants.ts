/**
 * @fileoverview Pricing service constants
 * 价格服务常量
 */

/**
 * LiteLLM pricing API URL
 * LiteLLM 价格 API 地址
 */
export const LITELLM_PRICING_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

/**
 * Cache configuration
 * 缓存配置
 */
export const CACHE_CONFIG = {
  /** 缓存超时时间（1小时） */
  TIMEOUT_MS: 60 * 60 * 1000,
  /** 最大缓存大小 */
  MAX_SIZE: 1000
} as const

/**
 * Default pricing configuration
 * 默认价格配置
 */
export const DEFAULT_PRICING_CONFIG = {
  offline: false,
  cacheTimeout: CACHE_CONFIG.TIMEOUT_MS,
  litellmUrl: LITELLM_PRICING_URL
} as const

/**
 * Model name mapping for compatibility
 * 模型名称映射以保持兼容性
 */
export const MODEL_NAME_MAPPING = {
  // Current project naming -> Standard naming
  'claude-opus-4-20250514': 'claude-4-opus-20250514',
  'claude-sonnet-4-20250514': 'claude-4-sonnet-20250514',
  'claude-haiku-4-20250514': 'claude-4-haiku-20250514',

  // Legacy model names
  opus: 'claude-4-opus-20250514',
  sonnet: 'claude-4-sonnet-20250514',
  haiku: 'claude-4-haiku-20250514',

  // Generic names
  'opus-4': 'claude-4-opus-20250514',
  'sonnet-4': 'claude-4-sonnet-20250514',
  'haiku-4': 'claude-4-haiku-20250514'
} as const

/**
 * Fallback pricing data (precompiled)
 * 降级价格数据（预编译）
 */
export const FALLBACK_PRICING = {
  'claude-4-opus-20250514': {
    input_cost_per_token: 0.000015,
    output_cost_per_token: 0.000075,
    cache_creation_input_token_cost: 0.00001875,
    cache_read_input_token_cost: 0.0000015
  },
  'claude-4-sonnet-20250514': {
    input_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    cache_creation_input_token_cost: 0.00000375,
    cache_read_input_token_cost: 0.0000003
  },
  'claude-4-haiku-20250514': {
    input_cost_per_token: 0.000001,
    output_cost_per_token: 0.000005,
    cache_creation_input_token_cost: 0.00000125,
    cache_read_input_token_cost: 0.0000001
  }
} as const
