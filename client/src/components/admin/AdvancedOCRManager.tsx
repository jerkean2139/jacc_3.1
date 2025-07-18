import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Eye, Zap, Settings, BarChart3, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface OCRResult {
  success: boolean;
  documentId: string;
  pages: number;
  totalCharacters: number;
  totalWords: number;
  averageConfidence: number;
  qualityAssessment: {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  };
  methods: string[];
  improvements: string[];
  processingTime: number;
  chunksCreated: number;
}

interface OCRQualityAnalysis {
  hasOCRData: boolean;
  documentId: string;
  summary: {
    chunks: number;
    averageConfidence: number;
    totalCharacters: number;
    totalWords: number;
    methods: string[];
    improvements: string[];
  };
  chunkAnalysis: Array<{
    chunkId: string;
    confidence: number;
    method: string;
    wordCount: number;
    characterCount: number;
    improvements: string[];
    qualityAssessment: any;
  }>;
  recommendations: string[];
}

const AdvancedOCRManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] = useState<string>('');
  const [processingDocument, setProcessingDocument] = useState<string>('');
  const [batchProcessing, setBatchProcessing] = useState<boolean>(false);

  // Fetch documents that can be processed with OCR
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/admin/documents'],
    select: (data: any[]) => data.filter(doc => 
      doc.mimeType === 'application/pdf' || doc.mimeType?.startsWith('image/')
    ),
  });

  // Process single document with advanced OCR
  const processDocumentMutation = useMutation({
    mutationFn: async ({ documentId, forceReprocess }: { documentId: string; forceReprocess: boolean }) => {
      return apiRequest('POST', `/api/admin/ocr/process-document/${documentId}`, { forceReprocess });
    },
    onSuccess: (result: OCRResult) => {
      // Check if OCR actually extracted any content
      if (!result.totalCharacters || result.totalCharacters === 0) {
        toast({
          title: "OCR Processing Failed",
          description: "No text could be extracted from this document. The file may be corrupted, empty, or contain only images without text.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "OCR Processing Complete",
          description: `Extracted ${result.totalCharacters} characters (${result.totalWords || 0} words) with ${result.averageConfidence || 0}% confidence${result.methods && result.methods.length > 0 ? ` using ${result.methods.join(', ')}` : ''}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ocr/quality-analysis', selectedDocument] });
      setProcessingDocument('');
    },
    onError: (error: any) => {
      toast({
        title: "OCR Processing Failed",
        description: error.message || "Failed to process document",
        variant: "destructive",
      });
      setProcessingDocument('');
    },
  });

  // Batch process multiple documents
  const batchProcessMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      return apiRequest('POST', '/api/admin/ocr/batch-process', { documentIds });
    },
    onSuccess: (result: any) => {
      toast({
        title: "Batch Processing Complete",
        description: `Processed ${result.summary.processed}/${result.summary.total} documents successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
      setBatchProcessing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Batch Processing Failed",
        description: error.message || "Failed to process documents",
        variant: "destructive",
      });
      setBatchProcessing(false);
    },
  });

  // Get OCR quality analysis for a document
  const { data: qualityAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['/api/admin/ocr/quality-analysis', selectedDocument],
    enabled: !!selectedDocument,
    select: (data: OCRQualityAnalysis) => data,
  });

  const handleProcessDocument = (documentId: string, forceReprocess = false) => {
    setProcessingDocument(documentId);
    processDocumentMutation.mutate({ documentId, forceReprocess });
  };

  const handleBatchProcess = () => {
    const pdfDocuments = documents.filter(doc => doc.mimeType === 'application/pdf').slice(0, 10);
    if (pdfDocuments.length === 0) {
      toast({
        title: "No Documents to Process",
        description: "No PDF documents found for batch processing",
        variant: "destructive",
      });
      return;
    }
    
    setBatchProcessing(true);
    batchProcessMutation.mutate(pdfDocuments.map(doc => doc.id));
  };

  const getQualityBadgeVariant = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'fair': return 'outline';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 85) return 'default';
    if (confidence >= 70) return 'secondary';
    if (confidence >= 50) return 'outline';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced OCR Management</h2>
          <p className="text-muted-foreground">Process documents with multi-engine OCR and quality enhancement</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleBatchProcess}
            disabled={batchProcessing || documents.length === 0}
            className="flex items-center gap-2"
          >
            {batchProcessing ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Batch Process
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="process" className="space-y-4">
        <TabsList>
          <TabsTrigger value="process">Process Documents</TabsTrigger>
          <TabsTrigger value="analysis">Quality Analysis</TabsTrigger>
          <TabsTrigger value="settings">OCR Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Processing
              </CardTitle>
              <CardDescription>
                Process PDF and image documents with advanced OCR techniques
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Clock className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading documents...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {documents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No PDF or image documents found for OCR processing
                      </div>
                    ) : (
                      documents.slice(0, 20).map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium">{doc.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{doc.mimeType}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(doc.size / 1024)}KB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {processingDocument === doc.id ? (
                              <Button disabled size="sm">
                                <Clock className="h-4 w-4 animate-spin mr-2" />
                                Processing...
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleProcessDocument(doc.id, false)}
                                >
                                  Process
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleProcessDocument(doc.id, true)}
                                >
                                  Force Reprocess
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                OCR Quality Analysis
              </CardTitle>
              <CardDescription>
                Analyze OCR quality and processing results for documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a document to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedDocument && (
                  <div className="space-y-4">
                    {analysisLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Clock className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Analyzing OCR quality...</span>
                      </div>
                    ) : qualityAnalysis?.hasOCRData ? (
                      <div className="space-y-4">
                        {/* Summary Card */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Quality Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold">{qualityAnalysis.summary.averageConfidence}%</div>
                                <div className="text-sm text-muted-foreground">Confidence</div>
                                <Badge variant={getConfidenceBadgeVariant(qualityAnalysis.summary.averageConfidence)} className="mt-1">
                                  {qualityAnalysis.summary.averageConfidence >= 85 ? 'Excellent' :
                                   qualityAnalysis.summary.averageConfidence >= 70 ? 'Good' :
                                   qualityAnalysis.summary.averageConfidence >= 50 ? 'Fair' : 'Poor'}
                                </Badge>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{qualityAnalysis.summary.totalCharacters.toLocaleString()}</div>
                                <div className="text-sm text-muted-foreground">Characters</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{qualityAnalysis.summary.totalWords.toLocaleString()}</div>
                                <div className="text-sm text-muted-foreground">Words</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{qualityAnalysis.summary.chunks}</div>
                                <div className="text-sm text-muted-foreground">Chunks</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Methods and Improvements */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Processing Methods</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {qualityAnalysis.summary.methods && qualityAnalysis.summary.methods.length > 0 ? (
                                  qualityAnalysis.summary.methods.map((method, index) => (
                                    <Badge key={index} variant="secondary">{method}</Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">No methods available</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Improvements Applied</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {qualityAnalysis.summary.improvements && qualityAnalysis.summary.improvements.length > 0 ? (
                                  qualityAnalysis.summary.improvements.map((improvement, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                      <span className="text-sm">{improvement}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">No improvements applied</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Recommendations */}
                        {qualityAnalysis.recommendations && qualityAnalysis.recommendations.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Recommendations
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {qualityAnalysis.recommendations.map((rec, index) => (
                                  <div key={index} className="flex items-start gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <span className="text-sm">{rec}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="text-center py-8">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">No OCR Data Available</h3>
                          <p className="text-muted-foreground mb-4">
                            This document hasn't been processed with OCR yet.
                          </p>
                          <Button onClick={() => handleProcessDocument(selectedDocument)}>
                            Process with OCR
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                OCR Configuration
              </CardTitle>
              <CardDescription>
                Configure OCR processing settings and quality thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Processing Quality</label>
                  <Select defaultValue="high">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Quality (Slower)</SelectItem>
                      <SelectItem value="medium">Medium Quality (Balanced)</SelectItem>
                      <SelectItem value="fast">Fast Processing (Lower Quality)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confidence Threshold</label>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Progress value={70} className="h-2" />
                    </div>
                    <span className="text-sm font-medium">70%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Documents with confidence below this threshold will be flagged for review
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Processing Features</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Image Preprocessing</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Multi-Engine Processing</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Text Enhancement</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Quality Assessment</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedOCRManager;