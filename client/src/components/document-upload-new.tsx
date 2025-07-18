import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  File,
  FileText,
  Image,
  X,
  ArrowRight,
  ArrowLeft,
  Folder,
  Shield,
  Users,
  Lock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  folderId?: string;
  onUploadComplete?: () => void;
}

export default function DocumentUpload({ folderId, onUploadComplete }: DocumentUploadProps) {
  // State management - Always start with files step
  const [currentStep, setCurrentStep] = useState<'files' | 'folder' | 'permissions' | 'final'>('files');
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folderId || "");
  const [permissions, setPermissions] = useState({
    adminOnly: false,
    trainingData: true,
    autoVectorize: true,
  });
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders
  const { data: folders = [] } = useQuery({
    queryKey: ["/api/folders"],
  });

  // Fetch existing documents for duplicate checking
  const { data: documentsData } = useQuery({
    queryKey: ["/api/documents"],
  });

  const existingDocuments = documentsData ? [
    ...((documentsData as any)?.folders?.flatMap((folder: any) => folder.documents || []) || []),
    ...((documentsData as any)?.unassignedDocuments || [])
  ] : [];

  // Check for duplicate files
  const checkForDuplicates = (files: File[]) => {
    const duplicates = files.filter(file => 
      existingDocuments.some((doc: any) => doc.filename === file.name)
    );
    setDuplicateWarnings(duplicates.map(f => f.name));
  };

  // File validation and addition
  const validateAndAddFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const maxSize = 25 * 1024 * 1024; // 25MB
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'application/zip'
      ];
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 25MB`,
          variant: "destructive",
        });
        return false;
      }
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      const newFiles = [...selectedFiles, ...validFiles];
      setSelectedFiles(newFiles);
      checkForDuplicates(newFiles);
      
      // Initialize custom names
      validFiles.forEach((file, index) => {
        const fileKey = `${selectedFiles.length + index}-${file.name}`;
        setFileNames(prev => ({
          ...prev,
          [fileKey]: file.name.replace(/\.[^/.]+$/, "")
        }));
      });
    }
  };

  // File selection handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    validateAndAddFiles(files);
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    checkForDuplicates(newFiles);
    
    // Remove custom name
    const fileKey = `${index}-${selectedFiles[index]?.name}`;
    setFileNames(prev => {
      const updated = { ...prev };
      delete updated[fileKey];
      return updated;
    });
  };

  // Step 1: Initial upload mutation (upload files to temp storage)
  const initialUploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFiles.length) {
        throw new Error("No files selected");
      }

      const formData = new FormData();
      
      selectedFiles.forEach((file, index) => {
        const fileKey = `${index}-${file.name}`;
        const customName = fileNames[fileKey];
        
        if (customName && customName.trim() !== file.name.replace(/\.[^/.]+$/, "")) {
          const fileExtension = file.name.split('.').pop();
          const renamedFile = new File([file], `${customName.trim()}.${fileExtension}`, {
            type: file.type,
            lastModified: file.lastModified,
          });
          formData.append('files', renamedFile);
        } else {
          formData.append('files', file);
        }
      });

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('Upload success data:', data);
      // Handle the actual API response structure: { success: true, results: [...] }
      const uploadedFiles = data.results || data.files || [];
      console.log('Extracted uploaded files:', uploadedFiles);
      setUploadedFiles(uploadedFiles);
      toast({
        title: "Files uploaded successfully",
        description: `${uploadedFiles.length} files uploaded. Now assign to folder.`,
      });
      setCurrentStep('folder');
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload.",
        variant: "destructive",
      });
    },
  });

  // Final processing mutation (assign folder and permissions)
  const finalProcessMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedFiles.length || !selectedFolderId) {
        throw new Error("Missing uploaded files or folder selection");
      }

      const response = await fetch('/api/documents/assign-folder-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: uploadedFiles.map(f => f.document?.id || f.id),
          folderId: selectedFolderId,
          permissions: permissions,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Processing failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      
      // Reset form
      setSelectedFiles([]);
      setUploadedFiles([]);
      setCurrentStep('files');
      setFileNames({});
      setDuplicateWarnings([]);
      setSelectedFolderId(folderId || "");
      setPermissions({
        adminOnly: false,
        trainingData: true,
        autoVectorize: true,
      });
      
      toast({
        title: "Processing complete",
        description: `${data.processed?.length || uploadedFiles.length} documents processed successfully.`,
      });
      
      if (onUploadComplete) onUploadComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process documents. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Navigation functions
  const goToStep = (step: 'files' | 'folder' | 'permissions' | 'final') => {
    console.log('Navigation attempt:', { step, uploadedFilesCount: uploadedFiles.length, selectedFolderId });
    
    if (step === 'folder' && uploadedFiles.length === 0) {
      toast({
        title: "No files uploaded",
        description: "Please upload files first.",
        variant: "destructive",
      });
      return;
    }
    if (step === 'permissions' && (!selectedFolderId || uploadedFiles.length === 0)) {
      toast({
        title: "Missing requirements",
        description: "Please upload files and assign a folder first.",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(step);
  };



  // Helper functions
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes('word')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (fileType.includes('excel') || fileType.includes('sheet')) return <File className="h-4 w-4 text-green-500" />;
    if (fileType.includes('image')) return <Image className="h-4 w-4 text-purple-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Clean 4-Step Process */}
      <div className="flex items-center justify-center space-x-2 mb-6">
        <div className={cn(
          "flex items-center space-x-2 px-2 py-1 rounded-lg text-xs",
          currentStep === 'files' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
        )}>
          <Upload className="h-3 w-3" />
          <span className="font-medium">1. Upload</span>
        </div>
        <ArrowRight className="h-3 w-3 text-gray-400" />
        <div className={cn(
          "flex items-center space-x-2 px-2 py-1 rounded-lg text-xs",
          currentStep === 'folder' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
        )}>
          <Folder className="h-3 w-3" />
          <span className="font-medium">2. Assign Folder</span>
        </div>
        <ArrowRight className="h-3 w-3 text-gray-400" />
        <div className={cn(
          "flex items-center space-x-2 px-2 py-1 rounded-lg text-xs",
          currentStep === 'permissions' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
        )}>
          <Shield className="h-3 w-3" />
          <span className="font-medium">3. Permissions</span>
        </div>
        <ArrowRight className="h-3 w-3 text-gray-400" />
        <div className={cn(
          "flex items-center space-x-2 px-2 py-1 rounded-lg text-xs",
          currentStep === 'final' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
        )}>
          <CheckCircle className="h-3 w-3" />
          <span className="font-medium">4. Process</span>
        </div>
      </div>

      {/* Step 1: File Selection */}
      {currentStep === 'files' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Select Documents to Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Drop Zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to select</p>
              <p className="text-sm text-gray-500 mb-4">
                Supports PDF, Word, Excel, CSV, Images, and ZIP files (max 25MB each)
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="mx-auto"
              >
                Select Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Selected Files ({selectedFiles.length})</Label>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {selectedFiles.map((file, index) => {
                    const fileKey = `${index}-${file.name}`;
                    const isDuplicate = duplicateWarnings.includes(file.name);
                    
                    return (
                      <div
                        key={fileKey}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isDuplicate ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-gray-50"
                        )}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {getFileIcon(file.type)}
                          <div className="flex-1 min-w-0">
                            <Input
                              value={fileNames[fileKey] || file.name.replace(/\.[^/.]+$/, "")}
                              onChange={(e) => setFileNames(prev => ({
                                ...prev,
                                [fileKey]: e.target.value
                              }))}
                              className="text-sm"
                              placeholder="Document name"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {formatFileSize(file.size)}
                              {isDuplicate && (
                                <span className="text-orange-600 ml-2">
                                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                                  Duplicate name
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  if (selectedFiles.length === 0) {
                    toast({
                      title: "No files selected",
                      description: "Please select files to upload first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Step 1: Actually upload the files first
                  initialUploadMutation.mutate();
                }}
                disabled={selectedFiles.length === 0 || initialUploadMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {initialUploadMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Files
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Folder Selection */}
      {currentStep === 'folder' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Assign Folder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Choose destination folder for uploaded files</Label>
              <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a folder..." />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Uploaded Files Summary */}
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">
                ✅ Uploaded Files: {uploadedFiles.length}
              </p>
              <div className="space-y-1">
                {uploadedFiles.slice(0, 3).map((file: any, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-green-700">
                    {getFileIcon(file.document?.mimeType || file.mimeType || 'file')}
                    <span className="truncate">{file.document?.name || file.name || file.originalName}</span>
                  </div>
                ))}
                {uploadedFiles.length > 3 && (
                  <p className="text-xs text-green-600">+{uploadedFiles.length - 3} more files</p>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => goToStep('files')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Upload
              </Button>
              <Button
                onClick={() => goToStep('permissions')}
                disabled={!selectedFolderId}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                Next: Set Permissions
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Permissions */}
      {currentStep === 'permissions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Set Document Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="adminOnly"
                  checked={permissions.adminOnly}
                  onCheckedChange={(checked) => 
                    setPermissions(prev => ({ ...prev, adminOnly: checked as boolean }))
                  }
                />
                <Label htmlFor="adminOnly" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Admin Only Access
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trainingData"
                  checked={permissions.trainingData}
                  onCheckedChange={(checked) => 
                    setPermissions(prev => ({ ...prev, trainingData: checked as boolean }))
                  }
                />
                <Label htmlFor="trainingData" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Use for AI Training
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoVectorize"
                  checked={permissions.autoVectorize}
                  onCheckedChange={(checked) => 
                    setPermissions(prev => ({ ...prev, autoVectorize: checked as boolean }))
                  }
                />
                <Label htmlFor="autoVectorize" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Auto-vectorize for Search
                </Label>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-900 mb-2">Processing Summary</h4>
              <div className="space-y-1 text-sm text-green-800">
                <p>✅ Uploaded Files: {uploadedFiles.length}</p>
                <p>📁 Folder: {folders.find((f: any) => f.id === selectedFolderId)?.name}</p>
                <p>🔒 Access: {permissions.adminOnly ? 'Admin Only' : 'All Users'}</p>
                <p>🤖 AI Training: {permissions.trainingData ? 'Enabled' : 'Disabled'}</p>
                <p>🔍 Search: {permissions.autoVectorize ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => goToStep('folder')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Folder
              </Button>
              <Button
                onClick={() => finalProcessMutation.mutate()}
                disabled={finalProcessMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {finalProcessMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete Processing
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}