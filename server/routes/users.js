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

// Helper function to write users
const writeUsers = (users) => {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
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
 * GET /api/users/pending
 * Get all pending host registrations (admin only)
 */
router.get('/pending', authenticate, requireAdmin, (req, res) => {
  try {
    const users = readUsers();
    const pendingHosts = users.filter(user => user.status === 'pending' && user.role === 'host');
    
    res.json(pendingHosts);
  } catch (error) {
    console.error('Error fetching pending hosts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const users = readUsers();
    
    // Remove passwords from response
    const sanitizedUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users/:id/approve
 * Approve a host registration (admin only)
 */
router.post('/:id/approve', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { expiryDate } = req.body;
    
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[userIndex];
    
    if (user.status !== 'pending') {
      return res.status(400).json({ error: 'User is not pending approval' });
    }
    
    // Update user status
    users[userIndex] = {
      ...user,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      expiryDate: expiryDate || null,
      approvedBy: req.user.id
    };
    
    writeUsers(users);
    
    // Return updated user (without password)
    const { password, ...userWithoutPassword } = users[userIndex];
    
    res.json({
      message: 'Host approved successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error approving host:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users/:id/reject
 * Reject a host registration (admin only)
 */
router.post('/:id/reject', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[userIndex];
    
    if (user.status !== 'pending') {
      return res.status(400).json({ error: 'User is not pending approval' });
    }
    
    // Update user status
    users[userIndex] = {
      ...user,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user.id
    };
    
    writeUsers(users);
    
    res.json({
      message: 'Host registration rejected',
      userId: id
    });
  } catch (error) {
    console.error('Error rejecting host:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/users/:id/extend
 * Extend user access (admin only)
 */
router.put('/:id/extend', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { expiryDate } = req.body;
    
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update expiry date
    users[userIndex] = {
      ...users[userIndex],
      expiryDate: expiryDate || null,
      extendedAt: new Date().toISOString(),
      extendedBy: req.user.id
    };
    
    writeUsers(users);
    
    // Return updated user (without password)
    const { password, ...userWithoutPassword } = users[userIndex];
    
    res.json({
      message: 'User access extended successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error extending user access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[userIndex];
    
    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }
    
    // Remove user
    users.splice(userIndex, 1);
    writeUsers(users);
    
    res.json({
      message: 'User deleted successfully',
      userId: id
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
