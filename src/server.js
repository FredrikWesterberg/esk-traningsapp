const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Sökvägar till data
const DATA_DIR = path.join(__dirname, '..', 'data');
const TRAININGS_FILE = path.join(DATA_DIR, 'trainings.json');
const EXERCISES_FILE = path.join(DATA_DIR, 'exercises.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INVITES_FILE = path.join(DATA_DIR, 'invites.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');

// Skapa mappar om de inte finns
[DATA_DIR, UPLOADS_DIR, IMAGES_DIR, VIDEOS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Hjälpfunktioner för att läsa/skriva JSON
function readJSON(filepath) {
  if (!fs.existsSync(filepath)) {
    return [];
  }
  const data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data);
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// Initiera datafiler om de inte finns
if (!fs.existsSync(TRAININGS_FILE)) writeJSON(TRAININGS_FILE, []);
if (!fs.existsSync(EXERCISES_FILE)) writeJSON(EXERCISES_FILE, []);
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(INVITES_FILE)) writeJSON(INVITES_FILE, []);

// Skapa initial inbjudningskod om det inte finns några användare
const users = readJSON(USERS_FILE);
const invites = readJSON(INVITES_FILE);
const hasAvailableInvite = invites.some(i => !i.usedBy);

if (users.length === 0 && !hasAvailableInvite) {
  const initialInvite = {
    id: 'initial',
    code: 'ESKADMIN1',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    usedBy: null,
    usedAt: null
  };
  invites.push(initialInvite);
  writeJSON(INVITES_FILE, invites);
  console.log('Initial inbjudningskod skapad: ESKADMIN1');
}

// Middleware
app.set('trust proxy', 1); // Trust first proxy (Render)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'esk-traning-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !!process.env.RENDER,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dagar
    sameSite: 'lax'
  }
}));

// Statiska filer (men skyddade routes hanteras separat)
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ============ AUTH MIDDLEWARE ============

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === req.session.userId);
    if (user) {
      req.user = user;
      return next();
    }
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Ej inloggad' });
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Admin-behörighet krävs' });
  }
  res.redirect('/');
}

// ============ AUTH ROUTES ============

// Visa login-sida
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Visa registrerings-sida
app.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Login API
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-post och lösenord krävs' });
  }

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Felaktig e-post eller lösenord' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Felaktig e-post eller lösenord' });
  }

  req.session.userId = user.id;
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Registrering API
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, inviteCode } = req.body;

  if (!name || !email || !password || !inviteCode) {
    return res.status(400).json({ error: 'Alla fält krävs' });
  }

  // Kolla inbjudningskod
  const invites = readJSON(INVITES_FILE);
  const invite = invites.find(i => i.code === inviteCode && !i.usedBy);

  if (!invite) {
    return res.status(400).json({ error: 'Ogiltig eller redan använd inbjudningskod' });
  }

  // Kolla om e-post redan finns
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'E-postadressen är redan registrerad' });
  }

  // Skapa användare
  const hashedPassword = await bcrypt.hash(password, 10);
  const isFirstUser = users.length === 0;

  const newUser = {
    id: Date.now().toString(),
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: isFirstUser ? 'admin' : 'user', // Första användaren blir admin
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);

  // Markera inbjudan som använd
  invite.usedBy = newUser.id;
  invite.usedAt = new Date().toISOString();
  writeJSON(INVITES_FILE, invites);

  // Logga in direkt
  req.session.userId = newUser.id;
  res.status(201).json({ success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Hämta nuvarande användare
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
});

// ============ INVITE ROUTES (Admin only) ============

// Hämta alla inbjudningar
app.get('/api/invites', requireAuth, requireAdmin, (req, res) => {
  const invites = readJSON(INVITES_FILE);
  const users = readJSON(USERS_FILE);

  // Lägg till användarnamn för använda inbjudningar
  const invitesWithUser = invites.map(invite => {
    if (invite.usedBy) {
      const user = users.find(u => u.id === invite.usedBy);
      return { ...invite, usedByName: user ? user.name : 'Okänd' };
    }
    return invite;
  });

  res.json(invitesWithUser);
});

// Skapa ny inbjudningskod
app.post('/api/invites', requireAuth, requireAdmin, (req, res) => {
  const invites = readJSON(INVITES_FILE);

  // Generera en slumpmässig 8-teckens kod
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const newInvite = {
    id: Date.now().toString(),
    code,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    usedBy: null,
    usedAt: null
  };

  invites.push(newInvite);
  writeJSON(INVITES_FILE, invites);
  res.status(201).json(newInvite);
});

// Ta bort inbjudningskod
app.delete('/api/invites/:id', requireAuth, requireAdmin, (req, res) => {
  let invites = readJSON(INVITES_FILE);
  invites = invites.filter(i => i.id !== req.params.id);
  writeJSON(INVITES_FILE, invites);
  res.json({ success: true });
});

// ============ USER MANAGEMENT ROUTES (Admin only) ============

// Hämta alla användare
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = readJSON(USERS_FILE);
  // Skicka inte lösenord
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt
  }));
  res.json(safeUsers);
});

// Uppdatera användares roll
app.put('/api/users/:id/role', requireAuth, requireAdmin, (req, res) => {
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Ogiltig roll' });
  }

  const users = readJSON(USERS_FILE);
  const index = users.findIndex(u => u.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Användare hittades inte' });
  }

  // Förhindra att ta bort sin egen admin-roll
  if (req.params.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Du kan inte ta bort din egen admin-behörighet' });
  }

  users[index].role = role;
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

// Ta bort användare
app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Du kan inte ta bort dig själv' });
  }

  let users = readJSON(USERS_FILE);
  users = users.filter(u => u.id !== req.params.id);
  writeJSON(USERS_FILE, users);
  res.json({ success: true });
});

// ============ FILUPPLADDNING ============

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVideo = file.mimetype.startsWith('video/');
    const folder = isVideo ? VIDEOS_DIR : IMAGES_DIR;
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Otillåten filtyp'));
    }
  }
});

// ============ PROTECTED API ROUTES ============

// Hämta alla träningar
app.get('/api/trainings', requireAuth, (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  res.json(trainings);
});

// Hämta en specifik träning
app.get('/api/trainings/:id', requireAuth, (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  const training = trainings.find(t => t.id === req.params.id);
  if (!training) {
    return res.status(404).json({ error: 'Träning hittades inte' });
  }
  res.json(training);
});

// Skapa ny träning (admin only)
app.post('/api/trainings', requireAuth, requireAdmin, (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  const newTraining = {
    id: Date.now().toString(),
    date: req.body.date,
    time: req.body.time,
    location: req.body.location || '',
    description: req.body.description || '',
    exerciseIds: req.body.exerciseIds || [],
    createdAt: new Date().toISOString()
  };
  trainings.push(newTraining);
  writeJSON(TRAININGS_FILE, trainings);
  res.status(201).json(newTraining);
});

// Uppdatera träning (admin only)
app.put('/api/trainings/:id', requireAuth, requireAdmin, (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  const index = trainings.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Träning hittades inte' });
  }
  trainings[index] = { ...trainings[index], ...req.body };
  writeJSON(TRAININGS_FILE, trainings);
  res.json(trainings[index]);
});

// Ta bort träning (admin only)
app.delete('/api/trainings/:id', requireAuth, requireAdmin, (req, res) => {
  let trainings = readJSON(TRAININGS_FILE);
  trainings = trainings.filter(t => t.id !== req.params.id);
  writeJSON(TRAININGS_FILE, trainings);
  res.json({ success: true });
});

// Hämta alla övningar
app.get('/api/exercises', requireAuth, (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  res.json(exercises);
});

// Hämta en specifik övning
app.get('/api/exercises/:id', requireAuth, (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  const exercise = exercises.find(e => e.id === req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Övning hittades inte' });
  }
  res.json(exercise);
});

// Skapa ny övning (admin only)
app.post('/api/exercises', requireAuth, requireAdmin, (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  const newExercise = {
    id: Date.now().toString(),
    name: req.body.name,
    description: req.body.description || '',
    images: req.body.images || [],
    video: req.body.video || null,
    youtubeUrl: req.body.youtubeUrl || null,
    createdAt: new Date().toISOString()
  };
  exercises.push(newExercise);
  writeJSON(EXERCISES_FILE, exercises);
  res.status(201).json(newExercise);
});

// Uppdatera övning (admin only)
app.put('/api/exercises/:id', requireAuth, requireAdmin, (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  const index = exercises.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Övning hittades inte' });
  }
  exercises[index] = { ...exercises[index], ...req.body };
  writeJSON(EXERCISES_FILE, exercises);
  res.json(exercises[index]);
});

// Ta bort övning (admin only)
app.delete('/api/exercises/:id', requireAuth, requireAdmin, (req, res) => {
  let exercises = readJSON(EXERCISES_FILE);
  exercises = exercises.filter(e => e.id !== req.params.id);
  writeJSON(EXERCISES_FILE, exercises);
  res.json({ success: true });
});

// Ladda upp fil (admin only)
app.post('/api/upload', requireAuth, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Ingen fil uppladdad' });
  }
  const isVideo = req.file.mimetype.startsWith('video/');
  const folder = isVideo ? 'videos' : 'images';
  res.json({
    filename: req.file.filename,
    path: `/uploads/${folder}/${req.file.filename}`,
    type: isVideo ? 'video' : 'image'
  });
});

// ============ PROTECTED HTML ROUTES ============

// Startsida - Kalender
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin-sida
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Starta servern
app.listen(PORT, () => {
  console.log(`\n🏃 Träningsappen körs på http://localhost:${PORT}`);
  console.log(`📋 Admin-sida: http://localhost:${PORT}/admin`);
  console.log(`\nTryck Ctrl+C för att stänga servern\n`);
});
