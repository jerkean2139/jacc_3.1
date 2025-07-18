import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Settings, Database, MessageSquare, Brain, PlayCircle, CheckCircle, XCircle, 
  AlertTriangle, Clock, TrendingUp, Zap, Globe, Search, FileText, Eye, Download,
  Edit, Trash2, Save, Plus, Folder, FolderOpen, Upload, Users, Activity,
  BarChart3, Timer, ChevronDown, ChevronRight, Target, BookOpen, ThumbsUp, Trash,
  ThumbsDown, Star, Copy, AlertCircle, ArrowRight, User, Bot, RefreshCw, Calendar,
  Archive, Scan, ExternalLink, Menu, X, Home, MessageCircle, Files, HelpCircle, Key, Code, Info, Mail
} from 'lucide-react';
import DocumentDragDrop from '@/components/ui/document-drag-drop';
import DocumentPreviewModal from '@/components/ui/document-preview-modal';
import DocumentUpload from '@/components/document-upload-new';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ContentQualityManager } from '@/components/admin/ContentQualityManager';
import AdvancedOCRManager from '@/components/admin/AdvancedOCRManager';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import AIProfileCreator from '@/components/ai-profile-creator';

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  priority: number;
  isActive: boolean;
}

interface DocumentEntry {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  folderId?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

export default function AdminControlCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for creating new FAQ entries
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newPriority, setNewPriority] = useState(1);
  const [openKnowledgeCategories, setOpenKnowledgeCategories] = useState<string[]>([]);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);

  // State for creating new prompt templates
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptDescription, setNewPromptDescription] = useState('');
  const [newPromptTemplate, setNewPromptTemplate] = useState('');
  const [newPromptCategory, setNewPromptCategory] = useState('system');
  const [newPromptTemperature, setNewPromptTemperature] = useState(0.7);
  const [newPromptMaxTokens, setNewPromptMaxTokens] = useState(1000);

  // State for editing prompt templates
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [showEditPromptModal, setShowEditPromptModal] = useState(false);
  const [editPromptName, setEditPromptName] = useState('');
  const [editPromptDescription, setEditPromptDescription] = useState('');
  const [editPromptTemplate, setEditPromptTemplate] = useState('');
  const [editPromptCategory, setEditPromptCategory] = useState('system');
  const [editPromptTemperature, setEditPromptTemperature] = useState(0.7);
  const [editPromptMaxTokens, setEditPromptMaxTokens] = useState(1000);

  // Document upload states
  const [uploadSelectedFolder, setUploadSelectedFolder] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState('admin');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  
  // Folder creation states
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');
  
  // Document management states
  const [documentSearchTerm, setDocumentSearchTerm] = useState('');
  const [documentFilter, setDocumentFilter] = useState('all');
  
  // Chat Review Center States
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatDetails, setSelectedChatDetails] = useState<any>(null);
  const [chatReviewTab, setChatReviewTab] = useState<string>("active");
  const [chatDisplayLimit, setChatDisplayLimit] = useState(5); // Show 5 chats initially
  
  // For editing individual message responses in chat review
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedResponses, setEditedResponses] = useState<Record<string, string>>({});
  

  // URL tracking state  
  const [showEditUrl, setShowEditUrl] = useState(false);
  const [editingUrl, setEditingUrl] = useState<any>(null);
  const [isForcingUpdate, setIsForcingUpdate] = useState<string | null>(null);
  
  // State for category management
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  
  // Google Sheets sync state
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState<any>(null);
  const [showGoogleSheetsConfig, setShowGoogleSheetsConfig] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [questionColumn, setQuestionColumn] = useState('A');
  const [answerColumn, setAnswerColumn] = useState('B');
  const [categoryColumn, setCategoryColumn] = useState('C');
  const [tagsColumn, setTagsColumn] = useState('D');
  const [priorityColumn, setPriorityColumn] = useState('E');
  const [isActiveColumn, setIsActiveColumn] = useState('F');
  const [headerRow, setHeaderRow] = useState(1);
  const [syncFrequency, setSyncFrequency] = useState('manual');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  
  // User management states
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showProfileCreator, setShowProfileCreator] = useState(false);
  const [editingUserProfile, setEditingUserProfile] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    role: 'sales-agent',
    isActive: true,
    profileImageUrl: ''
  });
  const [showUserCreatedDialog, setShowUserCreatedDialog] = useState(false);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    username: string;
    password: string;
    email: string;
  } | null>(null);
  
  // URL Scraping for Knowledge Base
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScrapingForKnowledge, setIsScrapingForKnowledge] = useState(false);
  const [enableWeeklyUpdates, setEnableWeeklyUpdates] = useState(false);
  const [settingsTab, setSettingsTab] = useState("ai-search");
  
  // Dialog states for glassomorphic settings
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showEditFAQ, setShowEditFAQ] = useState(false);
  const [scheduledUrls, setScheduledUrls] = useState<string[]>([]);
  const [correctionText, setCorrectionText] = useState("");
  
  // Navigation sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // State for URL tracking management - removed duplicates

  // State for user management settings
  const [userSettings, setUserSettings] = useState({
    defaultRole: "sales-agent",
    sessionTimeout: "1hour",
    requireMFA: true,
    allowGuestAccess: false,
    autoLogout: true
  });

  // State for content & document settings
  const [contentSettings, setContentSettings] = useState({
    ocrQuality: "medium",
    maxFileSize: 25,
    autoCategorize: true,
    versionControl: true,
    backupDaily: true
  });

  // State for system performance settings
  const [systemSettings, setSystemSettings] = useState({
    memoryThreshold: 80,
    responseTimeTarget: 2.0,
    databaseLoadThreshold: 70
  });
  
  // Iframe integration states
  const [ssoToken, setSsoToken] = useState('test-sso-token-12345');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  
  // Function to generate SSO token
  const generateSSOToken = async () => {
    setIsGeneratingToken(true);
    try {
      const response = await apiRequest('POST', '/api/admin/generate-sso-token');
      if (response.success) {
        setSsoToken(response.token);
        toast({
          title: "Token Generated",
          description: "New SSO token generated successfully. It expires in 24 hours."
        });
      }
    } catch (error) {
      console.error('Failed to generate SSO token:', error);
      toast({
        title: "Error",
        description: "Failed to generate SSO token",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Data queries
  const { data: faqData = [], isLoading: faqLoading, error: faqError } = useQuery({
    queryKey: ['/api/admin/faq'],
    retry: false,
  });

  const { data: documentsData = [] } = useQuery({
    queryKey: ['/api/admin/documents'],
    retry: false,
  });

  const { data: foldersData = [] } = useQuery({
    queryKey: ['/api/folders'],
    retry: false,
  });

  const { data: userChats, isLoading: chatsLoading } = useQuery({
    queryKey: ['/api/admin/chat-reviews'],
  });

  // Archive statistics query
  const { data: archiveStats } = useQuery({
    queryKey: ['/api/admin/chats/archive-stats'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // AI Configuration queries
  const { data: aiModelsData } = useQuery({
    queryKey: ['/api/admin/ai-models'],
    retry: false,
  });

  const { data: searchParamsData } = useQuery({
    queryKey: ['/api/admin/search-params'],
    retry: false,
  });

  const { data: aiConfigData } = useQuery({
    queryKey: ['/api/admin/ai-config'],
    retry: false,
  });

  const { data: chatMessages, isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
  });

  // Fetch vendor URLs for tracking
  const { data: vendorUrls = [], refetch: refetchVendorUrls } = useQuery({
    queryKey: ['/api/admin/vendor-urls'],
    retry: false,
  });

  // Google Sheets config query
  const { data: googleSheetsConfigData } = useQuery({
    queryKey: ['/api/admin/google-sheets/config'],
    retry: false,
  });

  // Google Sheets sync history query
  const { data: syncHistoryData = [] } = useQuery({
    queryKey: ['/api/admin/google-sheets/sync-history'],
    retry: false,
  });

  // Fetch FAQ categories
  const { data: faqCategories = [] } = useQuery({
    queryKey: ['/api/admin/faq-categories'],
    retry: false,
  });

  // Fetch performance data for system monitoring
  const { data: performanceData } = useQuery({
    queryKey: ['/api/admin/performance'],
    retry: false,
  });

  // Use fetched data for AI configuration and search parameters
  const aiConfig = aiConfigData || {
    primaryModel: 'claude-sonnet-4-20250514',
    fallbackModel: 'claude-3.7',
    temperature: 0.7,
    maxTokens: 4096,
    responseStyle: 'professional'
  };

  const searchParams = searchParamsData || {
    sensitivity: 0.8,
    searchOrder: ['faq', 'documents', 'web'],
    fuzzyMatching: true,
    maxResults: 10
  };

  // Fetch users data for user management
  const { data: usersData = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users'],
    staleTime: 0, // No caching - always fresh data
    refetchOnWindowFocus: false,
    gcTime: 0, // Don't keep in garbage collection cache
  });

  // Debug logging for user data
  console.log('Users Data:', usersData.length, 'total, Filter:', userRoleFilter, 'Search:', userSearchTerm);

  // Monitor chat selection state
  useEffect(() => {
    if (selectedChatId && chatMessages?.length > 0) {
      console.log('Chat loaded successfully:', {
        chatId: selectedChatId,
        messageCount: chatMessages.length
      });
    }
  }, [selectedChatId, chatMessages]);

  // Update chat details whenever chatMessages changes
  useEffect(() => {
    if (selectedChatId && chatMessages) {
      console.log('Processing chat messages:', { 
        chatId: selectedChatId, 
        messageCount: chatMessages.length,
        messages: chatMessages 
      });
      
      if (chatMessages.length > 0) {
        // Store all messages for full conversation display
        setSelectedChatDetails({
          userMessage: '', // Not used in new display
          aiResponse: '', // Not used in new display
          messages: chatMessages
        });
      } else {
        setSelectedChatDetails({
          userMessage: '',
          aiResponse: '',
          messages: []
        });
      }
    }
  }, [chatMessages, selectedChatId]);



  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      const response = await fetch('/api/admin/faq-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      });
      if (!response.ok) throw new Error('Failed to create category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      setShowCreateCategory(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      toast({
        title: "Category Created",
        description: "New FAQ category has been created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create category. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/admin/faq-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      setShowEditCategory(false);
      setEditingCategory(null);
      setNewCategoryName('');
      setNewCategoryDescription('');
      toast({
        title: "Category Updated",
        description: "FAQ category has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update category. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/faq-categories/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      toast({
        title: "Category Deleted",
        description: "FAQ category has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed", 
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      });
    }
  });

  // AI Configuration mutations
  const updateAiConfigMutation = useMutation({
    mutationFn: (config: any) => apiRequest('/api/admin/ai-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config'] });
      toast({
        title: "Success",
        description: "AI configuration updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update AI configuration",
        variant: "destructive",
      });
    },
  });

  // User Management Mutations
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      refetchUsers(); // Force immediate refetch
      
      // Store credentials for display
      setCreatedUserCredentials({
        username: newUser.username,
        password: newUser.password,
        email: newUser.email
      });
      
      setShowCreateUser(false);
      setShowUserCreatedDialog(true);
      
      // Reset form
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        role: 'sales-agent',
        isActive: true,
        profileImageUrl: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: string; userData: any }) => {
      return apiRequest(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowEditUser(false);
      setEditingUser(null);
      toast({
        title: "User Updated",
        description: "User has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      return apiRequest(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });
    },
    onSuccess: () => {
      setShowResetPassword(false);
      setEditingUser(null);
      setNewPassword('');
      toast({
        title: "Password Reset",
        description: "User password has been reset successfully",
      });
    },
    onError: () => {
      toast({
        title: "Reset Failed",
        description: "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update search parameters mutation
  const updateSearchParamsMutation = useMutation({
    mutationFn: (params: any) => apiRequest('/api/admin/search-params', {
      method: 'PUT',
      body: JSON.stringify(params),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/search-params'] });
      toast({
        title: "Success",
        description: "Search parameters updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update search parameters",
        variant: "destructive",
      });
    },
  });

  // Set default model mutation
  const setDefaultModelMutation = useMutation({
    mutationFn: (modelId: string) => apiRequest(`/api/admin/ai-models/${modelId}/set-default`, {
      method: 'POST',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-models'] });
      toast({
        title: "Success",
        description: "Default model updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to set default model",
        variant: "destructive",
      });
    },
  });

  // Google Sheets sync mutation
  const syncGoogleSheetsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/admin/google-sheets/sync', {
        method: 'POST'
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/google-sheets/sync-history'] });
      toast({
        title: "Sync Successful",
        description: "Google Sheets data has been synced to the knowledge base.",
      });
      setIsSyncing(false);
    },
    onError: (error: any) => {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Google Sheets data.",
        variant: "destructive",
      });
      setIsSyncing(false);
    },
  });

  // Save Google Sheets config mutation
  const saveGoogleSheetsConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await apiRequest('/api/admin/google-sheets/config', {
        method: 'POST',
        body: JSON.stringify(config)
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/google-sheets/config'] });
      toast({
        title: "Configuration Saved",
        description: "Google Sheets configuration has been saved successfully.",
      });
      setShowGoogleSheetsConfig(false);
    },
    onError: (error: any) => {
      console.error('Config save error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save Google Sheets configuration.",
        variant: "destructive",
      });
    },
  });

  // Validate spreadsheet mutation
  const validateSpreadsheetMutation = useMutation({
    mutationFn: async (spreadsheetId: string) => {
      const response = await apiRequest('/api/admin/google-sheets/validate', {
        method: 'POST',
        body: JSON.stringify({ spreadsheetId })
      });
      return response;
    },
    onSuccess: (data: any) => {
      if (data.valid) {
        toast({
          title: "Valid Spreadsheet",
          description: `Found spreadsheet: ${data.info.title}`,
        });
      } else {
        toast({
          title: "Invalid Spreadsheet",
          description: data.error || "Unable to access the spreadsheet.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Validation Failed",
        description: "Failed to validate the spreadsheet.",
        variant: "destructive",
      });
    },
  });

  // User Management Settings mutations
  const updateUserSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: "Success",
        description: "User settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user settings",
        variant: "destructive",
      });
    },
  });

  // Prompt editing mutation
  const updatePromptMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: any }) => {
      const response = await fetch(`/api/admin/prompts/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update prompt');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/prompts'] });
      setShowEditPromptModal(false);
      setEditingPrompt(null);
      toast({
        title: "Prompt Updated",
        description: "AI prompt has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update prompt. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Prompt editing handlers
  const handleEditPrompt = (prompt: PromptTemplate) => {
    setEditingPrompt(prompt);
    setEditPromptName(prompt.name);
    setEditPromptDescription(prompt.description);
    setEditPromptTemplate(prompt.template);
    setEditPromptCategory(prompt.category);
    setEditPromptTemperature(prompt.temperature);
    setEditPromptMaxTokens(prompt.maxTokens);
    setShowEditPromptModal(true);
  };

  const handleUpdatePrompt = () => {
    if (!editPromptName.trim() || !editPromptTemplate.trim() || !editingPrompt) {
      toast({ title: 'Please fill in prompt name and content', variant: 'destructive' });
      return;
    }

    updatePromptMutation.mutate({
      key: editingPrompt.id,
      data: {
        name: editPromptName,
        description: editPromptDescription,
        template: editPromptTemplate,
        category: editPromptCategory,
        temperature: editPromptTemperature,
        maxTokens: editPromptMaxTokens,
        isActive: true,
      },
    });
  };

  // Content & Documents Settings mutations
  const updateContentSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: "Success",
        description: "Content settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update content settings",
        variant: "destructive",
      });
    },
  });

  // System Performance Settings mutations
  const updateSystemSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings'] });
      toast({
        title: "Success",
        description: "System settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update system settings",
        variant: "destructive",
      });
    },
  });

  // User Management Handler Functions
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    createUserMutation.mutate(newUser);
  };

  const handleUpdateUser = async () => {
    if (!editingUser?.id) return;
    
    updateUserMutation.mutate({ 
      id: editingUser.id, 
      userData: editingUser 
    });
  };

  const handleResetPassword = async () => {
    if (!editingUser?.id || !newPassword) {
      toast({
        title: "Validation Error",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }
    
    resetPasswordMutation.mutate({ 
      userId: editingUser.id, 
      newPassword 
    });
  };

  // Function to check for duplicate FAQs
  const checkForDuplicateFAQ = (question: string, existingFAQs: FAQ[]) => {
    const normalizedQuestion = question.toLowerCase().trim();
    const threshold = 0.8; // 80% similarity threshold
    
    for (const faq of existingFAQs) {
      const existingQuestion = faq.question.toLowerCase().trim();
      
      // Calculate simple similarity score
      const words1 = normalizedQuestion.split(/\s+/);
      const words2 = existingQuestion.split(/\s+/);
      const commonWords = words1.filter(word => words2.includes(word));
      const similarity = commonWords.length / Math.max(words1.length, words2.length);
      
      if (similarity >= threshold) {
        return {
          isDuplicate: true,
          similarFAQ: faq,
          similarity: Math.round(similarity * 100)
        };
      }
    }
    
    return { isDuplicate: false };
  };

  // Mutations
  const createFAQMutation = useMutation({
    mutationFn: async (newFAQ: Omit<FAQ, 'id'>) => {
      console.log('Creating FAQ with data:', newFAQ);
      
      // Check for duplicates before creating
      const duplicateCheck = checkForDuplicateFAQ(newFAQ.question, faqData || []);
      
      if (duplicateCheck.isDuplicate && duplicateCheck.similarFAQ) {
        // Show warning dialog
        const confirmed = await new Promise<boolean>((resolve) => {
          const message = `This question is ${duplicateCheck.similarity}% similar to an existing FAQ:\n\n"${duplicateCheck.similarFAQ.question}"\n\nDo you still want to create this FAQ?`;
          
          if (window.confirm(message)) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        if (!confirmed) {
          throw new Error('FAQ creation cancelled due to duplicate detection');
        }
      }
      
      const response = await apiRequest('/api/admin/faq', {
        method: 'POST',
        body: JSON.stringify(newFAQ)
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      setNewQuestion('');
      setNewAnswer('');
      setNewCategory('general');
      setNewPriority(1);
      toast({
        title: "FAQ Created",
        description: "New FAQ entry has been added successfully.",
      });
    },
    onError: (error) => {
      console.error('FAQ creation error:', error);
      if (error.message?.includes('duplicate detection')) {
        toast({
          title: "FAQ Creation Cancelled",
          description: "Similar FAQ already exists. Consider updating the existing entry instead.",
          variant: "default",
        });
      } else {
        toast({
          title: "Creation Failed",
          description: "Failed to create FAQ entry. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Edit FAQ mutation - Fixed API call
  const editFAQMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FAQ> }) => {
      console.log('Updating FAQ:', id, data);
      const response = await fetch(`/api/admin/faq/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update FAQ');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      setEditingFAQ(null);
      toast({
        title: "FAQ Updated",
        description: "FAQ entry has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('FAQ update error:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update FAQ entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete FAQ mutation - Fixed API call
  const deleteFAQMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/faq/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
      toast({
        title: "FAQ Deleted",
        description: "FAQ entry has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error('FAQ deletion error:', error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete FAQ entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Category CRUD mutations - already defined above

  // Update and delete category mutations already defined above

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; color: string }) => {
      const response = await apiRequest('/api/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: folderData.name,
          color: folderData.color,
          folderType: 'custom',
          vectorNamespace: `folder_${folderData.name.toLowerCase().replace(/\s+/g, '_')}`
        })
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/folders'] });
      setUploadSelectedFolder(data.id);
      setIsCreateFolderDialogOpen(false);
      setNewFolderName('');
      setNewFolderColor('blue');
      toast({
        title: "Folder Created",
        description: `Folder "${data.name}" has been created successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create folder. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Vendor URL mutations are defined later to avoid duplication



  const handleSubmitCorrection = async () => {
    if (!correctionText.trim() || !selectedChatDetails) return;
    
    setIsSubmittingCorrection(true);
    
    try {
      const response = await fetch('/api/admin/ai-simulator/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalQuery: selectedChatDetails.userMessage,
          originalResponse: selectedChatDetails.aiResponse,
          correctedResponse: correctionText,
          improvementType: "admin_correction",
          addToKnowledgeBase: true,
          chatId: selectedChatId
        })
      });
      
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
        toast({
          title: "Training Correction Submitted",
          description: "AI has been trained with the corrected response",
        });
        setCorrectionText("");
      } else {
        throw new Error('Failed to submit correction');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit training correction",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingCorrection(false);
    }
  };
  
  // New function to handle corrections for individual messages in the conversation thread
  const handleSubmitMessageCorrection = async (messageId: string, messageIndex: number) => {
    if (!selectedChatDetails || !selectedChatDetails.messages) return;
    
    const editedContent = editedResponses[messageId];
    if (!editedContent || !editedContent.trim()) return;
    
    const messages = selectedChatDetails.messages;
    
    // Find the user message that precedes this AI response
    let userMessage = '';
    for (let i = messageIndex - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'user' || msg.sender === 'user' || msg.type === 'user') {
        userMessage = msg.content || msg.message || '';
        break;
      }
    }
    
    const originalResponse = messages[messageIndex].content || messages[messageIndex].message || '';
    
    setIsSubmittingCorrection(true);
    
    try {
      const response = await fetch('/api/admin/ai-simulator/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalQuery: userMessage,
          originalResponse: originalResponse,
          correctedResponse: editedContent,
          improvementType: "admin_correction",
          addToKnowledgeBase: true,
          chatId: selectedChatId,
          messageId: messageId
        })
      });
      
      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
        await queryClient.invalidateQueries({ queryKey: [`/api/chats/${selectedChatId}/messages`] });
        
        toast({
          title: "Training Correction Submitted",
          description: "AI has been trained with the corrected response and added to Q&A Knowledge Base",
        });
        
        // Clear the editing state
        setEditingMessageId(null);
        setEditedResponses({});
      } else {
        throw new Error('Failed to submit correction');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit training correction",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Archive chat mutation
  const archiveChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await fetch(`/api/admin/chat-reviews/${chatId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to archive chat');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
      toast({
        title: "Chat Archived",
        description: "Chat has been moved to archived folder",
      });
      setSelectedChatId(null);
      setSelectedChatDetails(null);
    },
  });

  // URL tracking mutations
  const updateUrlMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/admin/vendor-urls/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "URL Updated",
        description: "Vendor URL has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-urls'] });
      setShowEditUrl(false);
      setEditingUrl(null);
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: "Failed to update URL",
        variant: "destructive",
      });
    },
  });

  const forceUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/admin/scrape-vendor-url/${id}`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Update Forced",
        description: "URL content is being scraped and updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-urls'] });
      setIsForcingUpdate(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to force update",
        variant: "destructive",
      });
      setIsForcingUpdate(null);
    },
  });

  const deleteUrlMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/admin/vendor-urls/${id}`, {
        method: 'DELETE',
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "URL Deleted",
        description: "Vendor URL has been removed from tracking",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-urls'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete URL",
        variant: "destructive",
      });
    },
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await fetch(`/api/admin/chat-reviews/${chatId}/delete`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'credentials': 'include'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to delete chat: ${response.status} ${errorData}`);
      }
      
      // Try to parse JSON, but handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        return { success: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      toast({
        title: "Chat Deleted",
        description: "Chat has been permanently removed from the system",
      });
      setSelectedChatId(null);
      setSelectedChatDetails(null);
    },
    onError: (error: Error) => {
      console.error('Delete chat error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete chat. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Approve chat mutation
  const approveChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await fetch(`/api/admin/chat-reviews/${chatId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          feedback: 'Chat approved by admin',
          reviewStatus: 'approved'
        })
      });
      if (!response.ok) throw new Error('Failed to approve chat');
      return response.json();
    },
    onSuccess: (data, chatId) => {
      // Invalidate all related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      
      // Update the selected chat details locally if it's the current one
      if (selectedChatId === chatId && selectedChatDetails) {
        setSelectedChatDetails({
          ...selectedChatDetails,
          reviewStatus: 'approved'
        });
      }
      
      toast({
        title: "Response Approved",
        description: "AI response has been approved and marked for training",
      });
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve chat response. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handler functions for chat actions
  const handleArchiveChat = () => {
    if (selectedChatId) {
      archiveChatMutation.mutate(selectedChatId);
    }
  };

  const handleApproveChat = () => {
    if (selectedChatId) {
      approveChatMutation.mutate(selectedChatId);
    }
  };

  const handleDeleteChat = () => {
    if (selectedChatId && confirm('Are you sure you want to permanently delete this chat? This action cannot be undone.')) {
      deleteChatMutation.mutate(selectedChatId);
    }
  };

  // Helper functions for FAQ management
  const toggleKnowledgeCategory = (category: string) => {
    setOpenKnowledgeCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleEditFAQ = (faq: FAQ) => {
    setEditingFAQ(faq);
    setNewQuestion(faq.question);
    setNewAnswer(faq.answer);
    setNewCategory(faq.category);
    setNewPriority(faq.priority);
    setShowEditFAQ(true);
  };

  // Handler functions for glassomorphic settings dialogs
  const handleCreateFolder = () => {
    // Implementation for creating folder
    console.log("Creating folder:", newFolderName);
    setShowCreateFolder(false);
    setNewFolderName("");
  };

  const handleUpdateFAQ = () => {
    // Implementation for updating FAQ
    console.log("Updating FAQ:", editingFAQ);
    setShowEditFAQ(false);
    setEditingFAQ(null);
  };



  const handleUpdateUrl = () => {
    // Implementation for updating URL
    console.log("Updating URL:", editingUrl);
    setShowEditUrl(false);
    setEditingUrl(null);
  };

  const handleDeleteFAQ = (faqId: number) => {
    if (confirm('Are you sure you want to delete this FAQ entry?')) {
      deleteFAQMutation.mutate(faqId);
    }
  };

  // Category management handlers
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Category Name Required",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }
    createCategoryMutation.mutate({
      name: newCategoryName,
      description: newCategoryDescription
    });
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryDescription(category.description || '');
    setShowEditCategory(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    updateCategoryMutation.mutate({
      id: editingCategory.id,
      data: {
        name: newCategoryName,
        description: newCategoryDescription
      }
    });
  };

  const handleDeleteCategory = (id: number) => {
    if (confirm('Are you sure you want to delete this category? This will affect all FAQs in this category.')) {
      deleteCategoryMutation.mutate(id);
    }
  };

  // URL tracking handlers
  const handleEditUrl = (urlData: any) => {
    setEditingUrl(urlData);
    setShowEditUrl(true);
  };

  const handleToggleUrlTracking = async (urlData: any) => {
    updateUrlMutation.mutate({
      id: urlData.id,
      data: { ...urlData, isActive: !urlData.isActive }
    });
  };

  const handleForceUpdate = async (urlId: string) => {
    setIsForcingUpdate(urlId);
    forceUpdateMutation.mutate(urlId);
  };

  const handleDeleteUrl = (urlId: string) => {
    if (confirm('Are you sure you want to remove this URL from tracking?')) {
      deleteUrlMutation.mutate(urlId);
    }
  };

  // Filtered data for FAQ management
  const filteredFAQs = Array.isArray(faqData) ? faqData.filter((faq: FAQ) => {
    return faq.question && faq.answer;
  }) : [];

  const computedFaqCategories = Array.isArray(faqCategories) && faqCategories.length > 0 ? 
    faqCategories.map((cat: any) => cat.name) : 
    (Array.isArray(faqData) ? Array.from(new Set(faqData.map((faq: FAQ) => faq.category))) : []);

  // URL Scraping for Knowledge Base
  const handleScrapeForKnowledge = async () => {
    if (!scrapeUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid website URL to scrape",
        variant: "destructive",
      });
      return;
    }

    let formattedUrl = scrapeUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      new URL(formattedUrl);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsScrapingForKnowledge(true);
    try {
      const response = await fetch('/api/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: formattedUrl }),
      });

      if (!response.ok) {
        throw new Error(`Scraping failed: ${response.status}`);
      }

      const result = await response.json();
      
      // If weekly updates enabled, schedule the URL
      if (enableWeeklyUpdates) {
        try {
          const scheduleResponse = await fetch('/api/admin/scheduled-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              url: formattedUrl,
              type: 'knowledge_base',
              frequency: 'weekly',
              enabled: true
            }),
          });
          
          if (scheduleResponse.ok) {
            console.log('URL scheduled for weekly updates');
          }
        } catch (scheduleError) {
          console.warn('Failed to schedule URL for weekly updates:', scheduleError);
        }
      }
      
      // Convert scraped content into FAQ entries
      if (result.bulletPoints && result.bulletPoints.length > 0) {
        for (const point of result.bulletPoints.slice(0, 5)) { // Limit to 5 entries
          const question = `What does ${result.title} say about: ${point.split('.')[0]}?`;
          const answer = `Based on ${result.title}: ${point}`;
          
          await createFAQMutation.mutateAsync({
            question,
            answer,
            category: 'integration',
            priority: 5,
            isActive: true
          });
        }
      } else {
        // Create a single FAQ from the summary
        const question = `What information is available about ${result.title}?`;
        const answer = result.summary || result.content.substring(0, 500) + '...';
        
        await createFAQMutation.mutateAsync({
          question,
          answer,
          category: 'general',
          priority: 5,
          isActive: true
        });
      }

      // Save URL to vendor tracking system
      try {
        const urlObj = new URL(formattedUrl);
        const vendorName = urlObj.hostname.replace('www.', '').replace('.com', '').replace('.net', '').replace('.org', '');
        
        // Add to vendor URL tracking
        await fetch('/api/admin/vendor-urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            vendorName: vendorName.charAt(0).toUpperCase() + vendorName.slice(1),
            urlTitle: result.title,
            url: formattedUrl,
            urlType: 'knowledge_base',
            category: 'integration',
            tags: [],
            autoUpdate: enableWeeklyUpdates,
            updateFrequency: 'weekly'
          }),
        });
        
        // Refresh vendor URLs to show new entry
        queryClient.invalidateQueries({ queryKey: ['/api/admin/vendor-urls'] });
        
        if (enableWeeklyUpdates) {
          // Also add to scheduled URLs
          await fetch('/api/admin/scheduled-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              url: formattedUrl,
              type: 'knowledge_base',
              frequency: 'weekly',
              enabled: true
            }),
          });
          
          setScheduledUrls(prev => [...prev, formattedUrl]);
        }
      } catch (trackingError) {
        console.error('Failed to add URL to tracking:', trackingError);
      }

      toast({
        title: "Content Added to Knowledge Base",
        description: `Successfully created FAQ entries from ${result.title}${enableWeeklyUpdates ? ' (scheduled for weekly updates)' : ''}`,
      });
      
      setScrapeUrl('');
      setEnableWeeklyUpdates(false);
    } catch (error) {
      toast({
        title: "Scraping Failed",
        description: "Unable to scrape content from the provided URL",
        variant: "destructive",
      });
    } finally {
      setIsScrapingForKnowledge(false);
    }
  };

  // Chat Review Center Component
  function ChatReviewCenter() {
    return (
      <div className="space-y-6 overflow-x-hidden">
        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Total Chats</p>
                  <p className="text-xl font-bold">{Array.isArray(userChats) ? userChats.length : 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm text-gray-600">Approved</p>
                  <p className="text-xl font-bold">
                    {Array.isArray(userChats) ? userChats.filter((c: any) => c.reviewStatus === 'approved').length : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-xl font-bold">
                    {Array.isArray(userChats) ? userChats.filter((c: any) => c.reviewStatus === 'pending').length : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-600">Training Items</p>
                  <p className="text-xl font-bold">
                    {Array.isArray(userChats) ? userChats.filter((c: any) => c.hasCorrections).length : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Split-Screen Chat Review Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 overflow-x-hidden max-w-full" style={{ height: '700px' }}>
          {/* Chat List Panel with Tabs */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat Review Center
              </CardTitle>
              <CardDescription>
                Select a chat to review user question and AI response
              </CardDescription>
            </CardHeader>
            
            {/* Chat Review Tabs */}
            <div className="px-6 pb-3">
              <Tabs value={chatReviewTab} onValueChange={setChatReviewTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="active" className="text-xs">
                    Active ({Array.isArray(userChats) ? userChats.filter((c: any) => c.reviewStatus !== 'archived').length : 0})
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs">
                    Pending ({Array.isArray(userChats) ? userChats.filter((c: any) => c.reviewStatus === 'pending').length : 0})
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs">
                    Archived ({Array.isArray(userChats) ? userChats.filter((c: any) => c.reviewStatus === 'archived').length : 0})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <CardContent className="flex-1 overflow-hidden px-3 sm:px-6 pt-0">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading chat reviews...</span>
                </div>
              ) : (
                <div className="h-full overflow-x-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-3 pr-2 sm:pr-4">
                      {Array.isArray(userChats) && userChats.length > 0 ? (
                        userChats
                          .filter((chat: any) => {
                            if (chatReviewTab === 'active') return chat.reviewStatus !== 'archived';
                            if (chatReviewTab === 'pending') return chat.reviewStatus === 'pending';
                            if (chatReviewTab === 'archived') return chat.reviewStatus === 'archived';
                            return true;
                          })
                          .slice(0, chatDisplayLimit)
                          .map((chat: any) => (
                            <div 
                              key={chat.chatId}
                              className={`
                                p-3 border rounded-lg transition-all duration-200 hover:shadow-md overflow-hidden
                                ${selectedChatId === chat.chatId 
                                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                  : 'border-gray-200 hover:border-gray-300'
                                }
                              `}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium truncate text-sm">{chat.chatTitle || chat.title || 'Untitled Chat'}</h4>
                                <Badge variant={chat.reviewStatus === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                  {chat.reviewStatus === 'approved' ? (
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                  ) : chat.reviewStatus === 'archived' ? (
                                    <Archive className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Clock className="h-3 w-3 mr-1" />
                                  )}
                                  {chat.reviewStatus || 'pending'}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                                <div>
                                  <p><span className="font-medium">{chat.messageCount || 0}</span> msgs</p>
                                  <p className="truncate">{chat.userName || 'Unknown'}</p>
                                </div>
                                <div className="text-right">
                                  <p>{new Date(chat.createdAt).toLocaleDateString()}</p>
                                  <p className="text-xs">{new Date(chat.createdAt).toLocaleTimeString()}</p>
                                </div>
                              </div>
                              
                              {/* View Conversation Button */}
                              <button
                                type="button"
                                className={`w-full py-2 px-2 text-xs font-medium rounded-md flex items-center justify-center gap-1 transition-all ${
                                  selectedChatId === chat.chatId 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-gray-400'
                                }`}
                                onClick={() => {
                                  console.log('Button clicked! Chat ID:', chat.chatId);
                                  console.log('Current selected:', selectedChatId);
                                  setSelectedChatId(chat.chatId);
                                  // Clear any previous edits when selecting new chat
                                  setEditingMessageId(null);
                                  setEditedResponses({});
                                  
                                  // On mobile, scroll to the conversation panel
                                  if (window.innerWidth < 1024) {
                                    setTimeout(() => {
                                      const panel = document.querySelector('[data-chat-panel]');
                                      if (panel) {
                                        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                    }, 100);
                                  }
                                }}
                              >
                                <Eye className="h-3 w-3 flex-shrink-0" />
                                <span>View</span>
                              </button>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-12">
                          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Chat Reviews</h3>
                          <p className="text-gray-500">User conversations will appear here for review and training</p>
                        </div>
                      )}

                      {/* Load More Button */}
                      {Array.isArray(userChats) && userChats.length > 0 && (() => {
                        const filteredChats = userChats.filter((chat: any) => {
                          if (chatReviewTab === 'active') return chat.reviewStatus !== 'archived';
                          if (chatReviewTab === 'pending') return chat.reviewStatus === 'pending';
                          if (chatReviewTab === 'archived') return chat.reviewStatus === 'archived';
                          return true;
                        });
                        return filteredChats.length > chatDisplayLimit && (
                          <div className="text-center pt-4 border-t">
                            <Button
                              onClick={() => setChatDisplayLimit(prev => prev + 5)}
                              variant="outline"
                              className="w-full"
                            >
                              Load More ({filteredChats.length - chatDisplayLimit} remaining)
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Review & Training Panel */}
          <Card className="flex flex-col" data-chat-panel>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                {selectedChatId ? 'Review & Train AI' : 'Select Chat to Review'}
              </CardTitle>
              <CardDescription>
                {selectedChatId 
                  ? 'Review the user question and AI response. Approve if correct or provide training corrections.'
                  : 'Select a chat from the left panel to view the conversation and provide AI training feedback.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {selectedChatId ? (
                <div className="space-y-4 h-full">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading conversation...</span>
                    </div>
                  ) : selectedChatDetails && selectedChatDetails.messages ? (
                    <div className="space-y-4 h-full flex flex-col" style={{ overscrollBehavior: 'contain' }}>
                      {/* Full Conversation Thread */}
                      <ScrollArea className="flex-1" style={{ overscrollBehavior: 'contain' }}>
                        <div className="space-y-4 pr-4">
                          {selectedChatDetails.messages.map((message: any, index: number) => {
                            const isUser = message.role === 'user' || message.sender === 'user' || message.type === 'user';
                            const isAssistant = message.role === 'assistant' || message.sender === 'assistant' || message.type === 'assistant';
                            const content = message.content || message.message || '';
                            const messageId = message.id || `msg-${index}`;
                            const isEditing = editingMessageId === messageId;
                            
                            if (isUser) {
                              return (
                                <div key={messageId} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    <span className="font-medium text-blue-800">User Question</span>
                                  </div>
                                  <div className="text-sm text-blue-900">{content}</div>
                                </div>
                              );
                            } else if (isAssistant) {
                              return (
                                <div key={messageId} className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded-r-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Bot className="h-4 w-4 text-gray-600" />
                                      <span className="font-medium text-gray-800">AI Response</span>
                                    </div>
                                    {!isEditing && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingMessageId(messageId);
                                          setEditedResponses({
                                            ...editedResponses,
                                            [messageId]: content
                                          });
                                        }}
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                  
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <RichTextEditor
                                        content={editedResponses[messageId] || content}
                                        onChange={(newContent) => setEditedResponses({
                                          ...editedResponses,
                                          [messageId]: newContent
                                        })}
                                        placeholder="Edit the AI response..."
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            // Save the edited response
                                            handleSubmitMessageCorrection(messageId, index);
                                          }}
                                        >
                                          Save & Train
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingMessageId(null);
                                            setEditedResponses({
                                              ...editedResponses,
                                              [messageId]: content
                                            });
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-900">
                                      <div dangerouslySetInnerHTML={{ __html: content }} />
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </ScrollArea>

                      {/* Status Display */}
                      {selectedChatDetails?.reviewStatus && (
                        <div className={`p-3 rounded-lg border-l-4 ${
                          selectedChatDetails.reviewStatus === 'approved' 
                            ? 'bg-green-50 border-green-500' 
                            : selectedChatDetails.reviewStatus === 'archived'
                            ? 'bg-gray-50 border-gray-500'
                            : 'bg-orange-50 border-orange-500'
                        }`}>
                          <div className="flex items-center gap-2">
                            {selectedChatDetails.reviewStatus === 'approved' && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            {selectedChatDetails.reviewStatus === 'archived' && (
                              <Archive className="h-4 w-4 text-gray-600" />
                            )}
                            {selectedChatDetails.reviewStatus === 'pending' && (
                              <Clock className="h-4 w-4 text-orange-600" />
                            )}
                            <span className="font-medium text-sm">
                              Status: {selectedChatDetails.reviewStatus === 'approved' ? 'Approved for Training' : 
                                     selectedChatDetails.reviewStatus === 'archived' ? 'Archived' : 'Pending Review'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3 border-t">
                        <Button 
                          onClick={handleApproveChat}
                          className={`flex items-center gap-2 ${
                            selectedChatDetails?.reviewStatus === 'approved' 
                              ? 'bg-green-500 hover:bg-green-600 cursor-not-allowed' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                          disabled={approveChatMutation.isPending || selectedChatDetails?.reviewStatus === 'approved'}
                        >
                          {selectedChatDetails?.reviewStatus === 'approved' ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Already Approved
                            </>
                          ) : (
                            <>
                              <ThumbsUp className="h-4 w-4" />
                              {approveChatMutation.isPending ? 'Approving...' : 'Approve Response'}
                            </>
                          )}
                        </Button>
                        <Button 
                          onClick={handleArchiveChat}
                          variant="outline"
                          className="flex items-center gap-2"
                          disabled={archiveChatMutation.isPending}
                        >
                          <Archive className="h-4 w-4" />
                          {archiveChatMutation.isPending ? 'Archiving...' : 'Archive Chat'}
                        </Button>
                        <Button 
                          onClick={handleDeleteChat}
                          variant="destructive"
                          className="flex items-center gap-2"
                          disabled={deleteChatMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteChatMutation.isPending ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>

                      {/* Training Correction */}
                      <div className="space-y-3">
                        <Label>Provide Training Correction (Optional)</Label>
                        <Textarea
                          value={correctionText}
                          onChange={(e) => setCorrectionText(e.target.value)}
                          placeholder="Provide the corrected AI response that should have been given to this user question..."
                          className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={4}
                          onFocus={(e) => {
                            // Prevent viewport shifting on focus
                            e.preventDefault();
                            const scrollY = window.scrollY;
                            e.target.focus({ preventScroll: true });
                            window.scrollTo(0, scrollY);
                          }}
                          style={{ 
                            // Ensure textarea doesn't cause layout shifts
                            minHeight: '100px',
                            maxHeight: '200px'
                          }}
                        />
                        <Button 
                          onClick={handleSubmitCorrection}
                          disabled={isSubmittingCorrection || !correctionText.trim()}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          {isSubmittingCorrection ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Correction
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No conversation data</h3>
                      <p className="text-gray-500">Unable to load messages for this chat</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Chat to Review</h3>
                    <p className="text-gray-500 max-w-xs">
                      Choose a conversation from the left panel to view the user question and AI response for review and training
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
      {/* Navigation Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Navigation Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Navigation</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Main Navigation Links */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Main</h3>
            <a href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors">
              <Home className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Dashboard</span>
            </a>
            <a href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium">AI Chat</span>
            </a>
            <a href="/documents" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors">
              <Files className="h-5 w-5 text-purple-600" />
              <span className="font-medium">Document Center</span>
            </a>
            <a href="/prompt-customization" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors">
              <Brain className="h-5 w-5 text-orange-600" />
              <span className="font-medium">AI Prompts</span>
            </a>
            <a href="/guide" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors">
              <HelpCircle className="h-5 w-5 text-gray-600" />
              <span className="font-medium">User Guide</span>
            </a>
          </div>
          
          {/* Documentation Hub */}
          <div className="space-y-2 mt-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Documentation</h3>
            <a 
              href="/admin/guides/admin" 
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                window.open('/JACC_ADMIN_USER_GUIDE.md', '_blank');
              }}
            >
              <BookOpen className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Admin User Guide</span>
              <Badge variant="outline" className="ml-auto text-xs">PDF</Badge>
            </a>
            <a 
              href="/admin/guides/ai-settings" 
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                window.open('/AI_SETTINGS_USER_GUIDE.md', '_blank');
              }}
            >
              <Brain className="h-5 w-5 text-purple-600" />
              <span className="font-medium">AI Settings Guide</span>
              <Badge variant="outline" className="ml-auto text-xs">PDF</Badge>
            </a>
            <a 
              href="/admin/guides/jacc-settings" 
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                window.open('/JACC_SETTINGS_USER_GUIDE.md', '_blank');
              }}
            >
              <Settings className="h-5 w-5 text-emerald-600" />
              <span className="font-medium">Settings Guide</span>
              <Badge variant="outline" className="ml-auto text-xs">PDF</Badge>
            </a>
            <a 
              href="/admin/guides/iframe" 
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                window.open('/iframe-integration-guide.md', '_blank');
              }}
            >
              <ExternalLink className="h-5 w-5 text-indigo-600" />
              <span className="font-medium">Iframe Integration</span>
              <Badge variant="outline" className="ml-auto text-xs">PDF</Badge>
            </a>
          </div>
          
          {/* Admin Tools */}
          <div className="space-y-2 mt-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Admin Tools</h3>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-blue-700 w-full text-left"
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium">Admin Control Center</span>
              <Badge variant="secondary" className="ml-auto">Current</Badge>
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-2"
          >
            <Menu className="h-4 w-4" />
            <span className="hidden sm:inline">Navigation</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Control Center</h1>
          </div>
        </div>
        <p className="text-gray-600">Manage AI training, document processing, and system oversight</p>
      </div>
      
      <Tabs defaultValue="knowledge" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 h-auto p-2">
          <TabsTrigger value="knowledge" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">Q&A Knowledge</span>
            <span className="sm:hidden">Q&A</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">Document Center</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="content-quality" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">Content Quality</span>
            <span className="sm:hidden">Quality</span>
          </TabsTrigger>
          <TabsTrigger value="advanced-ocr" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">Advanced OCR</span>
            <span className="sm:hidden">OCR</span>
          </TabsTrigger>
          <TabsTrigger value="chat-training" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">Chat & AI Training</span>
            <span className="sm:hidden">Training</span>
          </TabsTrigger>
          <TabsTrigger value="system-monitor" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">System Monitor</span>
            <span className="sm:hidden">Monitor</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm py-3">
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="space-y-6 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Q&A Knowledge Base Management</h2>
            <Badge variant="secondary">
              {Array.isArray(faqData) ? faqData.length : 0} entries
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2 border-blue-500">
              <CardHeader>
                <CardTitle className="text-blue-600">📝 Add New FAQ Entry</CardTitle>
                <CardDescription>Create comprehensive Q&A entries for the knowledge base</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Question</Label>
                  <Input 
                    placeholder="What is the processing fee for restaurants?"
                    className="mt-1"
                    value={newQuestion}
                    onChange={(e) => {
                      setNewQuestion(e.target.value);
                      // Real-time duplicate detection
                      if (e.target.value.trim().length > 10) {
                        const duplicateCheck = checkForDuplicateFAQ(e.target.value, faqData || []);
                        if (duplicateCheck.isDuplicate && duplicateCheck.similarFAQ) {
                          // Show duplicate indicator
                          const element = document.getElementById('duplicate-indicator');
                          if (element) {
                            element.textContent = `⚠️ ${duplicateCheck.similarity}% similar to: "${duplicateCheck.similarFAQ.question.substring(0, 50)}..."`;
                            element.style.display = 'block';
                          }
                        } else {
                          const element = document.getElementById('duplicate-indicator');
                          if (element) {
                            element.style.display = 'none';
                          }
                        }
                      }
                    }}
                  />
                  <p id="duplicate-indicator" className="text-sm text-amber-600 mt-1" style={{ display: 'none' }}></p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Answer</Label>
                  <Textarea 
                    placeholder="Processing fees for restaurants typically range from 2.3% to 3.5% depending on the card type..."
                    className="mt-1 min-h-[100px]"
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Category</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="pricing">Pricing</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Priority</Label>
                    <Select value={newPriority.toString()} onValueChange={(value) => setNewPriority(parseInt(value))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">High Priority</SelectItem>
                        <SelectItem value="2">Medium Priority</SelectItem>
                        <SelectItem value="3">Low Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={() => createFAQMutation.mutate({
                    question: newQuestion,
                    answer: newAnswer,
                    category: newCategory,
                    priority: newPriority,
                    isActive: true
                  })}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!newQuestion.trim() || !newAnswer.trim() || createFAQMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createFAQMutation.isPending ? 'Creating...' : 'Add FAQ Entry'}
                </Button>

                <Separator className="my-4" />

                {/* URL Scraping for Knowledge Base */}
                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-green-600" />
                    Add from Website URL
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Scrape content from a website URL and convert it into Q&A entries
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="scrape-url" className="text-sm font-medium">Website URL</Label>
                      <Input
                        id="scrape-url"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        placeholder="https://support.example.com/article"
                        className="mt-1"
                      />
                    </div>
                    
                    {/* Weekly Updates Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableWeeklyUpdates"
                        checked={enableWeeklyUpdates}
                        onCheckedChange={(checked) => setEnableWeeklyUpdates(checked as boolean)}
                      />
                      <Label htmlFor="enableWeeklyUpdates" className="text-sm text-green-700 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Schedule weekly updates for this URL
                      </Label>
                    </div>
                    
                    <Button 
                      onClick={handleScrapeForKnowledge}
                      disabled={!scrapeUrl.trim() || isScrapingForKnowledge}
                      className="w-full bg-green-600 hover:bg-green-700"
                      variant="default"
                    >
                      {isScrapingForKnowledge ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Scraping Content...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Scrape & Add to Knowledge Base
                          {enableWeeklyUpdates && ' (Weekly)'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Knowledge Base Management - Combined URL Tracking & Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Knowledge Base Management
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setShowCreateCategory(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      New Category
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Manage FAQ categories and track automated URL updates for knowledge base content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="categories" className="w-full">
                  <TabsList className="flex flex-col sm:grid sm:grid-cols-3 gap-2 h-auto p-1">
                    <TabsTrigger value="categories" className="w-full text-xs sm:text-sm py-2">FAQ Categories</TabsTrigger>
                    <TabsTrigger value="url-tracking" className="w-full text-xs sm:text-sm py-2">URL Tracking</TabsTrigger>
                    <TabsTrigger value="google-sheets" className="w-full text-xs sm:text-sm py-2">Google Sheets Sync</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="categories" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {faqLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin" />
                            <span className="ml-2">Loading categories...</span>
                          </div>
                        ) : computedFaqCategories.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium">No FAQ categories found</p>
                            <p className="text-sm">Add your first FAQ entry to create categories</p>
                            {faqError && (
                              <p className="text-red-500 text-sm mt-2">Error loading FAQ data</p>
                            )}
                          </div>
                        ) : (
                          computedFaqCategories.map((category) => {
                            const count = Array.isArray(faqData) ? faqData.filter((f: FAQ) => f.category === category).length : 0;
                            const categoryFAQs = Array.isArray(faqData) ? faqData.filter((f: FAQ) => f.category === category) : [];
                            const isOpen = openKnowledgeCategories.includes(category);
                            
                            return (
                              <Collapsible key={category} open={isOpen} onOpenChange={() => toggleKnowledgeCategory(category)}>
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                      {isOpen ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-blue-500" />}
                                      <BookOpen className="w-4 h-4 text-blue-500" />
                                      <span className="font-medium capitalize">{category}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary">{count}</Badge>
                                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditCategory({ name: category }); }}>
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 ml-6 space-y-2">
                                  {categoryFAQs.map((faq: FAQ) => (
                                    <div key={faq.id} className="flex items-center justify-between p-2 bg-white border rounded text-sm">
                                      <div className="flex-1">
                                        <div className="font-medium truncate max-w-xs">{faq.question}</div>
                                        <div className="text-xs text-gray-500 mt-1">Priority: {faq.priority} | Active: {faq.isActive ? 'Yes' : 'No'}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleEditFAQ(faq)}>
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDeleteFAQ(faq.id)}>
                                          <Trash className="w-3 h-3 text-red-500" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="url-tracking" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {Array.isArray(vendorUrls) && vendorUrls.length > 0 ? (
                          vendorUrls.map((urlData: any) => (
                            <div key={urlData.id} className="p-4 border rounded-lg bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <div className="font-medium text-sm truncate max-w-sm">
                                    {urlData.urlTitle || urlData.url}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {urlData.vendorName} • Last checked: {urlData.lastScraped ? new Date(urlData.lastScraped).toLocaleDateString() : 'Never'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch 
                                    checked={urlData.isActive} 
                                    onCheckedChange={() => handleToggleUrlTracking(urlData)}
                                    size="sm"
                                  />
                                  <Badge variant={urlData.isActive ? "default" : "secondary"}>
                                    {urlData.isActive ? "Active" : "Disabled"}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant={urlData.autoUpdate ? "default" : "secondary"} className="text-xs">
                                    {urlData.autoUpdate ? `Auto: ${urlData.updateFrequency}` : "Manual Only"}
                                  </Badge>
                                  <Badge variant={urlData.scrapingStatus === 'success' ? "default" : "destructive"} className="text-xs">
                                    {urlData.scrapingStatus || 'Pending'}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleForceUpdate(urlData.id)}
                                    disabled={isForcingUpdate === urlData.id}
                                  >
                                    {isForcingUpdate === urlData.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                    Force Update
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleEditUrl(urlData)}>
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteUrl(urlData.id)}>
                                    <Trash className="w-3 h-3 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Globe className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No tracked URLs yet</p>
                            <p className="text-xs">Add a URL above with weekly updates to see tracking status</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  
                  <TabsContent value="google-sheets" className="mt-4">
                    <div className="space-y-4">
                      {/* Google Sheets Configuration */}
                      {!googleSheetsConfigData ? (
                        <div className="text-center py-8">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <h3 className="font-medium mb-2">No Google Sheets Configuration</h3>
                          <p className="text-sm text-gray-600 mb-4">Connect a Google Sheet to sync Q&A data automatically</p>
                          <Button onClick={() => setShowGoogleSheetsConfig(true)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Configure Google Sheets
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Current Configuration */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">Current Configuration</h4>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => {
                                  setSpreadsheetId(googleSheetsConfigData.spreadsheetId);
                                  setSheetName(googleSheetsConfigData.sheetName);
                                  setQuestionColumn(googleSheetsConfigData.questionColumn);
                                  setAnswerColumn(googleSheetsConfigData.answerColumn);
                                  setCategoryColumn(googleSheetsConfigData.categoryColumn);
                                  setTagsColumn(googleSheetsConfigData.tagsColumn);
                                  setPriorityColumn(googleSheetsConfigData.priorityColumn);
                                  setIsActiveColumn(googleSheetsConfigData.isActiveColumn);
                                  setHeaderRow(googleSheetsConfigData.headerRow);
                                  setSyncFrequency(googleSheetsConfigData.syncFrequency);
                                  setShowGoogleSheetsConfig(true);
                                }}>
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => {
                                    setIsSyncing(true);
                                    syncGoogleSheetsMutation.mutate();
                                  }}
                                  disabled={isSyncing}
                                >
                                  {isSyncing ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                      Syncing...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      Sync Now
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Spreadsheet ID:</span>
                                <p className="font-mono text-xs mt-1">{googleSheetsConfigData.spreadsheetId}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Sheet Name:</span>
                                <p className="font-medium">{googleSheetsConfigData.sheetName}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Sync Frequency:</span>
                                <Badge variant={googleSheetsConfigData.syncFrequency === 'manual' ? 'secondary' : 'default'}>
                                  {googleSheetsConfigData.syncFrequency}
                                </Badge>
                              </div>
                              <div>
                                <span className="text-gray-600">Last Sync:</span>
                                <p className="font-medium">
                                  {googleSheetsConfigData.lastSyncAt 
                                    ? new Date(googleSheetsConfigData.lastSyncAt).toLocaleString()
                                    : 'Never'}
                                </p>
                              </div>
                            </div>
                            {googleSheetsConfigData.lastSyncError && (
                              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                Error: {googleSheetsConfigData.lastSyncError}
                              </div>
                            )}
                          </div>

                          {/* Sync History */}
                          <div>
                            <h4 className="font-medium mb-3">Sync History</h4>
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {syncHistoryData && syncHistoryData.length > 0 ? (
                                  syncHistoryData.map((log: any) => (
                                    <div key={log.id} className="p-3 border rounded-lg text-sm">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                            {log.status}
                                          </Badge>
                                          <span className="ml-2 text-gray-600">
                                            {new Date(log.startedAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                          {log.duration}ms
                                        </span>
                                      </div>
                                      <div className="mt-1 text-xs text-gray-600">
                                        Processed: {log.itemsProcessed} | Added: {log.itemsAdded} | Updated: {log.itemsUpdated}
                                      </div>
                                      {log.errorDetails && (
                                        <div className="mt-1 text-xs text-red-600">
                                          {log.errorDetails}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500">
                                    <Clock className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                    <p className="text-xs">No sync history yet</p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent FAQ Entries</CardTitle>
              <CardDescription>Latest additions to the knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredFAQs.map((faq: FAQ) => (
                    <Card key={faq.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium mb-2">{faq.question}</h4>
                            <p className="text-sm text-gray-600 mb-3">{faq.answer}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{faq.category}</Badge>
                              <Badge variant={faq.priority === 1 ? "destructive" : faq.priority === 2 ? "default" : "secondary"} className="text-xs">
                                Priority {faq.priority}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            <Button size="sm" variant="ghost" onClick={() => handleEditFAQ(faq)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteFAQ(faq.id)}>
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredFAQs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No FAQ entries found</p>
                      <p className="text-sm">Create your first entry above</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Document Center Management</h2>
            <Badge variant="secondary">
              {Array.isArray(documentsData) ? documentsData.filter((doc: DocumentEntry) => doc.mimeType).length : 0} documents
            </Badge>
          </div>

          {/* Document Statistics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Documents</p>
                    <p className="text-xl font-bold">{documentsData.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Folders</p>
                    <p className="text-xl font-bold">{foldersData.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-600">Storage Used</p>
                    <p className="text-xl font-bold">2.4 GB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Upload Ready</p>
                    <p className="text-xl font-bold">✓</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Complete Document Upload System with 3-Step Process */}
          <Card className="border-2 border-green-500">
            <CardHeader>
              <CardTitle className="text-green-600">📁 Document Upload Center</CardTitle>
              <CardDescription>Streamlined 3-step process: 1. Upload Files → 2. Assign Folder → 3. Set Permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Upload Documents First */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="text-lg font-semibold text-gray-900">Upload Documents</h3>
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  Start by uploading your files. Folder assignment and permissions come next.
                </div>
                <DocumentUpload 
                  onUploadComplete={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
                    toast({
                      title: "Upload Complete",
                      description: "Documents uploaded successfully and are now available in the system.",
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Documents Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Documents</CardTitle>
              <CardDescription>
                Most recently uploaded documents appear here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.isArray(documentsData) && documentsData.length > 0 ? (
                  documentsData
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 10)
                    .map((doc: DocumentEntry) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.originalName}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(doc.createdAt).toLocaleDateString()} • {(doc.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {doc.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/documents/${doc.id}/view`, '_blank')}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/documents/${doc.id}/download`, '_blank')}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No documents uploaded yet</p>
                    <p className="text-sm">Upload documents using the form above</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content-quality" className="space-y-6 p-4 sm:p-6">
          <ContentQualityManager />
        </TabsContent>

        <TabsContent value="advanced-ocr" className="space-y-6 p-4 sm:p-6">
          <AdvancedOCRManager />
        </TabsContent>

        <TabsContent value="chat-training" className="space-y-6 p-4 sm:p-6">
          <ChatReviewCenter />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 p-4 sm:p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-blue-600" />
                  <div>
                    <CardTitle className="text-xl">System Settings</CardTitle>
                    <CardDescription>Configure your JACC admin environment</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Import
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Categories */}
                <div className="lg:col-span-1">
                  <Card className="border-2 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Settings Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button 
                        variant={settingsTab === "iframe-integration" ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSettingsTab("iframe-integration")}
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Iframe Integration
                      </Button>
                      <Button 
                        variant={settingsTab === "ai-search" ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSettingsTab("ai-search")}
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        AI & Search
                      </Button>
                      <Button 
                        variant={settingsTab === "user-mgmt" ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSettingsTab("user-mgmt")}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        User Management
                      </Button>
                      <Button 
                        variant={settingsTab === "content-docs" ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSettingsTab("content-docs")}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Content & Documents
                      </Button>
                      <Button 
                        variant={settingsTab === "performance" ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSettingsTab("performance")}
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        System Performance
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Settings Panel */}
                <div className="lg:col-span-3">
                  {/* Settings content will be rendered here based on settingsTab state */}
                  {settingsTab === "iframe-integration" && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <ExternalLink className="w-6 h-6 text-indigo-600" />
                        <div>
                          <h3 className="text-xl font-semibold">Iframe Integration</h3>
                          <p className="text-gray-600">Easy-to-use embed codes for ISO Hub integration</p>
                        </div>
                      </div>

                      {/* Integration Configuration */}
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-6 border border-amber-200 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Settings className="w-5 h-5 text-amber-600" />
                          <h4 className="text-lg font-semibold text-amber-900">Integration Configuration</h4>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Your Domain</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input 
                                value={window.location.origin}
                                readOnly
                                className="font-mono text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(window.location.origin);
                                  toast({
                                    title: "Domain Copied",
                                    description: "Domain URL copied to clipboard"
                                  });
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700">SSO Token</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input 
                                value={ssoToken}
                                readOnly
                                className="font-mono text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(ssoToken);
                                  toast({
                                    title: "Token Copied",
                                    description: "SSO token copied to clipboard"
                                  });
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={generateSSOToken}
                                disabled={isGeneratingToken}
                              >
                                {isGeneratingToken ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Key className="w-4 h-4 mr-1" />
                                    Generate New
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Token expires in 24 hours. Generate new tokens as needed.</p>
                          </div>
                        </div>
                      </div>

                      {/* Modal Integration (Recommended) */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <ExternalLink className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-blue-900">Modal Integration (Recommended)</h4>
                            <p className="text-blue-700 text-sm">Opens JACC in a responsive modal overlay</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-700">HTML</label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const htmlCode = `<!-- JACC Modal Integration -->
<button id="jacc-modal-btn" class="jacc-open-btn">
  Open JACC Assistant
</button>

<div id="jacc-modal" class="jacc-modal">
  <div class="jacc-modal-content">
    <span class="jacc-close">&times;</span>
    <iframe 
      id="jacc-iframe" 
      src="${window.location.origin}?embedded=true&token=${ssoToken}" 
      frameborder="0">
    </iframe>
  </div>
</div>`;
                                  navigator.clipboard.writeText(htmlCode);
                                  toast({
                                    title: "HTML Code Copied",
                                    description: "Modal integration HTML copied to clipboard"
                                  });
                                }}
                              >
                                Copy HTML
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<!-- JACC Modal Integration -->
<button id="jacc-modal-btn" class="jacc-open-btn">
  Open JACC Assistant
</button>

<div id="jacc-modal" class="jacc-modal">
  <div class="jacc-modal-content">
    <span class="jacc-close">&times;</span>
    <iframe 
      id="jacc-iframe" 
      src="${window.location.origin}?embedded=true&token=${ssoToken}" 
      frameborder="0">
    </iframe>
  </div>
</div>`}
                            </pre>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-700">CSS</label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const cssCode = `.jacc-modal {
  display: none;
  position: fixed;
  z-index: 10000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
}

.jacc-modal-content {
  background-color: #fefefe;
  margin: 2% auto;
  border-radius: 12px;
  width: 95%;
  height: 90%;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.jacc-close {
  position: absolute;
  right: 15px;
  top: 15px;
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  z-index: 10001;
}

.jacc-close:hover {
  color: #000;
}

#jacc-iframe {
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.jacc-open-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.2s;
}

.jacc-open-btn:hover {
  transform: translateY(-2px);
}`;
                                  navigator.clipboard.writeText(cssCode);
                                  toast({
                                    title: "CSS Code Copied",
                                    description: "Modal integration CSS copied to clipboard"
                                  });
                                }}
                              >
                                Copy CSS
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-blue-400 p-4 rounded-lg text-xs overflow-x-auto">
{`.jacc-modal {
  display: none;
  position: fixed;
  z-index: 10000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
}

.jacc-modal-content {
  background-color: #fefefe;
  margin: 2% auto;
  border-radius: 12px;
  width: 95%;
  height: 90%;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.jacc-close {
  position: absolute;
  right: 15px;
  top: 15px;
  color: #aaa;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  z-index: 10001;
}

#jacc-iframe {
  width: 100%;
  height: 100%;
  border-radius: 12px;
}`}
                            </pre>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-700">JavaScript</label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const jsCode = `// JACC Modal Integration JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('jacc-modal');
  const btn = document.getElementById('jacc-modal-btn');
  const span = document.getElementsByClassName('jacc-close')[0];

  btn.onclick = function() {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  span.onclick = function() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }

  // Listen for messages from JACC iframe
  window.addEventListener('message', function(event) {
    if (event.origin !== '${window.location.origin}') return;
    
    if (event.data.type === 'JACC_CLOSE') {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  });
});`;
                                  navigator.clipboard.writeText(jsCode);
                                  toast({
                                    title: "JavaScript Code Copied",
                                    description: "Modal integration JavaScript copied to clipboard"
                                  });
                                }}
                              >
                                Copy JavaScript
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-yellow-400 p-4 rounded-lg text-xs overflow-x-auto">
{`// JACC Modal Integration JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('jacc-modal');
  const btn = document.getElementById('jacc-modal-btn');
  const span = document.getElementsByClassName('jacc-close')[0];

  btn.onclick = function() {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  span.onclick = function() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
});`}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Sidebar Integration */}
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                            <Menu className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-purple-900">Sidebar Integration</h4>
                            <p className="text-purple-700 text-sm">Sliding panel from the right side</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-700">Complete Integration Code</label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const sidebarCode = `<!-- JACC Sidebar Integration -->
<button id="jacc-sidebar-btn" class="jacc-sidebar-toggle">
  💬 Ask JACC
</button>

<div id="jacc-sidebar" class="jacc-sidebar">
  <div class="jacc-sidebar-header">
    <h3>JACC Assistant</h3>
    <button id="jacc-sidebar-close">&times;</button>
  </div>
  <iframe 
    src="${window.location.origin}?embedded=true&token=test-sso-token-12345"
    frameborder="0"
    style="width: 100%; height: calc(100% - 60px);">
  </iframe>
</div>

<style>
.jacc-sidebar {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100%;
  background: white;
  box-shadow: -5px 0 15px rgba(0,0,0,0.1);
  transition: right 0.3s ease;
  z-index: 10000;
}

.jacc-sidebar.open {
  right: 0;
}

.jacc-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
}

.jacc-sidebar-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #667eea;
  color: white;
  border: none;
  padding: 15px 20px;
  border-radius: 50px;
  cursor: pointer;
  z-index: 9999;
}
</style>

<script>
document.getElementById('jacc-sidebar-btn').onclick = function() {
  document.getElementById('jacc-sidebar').classList.add('open');
};

document.getElementById('jacc-sidebar-close').onclick = function() {
  document.getElementById('jacc-sidebar').classList.remove('open');
};
</script>`;
                                  navigator.clipboard.writeText(sidebarCode);
                                  toast({
                                    title: "Sidebar Code Copied",
                                    description: "Complete sidebar integration code copied to clipboard"
                                  });
                                }}
                              >
                                Copy Full Code
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-purple-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<!-- JACC Sidebar Integration -->
<button id="jacc-sidebar-btn" class="jacc-sidebar-toggle">
  💬 Ask JACC
</button>

<div id="jacc-sidebar" class="jacc-sidebar">
  <iframe 
    src="${window.location.origin}?embedded=true&token=${ssoToken}"
    frameborder="0" style="width: 100%; height: 100%;">
  </iframe>
</div>`}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Simple Iframe Embed */}
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                            <Code className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-green-900">Simple Iframe Embed</h4>
                            <p className="text-green-700 text-sm">Direct page integration</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-700">Embed Code</label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const embedCode = `<iframe 
  src="${window.location.origin}?embedded=true&token=${ssoToken}"
  width="100%"
  height="600px"
  frameborder="0"
  style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
</iframe>`;
                                navigator.clipboard.writeText(embedCode);
                                toast({
                                  title: "Embed Code Copied",
                                  description: "Simple iframe embed code copied to clipboard"
                                });
                              }}
                            >
                              Copy Code
                            </Button>
                          </div>
                          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`<iframe 
  src="${window.location.origin}?embedded=true&token=${ssoToken}"
  width="100%"
  height="600px"
  frameborder="0"
  style="border-radius: 8px;">
</iframe>`}
                          </pre>
                        </div>
                      </div>

                      {/* Integration Notes */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-amber-800 mb-2">Integration Notes</h4>
                            <ul className="text-amber-700 text-sm space-y-1">
                              <li>• Current domain: <code className="bg-amber-100 px-1 rounded">{window.location.origin}</code></li>
                              <li>• Active SSO token: <code className="bg-amber-100 px-1 rounded">{ssoToken}</code></li>
                              <li>• Token expires in 24 hours - generate new tokens as needed</li>
                              <li>• The <code className="bg-amber-100 px-1 rounded">embedded=true</code> parameter optimizes the interface for iframe display</li>
                              <li>• All integrations support responsive design and mobile devices</li>
                              <li>• Cross-origin security is configured for ISO Hub domains</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {settingsTab === "ai-search" && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <Brain className="w-6 h-6 text-blue-600" />
                        <div>
                          <h3 className="text-xl font-semibold">AI & Search Configuration</h3>
                          <p className="text-gray-600">Configure AI models and search parameters</p>
                        </div>
                      </div>

                      {/* Model Configuration */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Model Configuration
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Primary AI Model</Label>
                              <Select 
                                value={aiConfig?.primaryModel || 'claude-sonnet-4-20250514'}
                                onValueChange={(value) => {
                                  updateAiConfigMutation.mutate({ 
                                    ...aiConfig || { temperature: 0.7 }, 
                                    primaryModel: value 
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {aiModelsData?.models?.map((model: any) => (
                                    <SelectItem key={model.id} value={model.id}>
                                      {model.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Temperature: {aiConfig?.temperature || 0.7}</Label>
                              <Slider
                                value={[aiConfig?.temperature || 0.7]}
                                onValueChange={([value]) => {
                                  updateAiConfigMutation.mutate({ 
                                    ...aiConfig || { primaryModel: 'claude-sonnet-4-20250514' }, 
                                    temperature: value 
                                  });
                                }}
                                max={1}
                                min={0}
                                step={0.1}
                                className="mt-2"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Response Style</Label>
                              <Select 
                                value={aiConfig?.responseStyle || 'professional'}
                                onValueChange={(value) => {
                                  updateAiConfigMutation.mutate({ 
                                    ...aiConfig, 
                                    responseStyle: value 
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="professional">Professional</SelectItem>
                                  <SelectItem value="conversational">Conversational</SelectItem>
                                  <SelectItem value="detailed">Detailed</SelectItem>
                                  <SelectItem value="concise">Concise</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Max Response Length</Label>
                              <Select 
                                value={aiConfig?.maxTokens?.toString() || '1024'}
                                onValueChange={(value) => {
                                  updateAiConfigMutation.mutate({ 
                                    ...aiConfig, 
                                    maxTokens: parseInt(value) 
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="512">Short (512 tokens)</SelectItem>
                                  <SelectItem value="1024">Medium (1024 tokens)</SelectItem>
                                  <SelectItem value="2048">Long (2048 tokens)</SelectItem>
                                  <SelectItem value="4096">Extended (4096 tokens)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Search Configuration */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5" />
                            Search Configuration
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label>Search Sensitivity: {searchParams?.sensitivity || 0.8}</Label>
                            <Slider
                              value={[searchParams?.sensitivity || 0.8]}
                              onValueChange={([value]) => {
                                updateSearchParamsMutation.mutate({ 
                                  ...searchParams, 
                                  sensitivity: value 
                                });
                              }}
                              max={1}
                              min={0.1}
                              step={0.1}
                              className="mt-2"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                              Higher values return more results, lower values are more precise
                            </p>
                          </div>

                          <div>
                            <Label>Search Priority Order</Label>
                            <div className="space-y-2 mt-2">
                              {(searchParams?.searchOrder || ['faq', 'documents', 'web']).map((source: string, index: number) => (
                                <div key={source} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                                    {index + 1}
                                  </span>
                                  <span className="capitalize">{source === 'faq' ? 'FAQ Knowledge Base' : source}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Web Search Fallback</Label>
                              <p className="text-sm text-gray-500">Enable web search when local sources don't have answers</p>
                            </div>
                            <Switch 
                              checked={searchParams?.webSearchEnabled !== false}
                              onCheckedChange={(checked) => {
                                updateSearchParamsMutation.mutate({ 
                                  ...searchParams, 
                                  webSearchEnabled: checked 
                                });
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* AI Prompts Management */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            AI Prompts Management
                          </CardTitle>
                          <CardDescription>
                            Manage all AI prompts that control system behavior and response generation
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* System Prompts Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Brain className="w-4 h-4 text-purple-600" />
                              <Label className="text-base font-semibold">System Prompts</Label>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              {[
                                {
                                  name: "Main System Prompt",
                                  description: "Core AI personality and capabilities",
                                  key: "main-system-prompt",
                                  defaultValue: `You are JACC, an expert AI assistant for merchant services sales agents with advanced document analysis capabilities. You excel at:

## CORE CAPABILITIES:
- Analyzing merchant statements, contracts, and business documents
- Processing payment data, transaction reports, and rate comparisons
- Extracting key information from uploaded files and documents
- Calculating processing costs, savings opportunities, and rate optimizations
- Generating merchant proposals and competitive analysis reports
- Providing instant insights from complex financial documents

## MERCHANT SERVICES EXPERTISE:
- Credit card processing solutions and payment gateway comparisons
- Point-of-sale systems (SkyTab, Clover, terminals) and equipment recommendations
- Cash discounting programs and surcharge implementations
- Merchant account applications and underwriting requirements
- Industry-specific processing solutions and rate structures

## DOCUMENT ANALYSIS POWERS:
- Instantly analyze merchant statements to identify cost-saving opportunities
- Extract transaction data and calculate effective processing rates
- Compare current processing costs with competitive alternatives
- Generate detailed savings projections and ROI calculations
- Create professional merchant proposals from analyzed data

## RESPONSE STYLE:
- Direct, actionable insights with specific recommendations
- Professional tone with merchant services expertise
- Focus on helping businesses reduce processing costs
- Provide concrete next steps and implementation guidance`
                                },
                                {
                                  name: "Enhanced AI Service Prompt",
                                  description: "Advanced AI service instructions and search hierarchy",
                                  key: "enhanced-ai-system-prompt",
                                  defaultValue: `You are JACC, an expert AI assistant for merchant services sales agents. You have access to comprehensive documentation about payment processing, POS systems, and merchant services.

Based on the provided context and documents, provide detailed, accurate responses about:
- Payment processing rates and fee structures
- POS system comparisons and recommendations
- Merchant account setup and requirements
- Cash discounting and surcharge programs
- Equipment specifications and pricing
- Industry best practices and compliance

## SEARCH HIERARCHY:
Always follow this search order:
1. FAQ Knowledge Base (internal Q&A)
2. Document Center (uploaded files)
3. Web Search (external sources with disclaimer)

## RESPONSE FORMATTING:
- Use HTML formatting for better readability
- Include document links when referencing sources
- Provide structured, actionable advice
- Include specific next steps when appropriate

## TRACER CO CARD PROCESSORS:
When asked about processors, reference these actual partners:
- TracerPay/Accept Blue
- Clearent
- MiCamp
- TRX
- Quantic
- Shift4`
                                },
                                {
                                  name: "Error Handling Instructions",
                                  description: "How AI handles errors and missing information",
                                  key: "error-handling-instructions",
                                  defaultValue: `## When Information Cannot Be Found

### Primary Response
"Nothing found in JACC Memory (FAQ + Documents). Searched the web and found information that may be helpful:"

[Web search results with clear disclaimer]

"Please note: This information comes from external sources and may not reflect Tracer Co Card's specific policies or procedures."

### Fallback Responses
1. **No FAQ Results**: Suggest alternative search terms or contact support
2. **No Document Results**: Recommend checking document permissions or uploading relevant files
3. **No Web Results**: Acknowledge limitation and suggest contacting a specialist

## Error Types and Responses

### Document Access Errors
"I couldn't access that document. This might be due to:
- Document permissions
- File corruption
- Missing file

Please try uploading the document again or contact support."

### Processing Rate Calculation Errors
"I need more information to calculate accurate processing rates:
- Business type and monthly volume
- Current processing statement
- Specific requirements or preferences

Could you provide these details for a more accurate analysis?"

### System Errors
"I'm experiencing a technical issue. Please try:
1. Refreshing the page
2. Starting a new conversation
3. Contacting support if the issue persists

Your data is safe and will be preserved."`
                                },
                                {
                                  name: "FAQ Search Instructions",
                                  description: "Instructions for searching FAQ knowledge base",
                                  key: "faq-search-instructions",
                                  defaultValue: `## Search Priority
FAQ Knowledge Base should be searched FIRST before document center or web search.

## FAQ Processors
When asked about processors, always reference Tracer Co Card's actual processor partners:
- TracerPay/Accept Blue (primary partner)
- Clearent
- MiCamp  
- TRX
- Quantic
- Shift4

## Key Terms for FAQ Search
- "processor" → Tracer Co Card processor partners
- "rates" → Processing rates and fee structures
- "equipment" → POS terminals and hardware
- "setup" → Merchant account setup process
- "cash discount" → Cash discounting programs
- "compliance" → Regulatory requirements

## Relevance Scoring
- Exact keyword matches: 10+ points
- Partial matches: 5-9 points
- Related terms: 1-4 points
- Return results with score ≥ 3

## Error Handling
If FAQ search returns no results:
1. Try broader search terms
2. Fall back to document center search
3. Use web search as last resort with disclaimer

## Response Format
When using FAQ results:
"Based on our knowledge base: [FAQ answer]

Source: FAQ Knowledge Base"`
                                }
                              ].map((prompt, index) => (
                                <Card key={index} className="border-l-4 border-l-purple-500">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <CardTitle className="text-sm font-medium">{prompt.name}</CardTitle>
                                        <CardDescription className="text-xs">{prompt.description}</CardDescription>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingPrompt({
                                            id: prompt.key,
                                            name: prompt.name,
                                            description: prompt.description,
                                            template: prompt.defaultValue,
                                            category: 'system',
                                            temperature: 0.7,
                                            maxTokens: 2000,
                                            isActive: true
                                          });
                                          setShowEditPromptModal(true);
                                        }}
                                      >
                                        <Edit className="w-3 h-3 mr-1" />
                                        Edit
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border max-h-20 overflow-y-auto">
                                      {prompt.defaultValue.substring(0, 200)}...
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* Custom Prompt Templates Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Code className="w-4 h-4 text-blue-600" />
                              <Label className="text-base font-semibold">Custom Prompt Templates</Label>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              {[
                                {
                                  name: "Pricing Analysis Template",
                                  description: "Calculate processing costs and competitive pricing",
                                  key: "pricing-analysis-template",
                                  variables: "{business_type}, {monthly_volume}, {current_rate}",
                                  defaultValue: `Analyze the processing costs for a {business_type} business with {monthly_volume} monthly volume currently paying {current_rate}%.

Provide:
1. Current monthly processing cost breakdown
2. Competitive rates from our processor partners
3. Potential monthly savings with each processor
4. ROI calculation and payback period
5. Recommended processor and why

Include specific numbers and actionable next steps.`
                                },
                                {
                                  name: "Objection Handling Template",
                                  description: "Address common merchant objections professionally",
                                  key: "objection-handling-template",
                                  variables: "{objection_type}, {merchant_concern}, {current_provider}",
                                  defaultValue: `The merchant has raised this objection: "{merchant_concern}" about switching from {current_provider}.

Provide:
1. Acknowledge their concern professionally
2. Address the objection with specific benefits
3. Provide proof points or case studies
4. Offer a risk-free trial or guarantee
5. Suggest next steps to move forward

Focus on value and trust-building, not pressure.`
                                },
                                {
                                  name: "Compliance Guidance Template",
                                  description: "Address regulatory and compliance questions",
                                  key: "compliance-guidance-template",
                                  variables: "{regulation_type}, {business_industry}, {specific_requirement}",
                                  defaultValue: `Provide compliance guidance for a {business_industry} business regarding {regulation_type} requirements, specifically: {specific_requirement}.

Include:
1. Regulatory requirements and deadlines
2. Compliance steps and documentation needed
3. Processor-specific compliance features
4. Risk mitigation strategies
5. Resources for ongoing compliance

Ensure accuracy and recommend consulting legal counsel when appropriate.`
                                },
                                {
                                  name: "Marketing Strategy Template",
                                  description: "Generate marketing strategies and content (Admin Only)",
                                  key: "marketing-strategy-template",
                                  variables: "{target_audience}, {marketing_goal}, {channel}",
                                  defaultValue: `Create a marketing strategy for {target_audience} with the goal of {marketing_goal} using {channel}.

Provide:
1. Target audience analysis and pain points
2. Value proposition and messaging framework
3. Content ideas and campaign structure
4. Call-to-action recommendations
5. Success metrics and optimization tips

Use direct response marketing principles and focus on measurable results.`
                                }
                              ].map((template, index) => (
                                <Card key={index} className="border-l-4 border-l-blue-500">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                                        <CardDescription className="text-xs">{template.description}</CardDescription>
                                        <div className="text-xs text-purple-600 font-mono bg-purple-50 px-2 py-1 rounded mt-1">
                                          Variables: {template.variables}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingPrompt({
                                            id: template.key,
                                            name: template.name,
                                            description: template.description,
                                            template: template.defaultValue,
                                            category: 'custom',
                                            temperature: 0.7,
                                            maxTokens: 1500,
                                            isActive: true
                                          });
                                          setShowEditPromptModal(true);
                                        }}
                                      >
                                        <Edit className="w-3 h-3 mr-1" />
                                        Edit
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border max-h-20 overflow-y-auto">
                                      {template.defaultValue.substring(0, 200)}...
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* AI Behavior Configuration */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Settings className="w-4 h-4 text-green-600" />
                              <Label className="text-base font-semibold">AI Behavior Configuration</Label>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <Label>System Prompt Style</Label>
                                <Select defaultValue="merchant-services">
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="merchant-services">Merchant Services Expert</SelectItem>
                                    <SelectItem value="general-assistant">General Assistant</SelectItem>
                                    <SelectItem value="technical-support">Technical Support</SelectItem>
                                    <SelectItem value="sales-focused">Sales Focused</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <Label>Enhanced Document Context</Label>
                                  <p className="text-sm text-gray-500">Include document metadata and relationships in responses</p>
                                </div>
                                <Switch 
                                  checked={aiConfig?.enhancedContext !== false}
                                  onCheckedChange={(checked) => {
                                    updateAiConfigMutation.mutate({ 
                                      ...aiConfig || { primaryModel: 'claude-sonnet-4-20250514', temperature: 0.7 }, 
                                      enhancedContext: checked 
                                    });
                                  }}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <Label>Source Citations</Label>
                                  <p className="text-sm text-gray-500">Always include source citations in AI responses</p>
                                </div>
                                <Switch 
                                  checked={aiConfig?.sourceCitations !== false}
                                  onCheckedChange={(checked) => {
                                    updateAiConfigMutation.mutate({ 
                                      ...aiConfig || { primaryModel: 'claude-sonnet-4-20250514', temperature: 0.7 }, 
                                      sourceCitations: checked 
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Performance Metrics */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            AI Performance Metrics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                              <div className="text-2xl font-bold text-green-600">
                                {performanceData?.search?.accuracy || '96%'}
                              </div>
                              <div className="text-sm text-gray-600">Search Accuracy</div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">
                                {performanceData?.responseTime || '1.8s'}
                              </div>
                              <div className="text-sm text-gray-600">Avg Response Time</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">
                                {performanceData?.cache?.hitRate || '82%'}
                              </div>
                              <div className="text-sm text-gray-600">Cache Hit Rate</div>
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                queryClient.invalidateQueries({ queryKey: ['/api/admin/performance'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/admin/search-params'] });
                                toast({
                                  title: "Metrics Refreshed",
                                  description: "AI performance metrics updated from live system data"
                                });
                              }}
                              className="flex items-center gap-2"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Refresh Metrics
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* AI Settings Actions */}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => {
                            updateAiConfigMutation.mutate(aiConfig);
                            updateSearchParamsMutation.mutate(searchParams);
                          }}
                          disabled={updateAiConfigMutation.isPending || updateSearchParamsMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {(updateAiConfigMutation.isPending || updateSearchParamsMutation.isPending) ? 'Saving...' : 'Save All Settings'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/admin/search-params'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/admin/performance'] });
                            toast({
                              title: "Settings Reset",
                              description: "AI configuration reset to server defaults"
                            });
                          }}
                        >
                          Reset to Defaults
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {settingsTab === "user-mgmt" && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <Users className="w-6 h-6 text-purple-600" />
                        <div>
                          <h3 className="text-xl font-semibold">User Management</h3>
                          <p className="text-gray-600">Manage system users and their access</p>
                        </div>
                      </div>
                      
                      <div className="border-b mb-6"></div>
                      
                      {/* User Management Table */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-semibold">System Users</h4>
                            <p className="text-sm text-gray-500">
                              {usersData.length} total users - Search: "{userSearchTerm}" - Role: {userRoleFilter}
                            </p>
                            <p className="text-xs text-blue-600">
                              Filtered: {usersData.filter((user: any) => {
                                const matchesSearch = userSearchTerm === '' || 
                                  user.firstName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                  user.lastName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                  user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                  user.username?.toLowerCase().includes(userSearchTerm.toLowerCase());
                                const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
                                return matchesSearch && matchesRole;
                              }).length} showing
                            </p>
                          </div>
                          <Button onClick={() => setShowCreateUser(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add New User
                          </Button>
                        </div>
                        
                        {/* Search and Filter Controls */}
                        <div className="flex gap-4 mb-6">
                          <div className="flex-1">
                            <Input
                              placeholder="Search users by name, email, or username..."
                              value={userSearchTerm}
                              onChange={(e) => setUserSearchTerm(e.target.value)}
                              className="w-full"
                            />
                          </div>
                          <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Filter by role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Roles</SelectItem>
                              <SelectItem value="sales-agent">Sales Agent</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="agent">Agent</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="client-admin">Client Admin</SelectItem>
                              <SelectItem value="dev-admin">Dev Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Users Table */}
                        <div className="border rounded-lg overflow-hidden">
                          <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_1fr_1fr_1fr] gap-4 p-4 bg-gray-50 font-medium text-sm border-b">
                            <div>Name</div>
                            <div>Username</div>
                            <div>Email</div>
                            <div>Role</div>
                            <div>Status</div>
                            <div>Created</div>
                            <div>Actions</div>
                          </div>
                          
                          <ScrollArea className="h-[600px]">
                            {usersLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-6 w-6 animate-spin" />
                                <span className="ml-2">Loading users...</span>
                              </div>
                            ) : usersError ? (
                              <div className="flex items-center justify-center py-8 text-red-500">
                                <AlertCircle className="h-6 w-6 mr-2" />
                                <span>Error loading users. Please check authentication.</span>
                              </div>
                            ) : !Array.isArray(usersData) || usersData.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="font-medium">No users found</p>
                                <p className="text-sm">Create your first user to get started</p>
                              </div>
                            ) : (
                              <div className="divide-y">
                                {usersData
                                  .filter((user: any) => {
                                    const matchesSearch = userSearchTerm === '' || 
                                      user.firstName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                      user.lastName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                      user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                      user.username?.toLowerCase().includes(userSearchTerm.toLowerCase());
                                    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
                                    return matchesSearch && matchesRole;
                                  })
                                  .map((user: any) => (
                                    <div key={user.id} className="grid grid-cols-[2fr_1.5fr_2fr_1fr_1fr_1fr_1fr] gap-4 p-4 hover:bg-gray-50">
                                      <div className="min-w-0">
                                        <div className="font-medium truncate">
                                          {user.firstName || user.lastName ? 
                                            `${user.firstName || ''} ${user.lastName || ''}`.trim() : 
                                            'No name set'
                                          }
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                          {user.id}
                                        </div>
                                      </div>
                                      <div className="font-mono text-sm truncate">{user.username || '-'}</div>
                                      <div className="text-sm truncate">{user.email}</div>
                                      <div>
                                        <Badge variant={
                                          user.role === 'admin' ? 'destructive' :
                                          user.role === 'dev-admin' ? 'default' :
                                          user.role === 'client-admin' ? 'secondary' :
                                          'outline'
                                        }>
                                          {user.role}
                                        </Badge>
                                      </div>
                                      <div>
                                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                          {user.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                                      </div>
                                      <div className="flex items-center gap-1 justify-end">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                          onClick={() => {
                                            setEditingUser(user);
                                            setShowEditUser(true);
                                          }}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                          onClick={() => {
                                            setEditingUser(user);
                                            setShowResetPassword(true);
                                          }}
                                        >
                                          <Key className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                          onClick={() => {
                                            if (confirm(`Are you sure you want to delete user ${user.username || user.email}?`)) {
                                              deleteUserMutation.mutate(user.id);
                                            }
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3 text-red-500" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                }
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {settingsTab === "content-docs" && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <FileText className="w-6 h-6 text-green-600" />
                        <div>
                          <h3 className="text-xl font-semibold">Content & Documents</h3>
                          <p className="text-gray-600">Configure document processing and content settings</p>
                        </div>
                      </div>

                      {/* OCR & Text Processing */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Scan className="w-5 h-5" />
                            OCR & Text Processing
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>OCR Quality Level</Label>
                              <Select value={contentSettings.ocrQuality} onValueChange={(value) => 
                                setContentSettings({...contentSettings, ocrQuality: value})
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="basic">Basic (Fast)</SelectItem>
                                  <SelectItem value="medium">Medium (Balanced)</SelectItem>
                                  <SelectItem value="high">High (Accurate)</SelectItem>
                                  <SelectItem value="premium">Premium (Best Quality)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Maximum File Size: {contentSettings.maxFileSize}MB</Label>
                              <Slider
                                value={[contentSettings.maxFileSize]}
                                onValueChange={([value]) => 
                                  setContentSettings({...contentSettings, maxFileSize: value})
                                }
                                max={100}
                                min={1}
                                step={1}
                                className="mt-2"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Content Management */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <FolderOpen className="w-5 h-5" />
                            Content Management
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-base">Auto-Categorization</Label>
                                <p className="text-sm text-gray-500">Automatically organize documents by content type</p>
                              </div>
                              <Switch
                                checked={contentSettings.autoCategorize}
                                onCheckedChange={(checked) => 
                                  setContentSettings({...contentSettings, autoCategorize: checked})
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-base">Version Control</Label>
                                <p className="text-sm text-gray-500">Track document changes and revisions</p>
                              </div>
                              <Switch
                                checked={contentSettings.versionControl}
                                onCheckedChange={(checked) => 
                                  setContentSettings({...contentSettings, versionControl: checked})
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-base">Daily Backup</Label>
                                <p className="text-sm text-gray-500">Automatic daily backup of all documents</p>
                              </div>
                              <Switch
                                checked={contentSettings.backupDaily}
                                onCheckedChange={(checked) => 
                                  setContentSettings({...contentSettings, backupDaily: checked})
                                }
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Document Permissions */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5" />
                            Document Permissions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Default Access Level</Label>
                              <Select defaultValue="admin-only">
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="public">All Users</SelectItem>
                                  <SelectItem value="authenticated">Authenticated Users</SelectItem>
                                  <SelectItem value="admin-only">Admin Only</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>File Retention Policy</Label>
                              <Select defaultValue="unlimited">
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="30-days">30 Days</SelectItem>
                                  <SelectItem value="90-days">90 Days</SelectItem>
                                  <SelectItem value="1-year">1 Year</SelectItem>
                                  <SelectItem value="unlimited">Unlimited</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Content Actions */}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => updateContentSettingsMutation.mutate(contentSettings)}
                          disabled={updateContentSettingsMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {updateContentSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setContentSettings({
                              ocrQuality: "medium",
                              maxFileSize: 25,
                              autoCategorize: true,
                              versionControl: true,
                              backupDaily: true
                            });
                          }}
                        >
                          Reset to Defaults
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {settingsTab === "performance" && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-6 h-6 text-orange-600" />
                        <div>
                          <h3 className="text-xl font-semibold">System Performance</h3>
                          <p className="text-gray-600">Monitor and configure system performance</p>
                        </div>
                      </div>

                      {/* Real-time Metrics */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Real-time System Metrics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Memory Usage</span>
                                <span>{performanceData?.memory?.percentage || 97}%</span>
                              </div>
                              <Progress value={performanceData?.memory?.percentage || 97} className="h-2" />
                              <p className="text-xs text-gray-500">
                                {performanceData?.memory?.used || '485MB'} / {performanceData?.memory?.total || '500MB'}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Response Time</span>
                                <span>{performanceData?.responseTime || '2.3s'}</span>
                              </div>
                              <Progress value={75} className="h-2" />
                              <p className="text-xs text-gray-500">Target: &lt; 2.0s</p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Database Load</span>
                                <span>{performanceData?.database?.responseTime || '156ms'}</span>
                              </div>
                              <Progress value={45} className="h-2" />
                              <p className="text-xs text-gray-500">Status: {performanceData?.database?.status || 'Online'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* System Configuration */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Performance Configuration
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-4">
                            <div>
                              <Label>Memory Threshold: {systemSettings.memoryThreshold}%</Label>
                              <Slider
                                value={[systemSettings.memoryThreshold]}
                                onValueChange={([value]) => 
                                  setSystemSettings({...systemSettings, memoryThreshold: value})
                                }
                                max={100}
                                min={50}
                                step={5}
                                className="mt-2"
                              />
                              <p className="text-xs text-gray-500 mt-1">Alert when memory usage exceeds this level</p>
                            </div>
                            <div>
                              <Label>Response Time Target: {systemSettings.responseTimeTarget}s</Label>
                              <Slider
                                value={[systemSettings.responseTimeTarget]}
                                onValueChange={([value]) => 
                                  setSystemSettings({...systemSettings, responseTimeTarget: value})
                                }
                                max={5.0}
                                min={0.5}
                                step={0.1}
                                className="mt-2"
                              />
                              <p className="text-xs text-gray-500 mt-1">Target response time for AI queries</p>
                            </div>
                            <div>
                              <Label>Database Load Threshold: {systemSettings.databaseLoadThreshold}%</Label>
                              <Slider
                                value={[systemSettings.databaseLoadThreshold]}
                                onValueChange={([value]) => 
                                  setSystemSettings({...systemSettings, databaseLoadThreshold: value})
                                }
                                max={100}
                                min={30}
                                step={5}
                                className="mt-2"
                              />
                              <p className="text-xs text-gray-500 mt-1">Alert when database load exceeds this level</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* System Health Status */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            System Health Monitoring
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium">AI Services</span>
                                </div>
                                <Badge variant="outline" className="bg-green-100 text-green-700">Online</Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium">Database</span>
                                </div>
                                <Badge variant="outline" className="bg-green-100 text-green-700">Online</Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Target className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium">Search Accuracy</span>
                                </div>
                                <Badge variant="outline" className="bg-blue-100 text-blue-700">
                                  {performanceData?.search?.accuracy || '96%'}
                                </Badge>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm font-medium">Cache Hit Rate</span>
                                </div>
                                <Badge variant="outline" className="bg-purple-100 text-purple-700">
                                  {performanceData?.cache?.hitRate || '82%'}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-orange-600" />
                                  <span className="text-sm font-medium">Uptime</span>
                                </div>
                                <Badge variant="outline" className="bg-orange-100 text-orange-700">99.9%</Badge>
                              </div>
                              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-medium">Last Updated</span>
                                </div>
                                <Badge variant="outline" className="bg-gray-100 text-gray-700">
                                  {new Date().toLocaleTimeString()}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Performance Actions */}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => updateSystemSettingsMutation.mutate(systemSettings)}
                          disabled={updateSystemSettingsMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          {updateSystemSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSystemSettings({
                              memoryThreshold: 80,
                              responseTimeTarget: 2.0,
                              databaseLoadThreshold: 70
                            });
                          }}
                        >
                          Reset to Defaults
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['/api/admin/performance'] });
                            toast({
                              title: "Metrics Refreshed",
                              description: "Performance metrics updated from live system data"
                            });
                          }}
                          className="flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Refresh Metrics
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Monitor Tab */}
        <TabsContent value="system-monitor" className="space-y-6 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">System Monitor</h2>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Live Dashboard
            </Badge>
          </div>

          {/* Real-time System Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Memory Usage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Memory Usage
                  <Database className="w-4 h-4 text-gray-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress value={performanceData?.memory?.percentage || 0} className="h-2" />
                  <div className="text-sm text-gray-600">
                    {performanceData?.memory?.used || 0}MB / {performanceData?.memory?.total || 0}MB
                  </div>
                  <Badge variant={performanceData?.memory?.percentage > 85 ? "destructive" : "secondary"}>
                    {performanceData?.memory?.percentage || 0}% Used
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Avg Response Time
                  <Timer className="w-4 h-4 text-gray-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {(performanceData?.performance?.averageResponseTime / 1000).toFixed(2)}s
                  </div>
                  <Badge variant={performanceData?.performance?.averageResponseTime > 3000 ? "destructive" : "secondary"}>
                    {performanceData?.performance?.averageResponseTime > 3000 ? "Slow" : "Normal"}
                  </Badge>
                  <div className="text-xs text-gray-500">Target: &lt; 3s</div>
                </div>
              </CardContent>
            </Card>

            {/* Database Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Database Status
                  <Database className="w-4 h-4 text-gray-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant={performanceData?.database?.status === 'online' ? "secondary" : "destructive"}>
                    {performanceData?.database?.status || 'Unknown'}
                  </Badge>
                  <div className="text-sm text-gray-600">
                    Connections: {performanceData?.database?.connections || 0}
                  </div>
                  <div className="text-xs text-gray-500">
                    Response: {performanceData?.database?.responseTime || 0}ms
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Knowledge Base Sync Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Knowledge Base Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Google Sheets Sync */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Google Sheets FAQ Sync</p>
                      <p className="text-sm text-gray-600">
                        Last sync: {googleSheetsConfig?.lastSyncAt ? 
                          new Date(googleSheetsConfig.lastSyncAt).toLocaleString() : 
                          'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {faqData?.length || 0} entries
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncGoogleSheetsMutation.mutate()}
                      disabled={syncGoogleSheetsMutation.isPending}
                    >
                      {syncGoogleSheetsMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Sync Now
                    </Button>
                  </div>
                </div>

                {/* Document Repository */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Files className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Document Repository</p>
                      <p className="text-sm text-gray-600">
                        {documentsData?.length || 0} documents in {foldersData?.length || 0} folders
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {documentsData?.filter(d => d.createdAt && new Date(d.createdAt) > new Date(Date.now() - 24*60*60*1000)).length || 0} new today
                  </Badge>
                </div>

                {/* Vector Database */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium">Vector Search Index</p>
                      <p className="text-sm text-gray-600">
                        Pinecone vectors indexed
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {performanceData?.performance?.searchAccuracy || 0}% accuracy
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Services Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Services Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Claude API */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Claude API</p>
                      <p className="text-sm text-gray-600">
                        Status: {performanceData?.aiServices?.claudeStatus || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={performanceData?.aiServices?.claudeStatus === 'operational' ? 'secondary' : 'destructive'}>
                    {performanceData?.aiServices?.claudeStatus === 'operational' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* OpenAI API */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bot className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">OpenAI API</p>
                      <p className="text-sm text-gray-600">
                        Status: {performanceData?.aiServices?.gptStatus || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={performanceData?.aiServices?.gptStatus === 'operational' ? 'secondary' : 'destructive'}>
                    {performanceData?.aiServices?.gptStatus === 'operational' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Request Rate */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Request Rate</p>
                      <p className="text-sm text-gray-600">
                        {performanceData?.aiServices?.requestsPerMinute || 0} req/min
                      </p>
                    </div>
                  </div>
                  <Progress value={(performanceData?.aiServices?.requestsPerMinute || 0) / 100 * 100} className="w-20" />
                </div>

                {/* Error Rate */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-medium">Error Rate</p>
                      <p className="text-sm text-gray-600">
                        {(performanceData?.performance?.errorRate || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <Badge variant={performanceData?.performance?.errorRate > 5 ? 'destructive' : 'secondary'}>
                    {performanceData?.performance?.errorRate > 5 ? 'High' : 'Normal'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat Archive Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5" />
                Chat Archive Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Total Chats</p>
                    <p className="text-sm text-gray-600">
                      {archiveStats?.totalChats || 0} conversations
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Chats Older Than 6 Months</p>
                    <p className="text-sm text-gray-600">
                      {archiveStats?.chatsOlderThan6Months || 0} chats ready for archive
                    </p>
                  </div>
                </div>
                {archiveStats?.oldestChatDate && (
                  <div className="text-center text-xs text-gray-500">
                    Oldest chat: {new Date(archiveStats.oldestChatDate).toLocaleDateString()}
                    {archiveStats.messagesInOldChats > 0 && (
                      <span className="block">
                        ({archiveStats.messagesInOldChats} messages to archive)
                      </span>
                    )}
                  </div>
                )}
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={async () => {
                    try {
                      // Show confirmation dialog
                      const confirmed = window.confirm(
                        `Are you sure you want to archive ${
                          archiveStats?.chatsOlderThan6Months || 0
                        } chats older than 6 months? This will also delete ${
                          archiveStats?.messagesInOldChats || 0
                        } messages. This action cannot be undone.`
                      );
                      
                      if (!confirmed) return;
                      
                      toast({
                        title: "Archiving Chats...",
                        description: "Processing old chat data"
                      });
                      
                      const response = await apiRequest('/api/admin/chats/archive', {
                        method: 'POST'
                      });
                      const data = response;
                      
                      if (data.success) {
                        toast({
                          title: "Archive Complete",
                          description: `${data.archivedCount} chats and ${data.messagesArchived} messages archived successfully`
                        });
                        
                        // Refresh chat data
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
                      } else {
                        throw new Error(data.error || 'Archive failed');
                      }
                    } catch (error) {
                      console.error('Archive error:', error);
                      toast({
                        title: "Archive Failed",
                        description: error.message || "Failed to archive old chats",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Old Chats
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                System Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Documents</span>
                    <span className="text-sm text-gray-600">{documentsData?.length || 0} / 5,000</span>
                  </div>
                  <Progress value={(documentsData?.length || 0) / 5000 * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">FAQs</span>
                    <span className="text-sm text-gray-600">{faqData?.length || 0} / 10,000</span>
                  </div>
                  <Progress value={(faqData?.length || 0) / 10000 * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Chat Messages</span>
                    <span className="text-sm text-gray-600">
                      {userChats?.reduce((acc, chat) => acc + (chat.messageCount || 0), 0) || 0} / 100,000
                    </span>
                  </div>
                  <Progress 
                    value={(userChats?.reduce((acc, chat) => acc + (chat.messageCount || 0), 0) || 0) / 100000 * 100} 
                    className="h-2" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refresh Controls */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/performance'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/faq'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/chat-reviews'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/chats/archive-stats'] });
                toast({
                  title: "Dashboard Refreshed",
                  description: "All metrics updated from live system data"
                });
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh All Metrics
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Management Modals */}
      {/* Create User Modal */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                placeholder="john_doe"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="flex gap-2">
                <Input 
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Enter password"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Generate secure password
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                    let password = '';
                    for (let i = 0; i < 12; i++) {
                      password += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    setNewUser({...newUser, password});
                  }}
                >
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales-agent">Sales Agent</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="client-admin">Client Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Profile Image</Label>
              <div className="flex items-center gap-4">
                {newUser.profileImageUrl ? (
                  <img 
                    src={newUser.profileImageUrl} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowProfileCreator(true);
                    setEditingUserProfile(false);
                  }}
                >
                  {newUser.profileImageUrl ? 'Change Image' : 'Create AI Profile'}
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="isActive"
                checked={newUser.isActive}
                onCheckedChange={(checked) => setNewUser({...newUser, isActive: checked})}
              />
              <Label htmlFor="isActive">Active User</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input 
                    id="editFirstName"
                    value={editingUser.firstName || ''}
                    onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input 
                    id="editLastName"
                    value={editingUser.lastName || ''}
                    onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editEmail">Email</Label>
                <Input 
                  id="editEmail"
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select value={editingUser.role || ''} onValueChange={(value) => setEditingUser({...editingUser, role: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales-agent">Sales Agent</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="client-admin">Client Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Profile Image</Label>
                <div className="flex items-center gap-4">
                  {editingUser.profileImageUrl ? (
                    <img 
                      src={editingUser.profileImageUrl} 
                      alt="Profile" 
                      className="w-16 h-16 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowProfileCreator(true);
                      setEditingUserProfile(true);
                    }}
                  >
                    {editingUser.profileImageUrl ? 'Change Image' : 'Create AI Profile'}
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="editIsActive"
                  checked={editingUser.isActive || false}
                  onCheckedChange={(checked) => setEditingUser({...editingUser, isActive: checked})}
                />
                <Label htmlFor="editIsActive">Active User</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUser(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Reset password for user: <strong>{editingUser.username}</strong>
              </p>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input 
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassword(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt Editing Modal */}
      <Dialog open={showEditPromptModal} onOpenChange={setShowEditPromptModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AI Prompt</DialogTitle>
            <DialogDescription>
              Modify the AI prompt configuration and behavior
            </DialogDescription>
          </DialogHeader>
          {editingPrompt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editPromptName">Prompt Name</Label>
                  <Input 
                    id="editPromptName"
                    value={editPromptName}
                    onChange={(e) => setEditPromptName(e.target.value)}
                    placeholder="Enter prompt name"
                  />
                </div>
                <div>
                  <Label htmlFor="editPromptCategory">Category</Label>
                  <Select value={editPromptCategory} onValueChange={setEditPromptCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System Prompt</SelectItem>
                      <SelectItem value="custom">Custom Template</SelectItem>
                      <SelectItem value="error">Error Handling</SelectItem>
                      <SelectItem value="search">Search Instructions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="editPromptDescription">Description</Label>
                <Input 
                  id="editPromptDescription"
                  value={editPromptDescription}
                  onChange={(e) => setEditPromptDescription(e.target.value)}
                  placeholder="Brief description of this prompt's purpose"
                />
              </div>

              <div>
                <Label htmlFor="editPromptTemplate">Prompt Content</Label>
                <Textarea 
                  id="editPromptTemplate"
                  value={editPromptTemplate}
                  onChange={(e) => setEditPromptTemplate(e.target.value)}
                  placeholder="Enter the full prompt content..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editPromptTemperature">Temperature: {editPromptTemperature}</Label>
                  <Slider
                    id="editPromptTemperature"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[editPromptTemperature]}
                    onValueChange={(value) => setEditPromptTemperature(value[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Higher values = more creative, Lower values = more focused
                  </p>
                </div>
                <div>
                  <Label htmlFor="editPromptMaxTokens">Max Tokens: {editPromptMaxTokens}</Label>
                  <Slider
                    id="editPromptMaxTokens"
                    min={100}
                    max={4000}
                    step={100}
                    value={[editPromptMaxTokens]}
                    onValueChange={(value) => setEditPromptMaxTokens(value[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum length of AI response
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Usage Guidelines</span>
                </div>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Use clear, specific instructions for consistent AI behavior</li>
                  <li>• Include examples when defining complex tasks</li>
                  <li>• Test prompts with various scenarios before deployment</li>
                  <li>• Use variables like {'{business_type}'} for dynamic content</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPromptModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePrompt} disabled={updatePromptMutation.isPending}>
              {updatePromptMutation.isPending ? 'Updating...' : 'Update Prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Sheets Configuration Modal */}
      <Dialog open={showGoogleSheetsConfig} onOpenChange={setShowGoogleSheetsConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Google Sheets Sync</DialogTitle>
            <DialogDescription>
              Connect a Google Sheet to automatically sync Q&A data to the knowledge base
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Spreadsheet ID */}
            <div>
              <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
              <div className="flex gap-2 mt-1">
                <Input 
                  id="spreadsheetId"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="flex-1"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => validateSpreadsheetMutation.mutate(spreadsheetId)}
                  disabled={!spreadsheetId || validateSpreadsheetMutation.isPending}
                >
                  {validateSpreadsheetMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    'Validate'
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Find this in your Google Sheets URL: docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
              </p>
            </div>

            {/* Sheet Name */}
            <div>
              <Label htmlFor="sheetName">Sheet Name</Label>
              <Input 
                id="sheetName"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Sheet1"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                The tab name in your spreadsheet (usually "Sheet1")
              </p>
            </div>

            {/* Column Mapping */}
            <div>
              <Label>Column Mapping</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs">Question Column</Label>
                  <Input 
                    value={questionColumn}
                    onChange={(e) => setQuestionColumn(e.target.value.toUpperCase())}
                    placeholder="A"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">Answer Column</Label>
                  <Input 
                    value={answerColumn}
                    onChange={(e) => setAnswerColumn(e.target.value.toUpperCase())}
                    placeholder="B"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">Category Column</Label>
                  <Input 
                    value={categoryColumn}
                    onChange={(e) => setCategoryColumn(e.target.value.toUpperCase())}
                    placeholder="C"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tags Column (optional)</Label>
                  <Input 
                    value={tagsColumn}
                    onChange={(e) => setTagsColumn(e.target.value.toUpperCase())}
                    placeholder="D"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">Priority Column (optional)</Label>
                  <Input 
                    value={priorityColumn}
                    onChange={(e) => setPriorityColumn(e.target.value.toUpperCase())}
                    placeholder="E"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label className="text-xs">Active Column (optional)</Label>
                  <Input 
                    value={isActiveColumn}
                    onChange={(e) => setIsActiveColumn(e.target.value.toUpperCase())}
                    placeholder="F"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Header Row */}
            <div>
              <Label htmlFor="headerRow">Header Row Number</Label>
              <Input 
                id="headerRow"
                type="number"
                value={headerRow}
                onChange={(e) => setHeaderRow(parseInt(e.target.value) || 1)}
                min={1}
                placeholder="1"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Which row contains column headers (usually row 1)
              </p>
            </div>

            {/* Sync Frequency */}
            <div>
              <Label htmlFor="syncFrequency">Sync Frequency</Label>
              <Select value={syncFrequency} onValueChange={setSyncFrequency}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Only</SelectItem>
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGoogleSheetsConfig(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const config = {
                  spreadsheetId,
                  sheetName,
                  questionColumn,
                  answerColumn,
                  categoryColumn,
                  tagsColumn,
                  priorityColumn,
                  isActiveColumn,
                  headerRow,
                  syncFrequency,
                  syncEnabled: true
                };
                saveGoogleSheetsConfigMutation.mutate(config);
              }}
              disabled={!spreadsheetId || saveGoogleSheetsConfigMutation.isPending}
            >
              {saveGoogleSheetsConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Profile Creator Dialog */}
      <AIProfileCreator
        open={showProfileCreator}
        onOpenChange={setShowProfileCreator}
        onProfileGenerated={(url) => {
          if (editingUserProfile && editingUser) {
            setEditingUser({ ...editingUser, profileImageUrl: url });
          } else {
            setNewUser({ ...newUser, profileImageUrl: url });
          }
          setShowProfileCreator(false);
        }}
        userName={editingUserProfile ? 
          `${editingUser?.firstName || ''} ${editingUser?.lastName || ''}`.trim() : 
          `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim()
        }
        existingProfileUrl={editingUserProfile ? editingUser?.profileImageUrl : newUser.profileImageUrl}
      />

      {/* User Created Success Dialog */}
      <Dialog open={showUserCreatedDialog} onOpenChange={setShowUserCreatedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              User Created Successfully
            </DialogTitle>
          </DialogHeader>
          {createdUserCredentials && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="text-sm">
                  <p className="text-gray-600">URL:</p>
                  <p className="font-mono text-sm select-all">{window.location.origin}</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600">Username:</p>
                  <p className="font-mono text-sm select-all">{createdUserCredentials.username}</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600">Password:</p>
                  <p className="font-mono text-sm select-all">{createdUserCredentials.password}</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600">Email:</p>
                  <p className="font-mono text-sm select-all">{createdUserCredentials.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = `Welcome to JACC!\n\nHere are your login credentials:\n\nURL: ${window.location.origin}\nUsername: ${createdUserCredentials.username}\nPassword: ${createdUserCredentials.password}\n\nPlease keep these credentials secure.`;
                    navigator.clipboard.writeText(text);
                    toast({
                      title: "Copied to clipboard",
                      description: "Login credentials have been copied"
                    });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const subject = encodeURIComponent('Your JACC Login Credentials');
                    const body = encodeURIComponent(`Welcome to JACC!\n\nHere are your login credentials:\n\nURL: ${window.location.origin}\nUsername: ${createdUserCredentials.username}\nPassword: ${createdUserCredentials.password}\n\nPlease keep these credentials secure.`);
                    window.open(`mailto:${createdUserCredentials.email}?subject=${subject}&body=${body}`);
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => {
              setShowUserCreatedDialog(false);
              setCreatedUserCredentials(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
                        <div className="border-b mb-6"></div>
                      
                      {/* Integration Options */}
