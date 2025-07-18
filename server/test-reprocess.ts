import { db } from './db';
import { documents, documentChunks } from '../shared/schema';
import { eq, and, like } from 'drizzle-orm';
import { DocumentReprocessor } from './reprocess-documents';

async function testReprocessing() {
  console.log('🧪 Testing document reprocessing on Auth.net documents...\n');
  
  try {
    // Get Auth.net documents with generic content
    const authnetDocs = await db
      .select({
        documentId: documentChunks.documentId,
        documentName: documents.name,
        path: documents.path,
        mimeType: documents.mimeType
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          like(documentChunks.content, '%This PDF document contains comprehensive information%'),
          like(documents.name, '%Authorize%')
        )
      )
      .groupBy(documentChunks.documentId, documents.name, documents.path, documents.mimeType)
      .limit(3);

    console.log(`Found ${authnetDocs.length} Auth.net documents to test:\n`);
    
    authnetDocs.forEach(doc => {
      console.log(`  - ${doc.documentName}`);
      console.log(`    Path: ${doc.path}`);
    });
    
    console.log('\n📋 Starting reprocessing...\n');
    
    const reprocessor = new DocumentReprocessor();
    
    // Process each document individually
    for (const doc of authnetDocs) {
      console.log(`\n🔄 Processing: ${doc.documentName}`);
      
      // @ts-ignore - processDocument is private but we need it for testing
      const result = await reprocessor.processDocument(doc);
      
      if (result.success) {
        console.log(`✅ Success! Extracted text preview:`);
        console.log(`   "${result.extractedText}"`);
        console.log(`   Created ${result.chunks} chunks`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
      
      // Small delay between documents
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✨ Test complete!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testReprocessing().then(() => {
  console.log('\nTest finished');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});