const fileList = document.getElementById('fileList');
const videoPlayer = videojs('videoPlayer', {html5: {localStorage: {}, hls: {withCredentials: false}}});
const backButton = document.getElementById('backButton');
const screenshotButton = document.getElementById('screenshotButton');
const timeInput = document.getElementById('timeInput');
let currentPath = '';

const lastTime = localStorage.getItem('lastTime');
if (lastTime) {
    videoPlayer.currentTime(lastTime);
}

videoPlayer.on('timeupdate', function () {
    localStorage.setItem('lastTime', this.currentTime());
});


const loadFiles = (path = '') => {
    fileList.innerHTML = '';
    currentPath = path;
    fetch(`/files/${path}`).then((response) => response.json()).then((files) => {
        files.forEach((file) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = file.name;
            a.onclick = () => {
                if (file.type === 'directory') {
                    loadFiles(`${path}/${file.name}`);
                } else {
                    videoPlayer.src({src: `/videos${path}/${file.name}`, type: 'video/mp4'});
                }
            };
            li.appendChild(a);
            fileList.appendChild(li);
        });
    });
};

backButton.onclick = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    loadFiles(parentPath);
};

loadFiles();


const takeScreenshot = async () => {
    const offscreenCanvas = new OffscreenCanvas(videoPlayer.videoWidth(), videoPlayer.videoHeight());
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.drawImage(videoPlayer.tech_.el_, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const blob = await new Promise(resolve => offscreenCanvas.convertToBlob().then(resolve));
    const formData = new FormData();
    formData.append('file', blob);
    const response = await fetch('/screenshot', {method: 'POST', body: formData});
    const blob2 = await response.blob();
    const a = document.createElement('a');
    const currentTime = videoPlayer.currentTime();
    const videoName = videoPlayer.src().split('/').pop().split('.')[0];
    a.href = URL.createObjectURL(blob2);
    a.download = `${videoName}_${currentTime.toFixed(2)}s_Screenshot.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }, 0);
};


screenshotButton.onclick = async () => {
    const time = timeInput.value;
    const totalSeconds = time ? time.split(':').reduce((acc, cur) => (60 * acc) + +cur, 0) : 0;
    if (totalSeconds >= videoPlayer.duration()) {
        timeInput.value = '';
        return;
    }
    if (totalSeconds > 0) {
        await new Promise(resolve => {
            videoPlayer.currentTime(totalSeconds);
            videoPlayer.one('seeked', resolve);
        });
    }
    await takeScreenshot();
    timeInput.value = '';
};


document.addEventListener('keydown', event => {
    if (event.target === timeInput && event.key === 'Enter') {
        screenshotButton.click();
        return;
    }
    if (event.target === timeInput) {
        return;
    }
    if (event.shiftKey) {
        if (event.key === 'ArrowLeft') {
            videoPlayer.currentTime(videoPlayer.currentTime() - 0.1);
            return;
        } else if (event.key === 'ArrowRight') {
            videoPlayer.currentTime(videoPlayer.currentTime() + 0.1);
            return;
        }
    }
    switch (event.key) {
        case ' ':
            videoPlayer.paused() ? videoPlayer.play() : videoPlayer.pause();
            break;
        case 'ArrowLeft':
            videoPlayer.currentTime(videoPlayer.currentTime() - 5);
            break;
        case 'ArrowRight':
            videoPlayer.currentTime(videoPlayer.currentTime() + 5);
            break;
        case 'ArrowUp':
            videoPlayer.volume(videoPlayer.volume() + 0.1);
            break;
        case 'ArrowDown':
            videoPlayer.volume(videoPlayer.volume() - 0.1);
            break;
        case 'm':
            videoPlayer.muted(!videoPlayer.muted());
            break;
        case 'f' :
            if (document.fullscreenElement) {
                document.exitFullscreen().then(() => {
                });
                break;
            } else videoPlayer.requestFullscreen().then(() => {
            });
            break;
        case 's':
            screenshotButton.click();
            break;
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const themeButton = document.getElementById('themeButton');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        themeButton.innerHTML = '☀';
    } else {
        document.documentElement.setAttribute('data-bs-theme', 'light');
        themeButton.innerHTML = '&#x1f319;';
    }

    themeButton.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-bs-theme');
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-bs-theme', 'light');
            themeButton.innerHTML = '&#x1f319;';
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
            themeButton.innerHTML = '☀';
            localStorage.setItem('theme', 'dark');
        }
    });
});


