// Notes Management Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadNotes();
    setupEventListeners();
});

/**
 * Initialize theme from localStorage
 */
function initTheme() {
    const savedTheme = localStorage.getItem('ha-digest-theme') || 'neptune';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    const addNoteBtn = document.getElementById('add-note-btn');
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', showAddNoteModal);
    }
}

/**
 * Load all notes from backend
 */
async function loadNotes() {
    try {
        const response = await fetch('api/digest/notes');
        const data = await response.json();

        renderNotes(data.notes || []);
    } catch (error) {
        console.error('Failed to load notes:', error);
    }
}

/**
 * Render notes list
 */
function renderNotes(notes) {
    const notesList = document.getElementById('notes-list');
    const emptyState = document.getElementById('empty-state');

    if (notes.length === 0) {
        emptyState.style.display = 'block';
        notesList.innerHTML = '';
        notesList.appendChild(emptyState);
        return;
    }

    emptyState.style.display = 'none';
    notesList.innerHTML = notes.map(note => `
        <div class="note-item" data-id="${note.id}">
            <div class="note-content">
                <div class="note-title">${escapeHtml(note.title)}</div>
                <div class="note-text">${escapeHtml(note.note)}</div>
                <div class="note-date">Added ${formatDate(note.created_at)}</div>
            </div>
            <div class="note-actions">
                <button class="btn-icon" onclick="editNote(${note.id})" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteNoteConfirm(${note.id})" title="Delete">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Show modal for adding a new note
 */
function showAddNoteModal() {
    const modalHtml = `
    <div class="modal-overlay active" onclick="closeModal(event)">
        <div class="modal-content note-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Add New Note</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <label for="note-title">Subject</label>
                    <input type="text" id="note-title" class="note-input" placeholder="e.g., AdGuard Home Updates">
                </div>
                <div class="modal-section">
                    <label for="note-input">Your Note</label>
                    <textarea id="note-input" class="note-textarea" placeholder="Type your preference..." rows="4"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="saveNewNote()">Save Note</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('note-title')?.focus(), 100);
}

/**
 * Save a new note
 */
async function saveNewNote() {
    const titleInput = document.getElementById('note-title');
    const noteInput = document.getElementById('note-input');

    const title = titleInput?.value?.trim();
    const note = noteInput?.value?.trim();

    if (!title || !note) {
        if (!title) titleInput?.classList.add('error');
        if (!note) noteInput?.classList.add('error');
        return;
    }

    try {
        const response = await fetch('api/digest/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, note })
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadNotes();
            showToast('Note added successfully!');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to save note:', error);
        showToast('Failed to save note', 'error');
    }
}

/**
 * Edit an existing note
 */
async function editNote(id) {
    // Fetch the note data
    try {
        const response = await fetch('api/digest/notes');
        const data = await response.json();
        const note = data.notes?.find(n => n.id === id);

        if (!note) return;

        const modalHtml = `
        <div class="modal-overlay active" onclick="closeModal(event)">
            <div class="modal-content note-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Edit Note</h3>
                    <button class="modal-close" onclick="closeModal()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <label>Subject</label>
                        <div class="note-title-display">${escapeHtml(note.title)}</div>
                    </div>
                    <div class="modal-section">
                        <label for="note-input">Your Note</label>
                        <textarea id="note-input" class="note-textarea" rows="4">${escapeHtml(note.note)}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="updateNote(${id})">Update Note</button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => document.getElementById('note-input')?.focus(), 100);
    } catch (error) {
        console.error('Failed to load note:', error);
    }
}

/**
 * Update an existing note
 */
async function updateNote(id) {
    const noteInput = document.getElementById('note-input');
    const note = noteInput?.value?.trim();

    if (!note) {
        noteInput?.classList.add('error');
        return;
    }

    try {
        const response = await fetch(`api/digest/note/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadNotes();
            showToast('Note updated!');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to update note:', error);
        showToast('Failed to update note', 'error');
    }
}

/**
 * Show delete confirmation
 */
function deleteNoteConfirm(id) {
    const modalHtml = `
    <div class="modal-overlay active" onclick="closeModal(event)">
        <div class="modal-content confirm-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Delete Note?</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this note? This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-danger" onclick="deleteNote(${id})">Delete</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Delete a note
 */
async function deleteNote(id) {
    try {
        const response = await fetch(`api/digest/note/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadNotes();
            showToast('Note deleted');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to delete note:', error);
        showToast('Failed to delete note', 'error');
    }
}

/**
 * Close modal
 */
function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Format date
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally
window.showAddNoteModal = showAddNoteModal;
window.editNote = editNote;
window.updateNote = updateNote;
window.deleteNoteConfirm = deleteNoteConfirm;
window.deleteNote = deleteNote;
window.closeModal = closeModal;

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
