const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// File paths
const usersFile = path.join(__dirname, '../data/users.json');
const webinarsFile = path.join(__dirname, '../data/webinars.json');

// Helper function to read users
const readUsers = () => {
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// Helper function to read webinars
const readWebinars = () => {
  try {
    const data = fs.readFileSync(webinarsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const users = readUsers();
    const webinars = readWebinars();
    
    const stats = {
      totalUsers: users.length,
      pendingHosts: users.filter(u => u.status === 'pending' && u.role === 'host').length,
      approvedHosts: users.filter(u => u.status === 'approved' && u.role === 'host').length,
      rejectedHosts: users.filter(u => u.status === 'rejected' && u.role === 'host').length,
      totalWebinars: webinars.length,
      activeWebinars: webinars.filter(w => w.status === 'live').length,
      scheduledWebinars: webinars.filter(w => w.status === 'scheduled').length,
      completedWebinars: webinars.filter(w => w.status === 'completed').length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
