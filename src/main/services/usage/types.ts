/**
 * @fileoverview Usage calculation service type definitions
 * 使用量计算服务类型定义
 */

import { z } from 'zod'

/**
 * Version schema for compatibility
 * 版本模式以保持兼容性
 */
export const versionSchema = z.string().optional()

/**
 * ISO timestamp schema
 * ISO 时间戳模式
 */
export const isoTimestampSchema = z.string().datetime()

/**
 * Message ID schema
 * 消息 ID 模式
 */
export const messageIdSchema = z.string().optional()

/**
 * Request ID schema
 * 请求 ID 模式
 */
export const requestIdSchema = z.string().optional()

/**
 * Model name schema
 * 模型名称模式
 */
export const modelNameSchema = z.string().optional()

/**
 * Usage data schema for validation
 * 使用量数据验证模式
 */
export const usageDataSchema = z.object({
  timestamp: isoTimestampSchema,
  version: versionSchema,
  message: z.object({
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional()
    }),
    model: modelNameSchema,
    id: messageIdSchema,
    content: z
      .array(
        z.object({
          text: z.string().optional()
        })
      )
      .optional()
  }),
  costUSD: z.number().optional(),
  requestId: requestIdSchema,
  isApiErrorMessage: z.boolean().optional()
})

export type UsageData = z.infer<typeof usageDataSchema>

/**
 * Loaded usage entry with additional metadata
 * 带有额外元数据的已加载使用条目
 */
export interface LoadedUsageEntry {
  timestamp: Date
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
  }
  costUSD: number
  messageId?: string
  requestId?: string
  projectPath: string
  sessionId: string
}

/**
 * Usage entry for internal processing
 * 内部处理的使用条目
 */
export interface UsageEntry {
  timestamp: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  cost: number
  session_id: string
  project_path: string
  request_id?: string
  message_type?: string
}

/**
 * Token field mapping for standardization
 * Token 字段映射以进行标准化
 */
export const TOKEN_FIELD_MAPPING = {
  // 当前项目 -> 标准字段
  cache_creation_tokens: 'cache_creation_input_tokens',
  cache_read_tokens: 'cache_read_input_tokens',

  // 兼容旧版本字段
  cache_creation_input_token: 'cache_creation_input_tokens',
  cache_read_input_token: 'cache_read_input_tokens'
} as const

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
 * Session block for 5-hour billing periods
 * 5小时计费周期的会话块
 */
export interface SessionBlock {
  startTime: Date
  endTime: Date
  entries: LoadedUsageEntry[]
  costUSD: number
  tokenCounts: {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
  }
  models: Set<string>
  isActive: boolean // 是否为当前活跃块
}

/**
 * Usage statistics aggregation
 * 使用量统计聚合
 */
export interface UsageStats {
  totalCost: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  modelBreakdown: ModelBreakdown[]
  sessionBlocks: SessionBlock[]
}

/**
 * Model breakdown statistics
 * 模型分解统计
 */
export interface ModelBreakdown {
  model: string
  totalCost: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  requestCount: number
}

/**
 * Default usage stats
 * 默认使用量统计
 */
export const defaultUsageStats: UsageStats = {
  totalCost: 0,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  modelBreakdown: [],
  sessionBlocks: []
}
