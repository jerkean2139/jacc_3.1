import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Clock, Eye, Lightbulb, FileText, BarChart3, File, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContentFlag {
  id: string;
  chunkId: string;
  documentId: string;
  flagType: string;
  flagReason: string;
  priority: string;
  status: string;
  aiSuggestion?: string;
  humanNotes?: string;
  originalContent: string;
  enhancedContent?: string;
  reviewCount: number;
  documentName: string;
  documentType: string;
  createdAt: string;
}

interface ContentStats {
  totalFlags: number;
  byPriority: { critical: number; high: number; medium: number; low: number };
  byStatus: { pending: number; in_review: number; enhanced: number; dismissed: number };
  byType: Record<string, number>;
}

export function ContentQualityManager() {
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [enhancedContent, setEnhancedContent] = useState('');
  const [humanNotes, setHumanNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showDocumentContent, setShowDocumentContent] = useState(false);
  const [documentContent, setDocumentContent] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [activeTab, setActiveTab] = useState('flags');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Function to fetch document content
  const fetchDocumentContent = async (documentId: string, chunkId: string) => {
    setLoadingContent(true);
    setShowDocumentContent(true); // Open the dialog immediately
    
    try {
      const response = await apiRequest('GET', `/api/admin/content-quality/document-content/${documentId}?chunkId=${chunkId}`);
      const data = await response.json();
      console.log('Document content fetched:', data);
      
      if (!data || (!data.currentChunk && !data.fullContent)) {
        throw new Error('No content found in document');
      }
      
      setDocumentContent(data);
    } catch (error) {
      console.error('Error fetching document content:', error);
      toast({
        title: 'Error fetching document content',
        description: error.message || 'Failed to load document content. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingContent(false);
    }
  };

  // Fetch content quality flags
  const { data: flags = [], isLoading } = useQuery({
    queryKey: [`/api/admin/content-quality/flags?status=${statusFilter}&priority=${priorityFilter}&limit=100`],
  });

  // Fetch statistics
  const { data: stats } = useQuery<ContentStats>({
    queryKey: ['/api/admin/content-quality/stats'],
  });

  // Enhanced content save mutation - updates vector database too
  const updateFlagMutation = useMutation({
    mutationFn: async (data: { id: string; enhancedContent: string; humanNotes: string; status: string }) => {
      const response = await apiRequest('POST', `/api/admin/content-quality/save-enhancement/${data.id}`, {
        enhancedContent: data.enhancedContent,
        humanNotes: data.humanNotes,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-quality/flags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-quality/stats'] });
      
      // Show detailed success message
      const actionDetails = [
        '✓ Original content replaced with enhanced version',
        '✓ Vector database updated for improved search accuracy',
        '✓ Document chunk marked as resolved',
        selectedFlag?.flagType === 'generic_template' && '✓ Generic template replaced with specific content',
        selectedFlag?.flagType === 'too_short' && '✓ Short content expanded with more details',
      ].filter(Boolean).join('\n');
      
      toast({ 
        title: 'Enhancement Complete!', 
        description: (
          <div className="space-y-2">
            <p>Successfully enhanced content for: <strong>{selectedFlag?.documentName}</strong></p>
            <div className="text-sm mt-2 space-y-1">
              {actionDetails.split('\n').map((action, idx) => (
                <div key={idx} className="flex items-start gap-1">
                  <span className="text-green-600">{action}</span>
                </div>
              ))}
            </div>
          </div>
        ),
        duration: 6000, // Show for longer to read details
      });
      
      // Clear selection and switch back to flags tab
      setSelectedFlag(null);
      setEnhancedContent('');
      setHumanNotes('');
      setActiveTab('flags'); // Switch back to see updated list
    },
    onError: (error: any) => {
      toast({ 
        title: 'Enhancement failed', 
        description: error.message || 'Failed to save enhanced content.', 
        variant: 'destructive' 
      });
    },
  });

  // AI suggestion generation mutation
  const generateSuggestionMutation = useMutation({
    mutationFn: async (flagId: string) => {
      const response = await apiRequest('POST', `/api/admin/content-quality/generate-suggestion/${flagId}`);
      return response.json();
    },
    onSuccess: (data, flagId) => {
      // Update the selected flag with the new suggestion
      if (selectedFlag && selectedFlag.id === flagId) {
        setSelectedFlag(prev => prev ? {...prev, aiSuggestion: data.suggestion} : null);
        setEnhancedContent(data.suggestion);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-quality/flags'] });
      toast({ 
        title: 'AI Suggestion Generated', 
        description: 'AI has created an enhanced content suggestion.' 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'AI suggestion failed', 
        description: error.message || 'Failed to generate AI suggestion.', 
        variant: 'destructive' 
      });
    },
  });

  // Bulk enhancement mutation
  const bulkEnhanceMutation = useMutation({
    mutationFn: async (data: { flagIds: string[]; enhancementType: string }) => {
      const response = await apiRequest('POST', '/api/admin/content-quality/bulk-enhance', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-quality/flags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-quality/stats'] });
      toast({
        title: "Bulk Enhancement Complete",
        description: `Enhanced ${data.summary.successful} of ${data.summary.total} items.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Enhancement Failed",
        description: error.message || "Failed to process bulk enhancement.",
        variant: "destructive",
      });
    },
  });

  const handleEnhanceContent = () => {
    if (!selectedFlag || !enhancedContent.trim()) return;
    
    updateFlagMutation.mutate({
      id: selectedFlag.id,
      enhancedContent,
      humanNotes,
      status: 'enhanced',
    });
  };

  const handleDismissFlag = (flag: ContentFlag) => {
    updateFlagMutation.mutate({
      id: flag.id,
      enhancedContent: flag.originalContent,
      humanNotes: 'Dismissed - content is acceptable as-is',
      status: 'dismissed',
    });
    
    // Show feedback for dismissal
    toast({
      title: 'Flag Dismissed',
      description: `Content in "${flag.documentName}" marked as acceptable. It will remain unchanged.`,
      duration: 3000,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enhanced': return 'default';
      case 'in_review': return 'secondary';
      case 'dismissed': return 'outline';
      default: return 'destructive';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Eye className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Quality Manager</h2>
          <p className="text-muted-foreground">Identify and enhance generic document chunks for better search accuracy</p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalFlags || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Flags</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{(stats.byPriority?.critical || 0) + (stats.byPriority?.high || 0)}</p>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.byStatus?.pending || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.byStatus?.enhanced || 0}</p>
                  <p className="text-sm text-muted-foreground">Enhanced</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">Chunks Needing Attention</TabsTrigger>
          <TabsTrigger value="enhance" disabled={!selectedFlag}>
            {selectedFlag ? 'Enhance Selected' : 'Select Chunk to Enhance'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          {/* Filters */}
          <div className="flex space-x-4 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="enhanced">Enhanced</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {flags.length > 0 && statusFilter === 'pending' && (
              <Button
                variant="default"
                onClick={() => {
                  const pendingIds = flags.filter(f => f.status === 'pending').map(f => f.id);
                  if (pendingIds.length > 0) {
                    bulkEnhanceMutation.mutate({ flagIds: pendingIds, enhancementType: 'auto' });
                  }
                }}
                disabled={bulkEnhanceMutation.isPending}
                className="ml-auto"
              >
                {bulkEnhanceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Bulk Enhancing...
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Bulk Enhance All Pending
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Flags List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Loading content quality flags...</div>
            ) : flags.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Flags Found</h3>
                  <p className="text-muted-foreground">
                    {statusFilter === 'pending' 
                      ? 'All chunks are in good condition!' 
                      : 'No flags match your current filters.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              flags.map((flag: ContentFlag) => (
                <Card key={flag.id} className={`cursor-pointer transition-colors ${
                  selectedFlag?.id === flag.id ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                }`} onClick={() => {
                  setSelectedFlag(flag);
                  setEnhancedContent(flag.enhancedContent || flag.originalContent);
                  setHumanNotes(flag.humanNotes || '');
                }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getPriorityIcon(flag.priority)}
                        <CardTitle className="text-lg">{flag.documentName}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getPriorityColor(flag.priority)}>{flag.priority}</Badge>
                        <Badge variant={getStatusColor(flag.status)}>{flag.status}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{flag.flagReason}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-sm mb-1">Original Content:</p>
                        <p className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded border-l-4 border-orange-500">
                          {flag.originalContent.substring(0, 200)}
                          {flag.originalContent.length > 200 && '...'}
                        </p>
                      </div>
                      
                      {flag.aiSuggestion && (
                        <div>
                          <p className="font-medium text-sm mb-1 flex items-center">
                            <Lightbulb className="h-4 w-4 mr-1 text-yellow-500" />
                            AI Suggestion:
                          </p>
                          <p className="text-sm bg-blue-100 dark:bg-blue-900 p-3 rounded border-l-4 border-blue-500">
                            {flag.aiSuggestion}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchDocumentContent(flag.documentId, flag.chunkId);
                            }}
                            disabled={loadingContent}
                          >
                            <File className="h-4 w-4 mr-1" />
                            View Document
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFlag(flag);
                              setEnhancedContent(flag.enhancedContent || flag.originalContent);
                              setHumanNotes(flag.humanNotes || '');
                              setActiveTab('enhance');
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Enhance
                          </Button>
                          {!flag.aiSuggestion && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateSuggestionMutation.mutate(flag.id);
                              }}
                              disabled={generateSuggestionMutation.isPending}
                            >
                              <Lightbulb className="h-4 w-4 mr-1" />
                              Get AI Suggestion
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissFlag(flag);
                            }}
                          >
                            Dismiss
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Reviewed {flag.reviewCount} times
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="enhance">
          {selectedFlag ? (
            <Card>
              <CardHeader>
                <CardTitle>Enhance Content Chunk</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Document: {selectedFlag.documentName} | Type: {selectedFlag.flagType} | Priority: {selectedFlag.priority}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Original Content:</label>
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded border-l-4 border-orange-500">
                    <p className="text-sm">{selectedFlag.originalContent}</p>
                  </div>
                </div>

                {selectedFlag.aiSuggestion && (
                  <div>
                    <label className="text-sm font-medium mb-2 block flex items-center">
                      <Lightbulb className="h-4 w-4 mr-1 text-yellow-500" />
                      AI Suggestion:
                    </label>
                    <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded border-l-4 border-blue-500">
                      <p className="text-sm whitespace-pre-line">{selectedFlag.aiSuggestion}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="enhanced-content" className="text-sm font-medium mb-2 block">
                    Enhanced Content:
                  </label>
                  <Textarea
                    id="enhanced-content"
                    value={enhancedContent}
                    onChange={(e) => setEnhancedContent(e.target.value)}
                    placeholder="Enter improved, specific content that provides real value to users..."
                    className="min-h-[200px]"
                  />
                </div>

                <div>
                  <label htmlFor="human-notes" className="text-sm font-medium mb-2 block">
                    Enhancement Notes:
                  </label>
                  <Textarea
                    id="human-notes"
                    value={humanNotes}
                    onChange={(e) => setHumanNotes(e.target.value)}
                    placeholder="Optional notes about the enhancement approach..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={handleEnhanceContent}
                    disabled={!enhancedContent.trim() || updateFlagMutation.isPending}
                    className="flex-1"
                  >
                    {updateFlagMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving & Updating Vector DB...
                      </>
                    ) : (
                      'Save Enhanced Content'
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => generateSuggestionMutation.mutate(selectedFlag.id)}
                    disabled={generateSuggestionMutation.isPending}
                  >
                    {generateSuggestionMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="h-4 w-4 mr-2" />
                        AI Suggest
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFlag(null);
                      setEnhancedContent('');
                      setHumanNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Chunk Selected</h3>
                <p className="text-muted-foreground">
                  Select a content chunk from the "Chunks Needing Attention" tab to enhance it.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Document Content Dialog */}
      <Dialog open={showDocumentContent} onOpenChange={setShowDocumentContent}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Document Content</DialogTitle>
            <DialogDescription>
              {documentContent?.documentName || 'Loading...'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full pr-4">
            {loadingContent ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : documentContent ? (
              <div className="space-y-4">
                {/* Display surrounding chunks */}
                {documentContent.surroundingChunks?.before && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Previous Content:</h3>
                    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded text-sm">
                      {documentContent.surroundingChunks.before}
                    </div>
                  </div>
                )}
                
                <div>
                  <h3 className="font-semibold text-sm mb-2">Current Chunk:</h3>
                  <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded text-sm border-2 border-yellow-300 dark:border-yellow-700">
                    {documentContent.currentChunk}
                  </div>
                </div>
                
                {documentContent.surroundingChunks?.after && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Following Content:</h3>
                    <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded text-sm">
                      {documentContent.surroundingChunks.after}
                    </div>
                  </div>
                )}
                
                {/* Full document content if available */}
                {documentContent.fullContent && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Full Document Preview:</h3>
                    <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded text-sm whitespace-pre-wrap">
                      {documentContent.fullContent}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No content available.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}