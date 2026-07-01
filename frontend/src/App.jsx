import React, { useState, useEffect } from 'react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5001/api'
  : '/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'ratings', 'crush'
  const [messages, setMessages] = useState([]);
  const [ratingsStats, setRatingsStats] = useState({ avg_style: 0, avg_fake: 0, avg_kibr: 0, total_votes: 0 });
  const [ratingComments, setRatingComments] = useState([]);
  const [crushes, setCrushes] = useState([]);
  const [referralStatus, setReferralStatus] = useState({ referral_code: '', referrals: [], count: 0, unlocked: false });
  
  // Visitor view state
  const [visitorMode, setVisitorMode] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [targetUser, setTargetUser] = useState(null);

  // Form states
  const [confessionText, setConfessionText] = useState('');
  const [rateStyle, setRateStyle] = useState(5);
  const [rateFake, setRateFake] = useState(5);
  const [rateKibr, setRateKibr] = useState(5);
  const [rateComment, setRateComment] = useState('');
  const [crushInput, setCrushInput] = useState('');
  
  // UI states
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [matchNotification, setMatchNotification] = useState(false);

  // Telegram WebApp Setup & Mock User Initialization
  useEffect(() => {
    let tgUser = null;
    let startParam = null;

    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tgUser = tg.initDataUnsafe.user;
      }
      if (tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
        startParam = tg.initDataUnsafe.start_param;
      }
    }

    // Parse URL params for testing in normal browser
    const urlParams = new URLSearchParams(window.location.search);
    const toParam = urlParams.get('to');
    const startQuery = urlParams.get('start');
    
    if (toParam) {
      setVisitorMode(true);
      setTargetUsername(toParam);
      fetchTargetUser(toParam);
    } else if (startParam || startQuery) {
      // Visited through bot referral link
      const refCode = startParam || startQuery;
      initializeUser(tgUser, refCode);
    } else {
      initializeUser(tgUser, null);
    }
  }, []);

  // Fetch data when currentUser changes
  useEffect(() => {
    if (currentUser && !visitorMode) {
      fetchUserData();
      // Poll referral status and messages periodically
      const interval = setInterval(fetchUserData, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser, visitorMode]);

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 4000);
  };

  const initializeUser = async (tgUser, referredBy) => {
    // If not in Telegram, generate mock user details
    const userPayload = {
      id: tgUser ? String(tgUser.id) : 'tg_1234567',
      username: tgUser?.username || 'madina_wiut',
      first_name: tgUser?.first_name || 'Madina',
      referred_by: referredBy
    };

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload)
      });
      const data = await res.json();
      setCurrentUser(data);
    } catch (err) {
      console.error('Error registering user:', err);
      // Fallback local mock state for completely offline testing
      setCurrentUser({
        id: userPayload.id,
        username: userPayload.username,
        first_name: userPayload.first_name,
        referral_code: 'ref_mock123'
      });
    }
  };

  const fetchTargetUser = async (username) => {
    try {
      const res = await fetch(`${API_BASE}/user/${username}`);
      if (res.ok) {
        const data = await res.json();
        setTargetUser(data);
      } else {
        showStatus('error', 'Foydalanuvchi topilmadi');
      }
    } catch (err) {
      console.error('Error fetching target user:', err);
    }
  };

  const fetchUserData = async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch messages
      const msgsRes = await fetch(`${API_BASE}/messages/${currentUser.id}`);
      const msgsData = await msgsRes.json();
      setMessages(msgsData);

      // 2. Fetch ratings
      const ratingsRes = await fetch(`${API_BASE}/ratings/${currentUser.id}`);
      const ratingsData = await ratingsRes.json();
      setRatingsStats(ratingsData.stats || { avg_style: 0, avg_fake: 0, avg_kibr: 0, total_votes: 0 });
      setRatingComments(ratingsData.reviews || []);

      // 3. Fetch crushes
      const crushRes = await fetch(`${API_BASE}/crushes/${currentUser.id}`);
      const crushData = await crushRes.json();
      setCrushes(crushData);

      // 4. Fetch referrals status
      const refRes = await fetch(`${API_BASE}/referrals/status/${currentUser.id}`);
      const refData = await refRes.json();
      setReferralStatus(refData);
    } catch (err) {
      console.error('Error fetching user dashboard data:', err);
    }
  };

  // Submit anonymous confession/message
  const handleSendConfession = async (e) => {
    e.preventDefault();
    if (!confessionText.trim()) return;

    const devices = ['iPhone 15 Pro', 'Samsung S24', 'iPhone 13', 'Redmi Note 12', 'iPhone 11'];
    const locations = ['Chilonzor', 'Yunusobod', 'Mirzo Ulug‘bek', 'Yakkasaroy', 'Sergeli', 'Shayxontohur'];
    const randomDevice = devices[Math.floor(Math.random() * devices.length)];
    const randomLoc = locations[Math.floor(Math.random() * locations.length)];

    try {
      const res = await fetch(`${API_BASE}/message/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_username: targetUsername,
          content: confessionText,
          device: randomDevice,
          location: randomLoc
        })
      });

      if (res.ok) {
        showStatus('success', 'Anonim xabaringiz yuborildi!');
        setConfessionText('');
      } else {
        showStatus('error', 'Yuborishda xatolik yuz berdi');
      }
    } catch (err) {
      showStatus('error', 'Server bilan aloqa yo‘q');
    }
  };

  // Submit anonymous rating
  const handleSendRating = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/rating/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_username: targetUsername,
          style: rateStyle,
          fake: rateFake,
          kibr: rateKibr,
          comment: rateComment
        })
      });

      if (res.ok) {
        showStatus('success', 'Reyting muvaffaqiyatli yuborildi!');
        setRateComment('');
        setRateStyle(5);
        setRateFake(5);
        setRateKibr(5);
      } else {
        showStatus('error', 'Reyting yuborishda xatolik yuz berdi');
      }
    } catch (err) {
      showStatus('error', 'Server bilan aloqa yo‘q');
    }
  };

  // Submit crush
  const handleAddCrush = async (e) => {
    e.preventDefault();
    if (!crushInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/crush/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          crush_username: crushInput
        })
      });
      const data = await res.json();

      if (res.ok) {
        setCrushInput('');
        fetchUserData();
        if (data.isMatch) {
          setMatchNotification(true);
          showStatus('success', 'YAY! Moslik (Match) topildi!');
        } else {
          showStatus('success', 'Crush qo‘shildi! Agar u ham sizni qo‘shsa, fosh qilamiz!');
        }
      }
    } catch (err) {
      showStatus('error', 'Server bilan aloqa yo‘q');
    }
  };

  // Clear a negative rating comment (simulated paywall protection)
  const handleDeleteComment = async (comment) => {
    try {
      const res = await fetch(`${API_BASE}/rating/delete-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          comment
        })
      });

      if (res.ok) {
        showStatus('success', 'Izoh o‘chirildi!');
        fetchUserData();
      }
    } catch (err) {
      showStatus('error', 'Xatolik yuz berdi');
    }
  };

  // Simulate adding a referral (Growth hacking demo testing)
  const simulateReferral = async () => {
    try {
      const res = await fetch(`${API_BASE}/referrals/mock-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        const data = await res.json();
        showStatus('success', data.message);
        fetchUserData();
      }
    } catch (err) {
      showStatus('error', 'Mock referral ulanmadi');
    }
  };

  const getInstagramLink = () => {
    if (!currentUser) return '';
    return `${window.location.origin}/?to=${currentUser.username}`;
  };

  const getInviteLink = () => {
    if (!currentUser) return '';
    return `https://t.me/stalker_fow_bot?start=ref_${currentUser.referral_code}`;
  };

  const handleCopyInstagramLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(getInstagramLink());
      showStatus('success', 'Instagram havolasi nusxalandi! Stories-ga joylang 📸');
    } else {
      showStatus('error', 'Havola nusxalab bo\'lmadi, uni qo\'lda nusxalang');
    }
  };

  const handleCopyInviteLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(getInviteLink());
      showStatus('success', 'Taklif havolasi nusxalandi! 👥');
    } else {
      showStatus('error', 'Havola nusxalab bo\'lmadi, uni qo\'lda nusxalang');
    }
  };

  // Visitor Mode render
  if (visitorMode) {
    return (
      <div className="visitor-container">
        <div className="send-header">
          <div className="send-avatar">🕵️‍♂️</div>
          <h1>{targetUser ? targetUser.first_name : 'Kuzatuv'}</h1>
          <div className="username-tag">@{targetUsername}</div>
          <p>Siz bu foydalanuvchining anonim "Stalker" sahifasidasiz. Uni fosh qilmasdan xabar yozing yoki unga baho bering!</p>
        </div>

        <div className="tabs-content">
          {statusMessage.text && (
            <div className={statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}>
              {statusMessage.text}
            </div>
          )}

          <div className="send-card">
            <h2>💌 Anonim E'tirof yozish</h2>
            <form onSubmit={handleSendConfession} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="input-group">
                <textarea
                  className="input-field textarea-field"
                  placeholder="Bu yerga anonim xat yoki e'tirofingizni yozing..."
                  value={confessionText}
                  onChange={(e) => setConfessionText(e.target.value)}
                  maxLength={300}
                  required
                />
              </div>
              <button type="submit" className="submit-btn">Xabarni yuborish (Anonim)</button>
            </form>
          </div>

          <div className="send-card">
            <h2>📊 Profilni anonim baholash</h2>
            <form onSubmit={handleSendRating} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="slider-group">
                <div className="slider-item">
                  <div className="slider-header">
                    <span>Kiyim kiyishi (Style)</span>
                    <span>{rateStyle}/10</span>
                  </div>
                  <input
                    type="range" min="1" max="10"
                    className="slider-input"
                    value={rateStyle}
                    onChange={(e) => setRateStyle(e.target.value)}
                  />
                </div>

                <div className="slider-item">
                  <div className="slider-header">
                    <span>Soxtalik darajasi (Fake Level)</span>
                    <span>{rateFake}/10</span>
                  </div>
                  <input
                    type="range" min="1" max="10"
                    className="slider-input"
                    value={rateFake}
                    onChange={(e) => setRateFake(e.target.value)}
                  />
                </div>

                <div className="slider-item">
                  <div className="slider-header">
                    <span>Kibrliligi (Kasal darajasi)</span>
                    <span>{rateKibr}/10</span>
                  </div>
                  <input
                    type="range" min="1" max="10"
                    className="slider-input"
                    value={rateKibr}
                    onChange={(e) => setRateKibr(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <input
                  type="text"
                  className="input-field"
                  placeholder="U haqida biror izoh qoldiring (ixtiyoriy)"
                  value={rateComment}
                  onChange={(e) => setRateComment(e.target.value)}
                  maxLength={100}
                />
              </div>

              <button type="submit" className="submit-btn" style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))', boxShadow: 'var(--glow-cyan)' }}>
                Baholashni yuborish
              </button>
            </form>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
          <a href="/index.html" className="back-to-home-link" onClick={() => setVisitorMode(false)}>
            🏠 O'z Stalker profilingizni yaratish
          </a>
        </div>
      </div>
    );
  }

  // Dashboard Owner View
  return (
    <div>
      {/* Simulation/Demo Bar for Testing */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderBottom: '1px solid var(--border-color)',
        padding: '10px 15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px'
      }}>
        <span>🛠 Demo Panel:</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={simulateReferral} style={{
            background: 'rgba(0, 240, 255, 0.2)',
            border: '1px solid var(--accent-cyan)',
            color: 'white',
            padding: '3px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            👥 +1 referral qo'shish
          </button>
          <button onClick={() => {
            const user = currentUser?.username || 'madina_wiut';
            window.location.search = `?to=${user}`;
          }} style={{
            background: 'rgba(255, 0, 127, 0.2)',
            border: '1px solid var(--accent-secondary)',
            color: 'white',
            padding: '3px 8px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            👁 Visitor rejimiga o'tish
          </button>
        </div>
      </div>

      <header className="app-header">
        <h1>🕵️‍♂️ Stalker Dashboard</h1>
        <div className="profile-card">
          <div className="profile-info">
            <div className="avatar-ring">
              {currentUser?.first_name ? currentUser.first_name[0] : 'S'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3>{currentUser?.first_name || 'Yuklanmoqda...'}</h3>
              <span className="username-tag">@{currentUser?.username || 'user'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px', width: '100%', textAlign: 'left' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--accent-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                📸 Instagram Story uchun havola (Anonim xabarlar to'plash):
              </span>
              <div className="share-link-box" style={{ marginTop: '0' }}>
                <span className="share-link-text">{getInstagramLink() || 'Yuklanmoqda...'}</span>
                <button className="copy-btn" onClick={handleCopyInstagramLink}>Nusxalash</button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                👥 Do'stlarni taklif qilish (Referral) havolasi:
              </span>
              <div className="share-link-box" style={{ marginTop: '0' }}>
                <span className="share-link-text">{getInviteLink() || 'Yuklanmoqda...'}</span>
                <button className="copy-btn" onClick={handleCopyInviteLink}>Nusxalash</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="tabs-content">
        {statusMessage.text && (
          <div className={statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}>
            {statusMessage.text}
          </div>
        )}

        {matchNotification && (
          <div className="match-banner">
            <h3>🎉 BINGO! MUTUAL CRUSH MATCH! 🎉</h3>
            <p>Siz qo'shgan crush'lardan biri ham sizni o'zining Crush Ro'yxatiga qo'shgan!</p>
            <button
              onClick={() => setMatchNotification(false)}
              className="copy-btn"
              style={{ marginTop: '10px', background: 'white', color: 'black' }}
            >
              Yopish
            </button>
          </div>
        )}

        {/* Tab 1: Inbox */}
        {activeTab === 'inbox' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h2>💌 Sizga kelgan xabarlar (Stalkerlar)</h2>
            
            {messages.length === 0 ? (
              <div className="empty-state">
                <svg className="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
                <p>Hozircha hech qanday maxfiy xabar kelmadi. Linkni Instagram hikoyangizga qo'ying!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div className="message-card" key={msg.id} onClick={() => setShowReferralModal(true)}>
                  <div className="message-header">
                    <span className="message-tag">Stalker #{messages.length - index}</span>
                    <span className="message-time">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Blurr body if not unlocked via referrals */}
                  <div className="message-body" style={{
                    filter: referralStatus.unlocked ? 'none' : 'blur(4px)',
                    userSelect: referralStatus.unlocked ? 'auto' : 'none'
                  }}>
                    {referralStatus.unlocked ? msg.content : "Ushbu maxfiy xabarni o'qish uchun stalker kimligini ochish kerak."}
                  </div>

                  <div className="message-footer">
                    <div className="footer-item">
                      📱 <span>{msg.device}</span>
                    </div>
                    <div className="footer-item">
                      📍 <span>{msg.location}</span>
                    </div>
                  </div>

                  {!referralStatus.unlocked && (
                    <button className="submit-btn" style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      marginTop: '5px',
                      alignSelf: 'flex-start'
                    }}>
                      Stalker kimligini aniqlash 🕵️‍♂️
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Ratings */}
        {activeTab === 'ratings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2>📊 Do'stlaringiz bergan reytinglar</h2>

            <div className="ratings-grid">
              <div className="rating-stat-card">
                <span className="stat-label">Kiyinishi</span>
                <span className="stat-value purple">{ratingsStats.avg_style}</span>
              </div>
              <div className="rating-stat-card">
                <span className="stat-label">Soxtalik</span>
                <span className="stat-value pink">{ratingsStats.avg_fake}</span>
              </div>
              <div className="rating-stat-card">
                <span className="stat-label">Kibr (Kasal)</span>
                <span className="stat-value cyan">{ratingsStats.avg_kibr}</span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              padding: '12px',
              borderRadius: '12px',
              textAlign: 'center',
              fontSize: '13px'
            }}>
              Jami ovoz berganlar: <strong>{ratingsStats.total_votes} kishi</strong>
            </div>

            <h2>💬 Do'stlaringiz fikrlari (Rants)</h2>
            <div className="review-list">
              {ratingComments.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>Hozircha hech qanday sharh yozilmadi.</p>
              ) : (
                ratingComments.map((rev, index) => (
                  <div className="review-card" key={index}>
                    <div className="review-card-header">
                      <span>Anonim fikr</span>
                      <button
                        className="delete-comment-btn"
                        onClick={() => handleDeleteComment(rev.comment)}
                      >
                        O‘chirish 🚫 (Simulyatsiya)
                      </button>
                    </div>
                    <p style={{ color: 'white', fontStyle: 'italic' }}>"{rev.comment}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Crush */}
        {activeTab === 'crush' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2>❤️ Yashirin Crush Matcher</h2>
            <p>Siz yashirincha yoqtiradigan 3 ta yigit yoki qizning Telegram username'larini qo'shing. Agar ulardan biri ham sizni qo'shsa, ikkingizga ham fosh qilamiz!</p>

            <div className="crush-form-container">
              <form onSubmit={handleAddCrush} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="input-group">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Telegram username (masalan: sardor_99)"
                    value={crushInput}
                    onChange={(e) => setCrushInput(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={crushes.length >= 3}>
                  {crushes.length >= 3 ? "Limit to'lgan (Maks 3 ta)" : "Crush qo'shish"}
                </button>
              </form>
            </div>

            <h2>Siz qo'shgan Crush ro'yxati ({crushes.length}/3)</h2>
            <div className="crush-list">
              {crushes.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '20px' }}>Hozircha ro'yxat bo'sh.</p>
              ) : (
                crushes.map((crush, index) => (
                  <div className="crush-card" key={index}>
                    <span className="crush-username">@{crush.crush_username}</span>
                    <span className="crush-status">Tasdiqlanish kutilmoqda...</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Referral Lock Modal */}
      {showReferralModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-icon-container">
              <svg className="modal-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h2>Stalkerlar yopiq! 🔐</h2>
            <p>Sizga kim yozganini yoki baho berganini bilish uchun botga kamida **3 ta do'stingizni** taklif qilishingiz kerak!</p>

            <div className="referral-progress-container">
              <div className="progress-stats">
                <span>Taklif etilgan do'stlar:</span>
                <span>{referralStatus.count} / 3</span>
              </div>
              <div className="referral-progress-bar-bg">
                <div className="referral-progress-bar-fill" style={{
                  width: `${Math.min((referralStatus.count / 3) * 100, 100)}%`
                }} />
              </div>
            </div>

            {referralStatus.count > 0 && (
              <div className="referral-list-preview">
                {referralStatus.referrals.map((name, i) => (
                  <div className="ref-row" key={i}>
                    <span>👤 {name}</span>
                    <span>Qo'shildi ✅</span>
                  </div>
                ))}
              </div>
            )}

            <button className="submit-btn" onClick={handleCopyLink}>
              Ssilkani nusxalash va Ulashish 🔗
            </button>

            <button className="close-modal-btn" onClick={() => setShowReferralModal(false)}>
              Yopish
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="nav-bar">
        <button
          className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveTab('inbox')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          Stalkerlar
        </button>

        <button
          className={`nav-item ${activeTab === 'ratings' ? 'active' : ''}`}
          onClick={() => setActiveTab('ratings')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 14H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V7h9v2z"/>
          </svg>
          Reyting
        </button>

        <button
          className={`nav-item ${activeTab === 'crush' ? 'active' : ''}`}
          onClick={() => setActiveTab('crush')}
        >
          <svg className="nav-icon" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          Crush
        </button>
      </nav>
    </div>
  );
}
