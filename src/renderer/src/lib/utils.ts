import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a project path for user-friendly display
 * @param path - The full project path
 * @returns A formatted, shorter version of the path
 */
export function formatProjectPath(path: string): string {
  // Handle empty or invalid paths
  if (!path) return ''

  // Common home directory patterns
  const homePatterns = [
    /^\/Users\/[^/]+/, // macOS
    /^\/home\/[^/]+/, // Linux
    /^C:\\Users\\[^\\]+/i, // Windows
    /^\/root/ // Root user
  ]

  // Try to replace home directory patterns with ~
  let formattedPath = path
  for (const pattern of homePatterns) {
    if (pattern.test(path)) {
      formattedPath = path.replace(pattern, '~')
      break
    }
  }

  // Split the path into parts
  const parts = formattedPath.split(/[/\\]/)

  // If path is short enough, return as is
  if (parts.length <= 4) {
    return formattedPath
  }

  // For long paths, show first part, ellipsis, and last 2-3 parts
  const firstPart = parts[0]
  const lastParts = parts.slice(-3)

  return `${firstPart}/.../${lastParts.join('/')}`
}

/**
 * Extracts just the project name from a full path
 * @param path - The full project path
 * @returns The project name (last directory in path)
 */
export function getProjectName(path: string): string {
  if (!path) return ''

  // Split by both forward and back slashes to handle cross-platform paths
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}
