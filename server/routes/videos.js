const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/videos');
    
    // Create uploads/videos directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: webinarId_timestamp_originalname
    const webinarId = req.params.webinarId || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${webinarId}_${timestamp}_${name}${ext}`);
  }
});

// File filter for videos only
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo', // .avi
    'video/x-ms-wmv',  // .wmv
    'video/webm'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only video files are allowed.'), false);
  }
};

// Configure multer with limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 1 // Only one file at a time
  }
});

// File paths
const webinarsFile = path.join(__dirname, '../data/webinars.json');

// Helper function to read webinars
const readWebinars = () => {
  try {
    const data = fs.readFileSync(webinarsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// Helper function to write webinars
const writeWebinars = (webinars) => {
  fs.writeFileSync(webinarsFile, JSON.stringify(webinars, null, 2));
};

/**
 * POST /api/videos/upload/:webinarId
 * Upload video for a webinar
 */
router.post('/upload/:webinarId', authenticate, upload.single('video'), (req, res) => {
  try {
    const webinarId = req.params.webinarId;
    console.log('Uploading video for webinar:', webinarId, 'by user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can upload videos' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    // Verify webinar exists and belongs to user
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (webinarIndex === -1) {
      // Clean up uploaded file if webinar not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    // Remove old video if exists
    const webinar = webinars[webinarIndex];
    if (webinar.videoFile && webinar.videoFile.path) {
      const oldVideoPath = path.join(__dirname, '..', webinar.videoFile.path);
      if (fs.existsSync(oldVideoPath)) {
        try {
          fs.unlinkSync(oldVideoPath);
          console.log('Removed old video file:', oldVideoPath);
        } catch (error) {
          console.warn('Could not remove old video file:', error.message);
        }
      }
    }
    
    // Update webinar with video information
    const videoInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: `uploads/videos/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };
    
    webinars[webinarIndex] = {
      ...webinar,
      videoFile: videoInfo,
      hasVideo: true,
      updatedAt: new Date().toISOString()
    };
    
    writeWebinars(webinars);
    
    console.log('Video uploaded successfully:', req.file.filename);
    
    res.json({
      message: 'Video uploaded successfully',
      video: videoInfo,
      webinar: webinars[webinarIndex]
    });
    
  } catch (error) {
    console.error('Error uploading video:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 500MB.' });
    }
    
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

/**
 * DELETE /api/videos/:webinarId
 * Remove video from a webinar
 */
router.delete('/:webinarId', authenticate, (req, res) => {
  try {
    const webinarId = req.params.webinarId;
    console.log('Removing video for webinar:', webinarId, 'by user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can remove videos' });
    }
    
    // Verify webinar exists and belongs to user
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (webinarIndex === -1) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    const webinar = webinars[webinarIndex];
    
    if (!webinar.videoFile) {
      return res.status(400).json({ error: 'No video file to remove' });
    }
    
    // Remove video file from disk
    const videoPath = path.join(__dirname, '..', webinar.videoFile.path);
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
        console.log('Removed video file:', videoPath);
      } catch (error) {
        console.warn('Could not remove video file:', error.message);
      }
    }
    
    // Update webinar to remove video info
    webinars[webinarIndex] = {
      ...webinar,
      videoFile: null,
      hasVideo: false,
      updatedAt: new Date().toISOString()
    };
    
    writeWebinars(webinars);
    
    console.log('Video removed successfully from webinar:', webinarId);
    
    res.json({
      message: 'Video removed successfully',
      webinar: webinars[webinarIndex]
    });
    
  } catch (error) {
    console.error('Error removing video:', error);
    res.status(500).json({ error: 'Failed to remove video' });
  }
});

/**
 * GET /api/videos/:webinarId/stream
 * Stream video for a webinar (for playing back)
 */
router.get('/:webinarId/stream', authenticate, (req, res) => {
  try {
    const webinarId = req.params.webinarId;
    console.log('Streaming video for webinar:', webinarId);
    
    // Verify webinar exists and user has access
    const webinars = readWebinars();
    const webinar = webinars.find(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    if (!webinar.videoFile) {
      return res.status(404).json({ error: 'No video file found for this webinar' });
    }
    
    const videoPath = path.join(__dirname, '..', webinar.videoFile.path);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }
    
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': webinar.videoFile.mimetype,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Send entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': webinar.videoFile.mimetype,
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
    
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

module.exports = router;
