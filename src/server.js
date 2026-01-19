const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Sökvägar till data (persistent på Fly.io)
const DATA_DIR = path.join(__dirname, '..', 'data');
const TRAININGS_FILE = path.join(DATA_DIR, 'trainings.json');
const EXERCISES_FILE = path.join(DATA_DIR, 'exercises.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');

// Skapa mappar om de inte finns
[DATA_DIR, UPLOADS_DIR, IMAGES_DIR, VIDEOS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Filuppladdning - konfiguration
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
  limits: { fileSize: 100 * 1024 * 1024 }, // Max 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Otillåten filtyp'));
    }
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
if (!fs.existsSync(TRAININGS_FILE)) {
  writeJSON(TRAININGS_FILE, []);
}
if (!fs.existsSync(EXERCISES_FILE)) {
  writeJSON(EXERCISES_FILE, []);
}

// ============ API ROUTES ============

// Hämta alla träningar
app.get('/api/trainings', (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  res.json(trainings);
});

// Hämta en specifik träning
app.get('/api/trainings/:id', (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  const training = trainings.find(t => t.id === req.params.id);
  if (!training) {
    return res.status(404).json({ error: 'Träning hittades inte' });
  }
  res.json(training);
});

// Skapa ny träning
app.post('/api/trainings', (req, res) => {
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

// Uppdatera träning
app.put('/api/trainings/:id', (req, res) => {
  const trainings = readJSON(TRAININGS_FILE);
  const index = trainings.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Träning hittades inte' });
  }
  trainings[index] = { ...trainings[index], ...req.body };
  writeJSON(TRAININGS_FILE, trainings);
  res.json(trainings[index]);
});

// Ta bort träning
app.delete('/api/trainings/:id', (req, res) => {
  let trainings = readJSON(TRAININGS_FILE);
  trainings = trainings.filter(t => t.id !== req.params.id);
  writeJSON(TRAININGS_FILE, trainings);
  res.json({ success: true });
});

// Hämta alla övningar
app.get('/api/exercises', (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  res.json(exercises);
});

// Hämta en specifik övning
app.get('/api/exercises/:id', (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  const exercise = exercises.find(e => e.id === req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Övning hittades inte' });
  }
  res.json(exercise);
});

// Skapa ny övning
app.post('/api/exercises', (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  const newExercise = {
    id: Date.now().toString(),
    name: req.body.name,
    description: req.body.description || '',
    images: req.body.images || [],
    video: req.body.video || null,
    createdAt: new Date().toISOString()
  };
  exercises.push(newExercise);
  writeJSON(EXERCISES_FILE, exercises);
  res.status(201).json(newExercise);
});

// Uppdatera övning
app.put('/api/exercises/:id', (req, res) => {
  const exercises = readJSON(EXERCISES_FILE);
  const index = exercises.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Övning hittades inte' });
  }
  exercises[index] = { ...exercises[index], ...req.body };
  writeJSON(EXERCISES_FILE, exercises);
  res.json(exercises[index]);
});

// Ta bort övning
app.delete('/api/exercises/:id', (req, res) => {
  let exercises = readJSON(EXERCISES_FILE);
  exercises = exercises.filter(e => e.id !== req.params.id);
  writeJSON(EXERCISES_FILE, exercises);
  res.json({ success: true });
});

// Ladda upp fil (bild eller video)
app.post('/api/upload', upload.single('file'), (req, res) => {
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

// ============ HTML ROUTES ============

// Startsida - Kalender
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin-sida
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Starta servern
app.listen(PORT, () => {
  console.log(`\n🏃 Träningsappen körs på http://localhost:${PORT}`);
  console.log(`📋 Admin-sida: http://localhost:${PORT}/admin`);
  console.log(`\nTryck Ctrl+C för att stänga servern\n`);
});
