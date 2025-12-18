/**
 * Home Assistant Digest - Setup Wizard
 */

let questions = [];
let currentStep = 0;
let answers = {};

document.addEventListener('DOMContentLoaded', () => {
    initSetup();
});

async function initSetup() {
    try {
        // Load existing profile data
        const profileRes = await fetch('api/profile');
        const profileData = await profileRes.json();
        if (profileData.profile) {
            answers = profileData.profile;
        }

        // Load questions
        const questionsRes = await fetch('api/profile/questions');
        const questionsData = await questionsRes.json();
        questions = questionsData.questions;

        // Set up navigation
        document.getElementById('btn-back').addEventListener('click', goBack);
        document.getElementById('btn-next').addEventListener('click', goNext);

        // Render first question
        renderQuestion();
    } catch (error) {
        console.error('Failed to initialize setup:', error);
        showError('Failed to load setup wizard');
    }
}

function renderQuestion() {
    const question = questions[currentStep];

    // Update progress
    const progress = ((currentStep + 1) / questions.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `Step ${currentStep + 1} of ${questions.length}`;

    // Update question text
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-description').textContent = question.description || '';

    // Render question content based on type
    const content = document.getElementById('question-content');
    content.innerHTML = renderQuestionType(question);

    // Update navigation buttons
    document.getElementById('btn-back').disabled = currentStep === 0;
    const nextBtn = document.getElementById('btn-next');
    if (currentStep === questions.length - 1) {
        nextBtn.textContent = 'Finish Setup ✓';
    } else {
        nextBtn.textContent = 'Next →';
    }

    // Restore previous answers
    restoreAnswers(question);
}

function renderQuestionType(question) {
    switch (question.type) {
        case 'multi-field':
            return renderMultiField(question);
        case 'select':
            return renderSelect(question);
        case 'multi-select':
            return renderMultiSelect(question);
        case 'textarea':
            return renderTextarea(question);
        default:
            return '<p>Unknown question type</p>';
    }
}

function renderMultiField(question) {
    return question.fields.map(field => `
        <div class="form-field">
            <label for="${field.id}">${field.label}</label>
            ${field.type === 'number'
            ? `<input type="number" id="${field.id}" name="${field.id}" 
                    min="${field.min || 0}" max="${field.max || 100}" 
                    value="${field.default || 0}" class="input">`
            : `<input type="text" id="${field.id}" name="${field.id}" 
                    placeholder="${field.placeholder || ''}" class="input">`
        }
        </div>
    `).join('');
}

function renderSelect(question) {
    return `
        <div class="select-options">
            ${question.options.map(opt => `
                <label class="select-option">
                    <input type="radio" name="${question.id}" value="${opt.value}">
                    <span class="option-label">${opt.label}</span>
                </label>
            `).join('')}
        </div>
    `;
}

function renderMultiSelect(question) {
    return `
        <div class="multi-select-options">
            ${question.options.map(opt => `
                <label class="multi-select-option">
                    <input type="checkbox" name="${question.id}" value="${opt.value}">
                    <div class="option-content">
                        <span class="option-label">${opt.label}</span>
                        ${opt.description ? `<span class="option-desc">${opt.description}</span>` : ''}
                    </div>
                </label>
            `).join('')}
        </div>
    `;
}

function renderTextarea(question) {
    return `
        <textarea id="${question.id}" name="${question.id}" 
            class="textarea" rows="4" 
            placeholder="${question.placeholder || ''}"></textarea>
        ${question.optional ? '<p class="optional-note">This field is optional</p>' : ''}
    `;
}

function restoreAnswers(question) {
    const savedAnswer = answers[question.id];
    if (!savedAnswer) return;

    switch (question.type) {
        case 'multi-field':
            if (typeof savedAnswer === 'object') {
                for (const [key, value] of Object.entries(savedAnswer)) {
                    const input = document.getElementById(key);
                    if (input) input.value = value;
                }
            }
            break;
        case 'select':
            const radio = document.querySelector(`input[name="${question.id}"][value="${savedAnswer}"]`);
            if (radio) radio.checked = true;
            break;
        case 'multi-select':
            if (Array.isArray(savedAnswer)) {
                savedAnswer.forEach(val => {
                    const checkbox = document.querySelector(`input[name="${question.id}"][value="${val}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
            break;
        case 'textarea':
            const textarea = document.getElementById(question.id);
            if (textarea) textarea.value = savedAnswer;
            break;
    }
}

function collectAnswer() {
    const question = questions[currentStep];

    switch (question.type) {
        case 'multi-field':
            const fieldAnswers = {};
            question.fields.forEach(field => {
                const input = document.getElementById(field.id);
                if (input) {
                    fieldAnswers[field.id] = field.type === 'number'
                        ? parseInt(input.value) || 0
                        : input.value;
                }
            });
            answers[question.id] = fieldAnswers;
            break;
        case 'select':
            const selected = document.querySelector(`input[name="${question.id}"]:checked`);
            answers[question.id] = selected ? selected.value : null;
            break;
        case 'multi-select':
            const checked = document.querySelectorAll(`input[name="${question.id}"]:checked`);
            answers[question.id] = Array.from(checked).map(c => c.value);
            break;
        case 'textarea':
            const textarea = document.getElementById(question.id);
            answers[question.id] = textarea ? textarea.value : '';
            break;
    }
}

function validateAnswer() {
    const question = questions[currentStep];
    if (question.optional) return true;

    const answer = answers[question.id];

    switch (question.type) {
        case 'multi-field':
            return answer && Object.keys(answer).length > 0;
        case 'select':
            return !!answer;
        case 'multi-select':
            return Array.isArray(answer) && answer.length > 0;
        case 'textarea':
            return true; // Already checked optional above
        default:
            return true;
    }
}

function goBack() {
    if (currentStep > 0) {
        collectAnswer();
        currentStep--;
        renderQuestion();
    }
}

async function goNext() {
    collectAnswer();

    if (!validateAnswer()) {
        showValidationError('Please answer this question before continuing');
        return;
    }

    if (currentStep < questions.length - 1) {
        currentStep++;
        renderQuestion();
    } else {
        // Finish setup
        await saveProfile();
    }
}

async function saveProfile() {
    const nextBtn = document.getElementById('btn-next');
    nextBtn.disabled = true;
    nextBtn.textContent = 'Saving...';

    try {
        // Step 1: Save profile
        const response = await fetch('api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(answers)
        });

        if (!response.ok) {
            throw new Error('Failed to save profile');
        }

        // Step 2: Auto-configure entities (no manual selection needed!)
        nextBtn.textContent = 'Configuring entities...';
        const configResponse = await fetch('api/entities/auto-configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!configResponse.ok) {
            console.warn('Auto-configure failed, but profile saved. User can retry from dashboard.');
        } else {
            const result = await configResponse.json();
            console.log(`Auto-configured ${result.total} entities`);
        }

        // Redirect to main page - setup complete!
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Failed to save profile:', error);
        nextBtn.disabled = false;
        nextBtn.textContent = 'Finish Setup ✓';
        showError('Failed to save profile. Please try again.');
    }
}

function showError(message) {
    const content = document.getElementById('question-content');
    content.innerHTML = `<div class="error-message">${message}</div>`;
}

function showValidationError(message) {
    // Remove existing validation error
    const existing = document.querySelector('.validation-error');
    if (existing) existing.remove();

    const error = document.createElement('div');
    error.className = 'validation-error';
    error.textContent = message;
    document.getElementById('question-content').appendChild(error);

    // Auto-remove after 3 seconds
    setTimeout(() => error.remove(), 3000);
}
