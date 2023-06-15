const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');
const chokidar = require('chokidar');
const ffmpeg = require('fluent-ffmpeg');
const moment = require("moment");
const {Queue} = require('queue-typescript');
const ffmpegQueue = new Queue();

const fastify = require('fastify')({
    http2: true,
    https: {
        allowHTTP1: true,
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    },
    logger: false
});

fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'public')
})
fastify.get('/', async function (req, res) {
    return res.sendFile('index.html');
});

fastify.get('/files', (req, res) => {
    res.redirect(301, '/files/');
});
fastify.get('/files/:folderPath', function (req, res) {
    const folderPath = req.params.folderPath || '';
    const directoryPath = path.join(__dirname, 'public/videos', folderPath);
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            return res.status(500).send({message: 'Unable to scan folder'});
        }
        const fileList = files
            .filter((file) => {
                const filePath = path.join(directoryPath, file);
                const isDirectory = fs.lstatSync(filePath).isDirectory();
                const isVideo = /\.(mp4|mkv|webm|avi)$/i.test(file);
                return isDirectory || isVideo;
            })
            .map((file) => {
                const filePath = path.join(directoryPath, file);
                const isDirectory = fs.lstatSync(filePath).isDirectory();
                const type = isDirectory ? 'directory' : 'file';
                return {name: file, type};
            });
        res.send(fileList);
    });
});


fastify.listen({port: 3000, host: '0.0.0.0'}, (err, address) => {
    if (err) throw err
    console.log(`server listening on ${address}`);
})

fastify.get('/thumbs/', (req, res) => {
    if (monitorFiles()) {
        res.send({status: 'success'});
    } else {
        res.status(500).send({error: 'An error occurred'});
    }
});

/*Monitor changes in the folder and automatically call the generateVttFile() function to generate a thumbnail if a new video file is detected.
If the corresponding video file is deleted, automatically clean up the corresponding .vtt and thumbnail files.*/
function monitorFiles() {
    const watcher = chokidar.watch('/app/public/videos', {ignored: /(^|[\/\\])\../, persistent: true});
    watcher.on('add', (filePath) => {
        if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
            console.log('Watching ' + filePath);
            ffmpeg.ffprobe(filePath, function (err, metadata) {
                if (err) {
                    console.error(err);
                    return false;
                }
                const duration = metadata.format.duration;
                generateVttThumbnail(filePath, duration).then(() => {
                    return true;
                });
            });
        }
    });
    watcher.on('unlink', (filePath) => {
        if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
            console.log(filePath + 'Was deleted');
            fs.unlinkSync(filePath + '.vtt');
            for (let i = 1; i <= 10000; i++) {
                const filename = `${filePath}-${i.toString().padStart(5, '0')}.jpg`;
                fs.unlink(filename, (err) => {
                    if (err) return;
                    console.log(`${filename} was deleted`);
                });
            }
        }
    });
    watcher.on('ready', () => {
        console.log('\x1b[32m%s\x1b[0m', 'Initial scan complete. Ready for changes.');
    });
    return true;
}


/*
async function generateVttThumbnail(filename, duration) {
    try {
        await fs.promises.access(`${filename}.vtt`);
        console.log('\x1b[33m%s\x1b[0m', `${filename}.vtt already exists, skipping processing`);
    } catch (err) {
        const width = 320;
        const height = 180;
        const interval = 1;
        const fps = 1 / interval;
        const col = 10;
        const row = 10;
        let thumbOutput = 'WEBVTT\n\n';
        const startTime = moment('00:00:00', 'HH:mm:ss.SSS');
        const endTime = moment('00:00:00', 'HH:mm:ss.SSS').add(interval, 'seconds');
        const totalImages = Math.floor(duration / interval); // Total no of thumbnails
        const totalSpirits = Math.ceil(duration / interval / (row * col)); // Total no of spirits
        let newStr = filename.replace(/^\/app\/public/, "");
        for (let k = 0; k < totalSpirits; k++) {
            for (let i = 0; i < row; i++) {
                for (let j = 0; j < col; j++) {
                    const currentImageCount = k * row * col + i * col + j;
                    if (currentImageCount > totalImages) {
                        break;
                    }
                    thumbOutput += `${startTime.format('HH:mm:ss.SSS')} --> ${endTime.format('HH:mm:ss.SSS')}\n`;

                    thumbOutput += `${newStr}-${(k + 1).toString().padStart(5, '0')}.jpg#xywh=${j * width},${i * height},${width},${height}\n\n`;

                    //thumbOutput += `${newStr}-${k + 1 < 10 ? '0' : ''}${k + 1}.jpg#xywh=${j * width},${i * height},${width},${height}\n\n`;

                    startTime.add(interval, 'seconds');
                    endTime.add(interval, 'seconds');
                }
            }
        }
        fs.writeFileSync(`${filename}.vtt`, thumbOutput);
        console.log('\x1b[32m%s\x1b[0m', `${filename} Processing complete`);
        //check if the thumbnail already exists them skip the thumbnail generation
        fs.access(`${filename}-${totalImages.toString().padStart(5, '0')}.jpg`, (err) => {
            if (!err) {
                return;
            }
            const ffmpeg = spawn('ffmpeg', ['-i', `${filename}`, '-vf', `fps=${fps},scale=${width}:${height},tile=${col}x${row}`, '-q:v', '30', `${filename}-%05d.jpg`]);
            /!*            ffmpeg.stdout.on('data', (data) => {
                            console.log(`stdout: ${data}`);
                        });
                        ffmpeg.stderr.on('data', (data) => {
                            console.log(`stderr: ${data}`);
                        });*!/
            ffmpeg.on('start', () => {
                console.log('\x1b[32m%s\x1b[0m', `${filename} thumbnail generation started`);
            });
            ffmpeg.on('progress', (progress) => {
                console.log(`Processing: ${filename}` + progress.percent + '% done');
            });
            ffmpeg.on('close', () => {
                console.log('\x1b[32m%s\x1b[0m', `${filename} thumbnail generation successes`);
            });
        });
    }
}*/


async function generateVttThumbnail(filename, duration) {
    try {
        await fs.promises.access(`${filename}.vtt`);
        console.log('\x1b[33m%s\x1b[0m', `${filename}.vtt already exists, skipping processing`);
    } catch (err) {
        const width = 320;
        const height = 180;
        const interval = 1;
        const fps = 1 / interval;
        const col = 10;
        const row = 10;
        let thumbOutput = 'WEBVTT\n\n';
        const startTime = moment('00:00:00', 'HH:mm:ss.SSS');
        const endTime = moment('00:00:00', 'HH:mm:ss.SSS').add(interval, 'seconds');
        const totalImages = Math.floor(duration / interval);
        const totalSpirits = Math.ceil(duration / interval / (row * col));
        let newStr = filename.replace(/^\/app\/public/, "");
        for (let k = 0; k < totalSpirits; k++) {
            for (let i = 0; i < row; i++) {
                for (let j = 0; j < col; j++) {
                    const currentImageCount = k * row * col + i * col + j;
                    if (currentImageCount > totalImages) {
                        break;
                    }
                    thumbOutput += `${startTime.format('HH:mm:ss.SSS')} --> ${endTime.format('HH:mm:ss.SSS')}\n`;

                    thumbOutput += `${newStr}-${(k + 1).toString().padStart(5, '0')}.jpg#xywh=${j * width},${i * height},${width},${height}\n\n`;

                    startTime.add(interval, 'seconds');
                    endTime.add(interval, 'seconds');
                }
            }
        }
        fs.writeFileSync(`${filename}.vtt`, thumbOutput);
        console.log('\x1b[32m%s\x1b[0m', `${filename} vtt file generated`);
        //check if the thumbnail already exists them skip the thumbnail generation
        fs.access(`${filename}-${totalImages.toString().padStart(5, '0')}.jpg`, (err) => {
            if (!err) {
                return;
            }
            ffmpegQueue.enqueue({
                filename,
                fps,
                width,
                height,
                col,
                row
            });
            if (ffmpegQueue.length <= 2) {
                startFFmpeg();
            }
        });
    }
}

function startFFmpeg() {
    const task = ffmpegQueue.peek();
    if (!task) {
        return;
    }
    const {filename, fps, width, height, col, row} = task;
    const ffmpeg = spawn('ffmpeg', ['-i', `${filename}`, '-vf', `fps=${fps},scale=${width}:${height},tile=${col}x${row}`, '-q:v', '30', `${filename}-%05d.jpg`]);
    ffmpeg.on('start', () => {
        console.log('\x1b[32m%s\x1b[0m', `${filename} thumbnail generation started`);
    });
    ffmpeg.on('close', () => {
        console.log('\x1b[32m%s\x1b[0m', `${filename} thumbnail generation successes`);
        if (ffmpegQueue.length > 0) {
            startFFmpeg();
        }
    });
}
