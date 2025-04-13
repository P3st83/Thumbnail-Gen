require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const axios = require('axios');
const sharp = require('sharp');

const app = express();
const port = 3001;

// Setup middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/frames', express.static(path.join(__dirname, 'frames')));
app.use(express.json());

// Ensure directories exist
if (!fs.existsSync('frames')) fs.mkdirSync('frames');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100000000 } // 100MB limit
});

// Video upload and frame extraction endpoint
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No video file uploaded');
  }

  const videoPath = req.file.path;
  const frameOutput = path.join(__dirname, 'frames', 'frame_%03d.jpg');

  console.log('Uploaded video:', videoPath);

  // Clean up existing frames
  try {
    if (fs.existsSync('frames')) {
      const files = fs.readdirSync('frames');
      files.forEach(file => {
        if (file.startsWith('frame_') || file.startsWith('enhanced_')) {
          fs.unlinkSync(path.join('frames', file));
        }
      });
    }
  } catch (err) {
    console.error('Error cleaning frames directory:', err);
  }

  // Extract frames using ffmpeg - take 10 frames evenly distributed
  const cmd = `ffmpeg -i "${videoPath}" -vf thumbnail=10 -vsync vfr "${frameOutput}"`;
  
  console.log('Executing FFmpeg command:', cmd);
  
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('FFmpeg error:', stderr);
      return res.status(500).send('Frame extraction failed: ' + stderr);
    }
    
    console.log('FFmpeg stdout:', stdout);
    console.log('FFmpeg stderr:', stderr);
    
    try {
      // Ensure the frames directory exists
      if (!fs.existsSync('frames')) {
        console.log('Creating frames directory');
        fs.mkdirSync('frames');
      }
      
      // Wait a moment for FFmpeg to finish writing files
      setTimeout(() => {
        try {
          const files = fs.readdirSync('frames')
            .filter(f => f.startsWith('frame_'))
            .sort()
            .map(f => `http://localhost:${port}/frames/${f}`);
          
          console.log('Extracted frames:', files);
          
          if (files.length === 0) {
            return res.status(500).send('No frames were extracted. Check the video format.');
          }
          
          res.json({ frames: files });
        } catch (err) {
          console.error('Error reading frames directory:', err);
          res.status(500).send('Error reading frames: ' + err.message);
        }
      }, 1000); // 1 second delay
    } catch (err) {
      console.error('Error after FFmpeg execution:', err);
      res.status(500).send('Error after frame extraction: ' + err.message);
    }
  });
});

// Image enhancement endpoint with offline image processing
app.post('/enhance', async (req, res) => {
  const { imageUrl, prompt } = req.body;
  
  console.log('Enhance request received:', { imageUrl, prompt });
  
  if (!imageUrl) {
    return res.status(400).send('No image URL provided');
  }
  
  try {
    console.log("Fetching image from URL:", imageUrl);
    
    // Extract the image filename from the URL
    const imagePath = decodeURIComponent(imageUrl.replace(`http://localhost:${port}/frames/`, ''));
    const fullImagePath = path.join(__dirname, 'frames', imagePath);
    
    console.log("Reading image from file:", fullImagePath);
    
    // Create timestamp and define output path
    const timestamp = Date.now();
    const outputFile = `frames/enhanced_${timestamp}.jpg`;
    
    // Parse the enhancement type from the prompt
    const enhancementType = parseEnhancementType(prompt);
    
    try {
      // Enhance the image using sharp
      await enhanceImage(fullImagePath, outputFile, enhancementType);
      
      const enhancedUrl = `http://localhost:${port}/frames/enhanced_${timestamp}.jpg`;
      console.log("Enhanced image saved at:", enhancedUrl);
      
      return res.json({ 
        enhanced: enhancedUrl,
        message: `Image enhanced with: ${enhancementType}`
      });
    } catch (enhanceError) {
      console.error("Enhancement error:", enhanceError);
      
      // Fallback to copying the original file
      fs.copyFileSync(fullImagePath, outputFile);
      
      const enhancedUrl = `http://localhost:${port}/frames/enhanced_${timestamp}.jpg`;
      
      return res.json({ 
        enhanced: enhancedUrl,
        message: "Enhancement failed, using original image"
      });
    }
  } catch (error) {
    console.error("Error in enhance endpoint:", error.message);
    res.status(500).send('Enhancement failed. Please try again later.');
  }
});

// Function to parse enhancement type from prompt
function parseEnhancementType(prompt) {
  if (!prompt) return 'default';
  
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes('bright') || promptLower.includes('lighter')) {
    return 'brighten';
  } else if (promptLower.includes('contrast') || promptLower.includes('vivid')) {
    return 'contrast';
  } else if (promptLower.includes('sharp') || promptLower.includes('clear')) {
    return 'sharpen';
  } else if (promptLower.includes('blur') || promptLower.includes('soft')) {
    return 'blur';
  } else if (promptLower.includes('gray') || promptLower.includes('black') || promptLower.includes('bw')) {
    return 'grayscale';
  } else if (promptLower.includes('sepia') || promptLower.includes('vintage') || promptLower.includes('old')) {
    return 'sepia';
  } else if (promptLower.includes('satur') || promptLower.includes('vibrant') || promptLower.includes('color')) {
    return 'saturate';
  } else if (promptLower.includes('hd') || promptLower.includes('high') || promptLower.includes('quality')) {
    return 'hd';
  } else if (promptLower.includes('cool') || promptLower.includes('blue') || promptLower.includes('cold')) {
    return 'cool';
  } else if (promptLower.includes('warm') || promptLower.includes('yellow') || promptLower.includes('orange')) {
    return 'warm';
  } else if (promptLower.includes('dark') || promptLower.includes('shadow') || promptLower.includes('dramatic')) {
    return 'dramatic';
  } else if (promptLower.includes('poster') || promptLower.includes('art') || promptLower.includes('comic')) {
    return 'posterize';
  } else if (promptLower.includes('invert') || promptLower.includes('negative')) {
    return 'invert';
  }
  
  return 'default';
}

// Function to enhance image using sharp
async function enhanceImage(inputPath, outputPath, enhancementType) {
  try {
    let imageProcessor = sharp(inputPath);
    
    // Apply the appropriate enhancement using compatible methods
    switch (enhancementType) {
      case 'brighten':
        // Simple brightness adjustment
        imageProcessor = imageProcessor.linear(1.3, 0);
        break;
      case 'contrast':
        // Simple contrast adjustment
        imageProcessor = imageProcessor.linear(1.2, -10).gamma(1.2);
        break;
      case 'sharpen':
        // Simple sharpening
        imageProcessor = imageProcessor.sharpen(2);
        break;
      case 'blur':
        // Simple blur
        imageProcessor = imageProcessor.blur(2);
        break;
      case 'grayscale':
        // Convert to grayscale
        imageProcessor = imageProcessor.grayscale();
        break;
      case 'sepia':
        // Create sepia effect using tint
        imageProcessor = imageProcessor.grayscale().tint({ r: 255, g: 220, b: 180 });
        break;
      case 'saturate':
        // Increase saturation without using gamma below 1.0
        imageProcessor = imageProcessor.linear(1.2, 0).gamma(1.3);
        break;
      case 'hd':
        // HD effect using individual operations
        imageProcessor = imageProcessor.sharpen(1.2).linear(1.05, 0).gamma(1.2);
        break;
      case 'cool':
        // Cool tone
        imageProcessor = imageProcessor.tint({ r: 220, g: 240, b: 255 });
        break;
      case 'warm':
        // Warm tone
        imageProcessor = imageProcessor.tint({ r: 255, g: 240, b: 220 });
        break;
      case 'dramatic':
        // Dramatic effect
        imageProcessor = imageProcessor.linear(0.9, 0).gamma(1.5).sharpen(1.2);
        break;
      case 'posterize':
        // Simulate posterize
        imageProcessor = imageProcessor.sharpen(2).threshold(150);
        break;
      case 'invert':
        // Invert colors
        imageProcessor = imageProcessor.negate();
        break;
      default:
        // Default enhancement: sharpen slightly and adjust contrast
        imageProcessor = imageProcessor.sharpen(1).gamma(1.1);
        break;
    }
    
    // Resize the image to be at least 1280x720 (HD) while preserving aspect ratio
    imageProcessor = imageProcessor.resize({
      width: 1280,
      height: 720,
      fit: 'inside',
      withoutEnlargement: false
    });
    
    // Save the enhanced image at high quality
    await imageProcessor.jpeg({ quality: 92 }).toFile(outputPath);
  } catch (error) {
    console.error("Sharp processing error:", error);
    // If Sharp processing fails, just copy the original file
    fs.copyFileSync(inputPath, outputPath);
  }
}

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
