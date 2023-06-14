const videoPlayer = new Plyr('#player');
const createThumbnail = document.getElementById('generateButton');
const title = document.getElementById('title');
const fileList = document.getElementById('fileList');
const backButton = document.getElementById('backButton');
const screenshotButton = document.getElementById('screenshotButton');
const timeInput = document.getElementById('timeInput');
const liveToast = document.getElementById('liveToast');
const continuePlay = document.getElementById('continuePlay');

//Add the icon before the link.
function addIconToLink(link, file) {
    const icon = document.createElement('i');
    if (file.type === 'directory') {
        link.className = 'icon-link link-warning';
        icon.className = ' bi bi-folder-fill';
    } else {
        icon.className = ' bi bi-file-earmark-play-fill';
    }
    link.insertBefore(icon, link.firstChild);
}

let currentPath = '';

function loadFiles(path = '') {
    fileList.innerHTML = '';
    currentPath = path;
    fetch(`/files${path}`).then((response) => response.json()).then((files) => {
        files.forEach((file) => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            const a = document.createElement('a');
            a.className = 'icon-link';
            a.textContent = file.name;
            addIconToLink(a, file);
            a.onclick = () => {
                if (file.type === 'directory') {
                    loadFiles(`${path}/${file.name}`);
                } else {
                    title.innerHTML = file.name.replace(/\.[^/.]+$/, '');
                    videoPlayer.source = {
                        type: 'video',
                        sources: [
                            {
                                title: `${file.name}`,
                                src: `/videos${path}/${file.name}`,
                                type: 'video/mp4',
                            },
                        ],
                        previewThumbnails: {
                            enabled: true,
                            src: `/videos${path}/${file.name}.vtt`,
                        },
                    };
                    //Automatically jump to the corresponding time if the video has been played before.
                    const lastWatchedTime = localStorage.getItem(file.name);
                    if (lastWatchedTime) {
                        setTimeout(() => {
                            videoPlayer.forward(parseFloat(lastWatchedTime));
                        }, 500);
                    }
                }
            };
            li.appendChild(a);
            fileList.appendChild(li);
        });
    });
}

function generateThumbnail() {
    setTimeout(() => {
        fetch('thumbs/').then(r => r.json()).then(data => {
            console.log(data);
            if (data.status === 'success') {
                createThumbnail.classList.remove('btn-secondary');
                createThumbnail.classList.add('btn-success');
                createThumbnail.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
            } else {
                createThumbnail.classList.remove('btn-secondary');
                createThumbnail.classList.add('btn-danger');
                createThumbnail.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i>';
            }
            setTimeout(() => {
                createThumbnail.classList.remove('btn-success', 'btn-danger');
                createThumbnail.classList.add('btn-secondary');
                createThumbnail.innerHTML = '<i class="bi bi-images"></i>';
            }, 1500);
        });
    }, 500);
}

//record the current playback time and the video name.
videoPlayer.on('timeupdate', () => {
    const source = videoPlayer.source;
    const fileName = decodeURIComponent(source.split('/').pop());
    localStorage.setItem(fileName, videoPlayer.currentTime);
    localStorage.setItem('lastWatched', fileName);
    localStorage.setItem('source', source);
});

async function takeScreenshot() {
    const offscreenCanvas = new OffscreenCanvas(videoPlayer.media.videoWidth, videoPlayer.media.videoHeight);
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.drawImage(videoPlayer.media, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const blob = await offscreenCanvas.convertToBlob({type: 'image/png'});
    const a = document.createElement('a');
    const currentTime = videoPlayer.currentTime;
    const videoName = videoPlayer.source.split('/').pop().split('.')[0];
    const decodeName = decodeURIComponent(videoName);
    a.href = URL.createObjectURL(blob);
    a.download = `${decodeName}_${currentTime.toFixed(2)}s_Screenshot.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }, 0);
}

document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
    if (localStorage.getItem('lastWatched')) {
        bootstrap.Toast.getOrCreateInstance(liveToast).show();
    }
});
document.addEventListener('keydown', event => {
    if (event.target !== timeInput) {
        switch (event.key) {
            case ' ':
                videoPlayer.togglePlay();
                break;
            case 'ArrowLeft':
                if (event.shiftKey && event.ctrlKey) {
                    videoPlayer.rewind(0.05);
                } else if (event.shiftKey) {
                    videoPlayer.rewind(1);
                } else {
                    videoPlayer.rewind(10);
                }
                break;
            case 'ArrowRight':
                if (event.shiftKey && event.ctrlKey) {
                    videoPlayer.forward(0.05);
                } else if (event.shiftKey) {
                    videoPlayer.forward(1);
                } else {
                    videoPlayer.forward(10);
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
backButton.addEventListener('click', () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    loadFiles(parentPath);
});
timeInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        screenshotButton.click();
    }
});
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
continuePlay.addEventListener('click', () => {
    const lastWatchedName = localStorage.getItem('lastWatched');
    const source = localStorage.getItem('source');
    const watchedTime = localStorage.getItem(lastWatchedName);
    title.innerHTML = lastWatchedName.replace(/\.[^/.]+$/, '');
    videoPlayer.source = {
        type: 'video',
        sources: [
            {
                title: lastWatchedName,
                src: source,
                type: 'video/mp4',
            },
        ],
        previewThumbnails: {
            enabled: true,
            src: `${source}.vtt`,
        },
    };
    setTimeout(() => {
        videoPlayer.forward(parseFloat(watchedTime));
    }, 500);
});
