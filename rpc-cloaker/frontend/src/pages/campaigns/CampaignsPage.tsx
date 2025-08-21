import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { campaignsService, type Campaign } from '@/services/campaigns.service'
import { formatDate, formatNumber, formatPercent } from '@/lib/utils'
import { CreateCampaignDialog } from '@/components/campaigns/CreateCampaignDialog'

export function CampaignsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { data: campaigns, isLoading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsService.list(),
  })

  const filteredCampaigns = campaigns?.filter((campaign: Campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleStatusToggle = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    await campaignsService.update(campaign.id, { status: newStatus })
    refetch()
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      await campaignsService.delete(id)
      refetch()
    }
  }

  const handleDuplicate = async (campaign: Campaign) => {
    await campaignsService.create({
      name: `${campaign.name} (Copy)`,
      moneyPageUrl: campaign.moneyPageUrl,
      safePageUrl: campaign.safePageUrl,
      redirectType: campaign.redirectType,
      notes: campaign.notes,
    })
    refetch()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your cloaking campaigns and traffic rules
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-64 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns?.map((campaign: Campaign, index: number) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Link
                        to={`/campaigns/${campaign.id}`}
                        className="hover:underline"
                      >
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      </Link>
                      <CardDescription className="text-xs">
                        Created {formatDate(campaign.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={campaign.status === 'active' ? 'default' : 'secondary'}
                      >
                        {campaign.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusToggle(campaign)}>
                            {campaign.status === 'active' ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/campaigns/${campaign.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link to={`/analytics?campaign=${campaign.id}`}>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Analytics
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(campaign.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Visits</p>
                      <p className="text-2xl font-bold">
                        {formatNumber(campaign.stats?.totalVisits || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bot Rate</p>
                      <p className="text-2xl font-bold">
                        {formatPercent(
                          campaign.stats?.totalVisits
                            ? (campaign.stats.botVisits / campaign.stats.totalVisits) * 100
                            : 0
                        )}
                      </p>
                    </div>
                  </div>

                  {/* URLs */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Money:</span>
                      <span className="truncate flex-1" title={campaign.moneyPageUrl}>
                        {campaign.moneyPageUrl}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Safe:</span>
                      <span className="truncate flex-1" title={campaign.safePageUrl}>
                        {campaign.safePageUrl}
                      </span>
                    </div>
                  </div>

                  {/* Redirect Type */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Redirect</span>
                    <Badge variant="outline">{campaign.redirectType}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          setShowCreateDialog(false)
          refetch()
        }}
      />
    </div>
  )
}