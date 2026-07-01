import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'database.json');

// Initialize JSON database file if it doesn't exist
async function initDb() {
  try {
    await fs.access(dbFilePath);
  } catch {
    const initialData = {
      users: [],
      messages: [],
      ratings: [],
      crushes: []
    };
    await fs.writeFile(dbFilePath, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Read database data
async function readData() {
  await initDb();
  const data = await fs.readFile(dbFilePath, 'utf8');
  return JSON.parse(data);
}

// Write database data
async function writeData(data) {
  await fs.writeFile(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
}

export const db = {
  // Users
  getUserById: async (id) => {
    const data = await readData();
    return data.users.find(u => u.id === id);
  },

  getUserByUsername: async (username) => {
    const data = await readData();
    const cleanUsername = username.trim().toLowerCase().replace('@', '');
    return data.users.find(u => u.username.toLowerCase() === cleanUsername);
  },

  createUser: async (user) => {
    const data = await readData();
    const referralCode = `ref_${Math.random().toString(36).substring(2, 9)}`;
    const newUser = {
      id: user.id,
      username: user.username || `user_${user.id}`,
      first_name: user.first_name || 'Stalker User',
      referral_code: referralCode,
      referred_by: user.referred_by || null,
      created_at: new Date().toISOString()
    };
    data.users.push(newUser);
    await writeData(data);
    return newUser;
  },

  updateUsername: async (id, username) => {
    const data = await readData();
    const userIndex = data.users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      data.users[userIndex].username = username;
      await writeData(data);
      return data.users[userIndex];
    }
    return null;
  },

  // Messages (Confessions)
  addMessage: async (recipientId, content, device, gender, location, senderName = 'Anonim Stalker', senderUsername = null) => {
    const data = await readData();
    const newMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      recipient_id: recipientId,
      content,
      device: device || 'iPhone',
      gender: gender || 'unknown',
      location: location || 'Toshkent',
      sender_name: senderName,
      sender_username: senderUsername,
      created_at: new Date().toISOString()
    };
    data.messages.push(newMessage);
    await writeData(data);
    return newMessage;
  },

  getMessagesByUserId: async (userId) => {
    const data = await readData();
    return data.messages
      .filter(m => m.recipient_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Ratings
  addRating: async (recipientId, style, fake, kibr, comment) => {
    const data = await readData();
    const newRating = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      recipient_id: recipientId,
      style: parseInt(style) || 5,
      fake: parseInt(fake) || 5,
      kibr: parseInt(kibr) || 5,
      comment: comment || '',
      created_at: new Date().toISOString()
    };
    data.ratings.push(newRating);
    await writeData(data);
    return newRating;
  },

  getRatingsStats: async (userId) => {
    const data = await readData();
    const userRatings = data.ratings.filter(r => r.recipient_id === userId);
    
    if (userRatings.length === 0) {
      return {
        avg_style: 0,
        avg_fake: 0,
        avg_kibr: 0,
        total_votes: 0
      };
    }

    const sumStyle = userRatings.reduce((sum, r) => sum + r.style, 0);
    const sumFake = userRatings.reduce((sum, r) => sum + r.fake, 0);
    const sumKibr = userRatings.reduce((sum, r) => sum + r.kibr, 0);

    return {
      avg_style: parseFloat((sumStyle / userRatings.length).toFixed(1)),
      avg_fake: parseFloat((sumFake / userRatings.length).toFixed(1)),
      avg_kibr: parseFloat((sumKibr / userRatings.length).toFixed(1)),
      total_votes: userRatings.length
    };
  },

  getRatingComments: async (userId) => {
    const data = await readData();
    return data.ratings
      .filter(r => r.recipient_id === userId && r.comment && r.comment.trim() !== '')
      .map(r => ({ comment: r.comment, created_at: r.created_at }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  clearRatingComment: async (userId, comment) => {
    const data = await readData();
    let updated = false;
    data.ratings = data.ratings.map(r => {
      if (r.recipient_id === userId && r.comment === comment) {
        updated = true;
        return { ...r, comment: '' };
      }
      return r;
    });
    if (updated) {
      await writeData(data);
    }
    return updated;
  },

  // Crushes
  addCrush: async (userId, crushUsername) => {
    const data = await readData();
    const cleanCrushUsername = crushUsername.trim().toLowerCase().replace('@', '');
    
    // Avoid duplicates
    const exists = data.crushes.some(c => c.user_id === userId && c.crush_username === cleanCrushUsername);
    if (!exists) {
      data.crushes.push({
        user_id: userId,
        crush_username: cleanCrushUsername,
        created_at: new Date().toISOString()
      });
      await writeData(data);
    }
  },

  checkMutualCrush: async (userId, crushUsername) => {
    const data = await readData();
    const cleanCrushUsername = crushUsername.trim().toLowerCase().replace('@', '');
    const user = data.users.find(u => u.id === userId);
    
    if (!user) return false;
    const cleanUserUsername = user.username.toLowerCase();

    // Check if crush exists as a user in our system
    const crushUser = data.users.find(u => u.username.toLowerCase() === cleanCrushUsername);
    if (!crushUser) return false;

    // Check if the crush user has added this user in their crushes
    return data.crushes.some(c => c.user_id === crushUser.id && c.crush_username === cleanUserUsername);
  },

  getCrushesByUserId: async (userId) => {
    const data = await readData();
    return data.crushes
      .filter(c => c.user_id === userId)
      .map(c => ({ crush_username: c.crush_username, created_at: c.created_at }));
  },

  // Referrals
  getReferralStatus: async (userId) => {
    const data = await readData();
    const user = data.users.find(u => u.id === userId);
    if (!user) return null;

    const referrals = data.users
      .filter(u => u.referred_by === user.referral_code)
      .map(u => u.first_name);

    return {
      referral_code: user.referral_code,
      referrals,
      count: referrals.length,
      unlocked: referrals.length >= 3
    };
  },

  addMockReferral: async (userId) => {
    const data = await readData();
    const user = data.users.find(u => u.id === userId);
    if (!user) return null;

    const mockId = `mock_${Math.random().toString(36).substring(2, 9)}`;
    const mockNames = ['Jahongir', 'Shaxzoda', 'Dilshod', 'Aziza', 'Bekzod', 'Sardor', 'Kamola', 'Ulugbek'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];

    const mockUser = {
      id: mockId,
      username: `mock_user_${mockId}`,
      first_name: randomName,
      referral_code: `ref_${mockId}`,
      referred_by: user.referral_code,
      created_at: new Date().toISOString()
    };

    data.users.push(mockUser);
    await writeData(data);
    return randomName;
  }
};
