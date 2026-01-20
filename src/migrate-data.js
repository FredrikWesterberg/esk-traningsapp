/**
 * Migrations-script för att flytta data från JSON-filer till PostgreSQL
 * Kör: DATABASE_URL=postgres://... node src/migrate-data.js
 */

const fs = require('fs');
const path = require('path');
const { sequelize, User, Invite, Training, Exercise, initDatabase } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INVITES_FILE = path.join(DATA_DIR, 'invites.json');
const TRAININGS_FILE = path.join(DATA_DIR, 'trainings.json');
const EXERCISES_FILE = path.join(DATA_DIR, 'exercises.json');

function readJSON(filepath) {
  if (!fs.existsSync(filepath)) {
    return [];
  }
  const data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data);
}

async function migrate() {
  console.log('Startar datamigrering...\n');

  // Anslut till databasen
  const connected = await initDatabase();
  if (!connected) {
    console.error('Kunde inte ansluta till databasen.');
    process.exit(1);
  }

  // Migrera användare
  const users = readJSON(USERS_FILE);
  console.log(`Migrerar ${users.length} användare...`);
  for (const user of users) {
    try {
      await User.findOrCreate({
        where: { id: user.id },
        defaults: {
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          createdAt: user.createdAt
        }
      });
    } catch (err) {
      console.error(`  Fel vid migrering av användare ${user.email}:`, err.message);
    }
  }
  console.log('  Användare klart!\n');

  // Migrera inbjudningar
  const invites = readJSON(INVITES_FILE);
  console.log(`Migrerar ${invites.length} inbjudningar...`);
  for (const invite of invites) {
    try {
      await Invite.findOrCreate({
        where: { id: invite.id },
        defaults: {
          code: invite.code,
          createdBy: invite.createdBy,
          usedBy: invite.usedBy,
          usedAt: invite.usedAt,
          createdAt: invite.createdAt
        }
      });
    } catch (err) {
      console.error(`  Fel vid migrering av inbjudan ${invite.code}:`, err.message);
    }
  }
  console.log('  Inbjudningar klart!\n');

  // Migrera övningar
  const exercises = readJSON(EXERCISES_FILE);
  console.log(`Migrerar ${exercises.length} övningar...`);
  for (const exercise of exercises) {
    try {
      await Exercise.findOrCreate({
        where: { id: exercise.id },
        defaults: {
          name: exercise.name,
          description: exercise.description,
          images: exercise.images || [],
          video: exercise.video,
          youtubeUrl: exercise.youtubeUrl,
          createdAt: exercise.createdAt
        }
      });
    } catch (err) {
      console.error(`  Fel vid migrering av övning ${exercise.name}:`, err.message);
    }
  }
  console.log('  Övningar klart!\n');

  // Migrera träningar
  const trainings = readJSON(TRAININGS_FILE);
  console.log(`Migrerar ${trainings.length} träningar...`);
  for (const training of trainings) {
    try {
      await Training.findOrCreate({
        where: { id: training.id },
        defaults: {
          date: training.date,
          time: training.time,
          location: training.location || '',
          description: training.description || '',
          exerciseIds: training.exerciseIds || [],
          createdAt: training.createdAt
        }
      });
    } catch (err) {
      console.error(`  Fel vid migrering av träning ${training.date}:`, err.message);
    }
  }
  console.log('  Träningar klart!\n');

  console.log('Migrering slutförd!');
  await sequelize.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migreringsfel:', err);
  process.exit(1);
});
