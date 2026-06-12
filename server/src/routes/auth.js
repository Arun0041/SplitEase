const router = require('express').Router();
const passport = require('../config/passport');
const { generateToken } = require('../middleware/auth');
const { authenticate } = require('../middleware/auth');

// GET /auth/google
// Initiates Google OAuth flow — redirects user to Google's consent screen
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
);

// GET /auth/google/callback
// Google redirects here after user consents
// We create/find the user, generate a JWT, and redirect to frontend with the token
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`
  }),
  (req, res) => {
    // User is authenticated — generate JWT
    const token = generateToken(req.user);

    // Redirect to frontend with token as query parameter
    // Frontend will extract and store it
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// GET /auth/me
// Returns the currently authenticated user's profile
router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    avatar_url: req.user.avatar_url
  });
});

module.exports = router;
