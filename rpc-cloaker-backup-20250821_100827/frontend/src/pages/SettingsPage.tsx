import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Shield,
  Bot,
  Bell,
  Code,
  Palette,
  Globe,
  Database,
  Activity,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

export function SettingsPage() {
  const [profileData, setProfileData] = useState({
    name: 'Test User',
    email: 'test@example.com',
    timezone: 'UTC+3',
    language: 'en',
  })

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '24',
    loginNotifications: true,
    suspiciousActivityAlerts: true,
  })

  const [botDetectionSettings, setBotDetectionSettings] = useState({
    sensitivity: 'medium',
    autoBlock: true,
    learningMode: false,
    customRules: '',
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    slackWebhook: '',
    discordWebhook: '',
    dailyReports: true,
    weeklyReports: false,
  })

  const [apiSettings, setApiSettings] = useState({
    webhookUrl: '',
    rateLimit: '1000',
    retryAttempts: '3',
    timeout: '30',
  })

  const [themeSettings, setThemeSettings] = useState({
    darkMode: false,
    compactMode: false,
    animationsEnabled: true,
    colorScheme: 'blue',
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const apiKey = 'sk-1234567890abcdef'

  const handleSave = (section: string) => {
    toast({ title: `${section} settings saved successfully!` })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and application preferences</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Activity className="h-4 w-4 mr-2" />
          All systems operational
        </Badge>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="bot-detection" className="flex items-center space-x-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Bot AI</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center space-x-2">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">API</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={profileData.timezone}
                    onValueChange={(value) => setProfileData({...profileData, timezone: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC+3">UTC+3 (Turkey)</SelectItem>
                      <SelectItem value="UTC+0">UTC+0 (London)</SelectItem>
                      <SelectItem value="UTC-5">UTC-5 (New York)</SelectItem>
                      <SelectItem value="UTC-8">UTC-8 (Los Angeles)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={profileData.language}
                    onValueChange={(value) => setProfileData({...profileData, language: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="tr">Türkçe</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <Button className="w-full">Update Password</Button>
              </CardContent>
            </Card>
          </motion.div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Profile')}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>Configure authentication and access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Switch
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(checked) => 
                      setSecuritySettings({...securitySettings, twoFactorEnabled: checked})
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Session Timeout (hours)</Label>
                  <Select
                    value={securitySettings.sessionTimeout}
                    onValueChange={(value) => 
                      setSecuritySettings({...securitySettings, sessionTimeout: value})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="8">8 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Configure security notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Login Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified of new logins</p>
                  </div>
                  <Switch
                    checked={securitySettings.loginNotifications}
                    onCheckedChange={(checked) => 
                      setSecuritySettings({...securitySettings, loginNotifications: checked})
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Suspicious Activity Alerts</Label>
                    <p className="text-sm text-muted-foreground">Alert on unusual activity</p>
                  </div>
                  <Switch
                    checked={securitySettings.suspiciousActivityAlerts}
                    onCheckedChange={(checked) => 
                      setSecuritySettings({...securitySettings, suspiciousActivityAlerts: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Security')}>
              <Save className="h-4 w-4 mr-2" />
              Save Security Settings
            </Button>
          </div>
        </TabsContent>

        {/* Bot Detection Settings */}
        <TabsContent value="bot-detection" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>AI Detection Settings</CardTitle>
                <CardDescription>Configure bot detection algorithms and sensitivity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Detection Sensitivity</Label>
                    <Select
                      value={botDetectionSettings.sensitivity}
                      onValueChange={(value) => 
                        setBotDetectionSettings({...botDetectionSettings, sensitivity: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Low - Fewer false positives</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span>Medium - Balanced detection</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span>High - Maximum protection</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Auto-Block Detected Bots</Label>
                        <p className="text-sm text-muted-foreground">Automatically block suspicious traffic</p>
                      </div>
                      <Switch
                        checked={botDetectionSettings.autoBlock}
                        onCheckedChange={(checked) => 
                          setBotDetectionSettings({...botDetectionSettings, autoBlock: checked})
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Learning Mode</Label>
                        <p className="text-sm text-muted-foreground">Improve detection with feedback</p>
                      </div>
                      <Switch
                        checked={botDetectionSettings.learningMode}
                        onCheckedChange={(checked) => 
                          setBotDetectionSettings({...botDetectionSettings, learningMode: checked})
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Custom Detection Rules</Label>
                  <Textarea
                    placeholder="Enter custom rules in JSON format..."
                    value={botDetectionSettings.customRules}
                    onChange={(e) => 
                      setBotDetectionSettings({...botDetectionSettings, customRules: e.target.value})
                    }
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Advanced users can define custom detection patterns using JSON configuration
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Bot Detection')}>
              <Save className="h-4 w-4 mr-2" />
              Save AI Settings
            </Button>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Notification Channels</CardTitle>
                <CardDescription>Configure how you receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => 
                      setNotificationSettings({...notificationSettings, emailNotifications: checked})
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    placeholder="https://hooks.slack.com/services/..."
                    value={notificationSettings.slackWebhook}
                    onChange={(e) => 
                      setNotificationSettings({...notificationSettings, slackWebhook: e.target.value})
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
                  <Input
                    id="discord-webhook"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={notificationSettings.discordWebhook}
                    onChange={(e) => 
                      setNotificationSettings({...notificationSettings, discordWebhook: e.target.value})
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Report Schedule</CardTitle>
                <CardDescription>Configure automated reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Daily Reports</Label>
                    <p className="text-sm text-muted-foreground">Daily traffic summary</p>
                  </div>
                  <Switch
                    checked={notificationSettings.dailyReports}
                    onCheckedChange={(checked) => 
                      setNotificationSettings({...notificationSettings, dailyReports: checked})
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">Weekly analytics summary</p>
                  </div>
                  <Switch
                    checked={notificationSettings.weeklyReports}
                    onCheckedChange={(checked) => 
                      setNotificationSettings({...notificationSettings, weeklyReports: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Notifications')}>
              <Save className="h-4 w-4 mr-2" />
              Save Notification Settings
            </Button>
          </div>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Manage API keys and webhook settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex space-x-2">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline">Regenerate</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-app.com/webhook"
                      value={apiSettings.webhookUrl}
                      onChange={(e) => 
                        setApiSettings({...apiSettings, webhookUrl: e.target.value})
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Limit (requests/hour)</Label>
                    <Select
                      value={apiSettings.rateLimit}
                      onValueChange={(value) => 
                        setApiSettings({...apiSettings, rateLimit: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 requests/hour</SelectItem>
                        <SelectItem value="1000">1,000 requests/hour</SelectItem>
                        <SelectItem value="10000">10,000 requests/hour</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Select
                      value={apiSettings.retryAttempts}
                      onValueChange={(value) => 
                        setApiSettings({...apiSettings, retryAttempts: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 attempt</SelectItem>
                        <SelectItem value="3">3 attempts</SelectItem>
                        <SelectItem value="5">5 attempts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout (seconds)</Label>
                    <Select
                      value={apiSettings.timeout}
                      onValueChange={(value) => 
                        setApiSettings({...apiSettings, timeout: value})
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('API')}>
              <Save className="h-4 w-4 mr-2" />
              Save API Settings
            </Button>
          </div>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Theme Settings</CardTitle>
                <CardDescription>Customize the appearance of your dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Switch to dark theme</p>
                  </div>
                  <Switch
                    checked={themeSettings.darkMode}
                    onCheckedChange={(checked) => 
                      setThemeSettings({...themeSettings, darkMode: checked})
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
                  </div>
                  <Switch
                    checked={themeSettings.compactMode}
                    onCheckedChange={(checked) => 
                      setThemeSettings({...themeSettings, compactMode: checked})
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Animations</Label>
                    <p className="text-sm text-muted-foreground">Enable smooth transitions</p>
                  </div>
                  <Switch
                    checked={themeSettings.animationsEnabled}
                    onCheckedChange={(checked) => 
                      setThemeSettings({...themeSettings, animationsEnabled: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Color Scheme</CardTitle>
                <CardDescription>Choose your preferred color theme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {['blue', 'green', 'purple', 'orange'].map((color) => (
                      <button
                        key={color}
                        className={`h-12 rounded-md border-2 ${
                          themeSettings.colorScheme === color 
                            ? 'border-foreground' 
                            : 'border-transparent'
                        }`}
                        style={{ 
                          backgroundColor: {
                            blue: '#3b82f6',
                            green: '#10b981',
                            purple: '#8b5cf6',
                            orange: '#f59e0b'
                          }[color] 
                        }}
                        onClick={() => setThemeSettings({...themeSettings, colorScheme: color})}
                      >
                        <span className="sr-only">{color}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave('Theme')}>
              <Save className="h-4 w-4 mr-2" />
              Save Appearance Settings
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}