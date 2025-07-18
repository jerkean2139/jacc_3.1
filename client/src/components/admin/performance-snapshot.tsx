import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  Camera, 
  RefreshCw, 
  Activity,
  Database,
  Server,
  TrendingUp,
  AlertCircle,
  Clock,
  Users,
  Zap
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PerformanceSnapshot {
  timestamp: string;
  systemInfo: {
    uptime: number;
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
  memory: {
    usage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
      arrayBuffers: number;
    };
    percentages: {
      heap: number;
      system: number;
    };
    trends: {
      last5Min: number[];
      average: number;
    };
  };
  performance: {
    responseTime: {
      endpoints: Record<string, number>;
      average: number;
      p95: number;
      p99: number;
    };
    throughput: {
      requestsPerMinute: number;
      requestsLast5Min: number;
    };
  };
  database: {
    status: string;
    activeConnections: number;
    queryPerformance: {
      slowQueries: number;
      averageQueryTime: number;
    };
    stats: {
      totalUsers: number;
      totalChats: number;
      totalDocuments: number;
      totalMessages: number;
    };
  };
  cache: {
    size: number;
    capacity: number;
    hitRate: number;
    evictionCount: number;
    memoryUsage: number;
  };
  apis: {
    status: Record<string, boolean>;
    errors: Record<string, number>;
    lastChecked: string;
  };
  errors: {
    last24Hours: number;
    byType: Record<string, number>;
    recentErrors: Array<{
      timestamp: string;
      type: string;
      message: string;
    }>;
  };
  userActivity: {
    activeUsers: number;
    last24Hours: {
      logins: number;
      chats: number;
      documents: number;
    };
    topUsers: Array<{
      email: string;
      activity: number;
    }>;
  };
}

export function PerformanceSnapshot() {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: snapshot, isLoading, refetch } = useQuery<PerformanceSnapshot>({
    queryKey: ['/api/admin/performance-snapshot'],
    enabled: false, // Don't auto-fetch on mount
  });

  const handleGenerateSnapshot = async () => {
    setIsGenerating(true);
    await refetch();
    setIsGenerating(false);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch('/api/admin/performance-snapshot/download', {
        credentials: 'include'
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jacc-performance-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getMemoryStatus = (percentage: number) => {
    if (percentage < 70) return { color: 'green', label: 'Healthy' };
    if (percentage < 85) return { color: 'yellow', label: 'Warning' };
    return { color: 'red', label: 'Critical' };
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Performance Snapshot</h3>
          <p className="text-muted-foreground mt-1">
            Generate comprehensive system performance reports with one click
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateSnapshot}
            disabled={isLoading || isGenerating}
            size="lg"
            className="gap-2"
          >
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Generate Snapshot
          </Button>
          {snapshot && (
            <Button
              onClick={handleDownload}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Snapshot Content */}
      {snapshot ? (
        <div className="space-y-6">
          {/* System Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatUptime(snapshot.systemInfo.uptime)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {snapshot.systemInfo.platform} {snapshot.systemInfo.architecture}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">
                    {snapshot.memory.percentages.heap}%
                  </div>
                  <Badge variant={
                    getMemoryStatus(snapshot.memory.percentages.heap).color === 'green' ? 'default' :
                    getMemoryStatus(snapshot.memory.percentages.heap).color === 'yellow' ? 'secondary' :
                    'destructive'
                  }>
                    {getMemoryStatus(snapshot.memory.percentages.heap).label}
                  </Badge>
                </div>
                <Progress value={snapshot.memory.percentages.heap} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {snapshot.performance.responseTime.average}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  P95: {snapshot.performance.responseTime.p95}ms
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cache Hit Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(snapshot.cache.hitRate * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {snapshot.cache.size}/{snapshot.cache.capacity} entries
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tabs */}
          <Tabs defaultValue="memory" className="space-y-4">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="memory">Memory</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
              <TabsTrigger value="apis">APIs</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="memory">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Memory Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Memory Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Heap Used</span>
                          <span className="font-mono">{snapshot.memory.usage.heapUsed}MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Heap Total</span>
                          <span className="font-mono">{snapshot.memory.usage.heapTotal}MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>RSS</span>
                          <span className="font-mono">{snapshot.memory.usage.rss}MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>External</span>
                          <span className="font-mono">{snapshot.memory.usage.external}MB</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Memory Trends</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Average (5min)</span>
                          <span className="font-mono">{snapshot.memory.trends.average}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Current</span>
                          <span className="font-mono">{snapshot.memory.percentages.heap}%</span>
                        </div>
                      </div>
                      {snapshot.memory.trends.last5Min.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs text-muted-foreground">Recent trend</div>
                          <div className="flex gap-1 mt-1">
                            {snapshot.memory.trends.last5Min.map((value, i) => (
                              <div
                                key={i}
                                className="flex-1 bg-primary"
                                style={{
                                  height: `${value * 0.5}px`,
                                  opacity: 0.3 + (i / snapshot.memory.trends.last5Min.length) * 0.7
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Response Times by Endpoint</h4>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {Object.entries(snapshot.performance.responseTime.endpoints)
                            .sort(([, a], [, b]) => b - a)
                            .map(([endpoint, time]) => (
                              <div key={endpoint} className="flex justify-between items-center">
                                <span className="font-mono text-sm">{endpoint}</span>
                                <Badge variant={time < 100 ? 'default' : time < 500 ? 'secondary' : 'destructive'}>
                                  {time}ms
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{snapshot.performance.responseTime.average}ms</div>
                        <div className="text-sm text-muted-foreground">Average</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{snapshot.performance.responseTime.p95}ms</div>
                        <div className="text-sm text-muted-foreground">95th Percentile</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{snapshot.performance.responseTime.p99}ms</div>
                        <div className="text-sm text-muted-foreground">99th Percentile</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="database">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">Connection Status</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Status</span>
                          <Badge variant={snapshot.database.status === 'healthy' ? 'default' : 'destructive'}>
                            {snapshot.database.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Connections</span>
                          <span>{snapshot.database.activeConnections}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Slow Queries</span>
                          <span>{snapshot.database.queryPerformance.slowQueries}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Data Statistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Users</span>
                          <span>{snapshot.database.stats.totalUsers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Chats</span>
                          <span>{snapshot.database.stats.totalChats}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Documents</span>
                          <span>{snapshot.database.stats.totalDocuments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Messages</span>
                          <span>{snapshot.database.stats.totalMessages}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="apis">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    External APIs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(snapshot.apis.status).map(([api, status]) => (
                      <div key={api} className="flex items-center justify-between">
                        <span className="capitalize">{api}</span>
                        <Badge variant={status ? 'default' : 'destructive'}>
                          {status ? 'Connected' : 'Disconnected'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Last checked: {new Date(snapshot.apis.lastChecked).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Error Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {snapshot.errors.last24Hours} errors in the last 24 hours
                    </AlertDescription>
                  </Alert>
                  
                  {snapshot.errors.byType && Object.keys(snapshot.errors.byType).length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Errors by Type</h4>
                      <div className="space-y-2">
                        {Object.entries(snapshot.errors.byType).map(([type, count]) => (
                          <div key={type} className="flex justify-between">
                            <span>{type}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {snapshot.errors.recentErrors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Recent Errors</h4>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {snapshot.errors.recentErrors.map((error, i) => (
                            <div key={i} className="text-sm border rounded p-2">
                              <div className="flex justify-between mb-1">
                                <Badge variant="outline">{error.type}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(error.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-xs font-mono">{error.message}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">Last 24 Hours</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Active Users</span>
                          <span>{snapshot.userActivity.activeUsers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Logins</span>
                          <span>{snapshot.userActivity.last24Hours.logins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chats Created</span>
                          <span>{snapshot.userActivity.last24Hours.chats}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Documents Accessed</span>
                          <span>{snapshot.userActivity.last24Hours.documents}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Top Active Users</h4>
                      <div className="space-y-2">
                        {snapshot.userActivity.topUsers.map((user, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-sm truncate">{user.email}</span>
                            <Badge variant="outline">{user.activity}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Timestamp */}
          <div className="text-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 inline mr-1" />
            Snapshot generated at {new Date(snapshot.timestamp).toLocaleString()}
          </div>
        </div>
      ) : !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Snapshot Available</h3>
            <p className="text-muted-foreground mb-4">
              Click "Generate Snapshot" to create a comprehensive performance report
            </p>
            <Button onClick={handleGenerateSnapshot} size="lg">
              Generate First Snapshot
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Generating Performance Snapshot</h3>
            <p className="text-muted-foreground">
              Collecting system metrics and analyzing performance...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}