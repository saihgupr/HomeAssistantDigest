let discoveredEntities = [];
let selectedCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
    checkConnection();

    document.getElementById('discover-btn').addEventListener('click', discoverEntities);
    document.getElementById('rescan-btn').addEventListener('click', discoverEntities);
    document.getElementById('save-btn').addEventListener('click', saveEntities);
});

async function checkConnection() {
    const statusEl = document.getElementById('connection-status');
    const infoEl = document.getElementById('connection-info');
    const discoveryCard = document.getElementById('discovery-card');

    try {
        const response = await fetch('/api/entities/connection');
        const data = await response.json();

        if (data.connected) {
            statusEl.classList.add('status-ok');
            infoEl.innerHTML = `
                <p class="success">✓ Connected to Home Assistant</p>
                <p><strong>Version:</strong> ${data.version}</p>
                <p><strong>Location:</strong> ${data.location_name}</p>
            `;
            discoveryCard.style.display = 'block';
        } else {
            statusEl.classList.add('status-error');
            infoEl.innerHTML = `
                <p class="error">✗ Cannot connect to Home Assistant</p>
                <p>Error: ${data.error || 'Unknown error'}</p>
                <p class="hint">Make sure the add-on has the correct permissions and is running inside Home Assistant.</p>
            `;
        }
    } catch (error) {
        statusEl.classList.add('status-warning');
        infoEl.innerHTML = `
            <p class="warning">⚠ Running in development mode</p>
            <p>Home Assistant API not available. This is normal when testing locally.</p>
        `;
        // Show discovery anyway for testing
        discoveryCard.style.display = 'block';
    }
}

async function discoverEntities() {
    showLoading('Discovering entities...');

    try {
        const response = await fetch('/api/entities/discover');

        if (!response.ok) {
            throw new Error(`Discovery failed: ${response.statusText}`);
        }

        const data = await response.json();
        discoveredEntities = data.entities;

        renderResults(data);

        document.getElementById('discovery-card').style.display = 'none';
        document.getElementById('results-card').style.display = 'block';
    } catch (error) {
        console.error('Discovery error:', error);
        alert(`Discovery failed: ${error.message}\n\nThis may be because you're running outside of Home Assistant.`);
    } finally {
        hideLoading();
    }
}

function renderResults(data) {
    // Update count badge
    document.getElementById('entity-count').textContent = `${data.total} entities`;

    // Update summary
    const categories = Object.keys(data.byCategory);
    const summary = categories.map(cat => {
        const count = data.byCategory[cat].length;
        return `${count} ${cat}`;
    }).join(', ');
    document.getElementById('discovery-summary').textContent = `Found: ${summary}`;

    // Render category tabs
    renderCategoryTabs(data.byCategory);

    // Render entity list
    renderEntityList(data.entities);
}

function renderCategoryTabs(byCategory) {
    const tabsEl = document.getElementById('category-tabs');
    const categories = ['all', ...Object.keys(byCategory).sort()];

    tabsEl.innerHTML = categories.map(cat => {
        const count = cat === 'all' ? discoveredEntities.length : (byCategory[cat]?.length || 0);
        const active = cat === selectedCategory ? 'active' : '';
        return `
            <button class="category-tab ${active}" data-category="${cat}">
                ${cat.charAt(0).toUpperCase() + cat.slice(1)}
                <span class="tab-count">${count}</span>
            </button>
        `;
    }).join('');

    // Add click handlers
    tabsEl.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            selectedCategory = tab.dataset.category;
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderEntityList(discoveredEntities);
        });
    });
}

function renderEntityList(entities) {
    const listEl = document.getElementById('entity-list');

    // Filter by selected category
    const filtered = selectedCategory === 'all'
        ? entities
        : entities.filter(e => e.category === selectedCategory);

    if (filtered.length === 0) {
        listEl.innerHTML = '<p class="empty-state">No entities in this category</p>';
        return;
    }

    listEl.innerHTML = filtered.map(entity => `
        <div class="entity-item" data-entity-id="${entity.entity_id}">
            <div class="entity-info">
                <span class="entity-name">${entity.friendly_name}</span>
                <span class="entity-id">${entity.entity_id}</span>
            </div>
            <div class="entity-meta">
                <span class="entity-state">${entity.state}</span>
                <span class="entity-strategy">${formatStrategy(entity.storage_strategy)}</span>
            </div>
            <div class="entity-priority">
                <select class="priority-select priority-${entity.priority}" 
                        data-entity-id="${entity.entity_id}"
                        onchange="updatePriority(this)">
                    <option value="critical" ${entity.priority === 'critical' ? 'selected' : ''}>Critical</option>
                    <option value="normal" ${entity.priority === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="low" ${entity.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="ignore" ${entity.priority === 'ignore' ? 'selected' : ''}>Ignore</option>
                </select>
            </div>
        </div>
    `).join('');
}

function formatStrategy(strategy) {
    const labels = {
        'hourly_avg': '⏱ Hourly Avg',
        'hourly_sum': '⏱ Hourly Sum',
        'daily_summary': '📅 Daily Summary',
        'daily_snapshot': '📸 Daily Snapshot'
    };
    return labels[strategy] || strategy;
}

function updatePriority(selectEl) {
    const entityId = selectEl.dataset.entityId;
    const priority = selectEl.value;

    // Update local data
    const entity = discoveredEntities.find(e => e.entity_id === entityId);
    if (entity) {
        entity.priority = priority;
    }

    // Update visual class
    selectEl.className = `priority-select priority-${priority}`;
}

async function saveEntities() {
    showLoading('Saving entities...');

    try {
        // Only save entities that aren't ignored (or save all and let collector filter)
        const toSave = discoveredEntities.map(e => ({
            entity_id: e.entity_id,
            friendly_name: e.friendly_name,
            domain: e.domain,
            category: e.category,
            priority: e.priority,
            storage_strategy: e.storage_strategy
        }));

        const response = await fetch('/api/entities/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entities: toSave })
        });

        if (!response.ok) {
            throw new Error(`Save failed: ${response.statusText}`);
        }

        const result = await response.json();

        // Redirect to main dashboard
        alert(`Saved ${result.saved} entities (${result.monitored} will be monitored)`);
        window.location.href = '/';
    } catch (error) {
        console.error('Save error:', error);
        alert(`Save failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function showLoading(text) {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}
