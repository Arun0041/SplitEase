const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('./db');

// Configure Google OAuth 2.0 strategy
// Flow: User clicks "Login with Google" → Google auth page → callback → find/create user → issue JWT
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const googleId = profile.id;
      const avatarUrl = profile.photos?.[0]?.value || null;

      // Check if user already exists (by google_id)
      let result = await query(
        'SELECT * FROM users WHERE google_id = $1',
        [googleId]
      );

      if (result.rows.length > 0) {
        // Existing user — return them
        return done(null, result.rows[0]);
      }

      // Check if user exists by email (might have been created during CSV import)
      result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length > 0) {
        // Link Google account to existing user
        await query(
          'UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
          [googleId, avatarUrl, result.rows[0].id]
        );
        result.rows[0].google_id = googleId;
        result.rows[0].avatar_url = avatarUrl;
        return done(null, result.rows[0]);
      }

      // New user — create account
      const insertResult = await query(
        'INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [googleId, email, name, avatarUrl]
      );

      return done(null, insertResult.rows[0]);
    } catch (err) {
      return done(err, null);
    }
  }
));

// Serialize/deserialize for session support (we use JWT, but Passport needs these)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
