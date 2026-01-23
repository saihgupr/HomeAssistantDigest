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

    // Cleanup old digests (older than 7 days)
    try {
        await fetch('api/digest/cleanup', { method: 'POST' });
    } catch (e) {
        console.log('Digest cleanup skipped');
    }
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
    // Initialize digest type toggle (Daily/Weekly)
    const savedDigestType = localStorage.getItem('ha-digest-view') || 'daily';
    setDigestView(savedDigestType);

    document.querySelectorAll('.layout-btn[data-digest-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const digestType = btn.dataset.digestType;
            setDigestView(digestType);
            localStorage.setItem('ha-digest-view', digestType);
        });
    });
}

function setDigestView(digestType) {
    // Update active button
    document.querySelectorAll('.layout-btn[data-digest-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.digestType === digestType);
    });

    // Store current type globally
    window.currentDigestType = digestType;

    // Update title based on tab
    const titleEl = document.getElementById('main-title');
    if (titleEl) {
        titleEl.textContent = digestType === 'weekly'
            ? 'Home Assistant Weekly Digest'
            : 'Home Assistant Daily Digest';
    }

    // Update "Next Digest" display based on selected type
    updateNextDigestDisplay(digestType);

    // Reload digest display for the selected type
    loadDigestForType(digestType);
}

async function loadDigestForType(type) {
    try {
        // Load digests filtered by type
        const response = await fetch(`api/digest/list?limit=10&type=${type}`);
        const data = await response.json();

        const digestCard = document.getElementById('digest-card');
        const digestContent = document.getElementById('digest-content');
        const digestGrid = document.getElementById('digest-grid');
        const digestTimestamp = document.getElementById('digest-timestamp');
        const historyCard = document.getElementById('history-card');
        const digestList = document.getElementById('digest-list');
        const summaryBlock = document.querySelector('.summary-block');

        // Reset display state before loading new content
        digestGrid.innerHTML = '';
        digestGrid.style.display = '';
        digestContent.style.display = 'none';
        if (summaryBlock) summaryBlock.style.display = '';

        if (data.digests && data.digests.length > 0) {
            // Display latest digest of this type
            const latest = data.digests[0];
            digestCard.classList.remove('hidden');

            if (latest.timestamp) {
                const date = new Date(latest.timestamp);
                digestTimestamp.textContent = date.toLocaleString();
            }

            // Cache digests for history navigation
            window.digestsList = data.digests || [];

            // Load full content if we have an ID (this will also trigger history sidebar update)
            await loadFullDigest(latest.id);
        } else {
            // No digests of this type yet - show clean empty state
            digestCard.classList.remove('hidden');
            digestTimestamp.textContent = `No ${type} digests yet`;

            // Hide the summary block and grid, show empty message
            if (summaryBlock) summaryBlock.style.display = 'none';
            if (digestGrid) {
                digestGrid.style.display = 'none';
                digestGrid.innerHTML = '';
            }
            digestContent.style.display = 'block';
            digestContent.innerHTML = `
                <div class="empty-state">
                    <h3>No ${type} digests yet</h3>
                    <p>Click "Generate Digest Now" above to create your first ${type} report.</p>
                    ${type === 'weekly' ? '<p class="empty-hint">Weekly digests analyze 7 days of data for trends and patterns.</p>' : ''}
                </div>
            `;
            historyCard.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to load digests for type:', error);
    }
}

/**
 * Update the "Next Digest" display based on selected tab type
 */
function updateNextDigestDisplay(digestType) {
    const nextDigestEl = document.getElementById('next-digest');
    if (!nextDigestEl || !window.schedulerInfo) return;

    const scheduler = window.schedulerInfo;

    if (digestType === 'weekly') {
        // Show day of week for weekly digest
        const weeklyDay = scheduler.weeklyDay || 'sunday';
        const capitalizedDay = weeklyDay.charAt(0).toUpperCase() + weeklyDay.slice(1);
        nextDigestEl.textContent = capitalizedDay;
    } else {
        // Show time for daily digest
        const timeStr = scheduler.digestTime || '07:00';
        try {
            // Parse HH:MM to date object for formatting
            const [hours, minutes] = timeStr.split(':');
            const d = new Date();
            d.setHours(parseInt(hours), parseInt(minutes));
            nextDigestEl.textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
            nextDigestEl.textContent = timeStr;
        }
    }
}

// ============================================
// Date Display
// ============================================

function updateDateDisplay() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = now.toLocaleDateString(undefined, options);
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    const startSetupBtn = document.getElementById('start-setup');
    const generateDigestBtn = document.getElementById('generate-digest');

    // startSetupBtn is handled dynamically in updateUIState
    // if (startSetupBtn) {
    //     startSetupBtn.addEventListener('click', handleStartSetup);
    // }
    if (generateDigestBtn) {
        generateDigestBtn.addEventListener('click', handleGenerateDigest);
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

        // Store scheduler info globally for use by tab switcher
        window.schedulerInfo = status.scheduler;

        // Update next digest based on current tab
        updateNextDigestDisplay(window.currentDigestType || 'daily');
    }

    // Simplified: fully configured = API key + profile done (entities auto-configure)
    const isFullyConfigured = status.configured && status.profileComplete && status.entitiesDiscovered;

    // Show/hide cards based on state
    // Show/hide cards based on state
    const setupCard = document.getElementById('setup-card');
    const digestCard = document.getElementById('digest-card');

    if (isFullyConfigured) {
        setupCard.classList.add('hidden');
        digestCard.classList.remove('hidden');
    } else {
        setupCard.classList.remove('hidden');
        digestCard.classList.add('hidden');

        // Update step styling based on progress
        updateSetupSteps(status);
    }

    // Enable/Disable Generate button based on profile completion
    const generateDigestBtn = document.getElementById('generate-digest');
    if (generateDigestBtn) {
        if (status.profileComplete) {
            generateDigestBtn.classList.remove('hidden');
        } else {
            generateDigestBtn.classList.add('hidden');
        }
    }

    // Enable start setup button - simplified 2-step flow
    const startSetupBtn = document.getElementById('start-setup');
    if (startSetupBtn) {
        startSetupBtn.disabled = false;

        if (!status.configured) {
            startSetupBtn.textContent = 'Configure API Key First';
            startSetupBtn.disabled = true;
        } else if (!status.profileComplete) {
            startSetupBtn.textContent = 'Set Up Profile';
            startSetupBtn.onclick = () => { window.location.href = 'setup.html'; };
        } else {
            // Profile complete but entities not discovered - trigger auto-configure
            startSetupBtn.textContent = 'Finish Setup';
            startSetupBtn.onclick = async () => {
                startSetupBtn.disabled = true;
                startSetupBtn.textContent = 'Configuring...';
                try {
                    await fetch('api/entities/auto-configure', { method: 'POST' });
                    window.location.reload();
                } catch (e) {
                    console.error('Auto-configure failed:', e);
                    startSetupBtn.disabled = false;
                    startSetupBtn.textContent = 'Retry Setup';
                }
            };
        }
    }
}

function updateSetupSteps(status) {
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');

    if (status.configured) {
        step1.classList.add('complete');
    }
    if (status.profileComplete) {
        step2.classList.add('complete');
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
    window.activeDigestId = digestId;
    try {
        const response = await fetch(`api/digest/${digestId}`);
        const data = await response.json();

        if (data.digest && data.digest.content) {
            const digestGrid = document.getElementById('digest-grid');
            // Hide legacy content, show grid
            document.getElementById('digest-content').style.display = 'none';
            digestGrid.innerHTML = renderDigestCards(data.digest.content);

            // Update history sidebar to reflect new active item
            updateHistorySidebar();
        }
    } catch (error) {
        console.error('Failed to load full digest:', error);
    }
}

async function loadDigestHistory() {
    const type = window.currentDigestType || 'daily';
    try {
        const response = await fetch(`api/digest/list?limit=5&type=${type}`);
        const data = await response.json();

        // Cache and render
        window.digestsList = data.digests || [];
        updateHistorySidebar();
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
    const digestType = window.currentDigestType || 'daily';

    btn.disabled = true;
    btn.textContent = `Generating ${digestType}...`;
    actionStatus.textContent = `Calling Gemini AI to analyze your smart home (${digestType} digest)...`;
    actionStatus.className = 'action-status info';

    try {
        const response = await fetch('api/digest/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: digestType })
        });
        const data = await response.json();

        if (data.success) {
            actionStatus.textContent = 'Digest generated successfully!';
            actionStatus.className = 'action-status success';

            // Make sure digest card is visible
            const digestCard = document.getElementById('digest-card');
            digestCard.classList.remove('hidden');

            // Update timestamp (backend returns 'generatedAt', not 'timestamp')
            const digestTimestamp = document.getElementById('digest-timestamp');
            const timestamp = data.digest.generatedAt || data.digest.timestamp;
            if (timestamp) {
                const date = new Date(timestamp);
                digestTimestamp.textContent = date.toLocaleString();
            } else {
                digestTimestamp.textContent = new Date().toLocaleString();
            }

            // Render the digest content directly if available
            const digestGrid = document.getElementById('digest-grid');
            const digestContent = document.getElementById('digest-content');

            if (data.digest.content) {
                digestContent.style.display = 'none';
                digestGrid.style.display = '';
                digestGrid.innerHTML = renderDigestCards(data.digest.content);
            } else if (data.digest.id) {
                // Fallback: fetch full digest by ID
                await loadFullDigest(data.digest.id);
            }

            // Reload history
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

    // 1. Quick Overview - Positives at the top (full width)
    if (digestData.positives && digestData.positives.length > 0) {
        const listItems = digestData.positives.map(p => {
            // Handle both string (legacy) and object (new) format
            if (typeof p === 'string') {
                return `<li><span class="status-dot status-good"></span>${p}</li>`;
            }
            const statusClass = p.status === 'warning' ? 'status-warning' :
                p.status === 'critical' ? 'status-critical' :
                    p.status === 'info' ? 'status-info' : 'status-good';
            return `<li><span class="status-dot ${statusClass}"></span>${p.text}</li>`;
        }).join('');
        html += createDigestCard({
            type: 'positive',
            icon: 'check_circle',
            title: 'Quick Overview',
            desc: `<ul class="quick-overview-list">${listItems}</ul>`,
            className: 'digest-card-full'
        });
    }

    // 3. Attention Items (Red) - Critical issues after overview
    if (digestData.attention_items && digestData.attention_items.length > 0) {
        digestData.attention_items.forEach((item, idx) => {
            // Ensure detailed info exists so the button always appears
            const details = item.detailed_info || {
                title: item.title,
                explanation: item.description,
                recommendation: "Check the entity in Home Assistant."
            };

            html += createDigestCard({
                type: 'attention',
                icon: 'warning',
                title: item.title,
                desc: item.description,
                footer: `Severity: ${item.severity || 'Attention'}`,
                detailedInfo: details,
                itemId: `attention-${idx}`
            });
        });
    }

    // 4. Observations (Blue) - with Note/Ignore buttons
    if (digestData.observations && digestData.observations.length > 0) {
        digestData.observations.forEach((item, idx) => {
            html += createDigestCard({
                type: 'observation',
                icon: 'analytics',
                title: item.title,
                desc: item.description,
                footer: item.trend ? `Trend: ${item.trend}` : null,
                showActions: true,
                itemId: `observation-${idx}`
            });
        });
    }

    // 4.1 Housekeeping (Gray/Collapsible)
    if (digestData.housekeeping && digestData.housekeeping.length > 0) {
        const housekeepingItems = digestData.housekeeping.map(item => {
            return `<li class="housekeeping-item"><strong>${item.title}:</strong> ${item.description}</li>`;
        }).join('');

        html += `
        <details class="digest-card-full housekeeping-section">
            <summary class="housekeeping-summary">
                <span class="housekeeping-icon">${getIconSvg('analytics')}</span>
                <span>Housekeeping / Unchanged (${digestData.housekeeping.length})</span>
                <span class="housekeeping-chevron">▼</span>
            </summary>
            <ul class="housekeeping-list">${housekeepingItems}</ul>
        </details>
        `;
    }

    // 4. All Good Items (Green) - Things working well
    if (digestData.good_items && digestData.good_items.length > 0) {
        digestData.good_items.forEach(item => {
            html += createDigestCard({ type: 'good', icon: 'check_circle', title: 'All Good', desc: item });
        });
    }

    // 5. Summary Block - Now explicitly at the bottom above the tip
    if (digestData.summary) {
        const summaryId = 'system-insight';
        html += `
            <div class="digest-summary-block digest-card-clickable" data-item-id="${summaryId}" onclick="showGenericDetails('${summaryId}', 'System Insight', ${JSON.stringify(digestData.summary).replace(/'/g, "&#39;")})">
                <span class="info-indicator">${getIconSvg('info')}</span>
                <div class="summary-block-label">
                    ${getIconSvg('insight')}
                    <span>System Insight</span>
                </div>
                <div class="summary-block-text">${digestData.summary}</div>
                <div class="card-actions summary-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); showFeedbackModal('System Insight')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Note</button>
                    <button class="action-btn action-btn-muted" onclick="event.stopPropagation(); dismissWarning('System Insight')"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6"/></svg>Ignore</button>
                </div>
            </div>
        `;
    }

    // 6. Tip (Gold) - Actionable tip at the end with Note/Ignore buttons
    if (digestData.tip) {
        // Handle both old string format and new object format
        let tipContent;
        let tipTitle = 'Tip of the Day';
        if (typeof digestData.tip === 'string') {
            // Legacy: tip is just a string
            tipContent = digestData.tip;
        } else {
            // New format: tip is an object - just show title and action (reason is redundant)
            tipTitle = digestData.tip.title || 'Tip of the Day';
            tipContent = `
                <strong>${digestData.tip.title || 'Tip'}</strong><br>
                ${digestData.tip.action || ''}
            `;
        }
        html += createDigestCard({
            type: 'tip',
            icon: 'lightbulb',
            title: tipTitle,
            desc: tipContent,
            className: 'digest-card-full',
            showActions: true,
            itemId: 'tip-of-day'
        });
    }

    return html;
}

function createDigestCard({ type, icon, title, desc, footer, detailedInfo, itemId, className = '', showActions = false }) {
    const iconSvg = getIconSvg(icon);
    const escapedTitle = title.replace(/'/g, "\\'");

    // Build action buttons for attention cards OR any card with showActions
    let actionsHtml = '';
    if (type === 'attention' || showActions) {
        const noteBtn = `<button class="action-btn" onclick="event.stopPropagation(); showFeedbackModal('${escapedTitle}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Note</button>`;
        const ignoreBtn = `<button class="action-btn action-btn-muted" onclick="event.stopPropagation(); dismissWarning('${escapedTitle}')"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6"/></svg>Ignore</button>`;

        actionsHtml = `<div class="card-actions">${noteBtn}${ignoreBtn}</div>`;
    }

    // Info indicator SVG
    const infoIndicator = `<span class="info-indicator"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>`;

    // Store detailed info in a data attribute for the modal
    const dataAttr = (detailedInfo && itemId)
        ? `data-item-id="${itemId}" data-detailed='${JSON.stringify(detailedInfo).replace(/'/g, "&#39;")}'`
        : itemId ? `data-item-id="${itemId}"` : '';

    // Card is clickable if it has an itemId (attention items have detailed info)
    const clickHandler = itemId ? `onclick="showIssueDetails('${itemId}')"` : '';
    const clickableClass = itemId ? 'digest-card-clickable' : '';

    return `
    <div class="digest-card-item digest-card-${type} ${className} ${clickableClass}" ${dataAttr} ${clickHandler}>
        ${infoIndicator}
        <div class="digest-card-header">
            <div class="digest-card-icon">${iconSvg}</div>
            <div class="digest-card-title">${title}</div>
        </div>
        <div class="digest-card-desc">${desc}</div>
        ${actionsHtml}
        ${footer ? `<div class="digest-card-footer">${footer}</div>` : ''}
    </div>
    `;
}

/**
 * Dismiss a warning so it won't appear in future digests
 */
async function dismissWarning(title) {
    try {
        const response = await fetch('api/digest/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });

        const data = await response.json();

        if (data.success) {
            // Remove the card from the UI
            const cards = document.querySelectorAll('.digest-card-item');
            cards.forEach(card => {
                const cardTitle = card.querySelector('.digest-card-title');
                if (cardTitle && cardTitle.textContent === title) {
                    card.style.opacity = '0';
                    card.style.transform = 'translateX(20px)';
                    setTimeout(() => card.remove(), 300);
                }
            });
        }
    } catch (error) {
        console.error('Failed to dismiss warning:', error);
    }
}

// Make dismissWarning available globally
window.dismissWarning = dismissWarning;

function getIconSvg(name) {
    const icons = {
        'warning': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        'analytics': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2v-3h2v3zm4 0h-2v-5h2v5z"/></svg>`,
        'check_circle': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        'lightbulb': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>`,
        'insight': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>`, // Trending up/insight icon
        'dismiss': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`, // Close/X icon
        'info': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>` // Info circle icon
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

/**
 * Show issue details in a modal popup
 */
function showIssueDetails(itemId) {
    const card = document.querySelector(`[data-item-id="${itemId}"]`);
    if (!card) return;

    const title = card.querySelector('.digest-card-title')?.textContent ||
        card.querySelector('.summary-block-label span')?.textContent || 'Details';
    const description = card.querySelector('.digest-card-desc')?.textContent ||
        card.querySelector('.summary-block-text')?.textContent || '';
    const severity = card.querySelector('.digest-card-footer')?.textContent?.replace('Severity: ', '') || '';

    let detailedInfo = {};
    try {
        const dataStr = card.dataset.detailed;
        if (dataStr) {
            detailedInfo = JSON.parse(dataStr.replace(/&#39;/g, "'"));
        }
    } catch (e) {
        console.error('Failed to parse detailed info:', e);
    }

    // If no detailed info, use showGenericDetails instead
    if (!detailedInfo.explanation && !detailedInfo.suggestions && !detailedInfo.troubleshooting) {
        showGenericDetails(itemId, title, description);
        return;
    }

    // Build modal content
    const escapedTitle = title.replace(/'/g, "\\'");
    const modalHtml = `
    <div class="modal-overlay active" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <h4>Severity</h4>
                    <span class="modal-severity ${severity.toLowerCase()}">${severity}</span>
                </div>
                ${detailedInfo.explanation ? `
                <div class="modal-section">
                    <h4>Details</h4>
                    <p>${detailedInfo.explanation}</p>
                </div>
                ` : ''}
                ${detailedInfo.affected_entities && detailedInfo.affected_entities.length > 0 ? `
                <div class="modal-section">
                    <h4>Affected Entities</h4>
                    <div class="modal-entities">
                        ${detailedInfo.affected_entities.map(e => `<span class="entity-tag">${e}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
                ${detailedInfo.suggestions && detailedInfo.suggestions.length > 0 ? `
                <div class="modal-section">
                    <h4>Suggestions</h4>
                    <ul>
                        ${detailedInfo.suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${detailedInfo.troubleshooting ? `
                <div class="modal-section">
                    <h4>Troubleshooting</h4>
                    <p>${detailedInfo.troubleshooting}</p>
                </div>
                ` : ''}
            </div>
            <div class="modal-footer modal-footer-actions">
                <button class="action-btn" onclick="closeModal(); showFeedbackModal('${escapedTitle}');">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Add Note
                </button>
                <button class="action-btn action-btn-muted" onclick="closeModal(); dismissWarning('${escapedTitle}');">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    Ignore
                </button>
            </div>
        </div>
    </div>
    `;

    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Show generic details modal for items without detailed_info (observations, tips, system insight)
 */
function showGenericDetails(itemId, title, content) {
    const escapedTitle = title.replace(/'/g, "\\'");

    const modalHtml = `
    <div class="modal-overlay active" onclick="closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <p>${content}</p>
                </div>
            </div>
            <div class="modal-footer modal-footer-actions">
                <button class="action-btn" onclick="closeModal(); showFeedbackModal('${escapedTitle}');">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Add Note
                </button>
                <button class="action-btn action-btn-muted" onclick="closeModal(); dismissWarning('${escapedTitle}');">
                    <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                    Ignore
                </button>
            </div>
        </div>
    </div>
    `;

    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Make showGenericDetails available globally
window.showGenericDetails = showGenericDetails;

/**
 * Close the modal
 */
function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Make modal functions available globally
window.showIssueDetails = showIssueDetails;
window.closeModal = closeModal;

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

/**
 * Update the history sidebar based on cached list and active ID
 */
function updateHistorySidebar() {
    const historyCard = document.getElementById('history-card');
    const digestList = document.getElementById('digest-list');
    const digests = window.digestsList || [];

    // Filter out the active digest
    const filteredDigests = digests.filter(d => d.id !== window.activeDigestId);

    if (filteredDigests.length > 0) {
        historyCard.classList.remove('hidden');
        digestList.innerHTML = renderDigestListItems(filteredDigests, digests); // Pass filtered and full list
    } else {
        historyCard.classList.add('hidden');
    }
}

/**
 * Render the list items HTML
 */
function renderDigestListItems(digestsToRender, allDigests) {
    // Determine the ID of the "current/latest" digest (assumed to be the first one in the full list)
    const latestId = (allDigests && allDigests.length > 0) ? allDigests[0].id : -1;

    return digestsToRender.map(digest => {
        const isCurrent = digest.id === latestId;
        const d = new Date(digest.timestamp);
        // Format without comma: "12/20/2025 2:14:40 PM"
        const dateStr = d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }) + ' ' + d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });

        // Label logic: "Current" (bold, no date) or Date
        const label = isCurrent ? `<strong>Current</strong>` : dateStr;
        const highlightClass = isCurrent ? 'current-item' : '';

        return `
            <div class="digest-list-item ${highlightClass}" onclick="loadFullDigest(${digest.id})">
                <span class="digest-date">${label}</span>
                <span class="digest-summary">${digest.summary || 'No summary'}</span>
                <span class="digest-attention ${digest.attention_count > 0 ? 'warning' : ''}">${digest.attention_count} items</span>
            </div>
        `;
    }).join('');
}

// ============================================
// User Notes Modal
// ============================================

/**
 * Show modal for adding a note to a warning
 */
function showFeedbackModal(title) {
    const modalHtml = `
    <div class="modal-overlay active" onclick="closeFeedbackModal(event)">
        <div class="modal-content feedback-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>Add Note</h3>
                <button class="modal-close" onclick="closeFeedbackModal()">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <h4>For: ${title}</h4>
                    <p class="feedback-hint">Add a note to help the AI understand your preferences. For example: "I don't update this", "This is expected", etc.</p>
                </div>
                <div class="modal-section">
                    <textarea id="feedback-input" class="feedback-textarea" placeholder="Type your note here..." rows="4"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeFeedbackModal()">Cancel</button>
                <button class="btn-primary" onclick="saveFeedback('${title.replace(/'/g, "\\'")}')">Save</button>
            </div>
        </div>
    </div>
    `;

    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Focus the textarea
    setTimeout(() => {
        document.getElementById('feedback-input')?.focus();
    }, 100);
}

/**
 * Close the feedback modal
 */
function closeFeedbackModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

/**
 * Save feedback to the backend
 */
async function saveFeedback(title) {
    const feedbackInput = document.getElementById('feedback-input');
    const feedback = feedbackInput?.value?.trim();

    if (!feedback) {
        feedbackInput?.classList.add('error');
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
            closeFeedbackModal();
            showToast('Feedback saved!');
        } else {
            throw new Error(data.error || 'Failed to save feedback');
        }
    } catch (error) {
        console.error('Failed to save feedback:', error);
        showToast('Failed to save feedback', 'error');
    }
}

/**
 * Show a toast notification
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

// Make feedback functions available globally
window.showFeedbackModal = showFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.saveFeedback = saveFeedback;

