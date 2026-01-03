import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

// Clerk authentication middleware that also extracts user info
export const authMiddleware = (req, res, next) => {
  ClerkExpressRequireAuth({
    onError: (error) => {
      console.error('Auth error:', error);
      return {
        status: 401,
        message: 'Authentication required'
      };
    }
  })(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Extract user info from Clerk auth
    if (req.auth && req.auth.userId) {
      req.user = {
        id: req.auth.userId,
      };
    }
    next();
  });
};

// Optional: Standalone extract user middleware if needed
export function extractUserMiddleware(req, res, next) {
  if (req.auth && req.auth.userId) {
    req.user = {
      id: req.auth.userId,
    };
  }
  next();
}
