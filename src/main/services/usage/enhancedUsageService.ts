/**
 * @fileoverview Enhanced usage service integrating new calculation modules
 * 集成新计算模块的增强使用量服务
 */

import { Result } from '@praha/byethrow'
import { glob } from 'glob'
import { promises as fs } from 'fs'
import { join } from 'path'

import { PricingFetcher } from '../pricing/PricingFetcher'
import { UsageAggregator, CostCalculator } from './aggregator'
import { FileProcessor, ClaudePathManager } from './fileProcessor'
import { TokenFieldMapper } from './tokenUtils'
import type { LoadedUsageEntry, UsageStats } from './types'
import type { CostMode } from '../pricing/types'
import { usageDataSchema } from './types'

/**
 * Enhanced usage service with new calculation capabilities
 * 具有新计算功能的增强使用量服务
 */
export class EnhancedUsageService {
  private pricingFetcher: PricingFetcher
  private usageAggregator: UsageAggregator
  private costCalculator: CostCalculator

  constructor(offline = false) {
    this.pricingFetcher = new PricingFetcher({ offline })
    this.usageAggregator = new UsageAggregator(this.pricingFetcher)
    this.costCalculator = new CostCalculator(this.pricingFetcher)
  }

  /**
   * Gets usage statistics for a date range with enhanced calculation
   * 获取日期范围的使用量统计（增强计算）
   */
  async getEnhancedUsageStats(
    startDate?: string,
    endDate?: string,
    projectPath?: string,
    mode: CostMode = 'auto' as CostMode
  ): Promise<Result.Result<UsageStats, Error>> {
    try {
      // Get all Claude data directories
      const claudePaths = ClaudePathManager.getClaudePaths()
      const allEntries: LoadedUsageEntry[] = []

      // Process each Claude directory
      for (const claudePath of claudePaths) {
        const projectsPath = ClaudePathManager.getProjectsPath(claudePath)
        const entries = await this.loadUsageEntries(projectsPath, startDate, endDate, projectPath)
        if (Result.isSuccess(entries)) {
          allEntries.push(...Result.unwrap(entries))
        }
      }

      // Aggregate and calculate enhanced statistics
      const result = await this.usageAggregator.aggregateUsage(allEntries, mode)
      return result
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Gets session usage with enhanced processing
   * 获取会话使用量（增强处理）
   */
  async getEnhancedSessionUsage(
    sessionId: string,
    mode: CostMode = 'auto' as CostMode
  ): Promise<Result.Result<LoadedUsageEntry[], Error>> {
    try {
      const claudePaths = ClaudePathManager.getClaudePaths()
      const allEntries: LoadedUsageEntry[] = []

      for (const claudePath of claudePaths) {
        const projectsPath = ClaudePathManager.getProjectsPath(claudePath)
        const pattern = join(projectsPath, '**', `${sessionId}.jsonl`)
        const files = await glob(pattern.replace(/\\/g, '/'))

        for (const file of files) {
          const projectPath = this.extractProjectPath(file, projectsPath)
          const sessionId = this.extractSessionId(file)

          try {
            const content = await fs.readFile(file, 'utf-8')
            const lines = content.split('\n').filter((line) => line.trim())

            for (const line of lines) {
              try {
                const json = JSON.parse(line)
                const result = usageDataSchema.safeParse(json)
                if (result.success) {
                  const entry = TokenFieldMapper.transformToUsageEntry(
                    result.data,
                    projectPath,
                    sessionId
                  )
                  allEntries.push(entry)
                }
              } catch {
                // Skip invalid JSON lines
                continue
              }
            }
          } catch (error) {
            console.warn('Failed to read session file:', file, error)
          }
        }
      }

      // Calculate costs for the entries
      const result = await this.costCalculator.calculateCosts(allEntries, mode)
      return result
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Loads usage entries from a projects directory
   * 从项目目录加载使用量条目
   */
  private async loadUsageEntries(
    projectsPath: string,
    startDate?: string,
    endDate?: string,
    projectPath?: string
  ): Promise<Result.Result<LoadedUsageEntry[], Error>> {
    try {
      // Check if directory exists
      await fs.access(projectsPath)
    } catch {
      return Result.succeed([]) // Directory doesn't exist, return empty
    }

    const entries: LoadedUsageEntry[] = []

    // Find all JSONL files
    const pattern = join(projectsPath, '**', '*.jsonl')
    const files = await glob(pattern.replace(/\\/g, '/'))

    // Sort files by timestamp for chronological processing
    const sortedFiles = await FileProcessor.sortFilesByTimestamp(files)

    for (const file of sortedFiles) {
      try {
        // Extract project path from file location
        const fileProjectPath = this.extractProjectPath(file, projectsPath)

        // Filter by project if specified
        if (projectPath && fileProjectPath !== projectPath) {
          continue
        }

        const sessionId = this.extractSessionId(file)
        const content = await fs.readFile(file, 'utf-8')
        const lines = content.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          try {
            const json = JSON.parse(line)
            const result = usageDataSchema.safeParse(json)

            if (result.success) {
              const entry = TokenFieldMapper.transformToUsageEntry(
                result.data,
                fileProjectPath,
                sessionId
              )

              // Filter by date range if specified
              if (startDate || endDate) {
                const entryDate = entry.timestamp.toISOString().split('T')[0]
                if (startDate && entryDate < startDate) continue
                if (endDate && entryDate > endDate) continue
              }

              entries.push(entry)
            }
          } catch {
            // Skip invalid JSON lines
            continue
          }
        }
      } catch (error) {
        console.warn('Failed to read file:', file, error)
      }
    }

    return Result.succeed(entries)
  }

  /**
   * Extracts project path from file path
   * 从文件路径提取项目路径
   */
  private extractProjectPath(filePath: string, projectsPath: string): string {
    const relativePath = filePath.replace(projectsPath + '/', '')
    const parts = relativePath.split('/')
    const encodedPath = parts[0] || 'unknown'
    return this.decodeProjectPath(encodedPath)
  }

  /**
   * Extracts session ID from file path
   * 从文件路径提取会话 ID
   */
  private extractSessionId(filePath: string): string {
    const fileName = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown'
    return fileName
  }

  /**
   * Decodes project path from encoded format
   * 从编码格式解码项目路径
   */
  private decodeProjectPath(encoded: string): string {
    // Check if this looks like a Windows path with drive letter (e.g., "C--Users-...")
    if (encoded.match(/^[A-Z]--/)) {
      // Windows path with drive letter
      const driveLetter = encoded.charAt(0)
      const pathPart = encoded.substring(3) // Skip "X--"
      return `${driveLetter}:\\${pathPart.replace(/-/g, '\\')}`
    } else {
      // Unix-like path (macOS/Linux)
      return encoded.replace(/-/g, '/')
    }
  }

  /**
   * Clears cached pricing data
   * 清除缓存的价格数据
   */
  clearCache(): void {
    this.pricingFetcher.clearCache()
  }

  /**
   * Disposes of resources
   * 释放资源
   */
  dispose(): void {
    this.pricingFetcher[Symbol.dispose]()
  }
}
