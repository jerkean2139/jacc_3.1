import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Users, 
  Clock, 
  Star, 
  Trophy, 
  Target, 
  Brain,
  Calculator,
  DollarSign,
  BarChart3,
  Calendar,
  ArrowRight,
  Zap,
  CheckCircle,
  Activity,
  MessageCircle,
  Award
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Chat, Folder } from "@shared/schema";
import { LeaderboardWidget } from "./leaderboard-widget";

interface DynamicWelcomeDashboardProps {
  onNewChatWithMessage: (message: string) => void;
  chats: Chat[];
  folders: Folder[];
}

interface UserActivity {
  totalChats: number;
  totalMessages: number;
  documentsAccessed: number;
  calculationsPerformed: number;
  proposalsGenerated: number;
  currentStreak: number;
  totalPoints: number;
  level: number;
  achievements: number;
  lastActive: string;
}

interface PersonalizedInsight {
  id: string;
  type: 'achievement' | 'suggestion' | 'trend' | 'milestone';
  title: string;
  description: string;
  icon: JSX.Element;
  action?: string;
  priority: 'high' | 'medium' | 'low';
  category: 'performance' | 'learning' | 'engagement' | 'productivity';
}

interface RecentActivity {
  id: string;
  type: 'chat' | 'document' | 'calculation' | 'achievement';
  title: string;
  description: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'pending';
}

export default function DynamicWelcomeDashboard({ 
  onNewChatWithMessage, 
  chats, 
  folders 
}: DynamicWelcomeDashboardProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch user activity data
  const { data: userActivity } = useQuery<UserActivity>({
    queryKey: ["/api/dashboard/user-activity"],
  });

  // Fetch leaderboard data for context
  const { data: leaderboardData } = useQuery({
    queryKey: ["/api/dashboard/leaderboard"],
  });

  // Fetch personalized insights
  const { data: personalizedInsights } = useQuery<PersonalizedInsight[]>({
    queryKey: ["/api/dashboard/insights"],
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/recent-activity"],
  });

  // Generate smart conversation starters based on user data
  const getSmartConversationStarters = () => {
    const starters = [
      {
        title: "Calculate Processing Rates",
        description: "Get competitive pricing analysis",
        message: "I need help calculating processing rates and finding competitive pricing",
        icon: <Calculator className="w-5 h-5" />,
        color: "bg-blue-600 hover:bg-blue-700"
      },
      {
        title: "Compare Processors",
        description: "Analyze different payment solutions",
        message: "I need to compare payment processors - can you help me analyze different options?",
        icon: <BarChart3 className="w-5 h-5" />,
        color: "bg-green-600 hover:bg-green-700"
      },
      {
        title: "Let's Talk Marketing",
        description: "Get marketing and sales insights",
        message: "Show me the latest market intelligence and sales strategies",
        icon: <Brain className="w-5 h-5" />,
        color: "bg-purple-600 hover:bg-purple-700"
      },
      {
        title: "Create Proposal",
        description: "Generate professional proposals",
        message: "Help me create a professional proposal for a new merchant",
        icon: <FileText className="w-5 h-5" />,
        color: "bg-orange-600 hover:bg-orange-700"
      }
    ];
    return starters;
  };

  // Calculate user's rank from leaderboard
  const getUserRank = () => {
    if (!leaderboardData?.leaderboard || !user?.id) return null;
    const userIndex = leaderboardData.leaderboard.findIndex((u: any) => u.id === user.id);
    return userIndex !== -1 ? userIndex + 1 : null;
  };

  // Generate personalized greeting
  const getPersonalizedGreeting = () => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const name = user?.firstName || user?.username || "there";
    
    if (userActivity?.currentStreak && userActivity.currentStreak > 0) {
      return `Good ${timeOfDay}, ${name}! You're on a ${userActivity.currentStreak}-day streak!`;
    }
    
    return `Good ${timeOfDay}, ${name}! Ready to boost your merchant services expertise?`;
  };

  // Calculate progress metrics
  const getProgressMetrics = () => {
    if (!userActivity) return null;
    
    const level = userActivity.level || 1;
    const pointsInCurrentLevel = userActivity.totalPoints % 100;
    const progressPercentage = (pointsInCurrentLevel / 100) * 100;
    
    return {
      level,
      pointsInCurrentLevel,
      progressPercentage,
      pointsToNextLevel: 100 - pointsInCurrentLevel
    };
  };

  // Skip loading state since API endpoints are working properly
  // Using live data from endpoints that are already responding successfully

  const conversationStarters = getSmartConversationStarters();
  const userRank = getUserRank();
  const progressMetrics = getProgressMetrics();

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Personalized Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {getPersonalizedGreeting()}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Your AI-powered merchant services command center. Track progress, discover insights, and accelerate your sales success.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Agent Leaderboard - First Container */}
          <LeaderboardWidget />
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Conversations</p>
                    <p className="text-2xl font-bold">{userActivity?.totalChats || 0}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Level</p>
                    <p className="text-2xl font-bold">Level {progressMetrics?.level || 1}</p>
                  </div>
                  <Trophy className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Points</p>
                    <p className="text-2xl font-bold">{userActivity?.totalPoints || 0}</p>
                  </div>
                  <Star className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Documents Accessed</p>
                    <p className="text-2xl font-bold">{userActivity?.documentsAccessed || 0}</p>
                  </div>
                  <FileText className="h-8 w-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Streak</p>
                    <p className="text-2xl font-bold">{userActivity?.currentStreak || 0} days</p>
                  </div>
                  <Zap className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Leaderboard Rank</p>
                    <p className="text-2xl font-bold">#{userRank || "N/A"}</p>
                  </div>
                  <Target className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Level Progress */}
          {progressMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-600" />
                  Level Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Level {progressMetrics.level}</span>
                    <span>{progressMetrics.pointsToNextLevel} points to next level</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${progressMetrics.progressPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progressMetrics.pointsInCurrentLevel}/100 points in current level
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Smart Conversation Starters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Smart Conversation Starters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {conversationStarters.map((starter, index) => (
                  <Button
                    key={index}
                    onClick={() => onNewChatWithMessage(starter.message)}
                    className={`${starter.color} text-white p-4 h-auto justify-start`}
                    variant="default"
                  >
                    <div className="flex items-center gap-3 text-left">
                      {starter.icon}
                      <div>
                        <div className="font-medium">{starter.title}</div>
                        <div className="text-sm opacity-90">{starter.description}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Activity Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Activity Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Total Messages</span>
                  <Badge variant="secondary">{userActivity?.totalMessages || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Documents Accessed</span>
                  <Badge variant="secondary">{userActivity?.documentsAccessed || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Calculations Done</span>
                  <Badge variant="secondary">{userActivity?.calculationsPerformed || 0}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Proposals Generated</span>
                  <Badge variant="secondary">{userActivity?.proposalsGenerated || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-600" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">First Week Complete</p>
                      <p className="text-xs text-muted-foreground">Completed 7 consecutive days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Chat Master</p>
                      <p className="text-xs text-muted-foreground">Started 10+ conversations</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {personalizedInsights && personalizedInsights.length > 0 ? (
              personalizedInsights.map((insight) => (
                <Card key={insight.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {insight.icon}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{insight.title}</h4>
                          <Badge 
                            variant={insight.priority === 'high' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {insight.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                        {insight.action && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onNewChatWithMessage(insight.action!)}
                          >
                            Take Action <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Generate Your First Insights</h3>
                  <p className="text-muted-foreground mb-4">
                    Start chatting with JACC to receive personalized recommendations and insights.
                  </p>
                  <Button onClick={() => onNewChatWithMessage("Tell me about the merchant services industry")}>
                    Start Learning
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.status === 'completed' ? 'bg-green-500' :
                        activity.status === 'in-progress' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Recent Activity</h3>
                  <p className="text-muted-foreground mb-4">
                    Your recent conversations and actions will appear here.
                  </p>
                  <Button onClick={() => onNewChatWithMessage("What can you help me with today?")}>
                    Get Started
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}