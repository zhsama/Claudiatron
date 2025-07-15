/**
 * @fileoverview Result utility functions for functional error handling
 * 函数式错误处理的 Result 工具函数
 */

import { Result } from '@praha/byethrow'

/**
 * Error types for usage calculation system
 * 使用量计算系统的错误类型
 */
export class UsageCalculationError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'UsageCalculationError'
  }
}

export class PricingFetchError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'PricingFetchError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ProcessingError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'ProcessingError'
  }
}

/**
 * Utility functions for working with Result types
 * 使用 Result 类型的工具函数
 */
export const ResultUtils = {
  /**
   * Convert a promise to a Result
   * 将 Promise 转换为 Result
   */
  fromPromise: <T>(promise: Promise<T>): Promise<Result.Result<T, Error>> => {
    return Result.try({
      try: () => promise,
      catch: (error) => (error instanceof Error ? error : new Error(String(error)))
    })()
  },

  /**
   * Convert a synchronous operation to a Result
   * 将同步操作转换为 Result
   */
  fromSync: <T>(operation: () => T): Result.Result<T, Error> => {
    return Result.try({
      try: operation,
      catch: (error) => (error instanceof Error ? error : new Error(String(error)))
    })()
  },

  /**
   * Chain multiple Results together
   * 将多个 Result 链接在一起
   */
  chain: <T, U>(
    result: Result.Result<T, Error>,
    operation: (value: T) => Result.Result<U, Error>
  ): Result.Result<U, Error> => {
    return Result.pipe(result, Result.andThen(operation))
  },

  /**
   * Map over a Result value
   * 映射 Result 值
   */
  map: <T, U>(
    result: Result.Result<T, Error>,
    mapper: (value: T) => U
  ): Result.Result<U, Error> => {
    return Result.pipe(result, Result.map(mapper))
  },

  /**
   * Unwrap a Result, throwing on error
   * 解包 Result，出错时抛出异常
   */
  unwrap: <T>(result: Result.Result<T, Error>): T => {
    return Result.unwrap(result)
  },

  /**
   * Get the value or return a default
   * 获取值或返回默认值
   */
  getOrElse: <T>(result: Result.Result<T, Error>, defaultValue: T): T => {
    return Result.isSuccess(result) ? Result.unwrap(result) : defaultValue
  },

  /**
   * Check if Result is a failure
   * 检查 Result 是否为失败
   */
  isFailure: <T>(result: Result.Result<T, Error>): result is Result.Failure<Error> => {
    return Result.isFailure(result)
  },

  /**
   * Check if Result is a success
   * 检查 Result 是否为成功
   */
  isSuccess: <T>(result: Result.Result<T, Error>): result is Result.Success<T> => {
    return Result.isSuccess(result)
  }
}
