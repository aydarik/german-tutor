let allWords = [];
let currentWord = null;
let currentDirection = 'de-to-trans'; // de-to-trans or trans-to-de

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

async function init() {
    try {
        const response = await fetch('/api/words');
        allWords = await response.json();
        wordCountEl.textContent = allWords.length;
        loadNextCard();
    } catch (err) {
        console.error("Failed to load words", err);
        questionEl.textContent = "Error loading words.";
    }
}

function loadNextCard() {
    if (allWords.length === 0) {
        questionEl.textContent = "Alles gelernt! No more words.";
        exampleContainerEl.classList.add('hidden');
        answerInputEl.disabled = true;
        checkBtnEl.disabled = true;
        return;
    }

    currentWord = allWords[Math.floor(Math.random() * allWords.length)];
    currentDirection = Math.random() > 0.5 ? 'de-to-trans' : 'trans-to-de';

    // Reset UI
    feedbackEl.classList.add('hidden');
    markBtnEl.classList.add('hidden');
    suggestionsEl.classList.add('hidden');
    inputGroupEl.classList.remove('hidden');
    answerInputEl.value = '';
    answerInputEl.disabled = false;
    answerInputEl.focus();
    checkBtnEl.disabled = false;

    if (currentDirection === 'de-to-trans') {
        directionLabelEl.textContent = "German to Russian/English";
        questionEl.textContent = currentWord.german;

        if (currentWord.example) {
            exampleContainerEl.classList.remove('hidden');
            exampleTextEl.textContent = currentWord.example;
        } else {
            exampleContainerEl.classList.add('hidden');
        }
    } else {
        directionLabelEl.textContent = "Russian/English to German";
        questionEl.textContent = currentWord.translations;
        exampleContainerEl.classList.add('hidden');
    }
}

function updateSuggestions() {
    const input = answerInputEl.value.trim().toLowerCase();
    if (input.length < 1) {
        suggestionsEl.classList.add('hidden');
        return;
    }

    let possibleOptions = [];
    if (currentDirection === 'de-to-trans') {
        allWords.forEach(w => {
            w.translations.split(/[,\/]/).forEach(t => {
                const cleaned = t.trim();
                if (cleaned && !possibleOptions.includes(cleaned)) {
                    possibleOptions.push(cleaned);
                }
            });
        });
    } else {
        allWords.forEach(w => {
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
        filtered.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = opt;
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

function checkAnswer() {
    const userAnswer = answerInputEl.value.trim().toLowerCase();
    let isCorrect = false;
    let target = currentDirection === 'de-to-trans' ? currentWord.translations : currentWord.german;

    suggestionsEl.classList.add('hidden');

    if (userAnswer) {
        if (currentDirection === 'de-to-trans') {
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
            allWords = allWords.filter(w => w.line_index !== currentWord.line_index || w.file_path !== currentWord.file_path);
            wordCountEl.textContent = allWords.length;
            loadNextCard();
        }
    } catch (err) {
        console.error("Failed to mark word", err);
    }
}

checkBtnEl.addEventListener('click', checkAnswer);
answerInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkAnswer();
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
