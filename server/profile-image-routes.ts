import { Router } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profile-images';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `profile-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Generate AI profile image
router.post('/api/generate-profile-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('Generating profile image with prompt:', prompt);

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt + " Portrait photo, professional, high quality, suitable for profile picture.",
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid"
    });

    const imageUrl = response.data[0].url;
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }

    console.log('Profile image generated successfully:', imageUrl);
    
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Error generating profile image:', error);
    res.status(500).json({ 
      error: 'Failed to generate profile image',
      details: error.message 
    });
  }
});

// Upload profile image
router.post('/api/upload/profile-image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct the URL for the uploaded file
    const fileUrl = `/uploads/profile-images/${req.file.filename}`;
    
    console.log('Profile image uploaded successfully:', fileUrl);
    
    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ 
      error: 'Failed to upload profile image',
      details: error.message 
    });
  }
});

export default router;