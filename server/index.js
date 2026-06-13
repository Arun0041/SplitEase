require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('./src/config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(passport.initialize());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const authRoutes = require('./src/routes/auth');
const groupsRoutes = require('./src/routes/groups');
const expensesRoutes = require('./src/routes/expenses');
const settlementsRoutes = require('./src/routes/settlements');
const importRoutes = require('./src/routes/import');

app.use('/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api', expensesRoutes); // Expenses routes are mounted at /api/groups/:groupId/expenses and /api/expenses/:id
app.use('/api', settlementsRoutes); // Mounted at /api/groups/:id/settlements and balances
app.use('/api', importRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
