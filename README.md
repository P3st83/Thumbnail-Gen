# Thumbnail Generator

A simple web application to extract frames from videos and enhance them to create professional thumbnails with sports broadcast styling.

## Features

- Extract multiple frames evenly distributed throughout your video
- Select your preferred frame to use as a thumbnail
- Apply various enhancement effects and broadcasting overlay templates
- Download in high resolution (1280x720)
- Works 100% offline - no internet connection needed

## Enhancement Options

The app offers several enhancement styles:

### Sports Broadcasting Templates
- **10 in 7 Record**: Blue sidebar with "GET 'EM INSIDE" logo and "10 IN 7" headline
- **Race 8**: Racing broadcast style with price box
- **Debut Winner**: Elegant overlay with transparent blue effect
- **Simon Marshall**: Breaking news style with red header and ticker bar
- **Odds**: Large odds display with GETON branding
- **Sword**: Transparent overlay with "PUT 'EM TO THE SWORD" text
- **Same Game**: NRL style with "SAME GAME MULTI" footer

Each template includes:
- Broadcasting-quality overlays
- Professional typography
- Timer display (0:44)
- Proper branding elements

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
   This will install all required packages including:
   - **express**: Web server framework
   - **multer**: File upload handling
   - **sharp**: Image processing library
   - **axios**: HTTP client
   - **dotenv**: Environment variable management

3. Make sure FFmpeg is installed on your system (see Requirements section)

## Starting the App

1. Start the server:
   ```
   node server.js
   ```

2. You should see this output:
   ```
   🚀 Server running at http://localhost:3001
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3001
   ```

4. If you want to run the server on a different port, you can change the `port` variable in `server.js`

5. To stop the server, press `Ctrl+C` in the terminal where it's running

## Requirements

- Node.js (v12 or later)
- FFmpeg must be installed on your system
  - On macOS: `brew install ffmpeg`
  - On Ubuntu/Debian: `apt install ffmpeg`
  - On Windows: Download from [FFmpeg website](https://ffmpeg.org/download.html)

## How to Use

1. **Upload a Video**: Click on the file input and select a video file (mp4, mov, avi, mkv, webm)
2. **Extract Frames**: Click "Upload Video" to process the video
3. **Select a Frame**: Browse through the extracted frames and click on one to select it
4. **Choose a Style**: Select one of the broadcasting style templates
5. **Enhance the Frame**: The selected template will be applied to your frame
6. **Download**: Click "Download Thumbnail" to save your enhanced image

## Technologies Used

### Frontend
- **HTML/CSS/JavaScript**: Dark-themed responsive interface
- **Modern CSS**: Flexbox-based layout for the enhancement options
- **Client-side JavaScript**: Handles file upload, frame selection, and enhancement requests

### Backend
- **Express.js**: Fast, unopinionated web framework for Node.js
- **Multer**: Middleware for handling multipart/form-data, primarily used for uploading files
- **FFmpeg**: Cross-platform solution to record, convert, and stream audio and video
  - Extracts frames at a rate of 4 frames per second
  - Validates video files to ensure they contain video streams
- **Sharp**: High-performance Node.js image processing library
  - Creates professional overlays using SVG templates
  - Composites images with text and graphical elements
  - Automatically handles image format conversion and optimization

## Performance

- Frame extraction time depends on video length and quality
- The app can handle videos up to 100MB in size
- Enhancement operations typically take less than 1 second
- Image processing is done entirely on the server, no client-side processing required

## License

MIT License
