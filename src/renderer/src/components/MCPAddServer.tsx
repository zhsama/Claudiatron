import React, { useState } from 'react'
import { Plus, Terminal, Globe, Network, Trash2, Info, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { api } from '@/lib/api'

interface MCPAddServerProps {
  /**
   * Callback when a server is successfully added
   */
  onServerAdded: () => void
  /**
   * Callback for error messages
   */
  onError: (message: string) => void
}

interface EnvironmentVariable {
  id: string
  key: string
  value: string
}

/**
 * Component for adding new MCP servers
 * Supports both stdio and SSE transport types
 */
export const MCPAddServer: React.FC<MCPAddServerProps> = ({ onServerAdded, onError }) => {
  const { t } = useTranslation('mcp')
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'http'>('stdio')
  const [saving, setSaving] = useState(false)

  // Stdio server state
  const [stdioName, setStdioName] = useState('')
  const [stdioCommand, setStdioCommand] = useState('')
  const [stdioArgs, setStdioArgs] = useState('')
  const [stdioScope, setStdioScope] = useState('local')
  const [stdioEnvVars, setStdioEnvVars] = useState<EnvironmentVariable[]>([])

  // SSE server state
  const [sseName, setSseName] = useState('')
  const [sseUrl, setSseUrl] = useState('')
  const [sseScope, setSseScope] = useState('local')
  const [sseEnvVars, setSseEnvVars] = useState<EnvironmentVariable[]>([])
  const [sseHeaders, setSseHeaders] = useState<EnvironmentVariable[]>([])

  // HTTP server state
  const [httpName, setHttpName] = useState('')
  const [httpUrl, setHttpUrl] = useState('')
  const [httpScope, setHttpScope] = useState('local')
  const [httpEnvVars, setHttpEnvVars] = useState<EnvironmentVariable[]>([])
  const [httpHeaders, setHttpHeaders] = useState<EnvironmentVariable[]>([])

  /**
   * Adds a new environment variable
   */
  const addEnvVar = (type: 'stdio' | 'sse' | 'http') => {
    const newVar: EnvironmentVariable = {
      id: `env-${Date.now()}`,
      key: '',
      value: ''
    }

    if (type === 'stdio') {
      setStdioEnvVars((prev) => [...prev, newVar])
    } else if (type === 'sse') {
      setSseEnvVars((prev) => [...prev, newVar])
    } else {
      setHttpEnvVars((prev) => [...prev, newVar])
    }
  }

  /**
   * Adds a new header
   */
  const addHeader = (type: 'sse' | 'http') => {
    const newHeader: EnvironmentVariable = {
      id: `header-${Date.now()}`,
      key: '',
      value: ''
    }

    if (type === 'sse') {
      setSseHeaders((prev) => [...prev, newHeader])
    } else {
      setHttpHeaders((prev) => [...prev, newHeader])
    }
  }

  /**
   * Updates an environment variable
   */
  const updateEnvVar = (
    type: 'stdio' | 'sse' | 'http',
    id: string,
    field: 'key' | 'value',
    value: string
  ) => {
    if (type === 'stdio') {
      setStdioEnvVars((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
    } else if (type === 'sse') {
      setSseEnvVars((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
    } else {
      setHttpEnvVars((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
    }
  }

  /**
   * Updates a header
   */
  const updateHeader = (
    type: 'sse' | 'http',
    id: string,
    field: 'key' | 'value',
    value: string
  ) => {
    if (type === 'sse') {
      setSseHeaders((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
    } else {
      setHttpHeaders((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
    }
  }

  /**
   * Removes an environment variable
   */
  const removeEnvVar = (type: 'stdio' | 'sse' | 'http', id: string) => {
    if (type === 'stdio') {
      setStdioEnvVars((prev) => prev.filter((v) => v.id !== id))
    } else if (type === 'sse') {
      setSseEnvVars((prev) => prev.filter((v) => v.id !== id))
    } else {
      setHttpEnvVars((prev) => prev.filter((v) => v.id !== id))
    }
  }

  const removeHeader = (type: 'sse' | 'http', id: string) => {
    if (type === 'sse') {
      setSseHeaders((prev) => prev.filter((v) => v.id !== id))
    } else {
      setHttpHeaders((prev) => prev.filter((v) => v.id !== id))
    }
  }

  /**
   * Validates and adds a stdio server
   */
  const handleAddStdioServer = async () => {
    if (!stdioName.trim()) {
      onError(t('addServer.validation.nameRequired'))
      return
    }

    if (!stdioCommand.trim()) {
      onError(t('addServer.validation.commandRequired'))
      return
    }

    try {
      setSaving(true)

      // Parse arguments
      const args = stdioArgs.trim() ? stdioArgs.split(/\s+/) : []

      // Convert env vars to object
      const env = stdioEnvVars.reduce(
        (acc, { key, value }) => {
          if (key.trim() && value.trim()) {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, string>
      )

      const result = await api.mcpAdd(
        stdioName,
        'stdio',
        stdioCommand,
        args,
        env,
        undefined,
        stdioScope
      )

      if (result.success) {
        // Reset form
        setStdioName('')
        setStdioCommand('')
        setStdioArgs('')
        setStdioEnvVars([])
        setStdioScope('local')
        onServerAdded()
      } else {
        onError(result.message)
      }
    } catch (error) {
      onError('Failed to add server')
      console.error('Failed to add stdio server:', error)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Validates and adds an SSE server
   */
  const handleAddSseServer = async () => {
    if (!sseName.trim()) {
      onError(t('addServer.validation.nameRequired'))
      return
    }

    if (!sseUrl.trim()) {
      onError(t('addServer.validation.urlRequired'))
      return
    }

    try {
      setSaving(true)

      // Convert env vars to object
      const env = sseEnvVars.reduce(
        (acc, { key, value }) => {
          if (key.trim() && value.trim()) {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, string>
      )

      const result = await api.mcpAdd(
        sseName,
        'sse',
        undefined,
        [],
        env,
        sseUrl,
        sseScope,
        sseHeaders
          .filter(({ key, value }) => key.trim() && value.trim())
          .map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
      )

      if (result.success) {
        // Reset form
        setSseName('')
        setSseUrl('')
        setSseEnvVars([])
        setSseHeaders([])
        setSseScope('local')
        onServerAdded()
      } else {
        onError(result.message)
      }
    } catch (error) {
      onError('Failed to add server')
      console.error('Failed to add SSE server:', error)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Validates and adds an HTTP server
   */
  const handleAddHttpServer = async () => {
    if (!httpName.trim()) {
      onError(t('addServer.validation.nameRequired'))
      return
    }

    if (!httpUrl.trim()) {
      onError(t('addServer.validation.urlRequired'))
      return
    }

    try {
      setSaving(true)

      // Convert env vars to object
      const env = httpEnvVars.reduce(
        (acc, { key, value }) => {
          if (key.trim() && value.trim()) {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, string>
      )

      const result = await api.mcpAdd(
        httpName,
        'http',
        undefined,
        [],
        env,
        httpUrl,
        httpScope,
        httpHeaders
          .filter(({ key, value }) => key.trim() && value.trim())
          .map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
      )

      console.log('Frontend: HTTP server add result:', result)

      if (result.success) {
        // Reset form
        setHttpName('')
        setHttpUrl('')
        setHttpEnvVars([])
        setHttpHeaders([])
        setHttpScope('local')
        onServerAdded()
      } else {
        onError(result.message)
      }
    } catch (error) {
      onError('Failed to add Streamable HTTP server')
      console.error('Failed to add Streamable HTTP server:', error)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Renders key-value pair inputs (environment variables or headers)
   */
  const renderKeyValuePairs = (
    _type: 'stdio' | 'sse' | 'http',
    dataType: 'env' | 'headers',
    items: EnvironmentVariable[],
    onAdd: () => void,
    onUpdate: (id: string, field: 'key' | 'value', value: string) => void,
    onRemove: (id: string) => void
  ) => {
    const isHeaders = dataType === 'headers'
    const separator = isHeaders ? ':' : '='

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            {isHeaders ? 'HTTP Headers' : t('addServer.fields.environmentVariables.label')}
          </Label>
          <Button variant="outline" size="sm" onClick={onAdd} className="gap-2">
            <Plus className="h-3 w-3" />
            {isHeaders ? '添加 Header' : t('addServer.fields.environmentVariables.add')}
          </Button>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Input
                  placeholder={
                    isHeaders
                      ? 'Header-Name'
                      : t('addServer.fields.environmentVariables.keyPlaceholder')
                  }
                  value={item.key}
                  onChange={(e) => onUpdate(item.id, 'key', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <span className="text-muted-foreground">{separator}</span>
                <Input
                  placeholder={
                    isHeaders
                      ? 'Header-Value'
                      : t('addServer.fields.environmentVariables.valuePlaceholder')
                  }
                  value={item.value}
                  onChange={(e) => onUpdate(item.id, 'value', e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(item.id)}
                  className="h-8 w-8 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderEnvVars = (type: 'stdio' | 'sse' | 'http', envVars: EnvironmentVariable[]) => {
    return renderKeyValuePairs(
      type,
      'env',
      envVars,
      () => addEnvVar(type),
      (id, field, value) => updateEnvVar(type, id, field, value),
      (id) => removeEnvVar(type, id)
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t('addServer.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('addServer.description')}</p>
      </div>

      <Tabs value={transport} onValueChange={(v) => setTransport(v as 'stdio' | 'sse' | 'http')}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg mb-6">
          <TabsTrigger value="stdio" className="gap-2">
            <Terminal className="h-4 w-4 text-amber-500" />
            {t('addServer.transport.stdio')}
          </TabsTrigger>
          <TabsTrigger value="sse" className="gap-2">
            <Globe className="h-4 w-4 text-emerald-500" />
            {t('addServer.transport.sse')}
          </TabsTrigger>
          <TabsTrigger value="http" className="gap-2">
            <Network className="h-4 w-4 text-blue-500" />
            Streamable HTTP
          </TabsTrigger>
        </TabsList>

        {/* Stdio Server */}
        <TabsContent value="stdio" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stdio-name">{t('addServer.fields.name.label')}</Label>
                <Input
                  id="stdio-name"
                  placeholder={t('addServer.fields.name.placeholder')}
                  value={stdioName}
                  onChange={(e) => setStdioName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('addServer.fields.name.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-command">{t('addServer.fields.command.label')}</Label>
                <Input
                  id="stdio-command"
                  placeholder={t('addServer.fields.command.placeholder')}
                  value={stdioCommand}
                  onChange={(e) => setStdioCommand(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('addServer.fields.command.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-args">{t('addServer.fields.args.label')}</Label>
                <Input
                  id="stdio-args"
                  placeholder={t('addServer.fields.args.placeholder')}
                  value={stdioArgs}
                  onChange={(e) => setStdioArgs(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('addServer.fields.args.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stdio-scope">{t('addServer.fields.scope.label')}</Label>
                <Select value={stdioScope} onValueChange={(value: string) => setStdioScope(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('addServer.fields.scope.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      {t('addServer.fields.scope.options.local')}
                    </SelectItem>
                    <SelectItem value="project">
                      {t('addServer.fields.scope.options.project')}
                    </SelectItem>
                    <SelectItem value="user">{t('addServer.fields.scope.options.user')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderEnvVars('stdio', stdioEnvVars)}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddStdioServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('addServer.actions.adding')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t('addServer.actions.addStdio')}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* SSE Server */}
        <TabsContent value="sse" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sse-name">{t('addServer.fields.name.label')}</Label>
                <Input
                  id="sse-name"
                  placeholder={t('addServer.fields.name.placeholder')}
                  value={sseName}
                  onChange={(e) => setSseName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('addServer.fields.name.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sse-url">{t('addServer.fields.url.label')}</Label>
                <Input
                  id="sse-url"
                  placeholder={t('addServer.fields.url.placeholder')}
                  value={sseUrl}
                  onChange={(e) => setSseUrl(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t('addServer.fields.url.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sse-scope">{t('addServer.fields.scope.label')}</Label>
                <Select value={sseScope} onValueChange={(value: string) => setSseScope(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('addServer.fields.scope.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      {t('addServer.fields.scope.options.local')}
                    </SelectItem>
                    <SelectItem value="project">
                      {t('addServer.fields.scope.options.project')}
                    </SelectItem>
                    <SelectItem value="user">{t('addServer.fields.scope.options.user')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderEnvVars('sse', sseEnvVars)}

              {renderKeyValuePairs(
                'sse',
                'headers',
                sseHeaders,
                () => addHeader('sse'),
                (id, field, value) => updateHeader('sse', id, field, value),
                (id) => removeHeader('sse', id)
              )}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddSseServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('addServer.actions.adding')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t('addServer.actions.addSse')}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* HTTP Server */}
        <TabsContent value="http" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="http-name">{t('addServer.fields.name.label')}</Label>
                <Input
                  id="http-name"
                  placeholder={t('addServer.fields.name.placeholder')}
                  value={httpName}
                  onChange={(e) => setHttpName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('addServer.fields.name.description')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="http-url">{t('addServer.fields.url.label')}</Label>
                <Input
                  id="http-url"
                  placeholder="https://api.example.com/mcp"
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Streamable HTTP MCP 服务器的完整 URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="http-scope">{t('addServer.fields.scope.label')}</Label>
                <Select value={httpScope} onValueChange={(value: string) => setHttpScope(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('addServer.fields.scope.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      {t('addServer.fields.scope.options.local')}
                    </SelectItem>
                    <SelectItem value="project">
                      {t('addServer.fields.scope.options.project')}
                    </SelectItem>
                    <SelectItem value="user">{t('addServer.fields.scope.options.user')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderEnvVars('http', httpEnvVars)}

              {renderKeyValuePairs(
                'http',
                'headers',
                httpHeaders,
                () => addHeader('http'),
                (id, field, value) => updateHeader('http', id, field, value),
                (id) => removeHeader('http', id)
              )}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleAddHttpServer}
                disabled={saving}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('addServer.actions.adding')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    添加 Streamable HTTP 服务器
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Example */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" />
            <span>{t('addServer.examples.title')}</span>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="font-mono bg-background p-2 rounded">
              <p>{t('addServer.examples.postgres')}</p>
              <p>{t('addServer.examples.weather')}</p>
              <p>{t('addServer.examples.sseServer')}</p>
              <p>{t('addServer.examples.httpServer')}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
