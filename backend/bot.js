import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'database.json');

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:5173';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Helper to escape HTML tags to prevent Telegram parser errors
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper to make API requests to Telegram
async function sendTelegramRequest(method, payload) {
  console.log(`[Telegram API] Sending request: ${method}...`);
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`[Telegram API] Response for ${method}: SUCCESS`);
    } else {
      console.warn(`[Telegram API] Response for ${method} FAILED:`, data.description);
    }
    return data;
  } catch (err) {
    console.error(`[Telegram API] Error in ${method}:`, err.message);
    return null;
  }
}

// Simple long-polling bot loop to receive Telegram updates
export async function startBot() {
  if (!BOT_TOKEN) {
    console.error('Error: BOT_TOKEN is missing in environment variables.');
    return;
  }

  console.log('Stalker Telegram Bot long-polling initialization...');
  
  // Set the menu button for the Mini App (Non-blocking async call)
  sendTelegramRequest('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Stalker App 🕵️‍♂️',
      web_app: { url: WEBAPP_URL }
    }
  }).then(res => {
    console.log('Menu button registration finished:', res ? res.ok : 'Error');
  });

  let offset = 0;
  console.log('Entering bot updates polling loop...');
  
  // Polling loop
  while (true) {
    try {
      console.log(`[Bot Poll] Fetching updates (offset: ${offset})...`);
      const updatesRes = await sendTelegramRequest('getUpdates', {
        offset: offset,
        timeout: 30,
        allowed_updates: ['message']
      });

      if (updatesRes && updatesRes.ok && updatesRes.result.length > 0) {
        console.log(`[Bot Poll] Received ${updatesRes.result.length} new updates`);
        for (const update of updatesRes.result) {
          offset = update.update_id + 1;
          if (update.message) {
            console.log(`[Bot Poll] Processing message from: ${update.message.from.username || update.message.from.id}`);
            await handleBotMessage(update.message);
          }
        }
      }
    } catch (err) {
      console.error('Error in bot polling loop:', err.message);
    }
    // Small pause to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

// Core Message Handler
async function handleBotMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const fromUser = message.from;

  console.log(`[Bot Message] Chat ID: ${chatId}, Text: "${text}"`);

  if (text.startsWith('/start')) {
    // Check if user came from a referral link: /start ref_xxxx
    const parts = text.split(' ');
    const referralCode = parts.length > 1 ? parts[1] : null;
    console.log(`[Bot Message] Start command detected, referral code: ${referralCode}`);

    // Register or retrieve user in our local database
    let user = await db.getUserById(String(chatId));
    
    if (!user) {
      console.log(`[Bot Message] Creating new user: ${fromUser.first_name}`);
      user = await db.createUser({
        id: String(chatId),
        username: fromUser.username || `user_${chatId}`,
        first_name: fromUser.first_name || 'Stalker User',
        referred_by: referralCode
      });

      // If referred, notify the referrer
      if (referralCode) {
        await notifyReferrer(referralCode, user.first_name);
      }
    } else {
      console.log(`[Bot Message] Existing user found: ${user.first_name}`);
    }

    // Check if URL is localhost (Telegram blocks localhost in inline buttons)
    const isLocalhost = WEBAPP_URL.includes('localhost') || WEBAPP_URL.includes('127.0.0.1');
    const isHttps = WEBAPP_URL.startsWith('https://');

    let welcomeText = `Salom, <b>${escapeHTML(user.first_name)}</b>! 👋\n\n🕵️‍♂️ <b>Stalker</b> botiga xush kelibsiz.\n\nSizni ijtimoiy tarmoqlarda kimlar yashirincha kuzatayotganini, sizga kimlar anonim tarzda sevgi izhor qilayotganini va siz haqingizda nimalar deb o'ylashlarini bilishni xohlaysizmi?\n\n`;
    let payload = {
      chat_id: chatId,
      parse_mode: 'HTML'
    };

    if (isLocalhost) {
      welcomeText += `Lokal sinov rejimi faolligi uchun profil havolasini pastdagi havola orqali oching:\n🔗 <b><a href="${WEBAPP_URL}?id=${chatId}">${WEBAPP_URL}</a></b>`;
    } else {
      welcomeText += `Quyidagi tugmani bosing va o'z profilingiz havolasini ijtimoiy tarmoqlarga (Instagram Story, Telegram) joylashtiring! 👇`;
      payload.reply_markup = {
        inline_keyboard: [
          [
            isHttps
              ? { text: 'Stalker Dashboard 🕵️‍♂️', web_app: { url: `${WEBAPP_URL}?id=${chatId}` } }
              : { text: 'Stalker Dashboard 🕵️‍♂️', url: `${WEBAPP_URL}?id=${chatId}` }
          ]
        ]
      };
    }

    payload.text = welcomeText;
    await sendTelegramRequest('sendMessage', payload);
  } else {
    const isLocalhost = WEBAPP_URL.includes('localhost') || WEBAPP_URL.includes('127.0.0.1');
    const isHttps = WEBAPP_URL.startsWith('https://');
    let fallbackText = `Ilovani ochish va stalkerlaringizni ko'rish uchun `;
    let payload = {
      chat_id: chatId,
      parse_mode: 'HTML'
    };

    if (isLocalhost) {
      fallbackText += `pastdagi havolani bosing:\n🔗 <b><a href="${WEBAPP_URL}?id=${chatId}">${WEBAPP_URL}</a></b>`;
    } else {
      fallbackText += `pastdagi <b>Stalker App 🕵️‍♂️</b> tugmasini bosing!`;
      payload.reply_markup = {
        inline_keyboard: [
          [
            isHttps
              ? { text: 'Appni ochish 📱', web_app: { url: `${WEBAPP_URL}?id=${chatId}` } }
              : { text: 'Appni ochish 📱', url: `${WEBAPP_URL}?id=${chatId}` }
          ]
        ]
      };
    }

    payload.text = fallbackText;
    await sendTelegramRequest('sendMessage', payload);
  }
}

// Notify referrer when someone uses their link
async function notifyReferrer(referralCode, newFriendName) {
  try {
    const users = await readUsersRaw();
    
    const referrer = users.find(u => u.referral_code === referralCode);
    if (referrer) {
      // Find how many referrals they have now
      const referrals = users.filter(u => u.referred_by === referralCode);
      const count = referrals.length;
      const left = Math.max(3 - count, 0);

      console.log(`[Referral] Notifying referrer ${referrer.first_name} (ID: ${referrer.id}) about new referral: ${newFriendName}`);

      let notifyText = `👤 Do'stingiz <b>${escapeHTML(newFriendName)}</b> sizning taklifnomangiz orqali botga qo'shildi!\n\nJami takliflar: <b>${count}/3</b>.\n`;
      if (left > 0) {
        notifyText += `Stalkerlarni to'liq fosh qilish uchun yana <b>${left}</b> ta do'st taklif qiling!`;
      } else {
        notifyText += `🎉 Tabriklaymiz! Stalkerlaringiz ro'yxati to'liq fosh qilindi! Ilovaga kirib ko'rishingiz mumkin.`;
      }

      await sendTelegramRequest('sendMessage', {
        chat_id: referrer.id,
        text: notifyText,
        parse_mode: 'HTML'
      });
    }
  } catch (err) {
    console.error('Error notifying referrer:', err);
  }
}

// Helper to quickly scan users directly from JSON
async function readUsersRaw() {
  try {
    const data = await fs.readFile(dbFilePath, 'utf8');
    return JSON.parse(data).users || [];
  } catch {
    return [];
  }
}
