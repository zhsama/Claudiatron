/**
 * @fileoverview File processing and timestamp sorting utilities
 * 文件处理和时间戳排序工具
 */

import { promises as fs, statSync } from 'fs'
import { join } from 'path'
import { Result } from '@praha/byethrow'
import type { LoadedUsageEntry } from './types'
import { usageDataSchema } from './types'
import { TokenFieldMapper } from './tokenUtils'
import { ProcessingError, ValidationError } from '../../utils/result'

/**
 * File processor for JSONL usage data files
 * JSONL 使用量数据文件处理器
 */
export class FileProcessor {
  /**
   * Extracts the earliest timestamp from a JSONL file
   * 从 JSONL 文件提取最早时间戳
   */
  static async getEarliestTimestamp(filePath: string): Promise<Date | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n')

      let earliestDate: Date | null = null

      for (const line of lines) {
        if (line.trim() === '') continue

        try {
          const json = JSON.parse(line) as Record<string, unknown>
          if (json.timestamp != null && typeof json.timestamp === 'string') {
            const date = new Date(json.timestamp)
            if (!Number.isNaN(date.getTime())) {
              if (earliestDate == null || date < earliestDate) {
                earliestDate = date
              }
            }
          }
        } catch {
          continue // 跳过无效 JSON 行
        }
      }

      return earliestDate
    } catch (error) {
      console.debug(`Failed to get earliest timestamp for ${filePath}:`, error)
      return null
    }
  }

  /**
   * Sorts files by their earliest timestamp
   * 按最早时间戳对文件进行排序
   */
  static async sortFilesByTimestamp(files: string[]): Promise<string[]> {
    const filesWithTimestamps = await Promise.all(
      files.map(async (file) => ({
        file,
        timestamp: await this.getEarliestTimestamp(file)
      }))
    )

    return filesWithTimestamps
      .sort((a, b) => {
        // 无时间戳的文件排到最后
        if (a.timestamp == null && b.timestamp == null) return 0
        if (a.timestamp == null) return 1
        if (b.timestamp == null) return -1

        // 按时间戳排序（最早的在前）
        return a.timestamp.getTime() - b.timestamp.getTime()
      })
      .map((item) => item.file)
  }

  /**
   * Processes a single JSONL file and returns usage entries
   * 处理单个 JSONL 文件并返回使用条目
   */
  static processFile(
    filePath: string,
    projectPath: string,
    sessionId: string
  ): Result.Result<LoadedUsageEntry[], ProcessingError> {
    return Result.pipe(
      this.readFile(filePath),
      Result.andThen((content) => this.parseJsonLines(content)),
      Result.andThen((lines) => this.validateAndTransform(lines, projectPath, sessionId)),
      Result.inspectError((error) => console.warn(`Failed to process file ${filePath}:`, error))
    )
  }

  /**
   * Creates an async generator for streaming file processing
   * 创建用于流式文件处理的异步生成器
   */
  static async *createFileStream(
    filePath: string,
    projectPath: string,
    sessionId: string
  ): AsyncIterableIterator<LoadedUsageEntry> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        if (line.trim() === '') continue

        try {
          const json = JSON.parse(line)
          const result = usageDataSchema.safeParse(json)
          if (result.success) {
            yield TokenFieldMapper.transformToUsageEntry(result.data, projectPath, sessionId)
          }
        } catch {
          // 跳过无效行
          continue
        }
      }
    } catch (error) {
      console.warn(`Failed to stream file ${filePath}:`, error)
    }
  }

  /**
   * Reads file content
   * 读取文件内容
   */
  private static readFile(_filePath: string): Result.Result<string, Error> {
    return Result.fail(new Error('Use async file reading at caller level'))
  }

  /**
   * Parses JSONL content into individual lines
   * 将 JSONL 内容解析为单独的行
   */
  private static parseJsonLines(content: string): Result.Result<unknown[], Error> {
    try {
      const lines = content.trim().split('\n')
      const parsedLines: unknown[] = []

      for (const line of lines) {
        if (line.trim() === '') continue

        try {
          const json = JSON.parse(line)
          parsedLines.push(json)
        } catch {
          // 跳过无效 JSON 行
          continue
        }
      }

      return Result.succeed(parsedLines)
    } catch (error) {
      return Result.fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Validates and transforms raw data to usage entries
   * 验证并将原始数据转换为使用条目
   */
  private static validateAndTransform(
    rawData: unknown[],
    projectPath: string,
    sessionId: string
  ): Result.Result<LoadedUsageEntry[], ValidationError> {
    const validEntries: LoadedUsageEntry[] = []
    const errors: string[] = []

    for (const [index, data] of rawData.entries()) {
      const result = usageDataSchema.safeParse(data)
      if (result.success) {
        validEntries.push(
          TokenFieldMapper.transformToUsageEntry(result.data, projectPath, sessionId)
        )
      } else {
        errors.push(`Line ${index + 1}: ${result.error.message}`)
      }
    }

    if (errors.length > 0) {
      console.debug(`Validation errors in file: ${errors.join(', ')}`)
    }

    return Result.succeed(validEntries)
  }
}

/**
 * Multi-path Claude data directory support
 * 多路径 Claude 数据目录支持
 */
export class ClaudePathManager {
  private static readonly CLAUDE_CONFIG_DIR_ENV = 'CLAUDE_CONFIG_DIR'
  private static readonly DEFAULT_CLAUDE_CONFIG_PATH = join(
    process.env.HOME || '',
    '.config',
    'claude'
  )
  private static readonly DEFAULT_CLAUDE_CODE_PATH = join(process.env.HOME || '', '.claude')
  private static readonly CLAUDE_PROJECTS_DIR_NAME = 'projects'

  /**
   * Gets all valid Claude data directory paths
   * 获取所有有效的 Claude 数据目录路径
   */
  static getClaudePaths(): string[] {
    const paths: string[] = []
    const normalizedPaths = new Set<string>()

    // 检查环境变量（支持逗号分隔的多个路径）
    const envPaths = (process.env[this.CLAUDE_CONFIG_DIR_ENV] ?? '').trim()
    if (envPaths !== '') {
      const envPathList = envPaths
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p !== '')
      for (const envPath of envPathList) {
        const normalizedPath = join(envPath)
        if (this.isValidClaudeDirectory(normalizedPath)) {
          if (!normalizedPaths.has(normalizedPath)) {
            normalizedPaths.add(normalizedPath)
            paths.push(normalizedPath)
          }
        }
      }
    }

    // 添加默认路径
    const defaultPaths = [this.DEFAULT_CLAUDE_CONFIG_PATH, this.DEFAULT_CLAUDE_CODE_PATH]

    for (const defaultPath of defaultPaths) {
      const normalizedPath = join(defaultPath)
      if (this.isValidClaudeDirectory(normalizedPath)) {
        if (!normalizedPaths.has(normalizedPath)) {
          normalizedPaths.add(normalizedPath)
          paths.push(normalizedPath)
        }
      }
    }

    if (paths.length === 0) {
      throw new Error(
        `No valid Claude data directories found. Please ensure at least one exists:\n` +
          `- ${join(this.DEFAULT_CLAUDE_CONFIG_PATH, this.CLAUDE_PROJECTS_DIR_NAME)}\n` +
          `- ${join(this.DEFAULT_CLAUDE_CODE_PATH, this.CLAUDE_PROJECTS_DIR_NAME)}\n` +
          `- Or set ${this.CLAUDE_CONFIG_DIR_ENV} environment variable`
      )
    }

    return paths
  }

  /**
   * Checks if a directory is a valid Claude data directory
   * 检查目录是否为有效的 Claude 数据目录
   */
  private static isValidClaudeDirectory(path: string): boolean {
    try {
      const projectsPath = join(path, this.CLAUDE_PROJECTS_DIR_NAME)
      const stat = statSync(projectsPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Gets the projects directory path for a Claude data directory
   * 获取 Claude 数据目录的项目目录路径
   */
  static getProjectsPath(claudePath: string): string {
    return join(claudePath, this.CLAUDE_PROJECTS_DIR_NAME)
  }
}
