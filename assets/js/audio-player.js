document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playConfigBtn');
    const playIcon = document.getElementById('playIcon');
    const audioStatus = document.getElementById('audioStatus');
    const article = document.getElementById('article-content');

    if (!article || !window.speechSynthesis) {
        const container = document.querySelector('.audio-player-container');
        if (container) container.style.display = 'none';
        return;
    }

    const synth = window.speechSynthesis;
    let utterance = null;
    let isPlaying = false;
    let isPaused = false;
    let keepAliveInterval = null;

    // Get text content, clean up Markdown quirks if any remain in textContent
    function getReadableText(element) {
        let text = element.innerText;
        // Remove citations like [1], [2] etc.
        text = text.replace(/\[\d+\]/g, '');
        // Remove image alt text placeholders
        text = text.replace(/!\[.*?\]/g, '');
        return text;
    }

    const fullText = getReadableText(article);

    // Split into chunks because some browsers limit utterance length
    // Split by sentences for natural pauses
    const chunks = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    let currentChunkIndex = 0;

    // Chrome has a bug where speech synthesis stops after ~15 seconds of "inactivity"
    // This keep-alive timer works around it by periodically pausing and resuming
    function startKeepAlive() {
        stopKeepAlive();
        keepAliveInterval = setInterval(() => {
            if (synth.speaking && !isPaused) {
                synth.pause();
                synth.resume();
            }
        }, 5000); // Every 5 seconds
    }

    function stopKeepAlive() {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
    }

    function setupUtterance(textIndex) {
        if (textIndex >= chunks.length) {
            stopAudio();
            return;
        }

        const text = chunks[textIndex];
        const u = new SpeechSynthesisUtterance(text);

        // Language selection
        u.lang = window.PAGE_LANG === 'pl' ? 'pl-PL' : 'en-US';

        // Select a voice if possible
        const voices = synth.getVoices();
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
        console.log("Starting Audio...");
        if (synth.speaking && isPaused) {
            console.log("Resuming...");
            synth.resume();
            isPaused = false;
        } else {
            console.log("New utterance...");
            synth.cancel();
            currentChunkIndex = 0;
            setupUtterance(currentChunkIndex);
        }
        isPlaying = true;
        updateIcon(true);
        startKeepAlive();
    }

    function pauseAudio() {
        if (synth.speaking && !isPaused) {
            synth.pause();
            isPaused = true;
            isPlaying = true;
            updateIcon(false);
            stopKeepAlive();
        }
    }

    function stopAudio() {
        synth.cancel();
        isPlaying = false;
        isPaused = false;
        currentChunkIndex = 0;
        updateIcon(false);
        updateStatus(true);
        stopKeepAlive();
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
            audioStatus.textContent = "0:00 / --:--";
            return;
        }
        const percent = Math.round((currentChunkIndex / chunks.length) * 100);
        audioStatus.textContent = (window.PAGE_LANG === 'pl' ? "Czytanie: " : "Reading: ") + percent + "%";
    }

    playBtn.onclick = () => {
        console.log("Play button clicked");
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

    // Stop audio on any navigation away from the page
    window.addEventListener('beforeunload', () => {
        stopAudio();
    });

    // Also handle visibility change (tab switch, minimize)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isPlaying && !isPaused) {
            // Page is hidden, stop to prevent lingering audio
            stopAudio();
        }
    });

    // Handle page hide event for better mobile/SPA support
    window.addEventListener('pagehide', () => {
        stopAudio();
    });
});
