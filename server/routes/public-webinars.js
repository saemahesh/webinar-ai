const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Data file paths
const webinarsFile = path.join(__dirname, '../data/webinars.json');
const attendeesFile = path.join(__dirname, '../data/attendees.json');

// Helper functions
const readJSONFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeJSONFile = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

// Get public webinar details (no authentication required)
router.get('/:id', async (req, res) => {
  try {
    const webinarId = req.params.id;
    const webinars = await readJSONFile(webinarsFile);
    
    const webinar = webinars.find(w => w.id === webinarId);
    
    if (!webinar) {
      return res.status(404).json({
        error: 'Webinar not found',
        message: 'The requested webinar could not be found.'
      });
    }
    
    // Compute status dynamically based on scheduledDate and duration
    const computeStatus = (w) => {
      try {
        const start = new Date(w.scheduledDate);
        if (Number.isNaN(start.getTime())) return w.status || 'upcoming';
        const durationMin = Number.isFinite(Number(w.duration)) ? Number(w.duration) : 30;
        const end = new Date(start.getTime() + durationMin * 60 * 1000);
        const now = new Date();
        if (now < start) return 'upcoming';
        if (now <= end) return 'live';
        return 'completed';
      } catch (_) {
        return w.status || 'upcoming';
      }
    };
    const dynamicStatus = computeStatus(webinar);
    // Persist status change for consistency across views
    if (dynamicStatus !== webinar.status) {
      try {
        const webinarsAll = await readJSONFile(webinarsFile);
        const idx = webinarsAll.findIndex(w => w.id === webinar.id);
        if (idx !== -1) {
          webinarsAll[idx].status = dynamicStatus;
          webinarsAll[idx].updatedAt = new Date().toISOString();
          await writeJSONFile(webinarsFile, webinarsAll);
        }
      } catch (e) {
        // non-fatal if persist fails
      }
    }
    
    // Return only public information (remove sensitive host data)
    const publicWebinar = {
      id: webinar.id,
      title: webinar.title,
      description: webinar.description,
      scheduledDate: webinar.scheduledDate,
      duration: webinar.duration,
      maxAttendees: webinar.maxAttendees,
      requireRegistration: webinar.requireRegistration,
      status: dynamicStatus,
      hostEmail: webinar.hostEmail,
      registrations: webinar.registrations || 0,
      customFields: webinar.customFields || [],
      videoPath: webinar.videoFile ? `/${webinar.videoFile.path}` : (webinar.videoPath || null),
    hasVideo: webinar.hasVideo || false,
    scheduledMessages: webinar.scheduledMessages || []
    };
    
    res.json({
      success: true,
      webinar: publicWebinar
    });
    
  } catch (error) {
    console.error('Error fetching public webinar:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to fetch webinar details'
    });
  }
});

// Register for webinar (no authentication required)
router.post('/:id/register', async (req, res) => {
  try {
    const webinarId = req.params.id;
  const { name, email, company, customFields } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name and email are required for registration.'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address.'
      });
    }
    
    // Load webinar and attendees data
    const webinars = await readJSONFile(webinarsFile);
    const attendees = await readJSONFile(attendeesFile);
    
    const webinar = webinars.find(w => w.id === webinarId);
    
    if (!webinar) {
      return res.status(404).json({
        error: 'Webinar not found',
        message: 'The requested webinar could not be found.'
      });
    }
    
    // Check if registration is required
    if (!webinar.requireRegistration) {
      return res.status(400).json({
        error: 'Registration not required',
        message: 'This webinar does not require registration.'
      });
    }
    
    // Check if webinar is full
    const currentRegistrations = webinar.registrations || 0;
    if (currentRegistrations >= webinar.maxAttendees) {
      return res.status(400).json({
        error: 'Webinar is full',
        message: 'This webinar has reached its maximum capacity.'
      });
    }
    
    // Check if already registered
    const existingAttendee = attendees.find(a => 
      a.webinarId === webinarId && a.email.toLowerCase() === email.toLowerCase()
    );
    
    if (existingAttendee) {
      return res.status(409).json({
        error: 'Already registered',
        message: 'You are already registered for this webinar with this email address.'
      });
    }
    
    // Create new attendee record
    const newAttendee = {
      id: uuidv4(),
      webinarId: webinarId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company ? company.trim() : '',
      registeredAt: new Date().toISOString(),
      status: 'registered',
      // Persist custom fields as provided (object keyed by field label)
      customFields: (customFields && typeof customFields === 'object') ? customFields : {}
    };
    
    // Add attendee to the list
    attendees.push(newAttendee);
    
    // Update webinar registration count
    const webinarIndex = webinars.findIndex(w => w.id === webinarId);
    webinars[webinarIndex].registrations = (webinars[webinarIndex].registrations || 0) + 1;
    webinars[webinarIndex].updatedAt = new Date().toISOString();
    
    // Save data
    await writeJSONFile(attendeesFile, attendees);
    await writeJSONFile(webinarsFile, webinars);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      attendee: {
        id: newAttendee.id,
        name: newAttendee.name,
        email: newAttendee.email,
        company: newAttendee.company,
        registeredAt: newAttendee.registeredAt,
        status: newAttendee.status,
        customFields: newAttendee.customFields
      }
    });
    
  } catch (error) {
    console.error('Error registering for webinar:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to process registration'
    });
  }
});

// Check registration status (no authentication required)
router.get('/:id/check-registration', async (req, res) => {
  try {
    const webinarId = req.params.id;
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Email parameter is required to check registration status.'
      });
    }
    
    const attendees = await readJSONFile(attendeesFile);
    
    const attendee = attendees.find(a => 
      a.webinarId === webinarId && a.email.toLowerCase() === email.toLowerCase()
    );
    
    res.json({
      success: true,
      isRegistered: !!attendee,
      attendee: attendee ? {
        id: attendee.id,
        name: attendee.name,
        email: attendee.email,
        company: attendee.company,
        registeredAt: attendee.registeredAt
      } : null
    });
    
  } catch (error) {
    console.error('Error checking registration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Unable to check registration status'
    });
  }
});

module.exports = router;
