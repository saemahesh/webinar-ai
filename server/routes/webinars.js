const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// File paths
const webinarsFile = path.join(__dirname, '../data/webinars.json');
const usersFile = path.join(__dirname, '../data/users.json');

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

// Helper function to read users
const readUsers = () => {
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

/**
 * GET /api/webinars/my-webinars
 * Get webinars for the authenticated host
 */
router.get('/my-webinars', authenticate, (req, res) => {
  try {
    console.log('Getting webinars for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can view webinars' });
    }
    
    const webinars = readWebinars();
    const userWebinars = webinars.filter(webinar => webinar.hostId === req.user.id);
    
    console.log(`Found ${userWebinars.length} webinars for host ${req.user.email}`);
    
    res.json({
      webinars: userWebinars,
      total: userWebinars.length
    });
  } catch (error) {
    console.error('Error fetching webinars:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webinars
 * Create a new webinar
 */
router.post('/', authenticate, (req, res) => {
  try {
    console.log('Creating webinar for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can create webinars' });
    }
    
    if (req.user.status !== 'approved') {
      return res.status(403).json({ error: 'Your account must be approved to create webinars' });
    }
    
    const { title, description, scheduledDate, duration, maxAttendees, requireRegistration } = req.body;
    
    // Validation
    if (!title || !description || !scheduledDate || !duration) {
      return res.status(400).json({ error: 'Title, description, scheduled date, and duration are required' });
    }
    
    // Create new webinar
    const newWebinar = {
      id: uuidv4(),
      title: title.trim(),
      description: description.trim(),
      scheduledDate: new Date(scheduledDate).toISOString(),
      duration: parseInt(duration),
      maxAttendees: parseInt(maxAttendees) || 100,
      requireRegistration: requireRegistration !== false,
      status: 'upcoming',
      hostId: req.user.id,
      hostName: req.user.name,
      hostEmail: req.user.email,
      registrations: 0,
      attendees: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Read existing webinars and add new one
    const webinars = readWebinars();
    webinars.push(newWebinar);
    writeWebinars(webinars);
    
    console.log('Webinar created successfully:', newWebinar.id);
    
    res.status(201).json({
      message: 'Webinar created successfully',
      webinar: newWebinar
    });
  } catch (error) {
    console.error('Error creating webinar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/webinars/:id
 * Update an existing webinar
 */
router.put('/:id', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    console.log('Updating webinar:', webinarId, 'for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can update webinars' });
    }
    
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (webinarIndex === -1) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    const { title, description, scheduledDate, duration, maxAttendees, requireRegistration, customFields, confirmationMessage, registrationDeadline } = req.body;
    
    // Update webinar
    const updatedWebinar = {
      ...webinars[webinarIndex],
      title: title?.trim() || webinars[webinarIndex].title,
      description: description?.trim() || webinars[webinarIndex].description,
      scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : webinars[webinarIndex].scheduledDate,
      duration: duration !== undefined ? parseInt(duration) : webinars[webinarIndex].duration,
      maxAttendees: maxAttendees !== undefined ? parseInt(maxAttendees) : webinars[webinarIndex].maxAttendees,
      requireRegistration: requireRegistration !== undefined ? requireRegistration : webinars[webinarIndex].requireRegistration,
      customFields: customFields !== undefined ? customFields : webinars[webinarIndex].customFields || [],
      confirmationMessage: confirmationMessage !== undefined ? confirmationMessage : webinars[webinarIndex].confirmationMessage || '',
      registrationDeadline: registrationDeadline !== undefined ? registrationDeadline : webinars[webinarIndex].registrationDeadline || null,
      updatedAt: new Date().toISOString()
    };
    
    webinars[webinarIndex] = updatedWebinar;
    writeWebinars(webinars);
    
    console.log('Webinar updated successfully:', webinarId);
    
    res.json({
      message: 'Webinar updated successfully',
      webinar: updatedWebinar
    });
  } catch (error) {
    console.error('Error updating webinar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/webinars/:id
 * Delete a webinar
 */
router.delete('/:id', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    console.log('Deleting webinar:', webinarId, 'for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can delete webinars' });
    }
    
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (webinarIndex === -1) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    // Remove webinar
    const deletedWebinar = webinars.splice(webinarIndex, 1)[0];
    writeWebinars(webinars);
    
    console.log('Webinar deleted successfully:', webinarId);
    
    res.json({
      message: 'Webinar deleted successfully',
      webinar: deletedWebinar
    });
  } catch (error) {
    console.error('Error deleting webinar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webinars/:id/start
 * Start a webinar live
 */
router.post('/:id/start', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    console.log('Starting webinar:', webinarId, 'for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can start webinars' });
    }
    
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (webinarIndex === -1) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    const webinar = webinars[webinarIndex];
    
    if (webinar.status === 'live') {
      return res.status(400).json({ error: 'Webinar is already live' });
    }
    
    if (webinar.status === 'completed') {
      return res.status(400).json({ error: 'Cannot start a completed webinar' });
    }
    
    // Update status to live
    webinars[webinarIndex] = {
      ...webinar,
      status: 'live',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    writeWebinars(webinars);
    
    console.log('Webinar started successfully:', webinarId);
    
    res.json({
      message: 'Webinar started successfully',
      webinar: webinars[webinarIndex]
    });
  } catch (error) {
    console.error('Error starting webinar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/webinars/:id
 * Get webinar details by ID (for host only)
 */
router.get('/:id', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    console.log('Getting webinar details:', webinarId, 'for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can view webinar details' });
    }
    
    const webinars = readWebinars();
  const webinar = webinars.find(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    // Dynamically compute status based on scheduledDate and duration and persist if changed
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
      } catch (_) { return w.status || 'upcoming'; }
    };
    const dynStatus = computeStatus(webinar);
    if (dynStatus !== webinar.status) {
      webinar.status = dynStatus;
      webinar.updatedAt = new Date().toISOString();
      writeWebinars(webinars);
    }
    // Add videoPath mapping for frontend compatibility
    const webinarResponse = {
      ...webinar,
      videoPath: webinar.videoFile ? `/${webinar.videoFile.path}` : (webinar.videoPath || null)
    };
    
    console.log('Webinar found:', webinar.title);
    res.json(webinarResponse);
  } catch (error) {
    console.error('Error fetching webinar details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/webinars/:id/attendees
 * Get attendees for a specific webinar (for host only)
 */
router.get('/:id/attendees', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    console.log('Getting attendees for webinar:', webinarId, 'for user:', req.user.email);
    
    if (req.user.role !== 'host') {
      return res.status(403).json({ error: 'Only hosts can view attendees' });
    }
    
    const webinars = readWebinars();
    const webinar = webinars.find(w => w.id === webinarId && w.hostId === req.user.id);
    
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found or access denied' });
    }
    
    // Read attendees file for this webinar
    const attendeesFile = path.join(__dirname, '../data/attendees.json');
    let allAttendees = [];
    
    try {
      const data = fs.readFileSync(attendeesFile, 'utf8');
      allAttendees = JSON.parse(data);
    } catch (error) {
      console.log('No attendees file found or empty');
    }
    
    // Filter attendees for this webinar
    const webinarAttendees = allAttendees
      .filter(attendee => attendee.webinarId === webinarId)
      .map(a => ({
        id: a.id,
        webinarId: a.webinarId,
        name: a.name,
        email: a.email,
        company: a.company,
        registeredAt: a.registeredAt,
        status: a.status,
        customFields: a.customFields || {}
      }));
    
    console.log(`Found ${webinarAttendees.length} attendees for webinar ${webinarId}`);
    
    res.json({
      attendees: webinarAttendees,
      total: webinarAttendees.length
    });
  } catch (error) {
    console.error('Error fetching webinar attendees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/webinars
 * Get all public webinars (for attendees)
 */
router.get('/', (req, res) => {
  try {
    const webinars = readWebinars();
    const users = readUsers();
    
    // Add host information and filter out sensitive data
    let mutated = false;
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
      } catch (_) { return w.status || 'upcoming'; }
    };
    const publicWebinars = webinars.map(webinar => {
      const dynStatus = computeStatus(webinar);
      if (dynStatus !== webinar.status) {
        webinar.status = dynStatus;
        webinar.updatedAt = new Date().toISOString();
        mutated = true;
      }
      const host = users.find(u => u.id === webinar.hostId);
      return {
        id: webinar.id,
        title: webinar.title,
        description: webinar.description,
        scheduledDate: webinar.scheduledDate,
        duration: webinar.duration,
        maxAttendees: webinar.maxAttendees,
        requireRegistration: webinar.requireRegistration,
        status: webinar.status,
        registrations: webinar.registrations || 0,
        hostName: host ? host.name : 'Unknown Host',
        createdAt: webinar.createdAt
      };
    }).filter(webinar => webinar.status !== 'cancelled');
    if (mutated) {
      writeWebinars(webinars);
    }
    
    res.json({
      webinars: publicWebinars,
      total: publicWebinars.length
    });
  } catch (error) {
    console.error('Error fetching public webinars:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/webinars/:id/status
 * Update webinar status (host only)
 */
router.put('/:id/status', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    const { status, startedAt, endedAt } = req.body;
    
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId);
    
    if (webinarIndex === -1) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    
    const webinar = webinars[webinarIndex];
    
    // Check if user is the host
    if (req.user.role !== 'host' || webinar.hostEmail !== req.user.email) {
      return res.status(403).json({ error: 'Only the webinar host can update status' });
    }
    
    // Validate status
    const validStatuses = ['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Update webinar status
    webinars[webinarIndex].status = status;
    
    if (startedAt) {
      webinars[webinarIndex].startedAt = startedAt;
    }
    
    if (endedAt) {
      webinars[webinarIndex].endedAt = endedAt;
    }
    
    webinars[webinarIndex].updatedAt = new Date().toISOString();
    
    writeWebinars(webinars);
    
    res.json({
      success: true,
      message: `Webinar status updated to ${status}`,
      webinar: webinars[webinarIndex]
    });
    
  } catch (error) {
    console.error('Error updating webinar status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/webinars/:id/chat-settings
 * Update chat settings (host only)
 */
router.put('/:id/chat-settings', authenticate, (req, res) => {
  try {
    const webinarId = req.params.id;
    const { chatEnabled } = req.body;
    
    const webinars = readWebinars();
    const webinarIndex = webinars.findIndex(w => w.id === webinarId);
    
    if (webinarIndex === -1) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    
    const webinar = webinars[webinarIndex];
    
    // Check if user is the host
    if (req.user.role !== 'host' || webinar.hostEmail !== req.user.email) {
      return res.status(403).json({ error: 'Only the webinar host can update chat settings' });
    }
    
    // Update chat settings
    if (!webinars[webinarIndex].settings) {
      webinars[webinarIndex].settings = {};
    }
    
    webinars[webinarIndex].settings.chatEnabled = chatEnabled;
    webinars[webinarIndex].updatedAt = new Date().toISOString();
    
    writeWebinars(webinars);
    
    res.json({
      success: true,
      message: `Chat ${chatEnabled ? 'enabled' : 'disabled'}`,
      settings: webinars[webinarIndex].settings
    });
    
  } catch (error) {
    console.error('Error updating chat settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
