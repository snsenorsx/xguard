import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Globe,
  Smartphone,
  Monitor,
  Languages,
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { campaignsService, type Campaign, type UpdateCampaignDto } from '@/services/campaigns.service'
import { toast } from '@/hooks/use-toast'

export function EditCampaignPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Form state
  const [formData, setFormData] = useState<UpdateCampaignDto>({})
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  // Fetch campaign data
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsService.get(id as string),
    enabled: !!id,
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateCampaignDto) => campaignsService.update(id as string, data),
    onSuccess: () => {
      toast({ title: 'Campaign updated successfully' })
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: () => {
      toast({ title: 'Failed to update campaign', variant: 'destructive' })
    },
  })

  // Initialize form when campaign loads
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        moneyPageUrl: campaign.moneyPageUrl,
        safePageUrl: campaign.safePageUrl,
        moneyPageRedirectType: campaign.moneyPageRedirectType,
        safePageRedirectType: campaign.safePageRedirectType,
        notes: campaign.notes,
        status: campaign.status,
      })
    }
  }, [campaign])

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const handleInputChange = (field: keyof UpdateCampaignDto, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!id) return null
  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Campaign</h1>
            <p className="text-muted-foreground">Modify campaign settings and targeting rules</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="targeting">Targeting</TabsTrigger>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Configure campaign name and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter campaign name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      </SelectItem>
                      <SelectItem value="paused">
                        <Badge variant="secondary">Paused</Badge>
                      </SelectItem>
                      <SelectItem value="completed">
                        <Badge variant="outline">Completed</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Add campaign notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* URL Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>URL Configuration</CardTitle>
                <CardDescription>Set target pages for different traffic types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="money-url">Money Page URL (for bots)</Label>
                  <Input
                    id="money-url"
                    value={formData.moneyPageUrl || ''}
                    onChange={(e) => handleInputChange('moneyPageUrl', e.target.value)}
                    placeholder="https://money-page.example.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    This page will be shown to detected bots
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="safe-url">Safe Page URL (for humans)</Label>
                  <Input
                    id="safe-url"
                    value={formData.safePageUrl || ''}
                    onChange={(e) => handleInputChange('safePageUrl', e.target.value)}
                    placeholder="https://safe-page.example.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    This page will be shown to legitimate users
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Redirect Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Redirect Configuration</CardTitle>
                <CardDescription>Configure how different traffic types are handled</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Money Page Redirect Type (for bots)</Label>
                  <Select
                    value={formData.moneyPageRedirectType}
                    onValueChange={(value) => handleInputChange('moneyPageRedirectType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select redirect type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301 - Permanent Redirect</SelectItem>
                      <SelectItem value="302">302 - Temporary Redirect</SelectItem>
                      <SelectItem value="js">JavaScript Redirect</SelectItem>
                      <SelectItem value="meta">Meta Refresh</SelectItem>
                      <SelectItem value="direct">Direct Load</SelectItem>
                      <SelectItem value="no_action">No Action (Block)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Safe Page Redirect Type (for humans)</Label>
                  <Select
                    value={formData.safePageRedirectType}
                    onValueChange={(value) => handleInputChange('safePageRedirectType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select redirect type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301 - Permanent Redirect</SelectItem>
                      <SelectItem value="302">302 - Temporary Redirect</SelectItem>
                      <SelectItem value="js">JavaScript Redirect</SelectItem>
                      <SelectItem value="meta">Meta Refresh</SelectItem>
                      <SelectItem value="direct">Direct Load</SelectItem>
                      <SelectItem value="no_action">No Action (Block)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Targeting Tab - Bu bölümü sonraki adımda geliştireceğim */}
        <TabsContent value="targeting" className="space-y-6">
          <TargetingSection campaignId={id} />
        </TabsContent>

        {/* Placeholder tabs */}
        <TabsContent value="streams">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Streams</CardTitle>
              <CardDescription>Manage traffic distribution and A/B testing</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Stream management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Analytics</CardTitle>
              <CardDescription>View performance metrics and insights</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure advanced campaign behaviors</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Advanced settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Targeting Section Component
function TargetingSection({ campaignId }: { campaignId: string }) {
  const [activeTargeting, setActiveTargeting] = useState({
    country: true,
    device: true,
    browser: true,
    language: false,
  })

  return (
    <div className="space-y-6">
      {/* Targeting Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Targeting Rules
          </CardTitle>
          <CardDescription>
            Configure which traffic should be filtered and redirected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(activeTargeting).map(([key, isActive]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-2">
                  {key === 'country' && <Globe className="h-4 w-4" />}
                  {key === 'device' && <Smartphone className="h-4 w-4" />}
                  {key === 'browser' && <Monitor className="h-4 w-4" />}
                  {key === 'language' && <Languages className="h-4 w-4" />}
                  <span className="capitalize">{key}</span>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) =>
                    setActiveTargeting(prev => ({ ...prev, [key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Country Targeting */}
      {activeTargeting.country && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <CountryTargetingCard />
        </motion.div>
      )}

      {/* Device Targeting */}
      {activeTargeting.device && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <DeviceTargetingCard />
        </motion.div>
      )}

      {/* Browser Targeting */}
      {activeTargeting.browser && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <BrowserTargetingCard />
        </motion.div>
      )}

      {/* Language Targeting */}
      {activeTargeting.language && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <LanguageTargetingCard />
        </motion.div>
      )}
    </div>
  )
}

// Individual targeting components
function CountryTargetingCard() {
  const [countries, setCountries] = useState<string[]>(['US', 'UK', 'DE'])
  const [newCountry, setNewCountry] = useState('')

  const addCountry = () => {
    if (newCountry && !countries.includes(newCountry)) {
      setCountries([...countries, newCountry])
      setNewCountry('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Globe className="h-5 w-5 mr-2" />
          Country Targeting
        </CardTitle>
        <CardDescription>Block or allow specific countries</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Enter country code (e.g., US, UK, DE)"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === 'Enter' && addCountry()}
          />
          <Button onClick={addCountry}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <Badge key={country} variant="secondary" className="flex items-center space-x-1">
              <span>{country}</span>
              <button
                onClick={() => setCountries(countries.filter(c => c !== country))}
                className="ml-1 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DeviceTargetingCard() {
  const [devices, setDevices] = useState(['mobile', 'desktop'])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Smartphone className="h-5 w-5 mr-2" />
          Device Targeting
        </CardTitle>
        <CardDescription>Target specific device types</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {['mobile', 'desktop', 'tablet'].map((device) => (
            <div key={device} className="flex items-center space-x-2">
              <Switch
                checked={devices.includes(device)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setDevices([...devices, device])
                  } else {
                    setDevices(devices.filter(d => d !== device))
                  }
                }}
              />
              <Label className="capitalize">{device}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function BrowserTargetingCard() {
  const [browsers, setBrowsers] = useState(['chrome', 'firefox'])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Monitor className="h-5 w-5 mr-2" />
          Browser Targeting
        </CardTitle>
        <CardDescription>Target specific browsers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['chrome', 'firefox', 'safari', 'edge', 'opera', 'other'].map((browser) => (
            <div key={browser} className="flex items-center space-x-2">
              <Switch
                checked={browsers.includes(browser)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setBrowsers([...browsers, browser])
                  } else {
                    setBrowsers(browsers.filter(b => b !== browser))
                  }
                }}
              />
              <Label className="capitalize">{browser}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function LanguageTargetingCard() {
  const [languages, setLanguages] = useState<string[]>(['en', 'tr'])
  const [newLanguage, setNewLanguage] = useState('')

  const addLanguage = () => {
    if (newLanguage && !languages.includes(newLanguage)) {
      setLanguages([...languages, newLanguage])
      setNewLanguage('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Languages className="h-5 w-5 mr-2" />
          Language Targeting
        </CardTitle>
        <CardDescription>Target specific languages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Enter language code (e.g., en, tr, de)"
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value.toLowerCase())}
            onKeyPress={(e) => e.key === 'Enter' && addLanguage()}
          />
          <Button onClick={addLanguage}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {languages.map((language) => (
            <Badge key={language} variant="secondary" className="flex items-center space-x-1">
              <span>{language}</span>
              <button
                onClick={() => setLanguages(languages.filter(l => l !== language))}
                className="ml-1 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}