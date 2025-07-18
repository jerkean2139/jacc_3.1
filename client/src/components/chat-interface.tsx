import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Download, FileText, Smile, User, Bot, Brain, Calculator, TrendingUp, BarChart3, Mic, MicOff } from "lucide-react";
import { MessageContent } from "./message-content";
import DynamicWelcomeDashboard from "./dynamic-welcome-dashboard";
// Remove these imports temporarily as they may not exist
// import { useCoaching } from "@/hooks/use-coaching"; // Temporarily removed
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToPDF, exportToCSV } from "@/lib/export-utils";

interface MessageWithActions {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt: string;
  actions?: Array<{
    type: "document_link" | "search_query" | "export";
    label: string;
    url?: string;
    query?: string;
  }>;
}

interface ChatInterfaceProps {
  chatId: string | null;
  onChatUpdate: () => void;
  onNewChatWithMessage?: (message: string) => Promise<void>;
  chats?: any[];
  folders?: any[];
}

// Define conversation starters
const conversationStarters = [
  {
    id: "rates",
    icon: Calculator,
    text: "I need help calculating processing rates and finding competitive pricing",
    color: "bg-blue-500 hover:bg-blue-600 hover:text-white"
  },
  {
    id: "tracerpay", 
    icon: TrendingUp,
    text: "Show me how TracerPay beats my current processor and saves money",
    color: "bg-green-500 hover:bg-green-600 hover:text-white"
  },
  {
    id: "proposal",
    icon: BarChart3,
    text: "I need help creating a merchant proposal with competitive rates and terms",
    color: "bg-purple-500 hover:bg-purple-600 hover:text-white"
  },
  {
    id: "marketing",
    icon: Brain,
    text: "Create Marketing Strategy & Content",
    color: "bg-purple-600 hover:bg-purple-700 hover:text-white"
  }
];

export function ChatInterface({ chatId, onChatUpdate, onNewChatWithMessage, chats = [], folders = [] }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Clear all cached queries on mount to prevent infinite loops
  useEffect(() => {
    console.log('🔄 ChatInterface mounted - clearing stale cached queries');
    queryClient.clear();
  }, []);
  
  // Fetch messages for the active chat - USING WORKING PUBLIC ENDPOINT TEMPORARILY
  const { data: messages = [], isLoading, error, refetch } = useQuery<MessageWithActions[]>({
    queryKey: [`/api/public/chats/${chatId}/messages`],
    enabled: !!chatId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 2000, // Poll every 2 seconds to catch AI responses
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch saved prompts for the dropdown (only when authenticated)
  const { data: savedPrompts = [] } = useQuery({
    queryKey: ["/api/user/prompts"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on auth errors
  });

  // Fetch user data for role-based access control
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/user"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on auth errors
  });

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + transcript);
        setIsRecording(false);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        let errorMessage = "Please try again or type your message.";
        if (event.error === 'not-allowed') {
          errorMessage = "Microphone access denied. Please allow microphone permissions and try again.";
        } else if (event.error === 'no-speech') {
          errorMessage = "No speech detected. Please try speaking again.";
        } else if (event.error === 'network') {
          errorMessage = "Network error. Please check your connection and try again.";
        }
        
        toast({
          title: "Voice recognition error",
          description: errorMessage,
          variant: "destructive",
        });
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognition);
    }
  }, [toast]);

  // Log any errors with message loading
  if (error) {
    console.error("Error loading messages:", error);
  }

  // Debug the actual API call
  console.log("Messages Query Status:", {
    chatId,
    queryKey: [`/api/chats/${chatId}/messages`],
    enabled: !!chatId,
    isLoading,
    hasError: !!error,
    messageCount: messages?.length || 0
  });

  // Debug logging with performance optimization
  console.log("Chat Interface Debug:", {
    chatId,
    messagesCount: Array.isArray(messages) ? messages.length : 0,
    isLoading,
    hasMessages: Array.isArray(messages) && messages.length > 0
  });

  // Ensure messages is always an array to prevent crashes
  const safeMessages = Array.isArray(messages) ? messages : [];
  
  // DETAILED DEBUGGING FOR MESSAGE DISPLAY ISSUE
  console.log("🔍 DETAILED MESSAGE DEBUG:", {
    rawMessages: messages,
    messagesType: typeof messages,
    isArray: Array.isArray(messages),
    messagesLength: messages?.length,
    safeMessagesLength: safeMessages.length,
    firstMessage: safeMessages[0],
    allMessages: safeMessages,
    queryKey: ['/api/chats', chatId, 'messages'],
    chatId: chatId,
    isQueryEnabled: !!chatId
  });

  // Send message mutation - SIMPLIFIED VERSION WITHOUT POLLING
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!chatId) throw new Error("No active chat");
      
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          role: "user"
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      return response.json();
    },
    onSuccess: async (data, variables) => {
      // Process message for coaching analysis - temporarily disabled
      // const coaching = useCoaching();
      // coaching.processMessage(variables, true); // true = agent message
      
      // Input will be cleared by form reset
      
      // Force refresh using exact same query key format
      await queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
      await queryClient.refetchQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      onChatUpdate();
      
      // Also force a direct refetch
      refetch();
      
      console.log('✅ Message sent successfully. Cache invalidated and refetched.');
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle conversation starter clicks
  const handleConversationStarter = async (starter: typeof conversationStarters[0]) => {
    try {
      console.log("🚀 Starting conversation with starter:", starter.text);
      
      if (onNewChatWithMessage) {
        // Use the proper new chat with message function from home page
        console.log("📨 Using onNewChatWithMessage function");
        await onNewChatWithMessage(starter.text);
      } else {
        console.log("🔧 Using fallback manual chat creation");
        // Fallback: create chat and send message manually using fetch
        const response = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: "New Chat",
            isActive: true
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create chat: ${response.statusText}`);
        }
        
        const newChat = await response.json();
        console.log("✅ Created new chat:", newChat.id);
        
        // Send the message immediately
        const messageResponse = await fetch(`/api/chats/${newChat.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            content: starter.text,
            role: "user"
          }),
        });
        
        if (!messageResponse.ok) {
          throw new Error(`Failed to send message: ${messageResponse.statusText}`);
        }
        
        console.log("✅ Sent initial message, navigating to chat");
        // Navigate to the new chat after message is sent
        window.location.href = `/chat/${newChat.id}`;
      }
    } catch (error) {
      console.error("❌ Failed to start conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle voice recording toggle
  const toggleVoiceRecording = async () => {
    if (!recognition) {
      toast({
        title: "Voice not supported",
        description: "Speech recognition is not available in your browser.",
        variant: "destructive",
      });
      return;
    }

    if (isRecording) {
      try {
        recognition.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping recognition:', error);
        setIsRecording(false);
      }
      return;
    }

    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Microphone permission denied:', error);
      toast({
        title: "Microphone access required",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
      return;
    }

    // Start speech recognition
    try {
      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Voice recognition error:', error);
      setIsRecording(false);
      
      const errorMessage = (error as Error).message.includes('already started') 
        ? "Voice recognition is already active. Please wait and try again."
        : "Failed to start voice recognition. Please try again.";
      
      toast({
        title: "Voice recognition error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;

    const message = input.trim();
    setInput("");
    
    try {
      if (!chatId) {
        // No active chat, create a new one with the message
        if (onNewChatWithMessage) {
          await onNewChatWithMessage(message);
        } else {
          // Fallback: create chat manually if onNewChatWithMessage is not available
          const response = await apiRequest("POST", "/api/chats", {
            title: "New Chat",
            isActive: true
          });
          const newChat = await response.json();
          window.location.href = `/chat/${newChat.id}`;
          
          // Send the message after navigation
          setTimeout(async () => {
            await apiRequest("POST", `/api/chats/${newChat.id}/messages`, {
              content: message,
              role: "user"
            });
          }, 200);
        }
      } else {
        // Active chat exists, send message normally
        await sendMessageMutation.mutateAsync(message);
      }
    } catch (error) {
      console.error("Send message error:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [safeMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Add PDF generation functions to global window object
  useEffect(() => {
    (window as any).generatePersonalizedPDF = function() {
      console.log('🔍 generatePersonalizedPDF called - auto-sending message');
      const message = "I'd like to personalize the PDF with client details";
      
      setInput(message);
      // Auto-submit the form after setting the message
      setTimeout(() => {
        // Create a synthetic form event
        const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
        handleSubmit(syntheticEvent);
      }, 100);
    };

    (window as any).generatePersonalizedPDFWithDetails = async function() {
      console.log('🔍 generatePersonalizedPDFWithDetails called - directly generating PDF');
      const companyName = (document.getElementById('companyName') as HTMLInputElement)?.value || 'Sample Business';
      const firstName = (document.getElementById('firstName') as HTMLInputElement)?.value || 'Contact';
      const lastName = (document.getElementById('lastName') as HTMLInputElement)?.value || 'Person';
      
      console.log('🔍 Collected details:', { companyName, firstName, lastName });
      
      try {
        // Add loading state to the button
        const button = document.querySelector('button[onclick="window.generatePersonalizedPDFWithDetails()"]') as HTMLButtonElement;
        if (button) {
          button.disabled = true;
          button.innerHTML = '⏳ Generating PDF...';
        }
        
        // Generate the PDF directly
        const pdfUrl = `/api/generate-pdf?company=${encodeURIComponent(companyName)}&contact=${encodeURIComponent(firstName + ' ' + lastName)}`;
        window.open(pdfUrl, '_blank');
        
        // Send a confirmation message to chat
        const confirmationMessage = `✅ Generated personalized PDF for ${companyName} (${firstName} ${lastName}) - opened in new tab for download.`;
        await sendMessageMutation.mutateAsync(confirmationMessage);
        
        // Reset button state
        if (button) {
          button.disabled = false;
          button.innerHTML = '🚀 Generate Personalized PDF';
        }
        
      } catch (error) {
        console.error('PDF generation error:', error);
        
        // Reset button state and show error
        const button = document.querySelector('button[onclick="window.generatePersonalizedPDFWithDetails()"]') as HTMLButtonElement;
        if (button) {
          button.disabled = false;
          button.innerHTML = '❌ Try Again';
        }
        
        // Send error message to chat
        const errorMessage = `❌ Sorry, there was an error generating the PDF. Please try again.`;
        await sendMessageMutation.mutateAsync(errorMessage);
      }
    };
  }, [handleSubmit, setInput, sendMessageMutation]);

  // Welcome screen when no chat is selected
  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col">
        <DynamicWelcomeDashboard 
          onNewChatWithMessage={async (message: string) => {
            if (onNewChatWithMessage) {
              await onNewChatWithMessage(message);
            } else {
              await handleConversationStarter({ 
                id: 'custom', 
                text: message, 
                icon: Brain, 
                color: 'bg-blue-600' 
              });
            }
          }}
          chats={chats}
          folders={folders}
        />

        {/* Chat Input for Welcome Screen - wider and more prominent */}
        <div className="border-t p-4 bg-white dark:bg-gray-800">
          <form onSubmit={handleSubmit} data-chat-form className="flex gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about processing rates, compare processors, or request market insights..."
                className="min-h-[44px] max-h-20 resize-none pr-14 text-base py-3 px-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleVoiceRecording}
                className={`absolute right-3 top-2 p-2 h-8 w-8 rounded-full ${
                  isRecording 
                    ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                disabled={!recognition}
                title={isRecording ? "Stop recording" : "Start voice recording"}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </div>
            
            <Button
              type="submit"
              disabled={!input.trim() || sendMessageMutation.isPending}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 h-11"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" key={`messages-${safeMessages.length}-${chatId}`}>
        {isLoading && safeMessages.length === 0 && chatId ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : safeMessages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No messages yet. Start the conversation!
          </div>
        ) : (
          safeMessages.map((message) => {
            console.log('🔥 RENDERING MESSAGE:', {
              messageId: message.id,
              messageRole: message.role,
              messageContent: message.content?.substring(0, 100),
              messageKeys: Object.keys(message),
              hasContent: !!message.content
            });
            return (
              <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <img 
                      src="/jacc-logo.jpg" 
                      alt="JACC Assistant" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              
              <Card className={`max-w-[80%] p-4 ${
                message.role === "user" 
                  ? "bg-blue-500 text-white ml-auto" 
                  : "bg-white dark:bg-gray-800"
              }`}>
                <MessageContent 
                  content={message.content} 
                  role={message.role}
                />
                
                {/* Actions removed temporarily */}
              </Card>
              
              {message.role === "user" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-500 dark:bg-gray-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              </div>
            );
          })
        )}
        
        {sendMessageMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <img 
                  src="/jacc-logo.jpg" 
                  alt="JACC Assistant" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <Card className="max-w-[80%] p-4 bg-white dark:bg-gray-800">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t p-4 bg-white dark:bg-gray-800">
        <form onSubmit={handleSubmit} data-chat-form className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about processing rates, compare processors, or request market insights..."
              className="min-h-[44px] max-h-20 resize-none pr-14 text-base py-3 px-4"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleVoiceRecording}
              className={`absolute right-3 top-2 p-2 h-8 w-8 rounded-full ${
                isRecording 
                  ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              disabled={!recognition}
              title={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
          </div>
          
          <Button
            type="submit"
            disabled={!input.trim() || sendMessageMutation.isPending}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 h-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export default ChatInterface;