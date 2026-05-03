let learnWords = [];
let currentWord = null;
let currentDirection = true; // de-to-trans or trans-to-de

const questionEl = document.getElementById('question');
const directionLabelEl = document.getElementById('direction-label');
const exampleContainerEl = document.getElementById('example-container');
const exampleTextEl = document.getElementById('example-text');
const answerInputEl = document.getElementById('answer-input');
const inputGroupEl = document.querySelector('.input-group');
const suggestionsEl = document.getElementById('suggestions');
const checkBtnEl = document.getElementById('check-btn');
const feedbackEl = document.getElementById('feedback');
const feedbackMsgEl = document.getElementById('feedback-message');
const correctAnswerEl = document.getElementById('correct-answer');
const nextBtnEl = document.getElementById('next-btn');
const markBtnEl = document.getElementById('mark-btn');
const wordCountEl = document.getElementById('word-count');
const progressBarEl = document.getElementById('progress-bar');

let totalWordsCount = 0;
let selectedSuggestionIndex = -1;

async function init() {
    try {
        const response = await fetch('/api/words');
        const allWords = await response.json();
        totalWordsCount = allWords.length;
        learnWords = allWords.filter(w => !w.is_marked)
        wordCountEl.textContent = String(learnWords.length);
        updateProgressBar();
        loadNextCard();
    } catch (err) {
        console.error("Failed to load words", err);
        questionEl.textContent = "Error loading words.";
    }
}

function loadNextCard() {
    // Reset UI
    feedbackEl.classList.add('hidden');
    markBtnEl.classList.add('hidden');
    suggestionsEl.classList.add('hidden');
    inputGroupEl.classList.remove('hidden');
    exampleContainerEl.classList.add('hidden');
    answerInputEl.value = '';
    answerInputEl.disabled = false;
    answerInputEl.focus();
    checkBtnEl.disabled = false;

    if (learnWords.length === 0) {
        questionEl.textContent = "Alles gelernt! No more words.";
        inputGroupEl.classList.add('hidden');
        exampleContainerEl.classList.add('hidden');
        answerInputEl.disabled = true;
        checkBtnEl.disabled = true;
        return;
    }

    currentWord = learnWords[Math.floor(Math.random() * learnWords.length)];
    currentDirection = Math.random() > 0.5;

    if (currentDirection) {
        directionLabelEl.textContent = "German to Russian/English";
        questionEl.textContent = currentWord.german;

        if (currentWord.example) {
            exampleContainerEl.classList.remove('hidden');
            exampleTextEl.textContent = currentWord.example;
        }
    } else {
        directionLabelEl.textContent = "Russian/English to German";
        questionEl.textContent = currentWord.translations;
    }
}

function updateSuggestions() {
    selectedSuggestionIndex = -1;
    const input = answerInputEl.value.trim().toLowerCase();
    if (input.length < 1) {
        suggestionsEl.classList.add('hidden');
        return;
    }

    let possibleOptions = [];
    if (currentDirection) {
        learnWords.forEach(w => {
            w.translations.split(/[,\/]/).forEach(t => {
                const cleaned = t.trim();
                if (cleaned && !possibleOptions.includes(cleaned)) {
                    possibleOptions.push(cleaned);
                }
            });
        });
    } else {
        learnWords.forEach(w => {
            const cleaned = w.german.trim();
            if (cleaned && !possibleOptions.includes(cleaned)) {
                possibleOptions.push(cleaned);
            }
        });
    }

    const filtered = possibleOptions
        .filter(opt => opt.toLowerCase().includes(input))
        .slice(0, 8);

    if (filtered.length > 0) {
        suggestionsEl.innerHTML = '';
        filtered.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = opt;
            div.onmouseenter = () => {
                selectedSuggestionIndex = index;
                updateSuggestionHighlight();
            };
            div.onclick = () => {
                answerInputEl.value = opt;
                suggestionsEl.classList.add('hidden');
                checkAnswer();
            };
            suggestionsEl.appendChild(div);
        });
        suggestionsEl.classList.remove('hidden');
    } else {
        suggestionsEl.classList.add('hidden');
    }
}

function updateSuggestionHighlight() {
    const items = suggestionsEl.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function checkAnswer() {
    const userAnswer = answerInputEl.value.trim().toLowerCase();
    let isCorrect = false;
    let target = currentDirection ? currentWord.translations : currentWord.german;

    suggestionsEl.classList.add('hidden');

    if (userAnswer) {
        if (currentDirection) {
            const possibleAnswers = target.toLowerCase().split(/[,\/]/).map(s => s.trim());
            isCorrect = possibleAnswers.some(ans => {
                return ans === userAnswer || (userAnswer.length > 2 && ans.includes(userAnswer));
            });
        } else {
            const targetLower = target.toLowerCase();
            isCorrect = targetLower === userAnswer || (userAnswer.length > 2 && targetLower.includes(userAnswer));
        }
    }

    showFeedback(isCorrect, target);
}

function showFeedback(isCorrect, correct) {
    feedbackEl.classList.remove('hidden');
    inputGroupEl.classList.add('hidden');
    answerInputEl.disabled = true;
    checkBtnEl.disabled = true;

    if (isCorrect) {
        feedbackMsgEl.textContent = "✅ Richtig!";
        feedbackMsgEl.style.color = "var(--success)";
        markBtnEl.classList.remove('hidden');
    } else {
        feedbackMsgEl.textContent = "❌ Nicht ganz...";
        feedbackMsgEl.style.color = "var(--error)";
    }

    correctAnswerEl.innerHTML = `Lösung: <strong>${correct}</strong>`;
}

async function markAsLearned() {
    try {
        const response = await fetch('/api/mark', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                file_path: currentWord.file_path,
                line_index: currentWord.line_index
            })
        });

        if (response.ok) {
            learnWords = learnWords.filter(w => w.line_index !== currentWord.line_index || w.file_path !== currentWord.file_path);
            wordCountEl.textContent = learnWords.length;
            updateProgressBar();
            loadNextCard();
        }
    } catch (err) {
        console.error("Failed to mark word", err);
    }
}

function updateProgressBar() {
    if (totalWordsCount === 0) {
        progressBarEl.style.width = '0';
        return;
    }
    const percentage = ((totalWordsCount - learnWords.length) / totalWordsCount) * 100;
    progressBarEl.style.width = `${percentage}%`;
}

checkBtnEl.addEventListener('click', checkAnswer);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (e.ctrlKey) {
            if (!markBtnEl.classList.contains('hidden')) {
                markAsLearned();
                e.preventDefault();
            }
            return;
        }
        if (!feedbackEl.classList.contains('hidden')) {
            loadNextCard();
        } else if (document.activeElement === answerInputEl) {
            const items = suggestionsEl.querySelectorAll('.suggestion-item');
            if (!suggestionsEl.classList.contains('hidden') && selectedSuggestionIndex >= 0 && selectedSuggestionIndex < items.length) {
                // Select highlighted suggestion
                items[selectedSuggestionIndex].click();
                e.preventDefault();
            } else {
                checkAnswer();
            }
        }
    } else if (e.key === 'ArrowDown') {
        if (!suggestionsEl.classList.contains('hidden')) {
            const items = suggestionsEl.querySelectorAll('.suggestion-item');
            if (items.length > 0) {
                selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;
                updateSuggestionHighlight();
                e.preventDefault();
            }
        }
    } else if (e.key === 'ArrowUp') {
        if (!suggestionsEl.classList.contains('hidden')) {
            const items = suggestionsEl.querySelectorAll('.suggestion-item');
            if (items.length > 0) {
                selectedSuggestionIndex = (selectedSuggestionIndex - 1 + items.length) % items.length;
                updateSuggestionHighlight();
                e.preventDefault();
            }
        }
    } else if (e.key === 'Escape') {
        suggestionsEl.classList.add('hidden');
        selectedSuggestionIndex = -1;
    }
});
answerInputEl.addEventListener('input', updateSuggestions);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) {
        suggestionsEl.classList.add('hidden');
    }
});

nextBtnEl.addEventListener('click', loadNextCard);
markBtnEl.addEventListener('click', markAsLearned);

init();
