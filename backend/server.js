import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { startBot } from './bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// API Endpoints

// 1. User Registration & Retrieval
app.post('/api/register', async (req, res) => {
  const { id, username, first_name, referred_by } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    let user = await db.getUserById(id);
    
    if (!user) {
      user = await db.createUser({ id, username, first_name, referred_by });
    } else if (username && user.username !== username) {
      user = await db.updateUsername(id, username);
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by username (for sharing profiles)
app.get('/api/user/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ id: user.id, username: user.username, first_name: user.first_name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Confessions (Send anonymous message)
app.post('/api/message/send', async (req, res) => {
  const { recipient_username, content, device, gender, location, sender_name, sender_username } = req.body;

  if (!recipient_username || !content) {
    return res.status(400).json({ error: 'Recipient username and content are required' });
  }

  try {
    const recipient = await db.getUserByUsername(recipient_username);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    await db.addMessage(
      recipient.id, 
      content, 
      device, 
      gender, 
      location, 
      sender_name || 'Anonim Stalker', 
      sender_username || null
    );
    res.json({ success: true, message: 'Anonymous message sent successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a user
app.get('/api/messages/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const messages = await db.getMessagesByUserId(userId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Ratings (Submit anonymous ratings)
app.post('/api/rating/submit', async (req, res) => {
  const { recipient_username, style, fake, kibr, comment } = req.body;

  if (!recipient_username) {
    return res.status(400).json({ error: 'Recipient username is required' });
  }

  try {
    const recipient = await db.getUserByUsername(recipient_username);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    await db.addRating(recipient.id, style, fake, kibr, comment);
    res.json({ success: true, message: 'Rating submitted successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ratings average and reviews for a user
app.get('/api/ratings/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const stats = await db.getRatingsStats(userId);
    const reviews = await db.getRatingComments(userId);

    res.json({ stats, reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear/Delete a rating comment (simulating the paid protection feature)
app.post('/api/rating/delete-comment', async (req, res) => {
  const { userId, comment } = req.body;
  try {
    const success = await db.clearRatingComment(userId, comment);
    if (success) {
      res.json({ success: true, message: 'Comment cleared successfully!' });
    } else {
      res.status(404).json({ error: 'Comment not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Crush Matcher
app.post('/api/crush/submit', async (req, res) => {
  const { userId, crush_username } = req.body;

  if (!userId || !crush_username) {
    return res.status(400).json({ error: 'User ID and crush username are required' });
  }

  try {
    await db.addCrush(userId, crush_username);
    const isMatch = await db.checkMutualCrush(userId, crush_username);

    res.json({ success: true, isMatch });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's crushes list
app.get('/api/crushes/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const crushes = await db.getCrushesByUserId(userId);
    res.json(crushes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Referral Check
app.get('/api/referrals/status/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const status = await db.getReferralStatus(userId);
    if (!status) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulated route to add mock referrals easily for testing/demo
app.post('/api/referrals/mock-add', async (req, res) => {
  const { userId } = req.body;
  try {
    const name = await db.addMockReferral(userId);
    if (!name) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: `Added mock referral: ${name}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static frontend files in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback all other routes to index.html for React Router SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start Telegram bot polling
  startBot().catch(err => console.error('Bot startup error:', err));
});
