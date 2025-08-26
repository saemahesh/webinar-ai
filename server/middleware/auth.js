const { verifyToken } = require('./jwt');

/**
 * Middleware to authenticate JWT token
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware to check if user is host or admin
 */
const requireHost = (req, res, next) => {
  if (req.user.role !== 'host' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Host access required' });
  }
  next();
};

/**
 * Middleware to check if user account is approved
 */
const requireApproved = (req, res, next) => {
  if (req.user.status !== 'approved') {
    return res.status(403).json({ 
      error: 'Account not approved',
      status: req.user.status 
    });
  }
  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireHost,
  requireApproved
};
