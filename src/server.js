const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { sequelize, User, Invite, Training, Exercise, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Sökvägar för filer (uploads behålls lokalt)
const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');

// Skapa mappar för uppladdningar om de inte finns
[DATA_DIR, UPLOADS_DIR, IMAGES_DIR, VIDEOS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session med PostgreSQL-lagring
app.use(session({
  store: new pgSession({
    pool: sequelize.connectionManager.pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
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

// Statiska filer
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ============ AUTH MIDDLEWARE ============

async function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    const user = await User.findByPk(req.session.userId);
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

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-post och lösenord krävs' });
  }

  const user = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      email.toLowerCase()
    )
  });

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

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, inviteCode } = req.body;

  if (!name || !email || !password || !inviteCode) {
    return res.status(400).json({ error: 'Alla fält krävs' });
  }

  // Kolla inbjudningskod
  const invite = await Invite.findOne({
    where: { code: inviteCode, usedBy: null }
  });

  if (!invite) {
    return res.status(400).json({ error: 'Ogiltig eller redan använd inbjudningskod' });
  }

  // Kolla om e-post redan finns
  const existingUser = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      email.toLowerCase()
    )
  });

  if (existingUser) {
    return res.status(400).json({ error: 'E-postadressen är redan registrerad' });
  }

  // Skapa användare
  const hashedPassword = await bcrypt.hash(password, 10);
  const userCount = await User.count();
  const isFirstUser = userCount === 0;

  const newUser = await User.create({
    id: Date.now().toString(),
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: isFirstUser ? 'admin' : 'user'
  });

  // Markera inbjudan som använd
  await invite.update({
    usedBy: newUser.id,
    usedAt: new Date()
  });

  req.session.userId = newUser.id;
  res.status(201).json({ success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
});

// ============ INVITE ROUTES (Admin only) ============

app.get('/api/invites', requireAuth, requireAdmin, async (req, res) => {
  const invites = await Invite.findAll({ order: [['createdAt', 'DESC']] });

  const invitesWithUser = await Promise.all(invites.map(async invite => {
    const data = invite.toJSON();
    if (data.usedBy) {
      const user = await User.findByPk(data.usedBy);
      data.usedByName = user ? user.name : 'Okänd';
    }
    return data;
  }));

  res.json(invitesWithUser);
});

app.post('/api/invites', requireAuth, requireAdmin, async (req, res) => {
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const newInvite = await Invite.create({
    id: Date.now().toString(),
    code,
    createdBy: req.user.id
  });

  res.status(201).json(newInvite);
});

app.delete('/api/invites/:id', requireAuth, requireAdmin, async (req, res) => {
  await Invite.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============ USER MANAGEMENT ROUTES (Admin only) ============

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.findAll({
    attributes: ['id', 'name', 'email', 'role', 'createdAt'],
    order: [['createdAt', 'DESC']]
  });
  res.json(users);
});

app.put('/api/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Ogiltig roll' });
  }

  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Användare hittades inte' });
  }

  if (req.params.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Du kan inte ta bort din egen admin-behörighet' });
  }

  await user.update({ role });
  res.json({ success: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Du kan inte ta bort dig själv' });
  }

  await User.destroy({ where: { id: req.params.id } });
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

// ============ TRAINING ROUTES ============

app.get('/api/trainings', requireAuth, async (req, res) => {
  const trainings = await Training.findAll({ order: [['date', 'ASC'], ['time', 'ASC']] });
  res.json(trainings);
});

app.get('/api/trainings/:id', requireAuth, async (req, res) => {
  const training = await Training.findByPk(req.params.id);
  if (!training) {
    return res.status(404).json({ error: 'Träning hittades inte' });
  }
  res.json(training);
});

app.post('/api/trainings', requireAuth, requireAdmin, async (req, res) => {
  const newTraining = await Training.create({
    id: Date.now().toString(),
    date: req.body.date,
    time: req.body.time,
    location: req.body.location || '',
    description: req.body.description || '',
    exerciseIds: req.body.exerciseIds || []
  });
  res.status(201).json(newTraining);
});

app.put('/api/trainings/:id', requireAuth, requireAdmin, async (req, res) => {
  const training = await Training.findByPk(req.params.id);
  if (!training) {
    return res.status(404).json({ error: 'Träning hittades inte' });
  }
  await training.update(req.body);
  res.json(training);
});

app.delete('/api/trainings/:id', requireAuth, requireAdmin, async (req, res) => {
  await Training.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ============ EXERCISE ROUTES ============

app.get('/api/exercises', requireAuth, async (req, res) => {
  const exercises = await Exercise.findAll({ order: [['createdAt', 'DESC']] });
  res.json(exercises);
});

app.get('/api/exercises/:id', requireAuth, async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Övning hittades inte' });
  }
  res.json(exercise);
});

app.post('/api/exercises', requireAuth, requireAdmin, async (req, res) => {
  const newExercise = await Exercise.create({
    id: Date.now().toString(),
    name: req.body.name,
    description: req.body.description || '',
    images: req.body.images || [],
    video: req.body.video || null,
    youtubeUrl: req.body.youtubeUrl || null
  });
  res.status(201).json(newExercise);
});

app.put('/api/exercises/:id', requireAuth, requireAdmin, async (req, res) => {
  const exercise = await Exercise.findByPk(req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Övning hittades inte' });
  }
  await exercise.update(req.body);
  res.json(exercise);
});

app.delete('/api/exercises/:id', requireAuth, requireAdmin, async (req, res) => {
  await Exercise.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

// Upload endpoint
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

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============ START SERVER ============

async function startServer() {
  const dbConnected = await initDatabase();

  if (!dbConnected) {
    console.error('Kunde inte ansluta till databasen. Servern startar inte.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\nTräningsappen körs på http://localhost:${PORT}`);
    console.log(`Admin-sida: http://localhost:${PORT}/admin`);
    console.log(`\nTryck Ctrl+C för att stänga servern\n`);
  });
}

startServer();
