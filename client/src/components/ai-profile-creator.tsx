import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Sparkles, ChevronRight, Upload } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AIProfileCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileGenerated: (profileUrl: string) => void;
  userName?: string;
  existingProfileUrl?: string;
}

interface ConversationStep {
  question: string;
  options?: string[];
  inputType?: 'radio' | 'text' | 'file';
  key: string;
}

export default function AIProfileCreator({ open, onOpenChange, onProfileGenerated, userName, existingProfileUrl }: AIProfileCreatorProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const conversationSteps: ConversationStep[] = [
    {
      question: existingProfileUrl 
        ? "How would you like to update your profile image?" 
        : "How would you like to create your profile image?",
      options: existingProfileUrl 
        ? ["Generate new AI image", "Upload a new photo", "Remove current image"]
        : ["Generate with AI", "Upload my own photo"],
      inputType: 'radio',
      key: 'method'
    },
    {
      question: "What style would you like for your AI avatar?",
      options: ["Professional headshot", "Cartoon avatar", "Artistic portrait", "Minimalist illustration"],
      inputType: 'radio',
      key: 'style'
    },
    {
      question: "What's your preferred color scheme?",
      options: ["Blue tones", "Warm colors", "Monochrome", "Vibrant rainbow"],
      inputType: 'radio',
      key: 'colors'
    },
    {
      question: "Any additional details you'd like to include? (optional)",
      inputType: 'text',
      key: 'details'
    }
  ];

  const handleResponse = (value: string) => {
    setResponses({ ...responses, [conversationSteps[currentStep].key]: value });
    setCurrentInput('');

    // Handle first step method selection
    if (currentStep === 0) {
      if (value === "Upload my own photo" || value === "Upload a new photo") {
        // Skip to file upload
        document.getElementById('profile-upload')?.click();
        return;
      } else if (value === "Remove current image") {
        // Remove the current image
        onProfileGenerated('');
        toast({
          title: "Profile Image Removed",
          description: "Your profile image has been removed successfully."
        });
        handleClose();
        return;
      } else if (value === "Generate with AI" || value === "Generate new AI image") {
        setCurrentStep(1);
        return;
      }
    }
    
    if (currentStep < conversationSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      generateProfile();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiRequest('/api/upload/profile-image', {
        method: 'POST',
        body: formData
      });

      if (response.url) {
        setGeneratedUrl(response.url);
        onProfileGenerated(response.url);
        toast({
          title: "Profile Image Uploaded",
          description: "Your profile image has been uploaded successfully!"
        });
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload profile image",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateProfile = async () => {
    setIsGenerating(true);

    try {
      // Build prompt from responses
      const style = responses.style || "professional headshot";
      const colors = responses.colors || "blue tones";
      const details = responses.details || "";
      
      const prompt = `Create a ${style} avatar for a professional named ${userName || 'user'} with ${colors}. ${details}. The image should be suitable for a business profile, clean and modern.`;

      const response = await apiRequest('POST', '/api/generate-profile-image', { prompt });

      if (response.url) {
        setGeneratedUrl(response.url);
        onProfileGenerated(response.url);
        toast({
          title: "Profile Generated!",
          description: "Your AI profile image has been created successfully!"
        });
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate profile image",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetConversation = () => {
    setCurrentStep(0);
    setResponses({});
    setCurrentInput('');
    setGeneratedUrl('');
    setUploadedFile(null);
  };

  const handleClose = () => {
    resetConversation();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Profile Creator
          </DialogTitle>
          <DialogDescription>
            Let's create a unique profile image for you
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!generatedUrl && !isGenerating && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {conversationSteps[currentStep].question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {conversationSteps[currentStep].inputType === 'radio' && (
                  <RadioGroup onValueChange={handleResponse}>
                    {conversationSteps[currentStep].options?.map((option) => (
                      <div key={option} className="flex items-center space-x-2 py-2">
                        <RadioGroupItem value={option} id={option} />
                        <Label htmlFor={option} className="cursor-pointer flex-1">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {conversationSteps[currentStep].inputType === 'text' && (
                  <div className="space-y-4">
                    <Input
                      placeholder="Type your response here..."
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && currentInput.trim()) {
                          handleResponse(currentInput);
                        }
                      }}
                    />
                    <div className="flex justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => handleResponse('')}
                      >
                        Skip
                      </Button>
                      <Button
                        onClick={() => handleResponse(currentInput)}
                        disabled={!currentInput.trim()}
                      >
                        Continue
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600">
                {uploadedFile ? "Uploading your image..." : "Creating your unique profile image..."}
              </p>
            </div>
          )}

          {generatedUrl && !isGenerating && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-32 h-32">
                  <AvatarImage src={generatedUrl} />
                  <AvatarFallback>
                    <User className="w-16 h-16" />
                  </AvatarFallback>
                </Avatar>
                <p className="text-center text-sm text-gray-600">
                  Your new profile image is ready!
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={resetConversation}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Use This Image
                </Button>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            id="profile-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Progress indicator */}
        {!generatedUrl && !isGenerating && conversationSteps[currentStep].key !== 'method' && (
          <div className="flex justify-center gap-1 pb-2">
            {conversationSteps.filter(s => s.key !== 'method').map((_, index) => (
              <div
                key={index}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  index < currentStep ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}