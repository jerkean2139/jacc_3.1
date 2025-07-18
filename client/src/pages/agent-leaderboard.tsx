import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  Medal, 
  Award, 
  Crown,
  TrendingUp,
  MessageSquare,
  Activity,
  Calendar,
  Star,
  Target,
  Users,
  BarChart3,
  LineChart,
  PieChart
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface LeaderboardAgent {
  rank: number;
  userId: string;
  username: string;
  email: string;
  role: string;
  totalChats: number;
  totalMessages: number;
  userQueries: number;
  aiResponses: number;
  lastActivity: string;
  joinedDate: string;
  activityScore: number;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  avgResponseTime?: number;
  successRate?: number;
  weeklyGrowth?: number;
}

export default function AgentLeaderboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all-time'>('weekly');
  const [selectedView, setSelectedView] = useState<'table' | 'charts'>('table');

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['/api/leaderboard', selectedPeriod],
    refetchInterval: 60000, // Refresh every minute
  });

  const agents = leaderboardData || [];

  // Filter out admin users
  const nonAdminAgents = agents.filter((agent: LeaderboardAgent) => 
    agent.role !== 'admin' && agent.role !== 'dev-admin'
  );

  // Calculate statistics for charts
  const topAgents = nonAdminAgents.slice(0, 10);
  const totalMessages = nonAdminAgents.reduce((sum: number, agent: LeaderboardAgent) => sum + agent.totalMessages, 0);
  const totalChats = nonAdminAgents.reduce((sum: number, agent: LeaderboardAgent) => sum + agent.totalChats, 0);

  // Prepare data for charts
  const barChartData = topAgents.map((agent: LeaderboardAgent) => ({
    name: agent.username,
    messages: agent.totalMessages,
    chats: agent.totalChats,
    score: agent.activityScore
  }));

  const pieChartData = topAgents.slice(0, 5).map((agent: LeaderboardAgent) => ({
    name: agent.username,
    value: agent.totalMessages
  }));

  const radarChartData = topAgents.slice(0, 6).map((agent: LeaderboardAgent) => ({
    agent: agent.username,
    activity: agent.activityScore,
    messages: Math.min(agent.totalMessages / 10, 100), // Normalize to 100
    chats: Math.min(agent.totalChats * 2, 100), // Normalize to 100
    engagement: Math.random() * 100, // Placeholder for engagement metric
    consistency: Math.random() * 100 // Placeholder for consistency metric
  }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500 animate-pulse" />;
      case 2:
        return <Trophy className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-orange-500" />;
      default:
        return <Award className="w-4 h-4 text-gray-300" />;
    }
  };

  const getRankBadgeStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold text-lg px-4 py-2";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800 font-bold px-3 py-1";
      case 3:
        return "bg-gradient-to-r from-orange-400 to-orange-500 text-white font-bold px-3 py-1";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const formatLastActivity = (date: string) => {
    const now = new Date();
    const activity = new Date(date);
    const diff = now.getTime() - activity.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return activity.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-yellow-600 animate-bounce mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Leaderboard...</h2>
          <p className="text-gray-600">Calculating agent rankings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Performance Leaderboard</h1>
              <p className="text-gray-600 mt-1">Track and celebrate top-performing agents</p>
            </div>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Users className="w-4 h-4 mr-2" />
            {nonAdminAgents.length} Active Agents
          </Badge>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {(['daily', 'weekly', 'monthly', 'all-time'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              onClick={() => setSelectedPeriod(period)}
              className="capitalize"
            >
              {period.replace('-', ' ')}
            </Button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Total Messages</p>
                  <p className="text-2xl font-bold text-blue-800">{totalMessages.toLocaleString()}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Total Chats</p>
                  <p className="text-2xl font-bold text-green-800">{totalChats.toLocaleString()}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Avg Messages/Agent</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {nonAdminAgents.length > 0 ? Math.round(totalMessages / nonAdminAgents.length) : 0}
                  </p>
                </div>
                <Target className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Top Performer</p>
                  <p className="text-xl font-bold text-amber-800 truncate">
                    {topAgents[0]?.username || 'N/A'}
                  </p>
                </div>
                <Crown className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as 'table' | 'charts')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="table" className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Rankings Table
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance Charts
          </TabsTrigger>
        </TabsList>

        {/* Table View */}
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Agent Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {nonAdminAgents.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg text-gray-500">No agent activity yet</p>
                    <p className="text-sm text-gray-400 mt-2">Agent performance will appear here once they start using JACC</p>
                  </div>
                ) : (
                  nonAdminAgents.map((agent: LeaderboardAgent, index: number) => (
                    <div
                      key={agent.userId}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300' :
                        index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300' :
                        index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300' :
                        'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="flex items-center justify-center min-w-[60px]">
                          {index < 3 ? (
                            <div className="flex flex-col items-center">
                              {getRankIcon(index + 1)}
                              <Badge className={getRankBadgeStyle(index + 1)}>
                                #{index + 1}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-lg px-3 py-1">
                              #{index + 1}
                            </Badge>
                          )}
                        </div>

                        {/* Avatar and Info */}
                        <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                          <AvatarImage src={agent.profileImageUrl} alt={agent.username} />
                          <AvatarFallback className={`${
                            index === 0 ? 'bg-yellow-200 text-yellow-800' :
                            index === 1 ? 'bg-gray-200 text-gray-800' :
                            index === 2 ? 'bg-orange-200 text-orange-800' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {agent.firstName?.[0] || agent.username[0]}
                            {agent.lastName?.[0] || agent.username[1]}
                          </AvatarFallback>
                        </Avatar>

                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.username}</h3>
                          <p className="text-sm text-gray-500">
                            Last active: {formatLastActivity(agent.lastActivity)}
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{agent.totalMessages}</div>
                          <div className="text-xs text-gray-500">Messages</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{agent.totalChats}</div>
                          <div className="text-xs text-gray-500">Chats</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{agent.activityScore}</div>
                          <div className="text-xs text-gray-500">Score</div>
                        </div>
                        
                        {/* Progress to next level */}
                        <div className="w-32">
                          <div className="text-xs text-gray-500 mb-1">Progress</div>
                          <Progress value={Math.min((agent.activityScore % 100), 100)} className="h-2" />
                          <div className="text-xs text-gray-400 mt-1">
                            {100 - (agent.activityScore % 100)} pts to next level
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts View */}
        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Top 10 Agents Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="messages" fill="#3B82F6" name="Messages" />
                    <Bar dataKey="chats" fill="#10B981" name="Chats" />
                    <Bar dataKey="score" fill="#F59E0B" name="Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart - Message Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Message Distribution (Top 5)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Radar Chart - Multi-metric Performance */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Agent Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={radarChartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="agent" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Activity Score" dataKey="activity" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                    <Radar name="Messages" dataKey="messages" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                    <Radar name="Chats" dataKey="chats" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Motivational Message */}
            <Card className="lg:col-span-2 bg-gradient-to-r from-blue-50 to-purple-50">
              <CardContent className="p-8 text-center">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Keep Up the Great Work!</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Every conversation counts! The more you engage with JACC, the better you can serve your merchants. 
                  Top performers are recognized for their dedication to learning and helping clients succeed.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    <Star className="w-4 h-4 mr-2" />
                    Excellence in Service
                  </Badge>
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Continuous Improvement
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}