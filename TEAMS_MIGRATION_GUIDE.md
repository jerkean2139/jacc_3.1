# JACC Migration to Replit Teams

## Quick Migration Steps

### 1. **In Your Current Pro Repl:**
```bash
# Create backup of environment secrets
echo "Save these environment variables in Teams Repl:" > env-backup.txt
echo "DATABASE_URL=$DATABASE_URL" >> env-backup.txt
echo "OPENAI_API_KEY=(copy from Secrets tab)" >> env-backup.txt
echo "ANTHROPIC_API_KEY=(copy from Secrets tab)" >> env-backup.txt
echo "PERPLEXITY_API_KEY=(copy from Secrets tab)" >> env-backup.txt
echo "GOOGLE_SERVICE_ACCOUNT_KEY=(copy from Secrets tab)" >> env-backup.txt
```

### 2. **Fork to Teams:**
- Click the 3 dots menu (top right)
- Select "Fork Repl"
- Choose your Teams account as destination
- Name it "JACC-Teams" or similar

### 3. **In Your New Teams Repl:**
1. Add all environment secrets from backup
2. Connect to same Neon database (DATABASE_URL)
3. Run deployment

### 4. **Benefits After Migration:**
- ✅ 16-32GB RAM (vs 8GB current)
- ✅ Can re-enable ALL features:
  - OCR Processing ✓
  - Google Sheets Sync ✓
  - PDF Generation ✓
  - Image Processing ✓
  - Web Scraping ✓
- ✅ Better performance
- ✅ No memory optimization needed

## Re-enabling Features After Migration

Once on Teams, run this to restore full functionality:
```bash
# Remove memory optimization
rm server/disable-unused-services.ts
rm server/memory-optimization.ts

# Restart with full features
```

## Database Migration Note
Your Neon database will work seamlessly - just copy the DATABASE_URL to Teams secrets.