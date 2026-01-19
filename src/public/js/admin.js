// ============ GLOBALA VARIABLER ============
let trainings = [];
let exercises = [];
let users = [];
let invites = [];
let currentUser = null;
let currentExerciseImages = [];
let currentExerciseVideo = null;
let currentExerciseYoutube = '';

// ============ INITIERING ============
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  loadData();
  setupFileUploads();
});

async function loadUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      document.getElementById('userName').textContent = currentUser.name;
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
    const [trainingsRes, exercisesRes, usersRes, invitesRes] = await Promise.all([
      fetch('/api/trainings'),
      fetch('/api/exercises'),
      fetch('/api/users'),
      fetch('/api/invites')
    ]);
    trainings = await trainingsRes.json();
    exercises = await exercisesRes.json();
    users = await usersRes.json();
    invites = await invitesRes.json();
    renderExercises();
    renderTrainings();
    renderUsers();
    renderInvites();
  } catch (error) {
    console.error('Kunde inte ladda data:', error);
  }
}

// ============ TABS ============
function showTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
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
          ${exercise.youtubeUrl ? ', YouTube' : exercise.video ? ', 1 video' : ''}
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

function renderUsers() {
  const list = document.getElementById('userList');
  const emptyState = document.getElementById('userEmptyState');

  if (users.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  list.innerHTML = users.map(user => {
    const isCurrentUser = currentUser && user.id === currentUser.id;
    return `
      <li class="admin-list-item">
        <div>
          <strong>${user.name}</strong> ${isCurrentUser ? '(du)' : ''}
          <p style="color: #666; font-size: 0.9rem;">
            ${user.email} -
            <span class="user-role" style="font-size: 0.75rem;">${user.role === 'admin' ? 'Admin' : 'Spelare'}</span>
          </p>
        </div>
        <div class="admin-actions">
          ${!isCurrentUser ? `
            ${user.role === 'admin'
              ? `<button class="btn btn-secondary" onclick="setUserRole('${user.id}', 'user')">Ta bort admin</button>`
              : `<button class="btn btn-secondary" onclick="setUserRole('${user.id}', 'admin')">Gör till admin</button>`
            }
            <button class="btn btn-danger" onclick="deleteUser('${user.id}')">Ta bort</button>
          ` : ''}
        </div>
      </li>
    `;
  }).join('');
}

function renderInvites() {
  const list = document.getElementById('inviteList');
  const emptyState = document.getElementById('inviteEmptyState');

  if (invites.length === 0) {
    list.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  const sortedInvites = [...invites].sort((a, b) => {
    if (a.usedBy && !b.usedBy) return 1;
    if (!a.usedBy && b.usedBy) return -1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  list.innerHTML = sortedInvites.map(invite => {
    const isUsed = !!invite.usedBy;
    return `
      <li class="admin-list-item">
        <div>
          <span class="invite-code">${invite.code}</span>
          <span class="invite-status ${isUsed ? 'used' : 'available'}">
            ${isUsed ? 'Använd' : 'Tillgänglig'}
          </span>
          ${isUsed ? `<p style="color: #666; font-size: 0.85rem; margin-top: 5px;">Använd av: ${invite.usedByName}</p>` : ''}
        </div>
        <div class="admin-actions">
          ${!isUsed ? `<button class="btn btn-secondary" onclick="copyInvite('${invite.code}')">Kopiera</button>` : ''}
          <button class="btn btn-danger" onclick="deleteInvite('${invite.id}')">Ta bort</button>
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
  document.getElementById('youtubeUrl').value = exercise ? exercise.youtubeUrl || '' : '';

  currentExerciseImages = exercise && exercise.images ? [...exercise.images] : [];
  currentExerciseVideo = exercise ? exercise.video : null;
  currentExerciseYoutube = exercise ? exercise.youtubeUrl || '' : '';

  renderUploadedImages();
  renderUploadedVideo();

  document.getElementById('exerciseModal').classList.add('active');
}

function closeExerciseModal() {
  document.getElementById('exerciseModal').classList.remove('active');
  document.getElementById('exerciseForm').reset();
  currentExerciseImages = [];
  currentExerciseVideo = null;
  currentExerciseYoutube = '';
}

async function saveExercise() {
  const id = document.getElementById('exerciseId').value;
  const name = document.getElementById('exerciseName').value.trim();
  const description = document.getElementById('exerciseDescription').value.trim();
  const youtubeUrl = document.getElementById('youtubeUrl').value.trim();

  if (!name) {
    alert('Du måste ange ett namn för övningen');
    return;
  }

  const exerciseData = {
    name,
    description,
    images: currentExerciseImages,
    video: youtubeUrl ? null : currentExerciseVideo,
    youtubeUrl: youtubeUrl || null
  };

  try {
    if (id) {
      await fetch(`/api/exercises/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exerciseData)
      });
    } else {
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
      await fetch(`/api/trainings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingData)
      });
    } else {
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

// ============ ANVÄNDARE ============
async function setUserRole(id, role) {
  try {
    await fetch(`/api/users/${id}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    loadData();
  } catch (error) {
    console.error('Kunde inte ändra roll:', error);
    alert('Något gick fel');
  }
}

async function deleteUser(id) {
  if (!confirm('Är du säker på att du vill ta bort denna användare?')) {
    return;
  }

  try {
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    loadData();
  } catch (error) {
    console.error('Kunde inte ta bort användare:', error);
    alert('Något gick fel');
  }
}

// ============ INBJUDNINGAR ============
async function createInvite() {
  try {
    await fetch('/api/invites', { method: 'POST' });
    loadData();
  } catch (error) {
    console.error('Kunde inte skapa inbjudan:', error);
    alert('Något gick fel');
  }
}

function copyInvite(code) {
  navigator.clipboard.writeText(code).then(() => {
    alert(`Inbjudningskod kopierad: ${code}`);
  }).catch(() => {
    prompt('Kopiera denna kod:', code);
  });
}

async function deleteInvite(id) {
  if (!confirm('Är du säker på att du vill ta bort denna inbjudningskod?')) {
    return;
  }

  try {
    await fetch(`/api/invites/${id}`, { method: 'DELETE' });
    loadData();
  } catch (error) {
    console.error('Kunde inte ta bort inbjudan:', error);
    alert('Något gick fel');
  }
}

// ============ FILUPPLADDNING ============
function setupFileUploads() {
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
