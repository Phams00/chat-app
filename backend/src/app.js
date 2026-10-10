const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const contactRoutes = require('./routes/contact.routes');
const conversationRoutes = require('./routes/conversation.routes');
const path = require('path');
const profileRoutes = require('./routes/profile.routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;

