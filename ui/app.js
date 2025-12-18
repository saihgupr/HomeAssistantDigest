// Home Assistant Digest - Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    initPlanetSwitcher();
    updateDateDisplay();
    await loadStatus();
    await loadDigestStatus();
    setupEventListeners();
}

// ============================================
// Planet Theme Switcher
// ============================================

function initPlanetSwitcher() {
    const savedTheme = localStorage.getItem('ha-digest-theme') || 'neptune';
    setTheme(savedTheme);

    document.querySelectorAll('.planet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
            localStorage.setItem('ha-digest-theme', theme);
        });
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update active button
    document.querySelectorAll('.planet-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ============================================
// Date Display
// ============================================

function updateDateDisplay() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    const startSetupBtn = document.getElementById('start-setup');
    const generateDigestBtn = document.getElementById('generate-digest');
    const testNotificationBtn = document.getElementById('test-notification');

    if (startSetupBtn) {
        startSetupBtn.addEventListener('click', handleStartSetup);
    }
    if (generateDigestBtn) {
        generateDigestBtn.addEventListener('click', handleGenerateDigest);
    }
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', handleTestNotification);
    }
}

// ============================================
// Status Loading
// ============================================

async function loadStatus() {
    try {
        const response = await fetch('/api/status');
        const status = await response.json();
        updateUIState(status);
    } catch (error) {
        console.error('Failed to load status:', error);
        document.getElementById('api-status').textContent = 'Error';
    }
}

function updateUIState(status) {
    // Update status indicators
    const apiStatus = document.getElementById('api-status');
    const profileStatus = document.getElementById('profile-status');
    const entitiesCount = document.getElementById('entities-count');
    const snapshotCount = document.getElementById('snapshot-count');
    const schedulerStatus = document.getElementById('scheduler-status');
    const nextDigest = document.getElementById('next-digest');

    // API Key status
    apiStatus.textContent = status.configured ? 'Configured' : 'Missing';
    apiStatus.className = `value ${status.configured ? 'success' : 'error'}`;

    // Profile status
    profileStatus.textContent = status.profileComplete ? 'Complete' : 'Incomplete';
    profileStatus.className = `value ${status.profileComplete ? 'success' : 'warning'}`;

    // Entities count
    entitiesCount.textContent = `${status.entitiesMonitored || 0}`;
    entitiesCount.className = `value ${status.entitiesMonitored > 0 ? 'success' : ''}`;

    // Snapshot stats
    if (status.snapshotStats) {
        snapshotCount.textContent = `${status.snapshotStats.total_snapshots || 0}`;
    }

    // Scheduler status
    if (status.scheduler) {
        schedulerStatus.textContent = status.scheduler.isRunning ? 'Running' : 'Stopped';
        schedulerStatus.className = `value ${status.scheduler.isRunning ? 'success' : 'warning'}`;
        nextDigest.textContent = status.scheduler.digestTime || '--:--';
    }

    // Determine setup state
    const isFullyConfigured = status.configured && status.profileComplete && status.entitiesDiscovered;

    // Show/hide cards based on state
    const setupCard = document.getElementById('setup-card');
    const actionsCard = document.getElementById('actions-card');
    const digestCard = document.getElementById('digest-card');

    if (isFullyConfigured) {
        setupCard.classList.add('hidden');
        actionsCard.classList.remove('hidden');
        digestCard.classList.remove('hidden');
    } else {
        setupCard.classList.remove('hidden');
        actionsCard.classList.add('hidden');
        digestCard.classList.add('hidden');

        // Update step styling based on progress
        updateSetupSteps(status);
    }

    // Enable start setup button
    const startSetupBtn = document.getElementById('start-setup');
    if (startSetupBtn) {
        startSetupBtn.disabled = false;

        if (!status.configured) {
            startSetupBtn.textContent = 'Configure API Key First';
            startSetupBtn.disabled = true;
        } else if (!status.profileComplete) {
            startSetupBtn.textContent = 'Set Up Profile';
            startSetupBtn.onclick = () => { window.location.href = '/setup.html'; };
        } else if (!status.entitiesDiscovered) {
            startSetupBtn.textContent = 'Discover Entities';
            startSetupBtn.onclick = () => { window.location.href = '/entities.html'; };
        }
    }
}

function updateSetupSteps(status) {
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');

    if (status.configured) {
        step1.classList.add('complete');
    }
    if (status.profileComplete) {
        step2.classList.add('complete');
    }
    if (status.entitiesDiscovered) {
        step3.classList.add('complete');
    }
}

// ============================================
// Digest Loading
// ============================================

async function loadDigestStatus() {
    try {
        const response = await fetch('/api/digest/status');
        const data = await response.json();

        if (data.lastDigest) {
            displayLatestDigest(data.lastDigest);
        }

        // Load digest history
        await loadDigestHistory();
    } catch (error) {
        console.error('Failed to load digest status:', error);
    }
}

function displayLatestDigest(digest) {
    const digestCard = document.getElementById('digest-card');
    const digestContent = document.getElementById('digest-content');
    const digestTimestamp = document.getElementById('digest-timestamp');

    digestCard.classList.remove('hidden');

    if (digest.timestamp) {
        const date = new Date(digest.timestamp);
        digestTimestamp.textContent = date.toLocaleString();
    }

    // If we have the full content, fetch it
    if (digest.id) {
        loadFullDigest(digest.id);
    } else {
        digestContent.innerHTML = `<p class="digest-summary">${digest.summary || 'No summary available'}</p>`;
    }
}

async function loadFullDigest(digestId) {
    try {
        const response = await fetch(`/api/digest/${digestId}`);
        const data = await response.json();

        if (data.digest && data.digest.content) {
            const digestContent = document.getElementById('digest-content');
            digestContent.innerHTML = markdownToHtml(data.digest.content);
        }
    } catch (error) {
        console.error('Failed to load full digest:', error);
    }
}

async function loadDigestHistory() {
    try {
        const response = await fetch('/api/digest/list?limit=5');
        const data = await response.json();

        if (data.digests && data.digests.length > 1) {
            const historyCard = document.getElementById('history-card');
            const digestList = document.getElementById('digest-list');

            historyCard.classList.remove('hidden');

            digestList.innerHTML = data.digests.slice(1).map(digest => `
                <div class="digest-list-item" onclick="loadFullDigest(${digest.id})">
                    <span class="digest-date">${new Date(digest.timestamp).toLocaleDateString()}</span>
                    <span class="digest-summary">${digest.summary || 'No summary'}</span>
                    <span class="digest-attention ${digest.attention_count > 0 ? 'warning' : ''}">${digest.attention_count} items</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load digest history:', error);
    }
}

// ============================================
// Actions
// ============================================

async function handleStartSetup() {
    window.location.href = '/setup.html';
}

async function handleGenerateDigest() {
    const btn = document.getElementById('generate-digest');
    const actionStatus = document.getElementById('action-status');

    btn.disabled = true;
    btn.textContent = 'Generating...';
    actionStatus.textContent = 'Calling Gemini AI to analyze your smart home...';
    actionStatus.className = 'action-status info';

    try {
        const response = await fetch('/api/digest/generate', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            actionStatus.textContent = 'Digest generated successfully!';
            actionStatus.className = 'action-status success';

            // Reload digest display
            displayLatestDigest(data.digest);
            await loadDigestHistory();
        } else {
            throw new Error(data.error || 'Failed to generate digest');
        }
    } catch (error) {
        console.error('Generate digest error:', error);
        actionStatus.textContent = `Error: ${error.message}`;
        actionStatus.className = 'action-status error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Digest Now';
    }
}

async function handleTestNotification() {
    const actionStatus = document.getElementById('action-status');

    actionStatus.textContent = 'Sending test notification...';
    actionStatus.className = 'action-status info';

    try {
        const response = await fetch('/api/digest/test-notification', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            actionStatus.textContent = 'Test notification sent!';
            actionStatus.className = 'action-status success';
        } else {
            throw new Error(data.error || 'Failed to send notification');
        }
    } catch (error) {
        console.error('Test notification error:', error);
        actionStatus.textContent = `Error: ${error.message}`;
        actionStatus.className = 'action-status error';
    }
}

// ============================================
// Markdown Parser
// ============================================

function markdownToHtml(markdown) {
    return markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Lists
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(.*)$/, '<p>$1</p>')
        // Horizontal rule
        .replace(/---/g, '<hr>');
}

// Make loadFullDigest available globally for onclick handlers
window.loadFullDigest = loadFullDigest;
