// Home Assistant Digest - Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    initPlanetSwitcher();
    initLayoutSwitcher();
    updateDateDisplay();
    await loadStatus();
    await loadDigestStatus();
    setupEventListeners();
}

// ============================================
// Planet Theme Switcher (Colors)
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
// Layout Style Switcher (Structure)
// ============================================

function initLayoutSwitcher() {
    const savedLayout = localStorage.getItem('ha-digest-layout') || 'monet';
    setLayout(savedLayout);

    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const layout = btn.dataset.layout;
            setLayout(layout);
            localStorage.setItem('ha-digest-layout', layout);
        });
    });
}

function setLayout(layout) {
    document.documentElement.setAttribute('data-layout', layout);

    // Update active button
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layout === layout);
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

    // startSetupBtn is handled dynamically in updateUIState
    // if (startSetupBtn) {
    //     startSetupBtn.addEventListener('click', handleStartSetup);
    // }
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
        const response = await fetch(`api/status?t=${Date.now()}`);
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
            startSetupBtn.onclick = () => { window.location.href = 'setup.html'; };
        } else if (!status.entitiesDiscovered) {
            startSetupBtn.textContent = 'Discover Entities';
            startSetupBtn.onclick = () => { window.location.href = 'entities.html'; };
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
        const response = await fetch('api/digest/status');
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
        const response = await fetch(`api/digest/${digestId}`);
        const data = await response.json();

        if (data.digest && data.digest.content) {
            const digestGrid = document.getElementById('digest-grid');
            // Hide legacy content, show grid
            document.getElementById('digest-content').style.display = 'none';
            digestGrid.innerHTML = renderDigestCards(data.digest.content);
        }
    } catch (error) {
        console.error('Failed to load full digest:', error);
    }
}

async function loadDigestHistory() {
    try {
        const response = await fetch('api/digest/list?limit=5');
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
    window.location.href = 'setup.html';
}

async function handleGenerateDigest() {
    const btn = document.getElementById('generate-digest');
    const actionStatus = document.getElementById('action-status');

    btn.disabled = true;
    btn.textContent = 'Generating...';
    actionStatus.textContent = 'Calling Gemini AI to analyze your smart home...';
    actionStatus.className = 'action-status info';

    try {
        const response = await fetch('api/digest/generate', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            actionStatus.textContent = 'Digest generated successfully!';
            actionStatus.className = 'action-status success';

            // Reload digest display
            displayLatestDigest(data.digest);
            // Trigger full render because displayLatestDigest only sets timestamp if ID present
            if (data.digest.id) {
                loadFullDigest(data.digest.id);
            }

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
        const response = await fetch('api/digest/test-notification', { method: 'POST' });
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

// ============================================
// Card Renderer
// ============================================

function renderDigestCards(digestData) {
    if (typeof digestData === 'string') {
        try {
            digestData = JSON.parse(digestData);
        } catch (e) {
            // Fallback for legacy markdown digests
            return markdownToHtml(digestData);
        }
    }

    let html = '';

    // 1. Summary Block
    if (digestData.summary) {
        html += `<div class="digest-summary-block">${digestData.summary}</div>`;
    }

    // 2. Attention Items (Red)
    if (digestData.attention_items && digestData.attention_items.length > 0) {
        digestData.attention_items.forEach(item => {
            html += createDigestCard({
                type: 'attention',
                icon: 'warning',
                title: item.title,
                desc: item.description,
                footer: `Severity: ${item.severity || 'Attention'}`
            });
        });
    }

    // 3. Observations (Blue)
    if (digestData.observations && digestData.observations.length > 0) {
        digestData.observations.forEach(item => {
            html += createDigestCard({
                type: 'observation',
                icon: 'analytics',
                title: item.title,
                desc: item.description,
                footer: item.trend ? `Trend: ${item.trend}` : null
            });
        });
    }

    // 4. Positives (Green)
    if (digestData.positives && digestData.positives.length > 0) {
        // Group positives into one card if they are simple strings
        const listItems = digestData.positives.map(p => `<li>${p}</li>`).join('');
        html += createDigestCard({
            type: 'positive',
            icon: 'check_circle',
            title: 'All Good',
            desc: `<ul style="padding-left: 1.25rem; margin: 0;">${listItems}</ul>`
        });
    }

    // 5. Tip (Gold)
    if (digestData.tip) {
        html += createDigestCard({
            type: 'tip',
            icon: 'lightbulb',
            title: 'Tip of the Day',
            desc: digestData.tip
        });
    }

    return html;
}

function createDigestCard({ type, icon, title, desc, footer }) {
    const iconSvg = getIconSvg(icon);

    return `
    <div class="digest-card-item digest-card-${type}">
        <div class="digest-card-header">
            <div class="digest-card-icon">${iconSvg}</div>
            <div class="digest-card-title">${title}</div>
        </div>
        <div class="digest-card-desc">${desc}</div>
        ${footer ? `<div class="digest-card-footer">${footer}</div>` : ''}
    </div>
    `;
}

function getIconSvg(name) {
    const icons = {
        'warning': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        'analytics': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2v-3h2v3zm4 0h-2v-5h2v5z"/></svg>`,
        'check_circle': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        'lightbulb': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>`
    };
    return icons[name] || icons['analytics'];
}

// Fallback for legacy data/errors
function markdownToHtml(markdown) {
    if (!markdown) return '';
    return markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

// Make loadFullDigest available globally for onclick handlers
window.loadFullDigest = loadFullDigest;
