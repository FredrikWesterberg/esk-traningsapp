// ============ GLOBALA VARIABLER ============
let trainings = [];
let exercises = [];
let currentExerciseImages = [];
let currentExerciseVideo = null;

// ============ INITIERING ============
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupFileUploads();
});

async function loadData() {
  try {
    const [trainingsRes, exercisesRes] = await Promise.all([
      fetch('/api/trainings'),
      fetch('/api/exercises')
    ]);
    trainings = await trainingsRes.json();
    exercises = await exercisesRes.json();
    renderExercises();
    renderTrainings();
  } catch (error) {
    console.error('Kunde inte ladda data:', error);
  }
}

// ============ RENDERING ============
function renderExercises() {
  const list = document.getElementById('exerciseList');
  const emptyState = document.getElementById('exerciseEmptyState');

  if (exercises.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  list.innerHTML = exercises.map(exercise => `
    <li class="admin-list-item">
      <div>
        <strong>${exercise.name}</strong>
        <p style="color: #666; font-size: 0.9rem;">
          ${exercise.images ? exercise.images.length : 0} bilder
          ${exercise.video ? ', 1 video' : ''}
        </p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-secondary" onclick="editExercise('${exercise.id}')">Redigera</button>
        <button class="btn btn-danger" onclick="deleteExercise('${exercise.id}')">Ta bort</button>
      </div>
    </li>
  `).join('');
}

function renderTrainings() {
  const list = document.getElementById('trainingList');
  const emptyState = document.getElementById('trainingEmptyState');

  // Sortera efter datum
  const sortedTrainings = [...trainings].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  if (sortedTrainings.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  list.innerHTML = sortedTrainings.map(training => {
    const date = new Date(training.date);
    const formattedDate = date.toLocaleDateString('sv-SE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    return `
      <li class="admin-list-item">
        <div>
          <strong>${formattedDate}${training.time ? ' kl ' + training.time : ''}</strong>
          <p style="color: #666; font-size: 0.9rem;">
            ${training.location || 'Plats ej angiven'} -
            ${training.exerciseIds ? training.exerciseIds.length : 0} övningar
          </p>
        </div>
        <div class="admin-actions">
          <button class="btn btn-secondary" onclick="editTraining('${training.id}')">Redigera</button>
          <button class="btn btn-danger" onclick="deleteTraining('${training.id}')">Ta bort</button>
        </div>
      </li>
    `;
  }).join('');
}

// ============ ÖVNINGAR ============
function openExerciseModal(exercise = null) {
  document.getElementById('exerciseModalTitle').textContent = exercise ? 'Redigera övning' : 'Ny övning';
  document.getElementById('exerciseId').value = exercise ? exercise.id : '';
  document.getElementById('exerciseName').value = exercise ? exercise.name : '';
  document.getElementById('exerciseDescription').value = exercise ? exercise.description : '';

  currentExerciseImages = exercise && exercise.images ? [...exercise.images] : [];
  currentExerciseVideo = exercise ? exercise.video : null;

  renderUploadedImages();
  renderUploadedVideo();

  document.getElementById('exerciseModal').classList.add('active');
}

function closeExerciseModal() {
  document.getElementById('exerciseModal').classList.remove('active');
  document.getElementById('exerciseForm').reset();
  currentExerciseImages = [];
  currentExerciseVideo = null;
}

async function saveExercise() {
  const id = document.getElementById('exerciseId').value;
  const name = document.getElementById('exerciseName').value.trim();
  const description = document.getElementById('exerciseDescription').value.trim();

  if (!name) {
    alert('Du måste ange ett namn för övningen');
    return;
  }

  const exerciseData = {
    name,
    description,
    images: currentExerciseImages,
    video: currentExerciseVideo
  };

  try {
    if (id) {
      // Uppdatera befintlig
      await fetch(`/api/exercises/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exerciseData)
      });
    } else {
      // Skapa ny
      await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exerciseData)
      });
    }

    closeExerciseModal();
    loadData();
  } catch (error) {
    console.error('Kunde inte spara övning:', error);
    alert('Något gick fel när övningen skulle sparas');
  }
}

function editExercise(id) {
  const exercise = exercises.find(e => e.id === id);
  if (exercise) {
    openExerciseModal(exercise);
  }
}

async function deleteExercise(id) {
  if (!confirm('Är du säker på att du vill ta bort denna övning?')) {
    return;
  }

  try {
    await fetch(`/api/exercises/${id}`, { method: 'DELETE' });
    loadData();
  } catch (error) {
    console.error('Kunde inte ta bort övning:', error);
    alert('Något gick fel när övningen skulle tas bort');
  }
}

// ============ TRÄNINGAR ============
function openTrainingModal(training = null) {
  document.getElementById('trainingModalTitle').textContent = training ? 'Redigera träning' : 'Ny träning';
  document.getElementById('trainingId').value = training ? training.id : '';
  document.getElementById('trainingDate').value = training ? training.date : '';
  document.getElementById('trainingTime').value = training ? training.time || '' : '';
  document.getElementById('trainingLocation').value = training ? training.location || '' : '';
  document.getElementById('trainingDescription').value = training ? training.description || '' : '';

  // Rendera övningscheckboxar
  const checkboxContainer = document.getElementById('exerciseCheckboxes');
  const selectedIds = training && training.exerciseIds ? training.exerciseIds : [];

  if (exercises.length === 0) {
    checkboxContainer.innerHTML = '<p style="color: #666;">Inga övningar skapade ännu. Skapa övningar först.</p>';
  } else {
    checkboxContainer.innerHTML = exercises.map(exercise => `
      <label style="display: block; margin-bottom: 8px; cursor: pointer;">
        <input type="checkbox" name="exercises" value="${exercise.id}"
          ${selectedIds.includes(exercise.id) ? 'checked' : ''}>
        ${exercise.name}
      </label>
    `).join('');
  }

  document.getElementById('trainingModal').classList.add('active');
}

function closeTrainingModal() {
  document.getElementById('trainingModal').classList.remove('active');
  document.getElementById('trainingForm').reset();
}

async function saveTraining() {
  const id = document.getElementById('trainingId').value;
  const date = document.getElementById('trainingDate').value;
  const time = document.getElementById('trainingTime').value;
  const location = document.getElementById('trainingLocation').value.trim();
  const description = document.getElementById('trainingDescription').value.trim();

  if (!date) {
    alert('Du måste ange ett datum för träningen');
    return;
  }

  // Hämta valda övningar
  const checkboxes = document.querySelectorAll('input[name="exercises"]:checked');
  const exerciseIds = Array.from(checkboxes).map(cb => cb.value);

  const trainingData = {
    date,
    time,
    location,
    description,
    exerciseIds
  };

  try {
    if (id) {
      // Uppdatera befintlig
      await fetch(`/api/trainings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingData)
      });
    } else {
      // Skapa ny
      await fetch('/api/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingData)
      });
    }

    closeTrainingModal();
    loadData();
  } catch (error) {
    console.error('Kunde inte spara träning:', error);
    alert('Något gick fel när träningen skulle sparas');
  }
}

function editTraining(id) {
  const training = trainings.find(t => t.id === id);
  if (training) {
    openTrainingModal(training);
  }
}

async function deleteTraining(id) {
  if (!confirm('Är du säker på att du vill ta bort denna träning?')) {
    return;
  }

  try {
    await fetch(`/api/trainings/${id}`, { method: 'DELETE' });
    loadData();
  } catch (error) {
    console.error('Kunde inte ta bort träning:', error);
    alert('Något gick fel när träningen skulle tas bort');
  }
}

// ============ FILUPPLADDNING ============
function setupFileUploads() {
  // Bilduppladdning
  const imageUpload = document.getElementById('imageUpload');
  const imageInput = document.getElementById('imageInput');

  imageUpload.addEventListener('click', () => imageInput.click());
  imageUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUpload.classList.add('dragover');
  });
  imageUpload.addEventListener('dragleave', () => {
    imageUpload.classList.remove('dragover');
  });
  imageUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUpload.classList.remove('dragover');
    handleImageFiles(e.dataTransfer.files);
  });
  imageInput.addEventListener('change', (e) => {
    handleImageFiles(e.target.files);
  });

  // Videouppladdning
  const videoUpload = document.getElementById('videoUpload');
  const videoInput = document.getElementById('videoInput');

  videoUpload.addEventListener('click', () => videoInput.click());
  videoUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoUpload.classList.add('dragover');
  });
  videoUpload.addEventListener('dragleave', () => {
    videoUpload.classList.remove('dragover');
  });
  videoUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    videoUpload.classList.remove('dragover');
    handleVideoFile(e.dataTransfer.files[0]);
  });
  videoInput.addEventListener('change', (e) => {
    handleVideoFile(e.target.files[0]);
  });
}

async function handleImageFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      currentExerciseImages.push(data.path);
      renderUploadedImages();
    } catch (error) {
      console.error('Kunde inte ladda upp bild:', error);
      alert('Något gick fel vid bilduppladdning');
    }
  }
}

async function handleVideoFile(file) {
  if (!file || !file.type.startsWith('video/')) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    currentExerciseVideo = data.path;
    renderUploadedVideo();
  } catch (error) {
    console.error('Kunde inte ladda upp video:', error);
    alert('Något gick fel vid videouppladdning');
  }
}

function renderUploadedImages() {
  const container = document.getElementById('uploadedImages');
  container.innerHTML = currentExerciseImages.map((path, index) => `
    <div class="uploaded-file">
      <img src="${path}" alt="Uppladdad bild">
      <button class="remove-btn" onclick="removeImage(${index})">&times;</button>
    </div>
  `).join('');
}

function removeImage(index) {
  currentExerciseImages.splice(index, 1);
  renderUploadedImages();
}

function renderUploadedVideo() {
  const container = document.getElementById('uploadedVideo');
  if (currentExerciseVideo) {
    container.innerHTML = `
      <div style="margin-top: 10px;">
        <video src="${currentExerciseVideo}" controls style="max-width: 100%; max-height: 200px;"></video>
        <button class="btn btn-danger" style="margin-top: 10px;" onclick="removeVideo()">Ta bort video</button>
      </div>
    `;
  } else {
    container.innerHTML = '';
  }
}

function removeVideo() {
  currentExerciseVideo = null;
  renderUploadedVideo();
}

// ============ MODAL-HANTERING ============
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});
