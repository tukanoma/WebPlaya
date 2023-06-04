const videoPlayer = new Plyr('#player');
const lastWatchedTime = localStorage.getItem('lastWatchedTime');
if (lastWatchedTime) {
    videoPlayer.currentTime = lastWatchedTime;
}
videoPlayer.on('timeupdate', () => {
    localStorage.setItem('lastWatchedTime', videoPlayer.currentTime);
});

const fileList = document.getElementById('fileList');
let currentPath = '';

document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
});

const addIconToLink = (link, file) => {
    const icon = document.createElement('i');
    if (file.type === 'directory') {
        link.className = 'icon-link link-warning';
        icon.className = ' bi bi-folder-fill';
    } else {
        icon.className = ' bi bi-file-earmark-play-fill';
    }
    link.insertBefore(icon, link.firstChild);
};
const loadFiles = (path = '') => {
    fileList.innerHTML = '';
    currentPath = path;
    fetch(`/files/${path}`).then((response) => response.json()).then((files) => {
        files.forEach((file) => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'icon-link';
            a.textContent = file.name;
            addIconToLink(a, file);
            a.onclick = () => {
                if (file.type === 'directory') {
                    loadFiles(`${path}/${file.name}`);
                } else {
                    const thumbs = file.name.split('.').slice(0, -1).join('.') + '.vtt';
                    videoPlayer.source = {
                        type: 'video',
                        sources: [
                            {
                                title: `${file.name}`,
                                src: `  /videos${path}/${file.name}`,
                                type: 'video/mp4',
                            },
                        ],
                        previewThumbnails: {
                            enabled: true,
                            src: `/thumbs/${thumbs}`,
                        },
                    };
                }
            };
            li.appendChild(a);
            fileList.appendChild(li);
        });
    });
};

const backButton = document.getElementById('backButton');
backButton.addEventListener('click', () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    loadFiles(parentPath);
});

const screenshotButton = document.getElementById('screenshotButton');
const timeInput = document.getElementById('timeInput');
screenshotButton.addEventListener('click', async () => {
    const time = timeInput.value;
    const totalSeconds = time ? time.split(':').reduce((acc, cur) => (60 * acc) + +cur, 0) : 0;
    if (totalSeconds >= videoPlayer.duration) {
        timeInput.value = '';
        return;
    }
    if (totalSeconds > 0) {
        await new Promise(resolve => {
            videoPlayer.currentTime = totalSeconds;
            videoPlayer.once('seeked', resolve);
        });
    }
    await takeScreenshot();
    timeInput.value = '';
});

const takeScreenshot = async () => {
    const offscreenCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(videoPlayer.media.videoWidth, videoPlayer.media.videoHeight) : document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.drawImage(videoPlayer.media, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const blob = await new Promise(resolve => offscreenCanvas.convertToBlob({type: 'image/png'}).then(resolve));
    const formData = new FormData();
    formData.append('file', blob);
    const response = await fetch('/screenshot', {method: 'POST', body: formData});
    const blob2 = await response.blob();
    const a = document.createElement('a');
    const currentTime = videoPlayer.currentTime;
    const videoName = videoPlayer.source.split('/').pop().split('.')[0];
    const decodeName = decodeURI(videoName);
    a.href = URL.createObjectURL(blob2);
    a.download = `${decodeName}_${currentTime.toFixed(2)}s_Screenshot.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }, 0);
};


timeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        screenshotButton.click();
    }
});
// Add event listeners to the video player for keyboard shortcuts
document.addEventListener('keydown', event => {
    if (event.target !== timeInput) {
        switch (event.key) {
            case ' ':
                videoPlayer.togglePlay();
                break;
            case 'ArrowLeft':
                if (event.shiftKey) {
                    videoPlayer.rewind(0.1);
                } else {
                    videoPlayer.rewind(5);
                }
                break;
            case 'ArrowRight':
                if (event.shiftKey) {
                    videoPlayer.forward(0.1);
                } else {
                    videoPlayer.forward(5);
                }
                break;
            case 'ArrowUp':
                videoPlayer.increaseVolume(0.1);
                break;
            case 'ArrowDown':
                videoPlayer.decreaseVolume(0.1);
                break;
            case 'm':
                videoPlayer.muted = !videoPlayer.muted;
                break;
            case 'f':
                videoPlayer.fullscreen.toggle();
                break;
            case 's':
                screenshotButton.click();
                break;
        }
    }
});
