/**
 * Shell 环境变量加载工具
 * 解决 macOS GUI 应用无法继承终端环境变量的问题
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { platform } from 'os'

const execAsync = promisify(exec)

/**
 * 加载用户 shell 环境变量
 */
export async function loadShellEnvironment(): Promise<void> {
  // 只在 macOS 和 Linux 上需要这个处理
  if (platform() !== 'darwin' && platform() !== 'linux') {
    return
  }

  try {
    // 获取用户的默认 shell
    const shell = process.env.SHELL || '/bin/zsh'

    // 使用登录 shell 来获取完整的环境变量
    // -l: 登录 shell，会加载完整的配置文件
    // -i: 交互式 shell，确保加载所有环境设置
    const { stdout } = await execAsync(
      `${shell} -l -i -c 'env'`,
      {
        timeout: 5000,
        encoding: 'utf8'
      }
    )

    // 解析环境变量
    const envLines = stdout.trim().split('\n')
    const envVars: Record<string, string> = {}

    for (const line of envLines) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=')
      }
    }

    // 合并重要的环境变量到当前进程
    const importantVars = [
      'PATH',
      'NODE_PATH',
      'NVM_DIR',
      'NVM_BIN',
      'FNM_DIR',
      'FNM_MULTISHELL_PATH',
      'VOLTA_HOME',
      'N_PREFIX',
      'NODENV_ROOT',
      'VFOX_HOME',
      'LANG',
      'LC_ALL',
      'HOME',
      'USER'
    ]

    for (const varName of importantVars) {
      if (envVars[varName]) {
        process.env[varName] = envVars[varName]
      }
    }

    // 确保 PATH 包含常见的 Node.js 安装位置
    const additionalPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/bin',
      '/bin',
      `${process.env.HOME}/.local/bin`,
      `${process.env.HOME}/.npm/bin`,
      `${process.env.HOME}/.yarn/bin`,
      `${process.env.HOME}/.fnm`,
      `${process.env.HOME}/.nvm/versions/node/*/bin`,
      `${process.env.HOME}/.volta/bin`,
      `${process.env.HOME}/.nodenv/shims`,
      `${process.env.HOME}/.config/yarn/global/node_modules/.bin`,
      `${process.env.HOME}/.version-fox/shims`,
      '/opt/local/bin'
    ]

    // 合并 PATH
    const currentPath = process.env.PATH || ''
    const pathSet = new Set(currentPath.split(':').filter(Boolean))

    // 添加额外的路径
    for (const path of additionalPaths) {
      if (!path.includes('*')) {
        pathSet.add(path)
      }
    }

    process.env.PATH = Array.from(pathSet).join(':')

    console.log('Shell environment loaded successfully')
    console.log('Updated PATH:', process.env.PATH)
  } catch (error) {
    console.error('Failed to load shell environment:', error)
    // 即使失败也不应该阻止应用启动
  }
}

/**
 * 获取增强的 PATH 环境变量
 * 用于子进程执行时使用
 */
export function getEnhancedPath(): string {
  const currentPath = process.env.PATH || ''
  const pathSet = new Set(currentPath.split(':').filter(Boolean))

  // 添加所有可能的路径
  const additionalPaths = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    `${process.env.HOME}/.local/bin`,
    `${process.env.HOME}/.npm/bin`,
    `${process.env.HOME}/.yarn/bin`,
    `${process.env.HOME}/.fnm`,
    `${process.env.HOME}/.volta/bin`,
    `${process.env.HOME}/.nodenv/shims`,
    `${process.env.HOME}/.config/yarn/global/node_modules/.bin`,
    `${process.env.HOME}/.version-fox/shims`,
    '/opt/local/bin'
  ]

  for (const path of additionalPaths) {
    if (!path.includes('*')) {
      pathSet.add(path)
    }
  }

  return Array.from(pathSet).join(':')
}
