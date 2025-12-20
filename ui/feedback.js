// Feedback Management Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadFeedback();
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
    const addBtn = document.getElementById('add-feedback-btn');
    if (addBtn) {
        addBtn.addEventListener('click', showAddFeedbackModal);
    }
}

/**
 * Load all feedback from backend
 */
async function loadFeedback() {
    try {
        const response = await fetch('api/digest/notes');
        const data = await response.json();

        renderFeedback(data.notes || []);
    } catch (error) {
        console.error('Failed to load feedback:', error);
    }
}

/**
 * Render feedback list
 */
function renderFeedback(items) {
    const list = document.getElementById('feedback-list');
    const emptyState = document.getElementById('empty-state');

    if (items.length === 0) {
        emptyState.style.display = 'block';
        list.innerHTML = '';
        list.appendChild(emptyState);
        return;
    }

    emptyState.style.display = 'none';
    list.innerHTML = items.map(item => `
        <div class="feedback-item" data-id="${item.id}">
            <div class="feedback-content">
                <div class="feedback-title">${escapeHtml(item.title)}</div>
                <div class="feedback-text">${escapeHtml(item.note)}</div>
                <div class="feedback-date">Added ${formatDate(item.created_at)}</div>
            </div>
            <div class="feedback-actions">
                <button class="btn-icon" onclick="editFeedback(${item.id})" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="btn-icon btn-danger" onclick="deleteFeedbackConfirm(${item.id})" title="Delete">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Show modal for adding new feedback
 */
function showAddFeedbackModal() {
    const modalHtml = `
    <div class="modal-overlay active" onclick="closeModal(event)">
        <div class="modal-content feedback-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Add Feedback</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <label for="feedback-title">Subject</label>
                    <input type="text" id="feedback-title" class="feedback-input" placeholder="e.g., AdGuard Home Updates">
                </div>
                <div class="modal-section">
                    <label for="feedback-input">Your Feedback</label>
                    <textarea id="feedback-input" class="feedback-textarea" placeholder="Type your preference..." rows="4"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="saveNewFeedback()">Save</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('feedback-title')?.focus(), 100);
}

/**
 * Save new feedback
 */
async function saveNewFeedback() {
    const titleInput = document.getElementById('feedback-title');
    const feedbackInput = document.getElementById('feedback-input');

    const title = titleInput?.value?.trim();
    const feedback = feedbackInput?.value?.trim();

    if (!title || !feedback) {
        if (!title) titleInput?.classList.add('error');
        if (!feedback) feedbackInput?.classList.add('error');
        return;
    }

    try {
        const response = await fetch('api/digest/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, note: feedback })
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadFeedback();
            showToast('Feedback saved!');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to save feedback:', error);
        showToast('Failed to save feedback', 'error');
    }
}

/**
 * Edit existing feedback
 */
async function editFeedback(id) {
    try {
        const response = await fetch('api/digest/notes');
        const data = await response.json();
        const item = data.notes?.find(n => n.id === id);

        if (!item) return;

        const modalHtml = `
        <div class="modal-overlay active" onclick="closeModal(event)">
            <div class="modal-content feedback-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Edit Feedback</h3>
                    <button class="modal-close" onclick="closeModal()">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-section">
                        <label>Subject</label>
                        <div class="feedback-title-display">${escapeHtml(item.title)}</div>
                    </div>
                    <div class="modal-section">
                        <label for="feedback-input">Your Feedback</label>
                        <textarea id="feedback-input" class="feedback-textarea" rows="4">${escapeHtml(item.note)}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn-primary" onclick="updateFeedback(${id})">Update</button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        setTimeout(() => document.getElementById('feedback-input')?.focus(), 100);
    } catch (error) {
        console.error('Failed to load feedback:', error);
    }
}

/**
 * Update existing feedback
 */
async function updateFeedback(id) {
    const feedbackInput = document.getElementById('feedback-input');
    const feedback = feedbackInput?.value?.trim();

    if (!feedback) {
        feedbackInput?.classList.add('error');
        return;
    }

    try {
        const response = await fetch(`api/digest/note/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: feedback })
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadFeedback();
            showToast('Feedback updated!');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to update feedback:', error);
        showToast('Failed to update', 'error');
    }
}

/**
 * Show delete confirmation
 */
function deleteFeedbackConfirm(id) {
    const modalHtml = `
    <div class="modal-overlay active" onclick="closeModal(event)">
        <div class="modal-content confirm-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Delete Feedback?</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this feedback?</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn-danger" onclick="deleteFeedback(${id})">Delete</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Delete feedback
 */
async function deleteFeedback(id) {
    try {
        const response = await fetch(`api/digest/note/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            closeModal();
            await loadFeedback();
            showToast('Feedback deleted');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Failed to delete feedback:', error);
        showToast('Failed to delete', 'error');
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
window.showAddFeedbackModal = showAddFeedbackModal;
window.editFeedback = editFeedback;
window.updateFeedback = updateFeedback;
window.deleteFeedbackConfirm = deleteFeedbackConfirm;
window.deleteFeedback = deleteFeedback;
window.closeModal = closeModal;

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
