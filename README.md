# Thumbnail Generator

A simple web application to extract frames from videos and enhance them to create professional thumbnails.

## Features

- Extract multiple frames evenly distributed throughout your video
- Select your preferred frame to use as a thumbnail
- Apply various enhancement effects to improve your thumbnail
- Download in high resolution (1280x720 or larger)
- Works 100% offline - no internet connection needed

## Enhancement Options

The app offers several enhancement options:

### Basic Adjustments
- **brighten**: Makes the image brighter
- **contrast**: Increases contrast and vividness
- **sharpen**: Makes details clearer and sharper
- **saturate**: Increases color saturation and vibrancy
- **blur**: Applies a soft blur effect

### Color Effects
- **grayscale**: Converts to black and white
- **sepia**: Applies a vintage/sepia effect
- **cool**: Adds a cool/blue tone
- **warm**: Adds a warm/orange tone
- **invert**: Creates a negative image effect

### Stylistic Effects
- **hd**: High-definition enhancement
- **dramatic**: High contrast with deep shadows
- **posterize**: Creates a poster/comic art effect

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install express multer sharp axios dotenv
   ```
   This will install:
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
   🚀 Server running at http://localhost:3000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
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

1. **Upload a Video**: Click on the file input and select a video file
2. **Extract Frames**: Click "Upload & Extract Frames" to process the video
3. **Select a Frame**: Browse through the extracted frames and click on one to select it
4. **Apply Enhancement**: Enter a keyword like "sharpen" or "dramatic" in the input field
5. **Enhance the Frame**: Click "Enhance Selected Frame" to apply the effect
6. **Download**: Click "Download Thumbnail" to save your enhanced image

## Technologies Used

### Frontend
- **HTML/CSS/JavaScript**: Simple responsive interface
- **Modern CSS**: Flexbox-based layout for the enhancement options
- **Client-side JavaScript**: Handles file upload, frame selection, and enhancement requests

### Backend
- **Express.js**: Fast, unopinionated web framework for Node.js
- **Multer**: Middleware for handling multipart/form-data, primarily used for uploading files
- **FFmpeg**: Cross-platform solution to record, convert, and stream audio and video
  - Uses the `thumbnail` filter to extract representative frames from videos
  - Can extract up to hundreds of frames from longer videos
- **Sharp**: High-performance Node.js image processing library
  - 4-8x faster than using ImageMagick or GraphicsMagick
  - Low memory footprint
  - Supports various image manipulations (brightness, contrast, etc.)
  - Automatically handles image format conversion and optimization

## Performance

- Frame extraction time depends on video length and quality
- The app can handle videos up to 100MB in size
- Enhancement operations typically take less than 1 second
- Image processing is done entirely on the server, no client-side processing required

## License

MIT License
