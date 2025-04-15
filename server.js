require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
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
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No video file uploaded');
    }

    // Delete existing frames
    try {
      fs.rmSync('frames', { recursive: true, force: true });
    } catch (err) {
      console.log('No frames directory to clean up');
    }

    // Create frames directory
    fs.mkdirSync('frames', { recursive: true });

    const videoPath = req.file.path;
    
    // Check if file is a valid video
    const checkVideoCmd = `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "${videoPath}"`;
    
    try {
      const videoCheck = execSync(checkVideoCmd).toString().trim();
      if (!videoCheck || parseInt(videoCheck) === 0) {
        fs.unlinkSync(videoPath);
        return res.status(400).send('The uploaded file does not contain valid video content');
      }
    } catch (error) {
      fs.unlinkSync(videoPath);
      return res.status(400).send('The uploaded file is not a valid video');
    }

    const framesDir = path.join(__dirname, 'frames');
    // Extract more frames - get one frame every second for a 48-second video
    const ffmpegCmd = `ffmpeg -i "${videoPath}" -vf "fps=4" ${framesDir}/frame_%03d.png`;
    
    console.log(`Executing FFmpeg command: ${ffmpegCmd}`);
    execSync(ffmpegCmd);
    
    // Get all frame filenames
    const frameFiles = fs.readdirSync(framesDir)
      .filter(file => file.startsWith('frame_') && file.endsWith('.png'))
      .sort();
    
    // Create URLs for each frame
    const frameUrls = frameFiles.map(file => `/frames/${file}`);
    
    console.log(`Generated ${frameUrls.length} frames`);
    
    if (frameUrls.length === 0) {
      return res.status(400).send('Could not extract frames from video');
    }
    
    // Ensure we're sending an array, even if it's just one frame
    res.json(frameUrls);
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).send(`Error processing video: ${error.message}`);
  }
});

// Image enhancement endpoint
app.post('/enhance', async (req, res) => {
  const { imageUrl, style = 'race8' } = req.body;
  
  if (!imageUrl) {
    return res.status(400).send('No image URL provided');
  }

  try {
    // Extract frame filename from URL
    const frameFilename = path.basename(imageUrl);
    const inputPath = path.join(__dirname, 'frames', frameFilename);
    
    // Check if file exists
    if (!fs.existsSync(inputPath)) {
      return res.status(404).send(`Image not found: ${frameFilename}`);
    }
    
    // Create enhanced directory if it doesn't exist
    if (!fs.existsSync('enhanced')) {
      fs.mkdirSync('enhanced', { recursive: true });
    }
    
    // Generate output path
    const outputFilename = `enhanced_${Date.now()}.png`;
    const outputPath = path.join(__dirname, 'enhanced', outputFilename);
    
    // Process image with Sharp
    const sharpInstance = sharp(inputPath).resize({
      width: 1280,
      height: 720,
      fit: 'cover',
      position: 'center'
    }).modulate({
      brightness: 1.1,
      saturation: 1.3
    });
    
    // Generate the overlay based on style
    const overlayContent = generateOverlay(style);
    
    await sharpInstance.composite([{
      input: Buffer.from(overlayContent),
      top: 0,
      left: 0
    }])
    .png()
    .toFile(outputPath);
    
    // Create URL for enhanced image
    const enhancedImageUrl = `/enhanced/${outputFilename}`;
    
    // Serve enhanced directory statically
    if (!app._router.stack.some(layer => 
      layer.route && 
      layer.route.path === '/enhanced' && 
      layer.route.methods.get)) {
      app.use('/enhanced', express.static(path.join(__dirname, 'enhanced')));
    }
    
    res.send(enhancedImageUrl);
  } catch (error) {
    console.error('Error enhancing image:', error);
    res.status(500).send(`Error enhancing image: ${error.message}`);
  }
});

// Function to generate different overlay templates
function generateOverlay(style) {
  switch(style) {
    case 'race8':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0066cc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0052cc;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- Blue header bar -->
        <rect width="1280" height="80" fill="url(#headerGradient)"/>
        <!-- GETON logo in header -->
        <text x="30" y="55" fill="white" font-family="Arial" font-size="36" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
        <!-- Main content -->
        <g transform="translate(30, 120)">
          <text x="0" y="0" fill="white" font-family="Arial" font-size="72" font-weight="bold">RACE 8</text>
          <!-- Price box -->
          <rect x="0" y="20" width="200" height="60" fill="#ffcc00" rx="5"/>
          <text x="20" y="65" fill="black" font-family="Arial" font-size="36" font-weight="bold">$26.00</text>
        </g>
        <!-- Footer -->
        <g transform="translate(20, 640)">
          <rect x="0" y="0" width="500" height="60" rx="8" fill="#0066cc"/>
          <image x="10" y="10" width="100" height="40" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgODAiPjx0ZXh0IHg9IjEwIiB5PSI0MCIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIzNiIgZm9udC13ZWlnaHQ9ImJvbGQiPkdFVDx0c3BhbiBmaWxsPSIjZmZjYzAwIj5PTjwvdHNwYW4+PC90ZXh0Pjwvc3ZnPg=="/>
          <text x="130" y="35" fill="white" font-family="Arial" font-size="24" font-weight="bold">SIMON MARSHALL</text>
          <text x="130" y="55" fill="#ffcc00" font-family="Arial" font-size="18">EXPERT TIPSTER</text>
        </g>
        <!-- Add timer in top right -->
        <g transform="translate(1180, 20)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
      </svg>`;
      
    case 'debut_winner':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0066cc;stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:#0088ff;stop-opacity:0.4" />
          </linearGradient>
          <radialGradient id="spotlightGradient" cx="30%" cy="30%" r="70%" fx="30%" fy="30%">
            <stop offset="0%" style="stop-color:rgba(255,255,255,0.2);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgba(0,0,0,0);stop-opacity:0" />
          </radialGradient>
        </defs>
        
        <!-- Semi-transparent blue overlay with rounded corners -->
        <rect width="1280" height="720" rx="20" ry="20" fill="url(#blueGradient)" fill-opacity="0.5"/>
        
        <!-- Spotlight effect -->
        <circle cx="640" cy="360" r="500" fill="url(#spotlightGradient)"/>
        
        <!-- GETON logo in top left -->
        <g transform="translate(20, 20)">
          <text x="0" y="30" fill="white" font-family="Arial" font-size="30" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
        </g>
        
        <!-- Timer in top right -->
        <g transform="translate(1180, 20)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
        
        <!-- Main content -->
        <g transform="translate(40, 640)">
          <text x="0" y="-40" fill="white" font-family="Arial" font-size="48" font-weight="bold" text-anchor="start" stroke="black" stroke-width="1">"DEBUT WINNER"</text>
          <!-- Price box -->
          <rect x="0" y="-30" width="150" height="60" fill="#ffcc00" rx="5"/>
          <text x="75" y="5" fill="black" font-family="Arial" font-size="36" font-weight="bold" text-anchor="middle">$3.20</text>
        </g>
      </svg>`;
      
    case 'ten_in_seven':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0044aa;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0088ff;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Blue background for right quarter -->
        <rect x="950" y="0" width="330" height="720" fill="#0066cc"/>
        
        <!-- GET 'EM INSIDE logo with MUCH larger gray background -->
        <rect x="950" y="10" width="330" height="100" fill="#e0e0e0"/>
        
        <!-- Logo text big and bold -->
        <text x="1115" y="55" text-anchor="middle" fill="#004999" font-family="Arial" font-size="38" font-weight="900">GET 'EM</text>
        <text x="1115" y="95" text-anchor="middle" fill="#004999" font-family="Arial" font-size="38" font-weight="900">INSIDE</text>
        
        <!-- Timer repositioned lower -->
        <g transform="translate(1115, 140)">
          <rect x="-40" y="-20" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="0" y="7" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
        
        <!-- Main headline in the middle of the right side -->
        <g transform="translate(1115, 360)">
          <text x="0" y="0" fill="#ffcc00" font-family="Arial" font-size="65" font-weight="bold" text-anchor="middle">10 IN 7.</text>
          <text x="0" y="80" fill="white" font-family="Arial" font-size="30" font-weight="bold" text-anchor="middle">UNBELIEVABLE</text>
          <text x="0" y="120" fill="white" font-family="Arial" font-size="30" font-weight="bold" text-anchor="middle">RECORD</text>
        </g>
      </svg>`;
      
    case 'simon_marshall':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#cc0000;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ff0000;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- Red header bar -->
        <rect width="1280" height="80" fill="url(#headerGradient)"/>
        <!-- Breaking News logo in header -->
        <text x="30" y="55" fill="white" font-family="Arial" font-size="36" font-weight="bold">BREAKING NEWS</text>
        
        <!-- Ticker bar at bottom -->
        <g transform="translate(0, 650)">
          <rect width="1280" height="70" fill="#000000"/>
          <rect x="0" y="0" width="280" height="70" fill="#cc0000"/>
          <text x="20" y="45" fill="white" font-family="Arial" font-size="28" font-weight="bold">EXCLUSIVE</text>
          <line x1="280" y1="0" x2="280" y2="70" stroke="white" stroke-width="2"/>
          <text x="300" y="45" fill="white" font-family="Arial" font-size="24" font-weight="bold">LATEST DEVELOPMENTS</text>
        </g>
        
        <!-- Timer in top right -->
        <g transform="translate(1180, 20)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">LIVE</text>
        </g>
      </svg>`;
      
    case 'odds':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0066cc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0052cc;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- GETON logo in top left -->
        <g transform="translate(20, 20)">
          <text x="0" y="30" fill="white" font-family="Arial" font-size="30" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
        </g>
        
        <!-- Timer -->
        <g transform="translate(1180, 20)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
        
        <!-- Big $26 ODDS text -->
        <g transform="translate(200, 200)">
          <text x="0" y="0" fill="#ffcc00" font-family="Arial" font-size="120" font-weight="bold">$26</text>
          <text x="0" y="100" fill="white" font-family="Arial" font-size="100" font-weight="bold">ODDS</text>
        </g>
      </svg>`;
      
    case 'sword':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0066cc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0052cc;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Rounded rectangle background -->
        <rect width="1280" height="720" rx="20" ry="20" fill="rgba(0,0,0,0.2)"/>
        
        <!-- GETON logo in top left -->
        <g transform="translate(20, 20)">
          <text x="0" y="30" fill="white" font-family="Arial" font-size="30" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
        </g>
        
        <!-- Timer in top right -->
        <g transform="translate(1180, 20)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
        
        <!-- Main content -->
        <g transform="translate(40, 640)">
          <text x="0" y="-40" fill="white" font-family="Arial" font-size="36" font-weight="bold" text-anchor="start">"PUT 'EM TO THE SWORD"</text>
        </g>
      </svg>`;
      
    case 'same_game':
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0044aa;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0088ff;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- NRL logo in top left -->
        <g transform="translate(30, 50)">
          <rect width="100" height="50" rx="5" fill="#0033aa"/>
          <text x="50" y="35" fill="white" font-family="Arial" font-size="24" font-weight="bold" text-anchor="middle">NRL</text>
        </g>
        
        <!-- Timer -->
        <g transform="translate(1180, 50)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
        
        <!-- Footer for GET EM INSIDE -->
        <g transform="translate(120, 640)">
          <rect width="300" height="60" rx="10" fill="#0066cc"/>
          <rect x="250" y="0" width="450" height="60" rx="0" fill="#ffcc00"/>
          <text x="120" y="40" fill="white" font-family="Arial" font-size="28" font-weight="bold" text-anchor="middle">GET 'EM INSIDE</text>
          <text x="470" y="40" fill="#0066cc" font-family="Arial" font-size="28" font-weight="bold" text-anchor="middle">SAME GAME MULTI</text>
          <circle cx="660" cy="30" r="20" fill="#4CAF50"/>
          <text x="660" y="37" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">✓</text>
        </g>
      </svg>`;
      
    default:
      return `
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#0066cc;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0052cc;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- Blue header bar -->
        <rect width="1280" height="80" fill="url(#headerGradient)"/>
        <!-- GETON logo in header -->
        <text x="30" y="55" fill="white" font-family="Arial" font-size="36" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
        
        <!-- Footer for Simon Marshall -->
        <g transform="translate(0, 590)">
          <rect width="530" height="80" fill="#0066cc"/>
          <circle cx="495" cy="30" r="20" fill="#4CAF50"/>
          <text x="495" y="37" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">✓</text>
          <image x="10" y="20" width="100" height="40" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgODAiPjx0ZXh0IHg9IjEwIiB5PSI0MCIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIzNiIgZm9udC13ZWlnaHQ9ImJvbGQiPkdFVDx0c3BhbiBmaWxsPSIjZmZjYzAwIj5PTjwvdHNwYW4+PC90ZXh0Pjwvc3ZnPg=="/>
          <text x="230" y="35" fill="white" font-family="Arial" font-size="28" font-weight="bold">SIMON MARSHALL</text>
          <text x="230" y="65" fill="#ffcc00" font-family="Arial" font-size="20">EXPERT TIPSTER</text>
        </g>
        <!-- Add timer in top right -->
        <g transform="translate(1180, 20)">
          <rect x="-80" y="0" width="80" height="40" rx="20" fill="rgba(0,0,0,0.7)"/>
          <text x="-40" y="27" fill="white" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">0:44</text>
        </g>
      </svg>`;
  }
}

// Create a directory for style preview images if it doesn't exist
if (!fs.existsSync('public/styles')) {
  fs.mkdirSync('public/styles', { recursive: true });
}

// Create style preview images if they don't exist
async function createStylePreviewImages() {
  const styles = [
    { name: 'race-8', caption: 'RACE 8', price: '$26.00' },
    { name: 'odds-reaction', caption: '$26', price: 'ODDS' }
  ];

  for (const style of styles) {
    const outputPath = `public/styles/${style.name}.jpg`;
    if (!fs.existsSync(outputPath)) {
      try {
        const width = 300;
        const height = 169;
        const svg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#004999;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0066cc;stop-opacity:1" />
              </linearGradient>
              <linearGradient id="priceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#FFC000;stop-opacity:1" />
              </linearGradient>
            </defs>
            ${style.name === 'race-8' ? `
              <!-- Blue header bar -->
              <rect width="${width}" height="20" fill="url(#headerGradient)"/>
              <!-- GETON logo -->
              <text x="5" y="15" fill="white" font-family="Arial" font-size="12" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
              <!-- Main content -->
              <text x="5" y="50" fill="white" font-family="Arial" font-size="24" font-weight="bold">${style.caption}</text>
              <!-- Price box -->
              <rect x="5" y="60" width="80" height="25" rx="5" fill="url(#priceGradient)"/>
              <text x="10" y="78" fill="white" font-family="Arial" font-size="16" font-weight="bold">${style.price}</text>
            ` : `
              <!-- Blue background -->
              <rect width="${width}" height="${height}" fill="url(#headerGradient)"/>
              <!-- GETON logo -->
              <text x="5" y="15" fill="white" font-family="Arial" font-size="12" font-weight="bold">GET<tspan fill="#ffcc00">ON</tspan></text>
              <!-- Main content -->
              <text x="5" y="50" fill="white" font-family="Arial" font-size="32" font-weight="bold">${style.caption}</text>
              <text x="5" y="80" fill="white" font-family="Arial" font-size="24" font-weight="bold">${style.price}</text>
            `}
          </svg>
        `;

        await sharp(Buffer.from(svg))
          .jpeg({ quality: 90 })
          .toFile(outputPath);

        console.log(`Created style preview for ${style.name}`);
      } catch (error) {
        console.error(`Error creating style preview for ${style.name}:`, error);
      }
    }
  }
}

// Call this when the server starts
createStylePreviewImages();

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
