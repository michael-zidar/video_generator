import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser, useClerk } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { 
  Video, 
  ArrowLeft, 
  Check, 
  X, 
  Loader2, 
  ExternalLink,
  Link2,
  Link2Off,
  Eye,
  EyeOff
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface NotionStatus {
  connected: boolean
  user?: {
    id: string
    name: string
    type: string
    avatar_url?: string
  }
}

export function Settings() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()

  // Notion integration state
  const [notionStatus, setNotionStatus] = useState<NotionStatus | null>(null)
  const [notionApiKey, setNotionApiKey] = useState('')
  const [isTestingNotion, setIsTestingNotion] = useState(false)
  const [isSavingNotion, setIsSavingNotion] = useState(false)
  const [isRemovingNotion, setIsRemovingNotion] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [notionTestResult, setNotionTestResult] = useState<{
    success: boolean
    message: string
    user?: { name: string }
  } | null>(null)

  // Check Notion connection status
  const checkNotionStatus = useCallback(async () => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/notion/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setNotionStatus(data)
      }
    } catch (error) {
      console.error('Failed to check Notion status:', error)
    }
  }, [getToken])

  useEffect(() => {
    checkNotionStatus()
  }, [checkNotionStatus])

  // Test Notion API key
  const handleTestNotion = async () => {
    if (!notionApiKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      })
      return
    }

    setIsTestingNotion(true)
    setNotionTestResult(null)

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/notion/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ api_key: notionApiKey }),
      })

      const data = await response.json()

      if (response.ok) {
        setNotionTestResult({
          success: true,
          message: 'Connection successful!',
          user: data.user,
        })
      } else {
        setNotionTestResult({
          success: false,
          message: data.error || 'Connection failed',
        })
      }
    } catch (error) {
      setNotionTestResult({
        success: false,
        message: 'Failed to test connection',
      })
    } finally {
      setIsTestingNotion(false)
    }
  }

  // Save Notion API key
  const handleSaveNotion = async () => {
    if (!notionApiKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      })
      return
    }

    setIsSavingNotion(true)

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/notion/save-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ api_key: notionApiKey }),
      })

      if (response.ok) {
        toast({
          title: 'Connected',
          description: 'Notion integration has been enabled.',
        })
        setNotionApiKey('')
        setNotionTestResult(null)
        checkNotionStatus()
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'Failed to save API key',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save API key',
        variant: 'destructive',
      })
    } finally {
      setIsSavingNotion(false)
    }
  }

  // Remove Notion connection
  const handleRemoveNotion = async () => {
    if (!confirm('Are you sure you want to disconnect Notion?')) {
      return
    }

    setIsRemovingNotion(true)

    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/notion/remove-key`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: 'Notion integration has been removed.',
        })
        setNotionStatus({ connected: false })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to disconnect Notion',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Notion',
        variant: 'destructive',
      })
    } finally {
      setIsRemovingNotion(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 lg:px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Video className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">{user?.fullName || user?.firstName}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your integrations and preferences
            </p>
          </div>

          {/* Integrations Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Integrations
              </CardTitle>
              <CardDescription>
                Connect external services to import content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notion Integration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center text-white font-bold text-lg">
                      N
                    </div>
                    <div>
                      <h3 className="font-medium">Notion</h3>
                      <p className="text-sm text-muted-foreground">
                        Import pages from Notion as presentations
                      </p>
                    </div>
                  </div>
                  {notionStatus?.connected && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Connected
                    </div>
                  )}
                </div>

                {notionStatus?.connected ? (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {notionStatus.user?.avatar_url ? (
                          <img
                            src={notionStatus.user.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {notionStatus.user?.name?.[0] || 'N'}
                            </span>
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {notionStatus.user?.name || 'Notion User'}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveNotion}
                        disabled={isRemovingNotion}
                        className="text-destructive hover:text-destructive"
                      >
                        {isRemovingNotion ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Link2Off className="h-4 w-4 mr-2" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        To connect Notion, you'll need to create an integration and get an API key:
                      </p>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Notion Integrations</a></li>
                        <li>Click "New integration" and give it a name</li>
                        <li>Copy the "Internal Integration Token"</li>
                        <li>Share the pages you want to import with your integration</li>
                      </ol>
                      <a
                        href="https://developers.notion.com/docs/create-a-notion-integration"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Learn more
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notion-key">API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="notion-key"
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="secret_..."
                            value={notionApiKey}
                            onChange={(e) => setNotionApiKey(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleTestNotion}
                          disabled={isTestingNotion || !notionApiKey.trim()}
                        >
                          {isTestingNotion ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Test'
                          )}
                        </Button>
                      </div>
                    </div>

                    {notionTestResult && (
                      <div
                        className={`p-3 rounded-lg flex items-center gap-2 ${
                          notionTestResult.success
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {notionTestResult.success ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        <span className="text-sm">
                          {notionTestResult.message}
                          {notionTestResult.user && ` (${notionTestResult.user.name})`}
                        </span>
                      </div>
                    )}

                    {notionTestResult?.success && (
                      <Button
                        onClick={handleSaveNotion}
                        disabled={isSavingNotion}
                        className="w-full"
                      >
                        {isSavingNotion ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" />
                            Connect Notion
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the app looks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Theme</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose between light, dark, or system theme
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

