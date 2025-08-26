const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production-2025';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate attendee join token
 * @param {Object} attendee - Attendee object
 * @param {String} webinarId - Webinar ID
 * @returns {String} JWT token
 */
const generateAttendeeToken = (attendee, webinarId) => {
  const payload = {
    attendeeId: attendee.id,
    webinarId: webinarId,
    email: attendee.email,
    type: 'attendee'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};

/**
 * Verify attendee token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyAttendeeToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'attendee') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired attendee token');
  }
};

module.exports = {
  generateToken,
  verifyToken,
  generateAttendeeToken,
  verifyAttendeeToken
};
