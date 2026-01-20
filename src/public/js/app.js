// ============ GLOBALA VARIABLER ============
let trainings = [];
let exercises = [];
let currentUser = null;

// ============ INITIERING ============
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  loadData();
});

async function loadUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      document.getElementById('userName').textContent = currentUser.name;
      document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Admin' : 'Spelare';

      if (currentUser.role === 'admin') {
        document.getElementById('adminLink').style.display = 'inline-block';
      }
    }
  } catch (error) {
    console.error('Kunde inte ladda användare:', error);
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (error) {
    console.error('Kunde inte logga ut:', error);
  }
}

async function loadData() {
  try {
    const [trainingsRes, exercisesRes] = await Promise.all([
      fetch('/api/trainings'),
      fetch('/api/exercises')
    ]);
    trainings = await trainingsRes.json();
    exercises = await exercisesRes.json();
    renderTrainings();
  } catch (error) {
    console.error('Kunde inte ladda data:', error);
  }
}

// ============ RENDERING ============
function renderTrainings() {
  const list = document.getElementById('trainingList');
  const emptyState = document.getElementById('emptyState');

  const sortedTrainings = [...trainings].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingTrainings = sortedTrainings.filter(t =>
    new Date(t.date) >= today
  );

  if (upcomingTrainings.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  list.innerHTML = upcomingTrainings.map(training => {
    const date = new Date(training.date);
    const day = date.getDate();
    const month = date.toLocaleDateString('sv-SE', { month: 'short' });
    const weekday = date.toLocaleDateString('sv-SE', { weekday: 'long' });
    const exerciseCount = training.exerciseIds ? training.exerciseIds.length : 0;

    return `
      <li class="training-item" onclick="openTraining('${training.id}')">
        <div class="training-date">
          <span class="day">${day}</span>
          <span class="month">${month}</span>
        </div>
        <div class="training-info">
          <h3>${capitalizeFirst(weekday)}${training.time ? ' kl ' + training.time : ''}</h3>
          <p>${training.location || 'Plats ej angiven'}</p>
          ${training.description ? `<p>${training.description}</p>` : ''}
        </div>
        <span class="training-badge">${exerciseCount} övningar</span>
      </li>
    `;
  }).join('');
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============ TRÄNINGSMODAL ============
function openTraining(id) {
  const training = trainings.find(t => t.id === id);
  if (!training) return;

  const date = new Date(training.date);
  const formattedDate = date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('modalTitle').textContent = capitalizeFirst(formattedDate);

  document.getElementById('trainingDetails').innerHTML = `
    ${training.time ? `<p><strong>Tid:</strong> ${training.time}</p>` : ''}
    ${training.location ? `<p><strong>Plats:</strong> ${training.location}</p>` : ''}
    ${training.description ? `<p><strong>Beskrivning:</strong> ${training.description}</p>` : ''}
  `;

  const exerciseList = document.getElementById('exerciseList');
  const trainingExercises = training.exerciseIds
    ? training.exerciseIds.map(id => exercises.find(e => e.id === id)).filter(Boolean)
    : [];

  if (trainingExercises.length === 0) {
    exerciseList.innerHTML = '<p class="empty-state">Inga övningar tillagda för denna träning</p>';
  } else {
    exerciseList.innerHTML = trainingExercises.map(exercise => `
      <div class="exercise-card" onclick="openExercise('${exercise.id}')">
        ${exercise.images && exercise.images.length > 0
          ? `<img src="${exercise.images[0]}" alt="${exercise.name}">`
          : `<div class="placeholder-img">⚽</div>`
        }
        <div class="exercise-card-content">
          <h3>${exercise.name}</h3>
          <p>${truncate(exercise.description, 100)}</p>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('trainingModal').classList.add('active');
}

function closeModal() {
  document.getElementById('trainingModal').classList.remove('active');
}

// ============ ÖVNINGSMODAL ============
function openExercise(id) {
  const exercise = exercises.find(e => e.id === id);
  if (!exercise) return;

  document.getElementById('exerciseModalTitle').textContent = exercise.name;

  let imagesHTML = '';
  if (exercise.images && exercise.images.length > 0) {
    imagesHTML = `
      <div class="exercise-media">
        <h3>Bilder</h3>
        <div class="image-gallery">
          ${exercise.images.map(img => `
            <img src="${img}" alt="Övningsbild" onclick="window.open('${img}', '_blank')">
          `).join('')}
        </div>
      </div>
    `;
  }

  let videoHTML = '';
  if (exercise.youtubeUrl) {
    const youtubeId = getYoutubeId(exercise.youtubeUrl);
    if (youtubeId) {
      videoHTML = `
        <div class="exercise-media">
          <h3>Video</h3>
          <div class="video-container">
            <iframe src="https://www.youtube.com/embed/${youtubeId}"
                    allowfullscreen></iframe>
          </div>
        </div>
      `;
    }
  } else if (exercise.video) {
    videoHTML = `
      <div class="exercise-media">
        <h3>Video</h3>
        <div class="video-container">
          <video controls>
            <source src="${exercise.video}" type="video/mp4">
            Din webbläsare stöder inte videouppspelning.
          </video>
        </div>
      </div>
    `;
  }

  document.getElementById('exerciseDetails').innerHTML = `
    <div class="exercise-description">
      ${exercise.description || 'Ingen beskrivning angiven'}
    </div>
    ${imagesHTML}
    ${videoHTML}
  `;

  document.getElementById('exerciseModal').classList.add('active');
}

function closeExerciseModal() {
  document.getElementById('exerciseModal').classList.remove('active');
}

// ============ HJÄLPFUNKTIONER ============
function truncate(str, length) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

function getYoutubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Stäng modal vid klick utanför
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// Stäng modal med Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});
