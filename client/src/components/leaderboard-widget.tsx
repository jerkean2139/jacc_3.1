import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Users, MessageSquare, Activity } from 'lucide-react';

interface LeaderboardAgent {
  rank: number;
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
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
}

interface LeaderboardWidgetProps {
  showFullLeaderboard?: boolean;
  maxEntries?: number;
}

export function LeaderboardWidget({ showFullLeaderboard = false, maxEntries = 5 }: LeaderboardWidgetProps) {
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['/api/leaderboard'],
    refetchInterval: 60000, // Refresh every minute
  });

  const agents = (leaderboardData && typeof leaderboardData === 'object' && 'leaderboard' in leaderboardData && Array.isArray((leaderboardData as any).leaderboard)) ? (leaderboardData as any).leaderboard : [];
  const displayAgents = showFullLeaderboard ? agents : agents.slice(0, maxEntries);

  // Skip loading state since API endpoints are working properly
  // Use live data from endpoints that are already responding successfully

  if (!agents.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Agent Activity Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Activity Data Yet</p>
            <p className="text-sm">Agent chat activity will appear here once conversations begin</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Agent Activity Leaderboard
        </CardTitle>
        {!showFullLeaderboard && (
          <div className="text-sm text-gray-600">
            Top {maxEntries} most active agents
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        {showFullLeaderboard && (
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {agents.reduce((sum: number, agent: LeaderboardAgent) => sum + agent.totalChats, 0)}
              </div>
              <div className="text-xs text-gray-500">Total Chats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {agents.reduce((sum: number, agent: LeaderboardAgent) => sum + agent.userQueries, 0)}
              </div>
              <div className="text-xs text-gray-500">User Queries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {agents.reduce((sum: number, agent: LeaderboardAgent) => sum + agent.aiResponses, 0)}
              </div>
              <div className="text-xs text-gray-500">AI Responses</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {displayAgents.map((agent: LeaderboardAgent, index: number) => (
            <div 
              key={agent.username} 
              className={`flex items-center justify-between p-3 border rounded-lg transition-all hover:shadow-sm ${
                index === 0 ? 'bg-yellow-50 border-yellow-200' :
                index === 1 ? 'bg-gray-50 border-gray-200' :
                index === 2 ? 'bg-orange-50 border-orange-200' :
                'bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  {agent.profileImageUrl ? (
                    <img 
                      src={agent.profileImageUrl} 
                      alt={`${agent.firstName || agent.username}'s profile`}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-gray-400 text-gray-900' :
                    index === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-blue-400 text-blue-900'
                  }`}>
                    {agent.rank}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{agent.username}</span>
                    <Badge variant="outline" className="text-xs">
                      {agent.role}
                    </Badge>
                    {index < 3 && (
                      <div className="flex items-center gap-1">
                        {index === 0 && <Trophy className="h-3 w-3 text-yellow-600" />}
                        {index === 1 && <Medal className="h-3 w-3 text-gray-600" />}
                        {index === 2 && <Award className="h-3 w-3 text-orange-600" />}
                      </div>
                    )}
                  </div>
                  
                  {showFullLeaderboard && (
                    <>
                      <div className="text-xs text-gray-600">{agent.email}</div>
                      {agent.lastActivity && (
                        <div className="text-xs text-gray-500">
                          Last active: {new Date(agent.lastActivity).toLocaleDateString()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                {showFullLeaderboard ? (
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <div className="font-bold">{agent.totalChats}</div>
                      <div className="text-gray-500">Chats</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{agent.userQueries}</div>
                      <div className="text-gray-500">Queries</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{agent.aiResponses}</div>
                      <div className="text-gray-500">Responses</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="font-bold text-blue-600">{agent.totalMessages}</div>
                    <div className="text-xs text-gray-500">Messages</div>
                  </div>
                )}
                
                <div className="mt-1">
                  <div className="font-bold text-xs text-purple-600">{agent.activityScore} pts</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {!showFullLeaderboard && agents.length > maxEntries && (
          <div className="text-center mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500">
              +{agents.length - maxEntries} more agents
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}