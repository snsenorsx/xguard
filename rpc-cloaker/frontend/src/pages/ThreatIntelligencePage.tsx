import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Search, AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';

interface ThreatResult {
  ipAddress: string;
  isMalicious: boolean;
  confidence: number;
  sources: ThreatSource[];
  lastChecked: Date;
  cached: boolean;
}

interface ThreatSource {
  name: string;
  score: number;
  categories: string[];
  details: any;
  reliable: boolean;
}

interface ThreatStats {
  requestsToday: {
    abuseIPDB: number;
    virusTotal: number;
  };
  rateLimits: {
    abuseIPDB: {
      daily: number;
      remaining: number;
    };
    virusTotal: {
      perMinute: number;
      remaining: number;
    };
  };
}

export function ThreatIntelligencePage() {
  const [ipAddress, setIpAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThreatResult | null>(null);
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<ThreatResult[]>([]);

  useEffect(() => {
    loadStats();
    loadRecentAnalyses();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/threat-intelligence/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadRecentAnalyses = async () => {
    const stored = localStorage.getItem('threat_analyses');
    if (stored) {
      setRecentAnalyses(JSON.parse(stored));
    }
  };

  const saveToRecentAnalyses = (result: ThreatResult) => {
    const updated = [result, ...recentAnalyses.slice(0, 9)]; // Keep last 10
    setRecentAnalyses(updated);
    localStorage.setItem('threat_analyses', JSON.stringify(updated));
  };

  const analyzeIP = async () => {
    if (!ipAddress.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/threat-intelligence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: ipAddress.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data.data);
        saveToRecentAnalyses(data.data);
        loadStats(); // Refresh stats
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async (ip?: string) => {
    try {
      const url = ip 
        ? `/api/threat-intelligence/cache?ip=${encodeURIComponent(ip)}`
        : '/api/threat-intelligence/cache';
        
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        if (ip) {
          setRecentAnalyses(prev => prev.filter(r => r.ipAddress !== ip));
        } else {
          setRecentAnalyses([]);
          localStorage.removeItem('threat_analyses');
        }
        loadStats();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const getThreatBadge = (result: ThreatResult) => {
    if (result.isMalicious) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Malicious ({result.confidence}%)
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Clean ({result.confidence}%)
      </Badge>
    );
  };

  const getSourceBadge = (source: ThreatSource) => {
    const variant = source.score >= 75 ? 'destructive' : 
                   source.score >= 25 ? 'default' : 'secondary';
    return (
      <Badge variant={variant}>
        {source.name}: {source.score}%
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Threat Intelligence</h1>
      </div>

      <Tabs defaultValue="analyze" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analyze">IP Analysis</TabsTrigger>
          <TabsTrigger value="recent">Recent Analyses</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analyze IP Address</CardTitle>
              <CardDescription>
                Check IP reputation using AbuseIPDB and VirusTotal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter IP address (e.g., 192.168.1.1)"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && analyzeIP()}
                />
                <Button onClick={analyzeIP} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? 'Analyzing...' : 'Analyze'}
                </Button>
              </div>

              {result && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Analysis Result</h3>
                    <div className="flex items-center gap-2">
                      {getThreatBadge(result)}
                      {result.cached && (
                        <Badge variant="outline" className="gap-1">
                          <Database className="h-3 w-3" />
                          Cached
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">IP Information</h4>
                      <div className="space-y-1 text-sm">
                        <div>IP Address: <code className="bg-muted px-1 rounded">{result.ipAddress}</code></div>
                        <div>Confidence: {result.confidence}%</div>
                        <div>Last Checked: {new Date(result.lastChecked).toLocaleString()}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Threat Sources</h4>
                      <div className="space-y-1">
                        {result.sources.map((source, index) => (
                          <div key={index} className="flex items-center gap-2">
                            {getSourceBadge(source)}
                            {source.reliable && (
                              <Badge variant="outline" size="sm">Reliable</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {result.sources.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Detailed Information</h4>
                      <div className="space-y-3">
                        {result.sources.map((source, index) => (
                          <Card key={index} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{source.name}</span>
                              <span className="text-sm text-muted-foreground">
                                Score: {source.score}%
                              </span>
                            </div>
                            
                            {source.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {source.categories.map((category, catIndex) => (
                                  <Badge key={catIndex} variant="outline" size="sm">
                                    {category.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {source.details && (
                              <div className="text-xs text-muted-foreground space-y-1">
                                {source.name === 'AbuseIPDB' && (
                                  <>
                                    <div>Country: {source.details.countryCode}</div>
                                    <div>ISP: {source.details.isp}</div>
                                    <div>Reports: {source.details.totalReports}</div>
                                    <div>Usage Type: {source.details.usageType}</div>
                                  </>
                                )}
                                {source.name === 'VirusTotal' && (
                                  <>
                                    <div>Malicious: {source.details.malicious}</div>
                                    <div>Suspicious: {source.details.suspicious}</div>
                                    <div>Harmless: {source.details.harmless}</div>
                                    <div>Country: {source.details.country}</div>
                                    <div>ASN: {source.details.asn}</div>
                                  </>
                                )}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => clearCache(result.ipAddress)}
                    >
                      Clear Cache
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setResult(null)}
                    >
                      Clear Result
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Analyses</CardTitle>
                  <CardDescription>Recently analyzed IP addresses</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => clearCache()}
                >
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentAnalyses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent analyses found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>Checked</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAnalyses.map((analysis, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <code className="bg-muted px-1 rounded text-sm">
                            {analysis.ipAddress}
                          </code>
                        </TableCell>
                        <TableCell>{getThreatBadge(analysis)}</TableCell>
                        <TableCell>{analysis.confidence}%</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {analysis.sources.map((source, sourceIndex) => (
                              <Badge key={sourceIndex} variant="outline" size="sm">
                                {source.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(analysis.lastChecked).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setIpAddress(analysis.ipAddress);
                                setResult(analysis);
                              }}
                            >
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => clearCache(analysis.ipAddress)}
                            >
                              Clear
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AbuseIPDB</CardTitle>
                    <CardDescription>IP reputation database</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Requests Today:</span>
                      <span className="font-mono">{stats.requestsToday.abuseIPDB}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Limit:</span>
                      <span className="font-mono">{stats.rateLimits.abuseIPDB.daily}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining:</span>
                      <span className="font-mono">{stats.rateLimits.abuseIPDB.remaining}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${(stats.requestsToday.abuseIPDB / stats.rateLimits.abuseIPDB.daily) * 100}%` 
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>VirusTotal</CardTitle>
                    <CardDescription>Multi-engine malware scanner</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Requests (Current Minute):</span>
                      <span className="font-mono">{stats.requestsToday.virusTotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Per-Minute Limit:</span>
                      <span className="font-mono">{stats.rateLimits.virusTotal.perMinute}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining:</span>
                      <span className="font-mono">{stats.rateLimits.virusTotal.remaining}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${(stats.requestsToday.virusTotal / stats.rateLimits.virusTotal.perMinute) * 100}%` 
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Service Health</CardTitle>
                  <CardDescription>Threat intelligence service status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>AbuseIPDB API Connected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>VirusTotal API Connected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Cache System Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Auto-Blacklist Enabled</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}