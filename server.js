const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.netlify.app'],
  credentials: true
}));
app.get('/api/test', (req, res) => {
  res.send('Fleet Management Backend is running');
} );
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Fleet Management Backend running on http://localhost:${PORT}`);
});
