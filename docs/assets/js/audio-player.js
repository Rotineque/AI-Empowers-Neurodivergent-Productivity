document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playConfigBtn');
    const playIcon = document.getElementById('playIcon');
    const audioStatus = document.getElementById('audioStatus');
    const article = document.getElementById('article-content');

    if (!article || !window.speechSynthesis) {
        document.querySelector('.audio-player-container').style.display = 'none';
        return;
    }

    const synth = window.speechSynthesis;
    let utterance = null;
    let isPlaying = false;
    let isPaused = false;

    // Get text content, clean up Markdown quirks if any remain in textContent
    // We traverse purely text nodes to avoid reading hidden elements or scripts
    function getReadableText(element) {
        let text = "";
        // Simple strategy: use innerText which approximates rendered text well
        text = element.innerText;

        // Remove citations like [1], [2] etc.
        text = text.replace(/\[\d+\]/g, '');
        // Remove image alt text placeholders
        text = text.replace(/!\[.*?\]/g, '');

        return text;
    }

    const fullText = getReadableText(article);

    // Split into chunks because some browsers limit utterance length
    // We'll split by paragraphs/periods for natural pauses
    const chunks = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    let currentChunkIndex = 0;

    function setupUtterance(textIndex) {
        if (textIndex >= chunks.length) {
            stopAudio();
            return;
        }

        const text = chunks[textIndex];
        const u = new SpeechSynthesisUtterance(text);

        // Language selection
        // Polish: pl-PL, English: en-US or en-GB
        u.lang = window.PAGE_LANG === 'pl' ? 'pl-PL' : 'en-US';

        // Select a voice if possible
        const voices = synth.getVoices();
        // Try to find a "Google" voice or "Microsoft" voice which are usually better
        const preferredVoice = voices.find(v => v.lang.includes(u.lang) && (v.name.includes('Google') || v.name.includes('Neural')));
        if (preferredVoice) {
            u.voice = preferredVoice;
        }

        u.rate = 1.0;
        u.pitch = 1.0;

        u.onend = () => {
            currentChunkIndex++;
            if (isPlaying && !isPaused) {
                setupUtterance(currentChunkIndex);
            }
        };

        u.onerror = (e) => {
            console.error('Speech synthesis error', e);
            // Try next chunk if one fails
            currentChunkIndex++;
            if (isPlaying) {
                setupUtterance(currentChunkIndex);
            }
        };

        utterance = u;
        synth.speak(utterance);
        updateStatus();
    }

    function startAudio() {
        if (synth.speaking && isPaused) {
            synth.resume();
            isPaused = false;
        } else {
            synth.cancel(); // Clear any existing queue
            currentChunkIndex = 0;
            setupUtterance(currentChunkIndex);
        }
        isPlaying = true;
        updateIcon(true);
    }

    function pauseAudio() {
        if (synth.speaking && !isPaused) {
            synth.pause();
            isPaused = true;
            isPlaying = true; // Still technically in a playback session
            updateIcon(false);
        }
    }

    function stopAudio() {
        synth.cancel();
        isPlaying = false;
        isPaused = false;
        currentChunkIndex = 0;
        updateIcon(false);
        updateStatus(true);
    }

    function updateIcon(playing) {
        if (playing) {
            playIcon.classList.remove('fa-play');
            playIcon.classList.add('fa-pause');
        } else {
            playIcon.classList.remove('fa-pause');
            playIcon.classList.add('fa-play');
        }
    }

    function updateStatus(reset = false) {
        if (reset) {
            audioStatus.textContent = "0% / 100%";
            return;
        }
        // Rough estimate of progress
        const percent = Math.round((currentChunkIndex / chunks.length) * 100);
        audioStatus.textContent = (window.PAGE_LANG === 'pl' ? "Czytanie: " : "Reading: ") + percent + "%";
    }

    playBtn.onclick = () => {
        if (isPlaying && !isPaused) {
            pauseAudio();
        } else {
            startAudio();
        }
    };

    // Handle voice loading (sometimes async in Chrome)
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            // Voices loaded, ready to go
        };
    }

    // Stop audio on nav away
    window.onbeforeunload = () => {
        synth.cancel();
    };
});
