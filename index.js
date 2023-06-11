const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const app = express();
const upload = multer({dest: 'uploads/'});
const {spawn} = require('child_process');
const chokidar = require('chokidar');
const ffmpeg = require('fluent-ffmpeg');
const moment = require("moment");

app.use(express.static('public'));

app.get('/files/:folderPath(*)', (req, res) => {
    console.log(req.url);
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


app.post('/screenshot', upload.single('file'), (req, res) => {
    const imagePath = path.join(__dirname, 'uploads', req.file.filename + '.png');
    sharp(req.file.path)
        .toFile(imagePath)
        .then(() => {
            res.download(imagePath, () => {
                fs.unlink(imagePath, () => {
                });
                fs.unlink(req.file.path, () => {
                });
            });
        })
        .catch(() => {
            res.status(500).send({message: 'Error processing image'});
        });
});


app.get('/public/func.js', function (req, res) {
    res.set('Content-Type', 'text/javascript');
    res.sendFile(__dirname + '/public/func.js');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/thumbs', (req, res) => {
    if (watchVideos()) {
        res.send('OK');
    } else {
        res.send('Error');
    }
});

/*app.get('/thumbs', async (req, res) => {
    try {
        const result = await watchVideos();
        res.send('OK');
    } catch (error) {
        res.send('Error');
    }
});*/


/*async function watchVideos() {
    const watcher = chokidar.watch('/app/public/videos', {ignored: /(^|[\/\\])\../, persistent: true});
    watcher.on('add', async (filePath) => {
        if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
            console.log('Watching ' + filePath);
            try {
                ffmpeg.ffprobe(filePath, async function (err, metadata) {
                    if (err) {
                        console.error(err);
                        return false;
                    }
                    const duration = metadata.format.duration;
                    await generateVttFile(filePath, duration);
                });
            } catch (err) {
                console.error(err);
                return false;
            }
        }
        return true;
    });
    watcher.on('unlink', async (filePath) => {
        if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
            console.log(filePath + 'Was deleted');
            try {
                await fs.promises.unlink(filePath + '.vtt');
                for (let i = 1; i <= 10; i++) {
                    const filename = `${filePath}-${i.toString().padStart(2, '0')}.jpg`;
                    await fs.promises.unlink(filename);
                    console.log(`${filename} was deleted`);
                }
            } catch (err) {
                console.error(err);
                return false;
            }
            await watcher.unwatch(filePath);
        }
        return true;
    });
    return true;
}*/


function watchVideos() {
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
                generateVttFile(filePath, duration);
            });
        }
        return true;
    });
    watcher.on('unlink', (filePath) => {
        if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
            console.log(filePath + 'Was deleted');
            fs.unlinkSync(filePath + '.vtt');
            for (let i = 1; i <= 10; i++) {
                const filename = `${filePath}-${i.toString().padStart(2, '0')}.jpg`;
                fs.unlink(filename, (err) => {
                    if (err) throw err;
                    console.log(`${filename} was deleted`);
                });
            }
        }
        return true;
    });
    return true;
}


//watchVideos('/app/public/videos');

/*function generateVttFile(filename, duration) {
    fs.access(`${filename}.vtt`, (err) => {
        if (err) {
            const width = 320; // width of each thumbnail
            const height = 180; // height of each thumbnail
            const interval = 1; // Interval between thumbnails in seconds
            const col = 15; // Number of thumbnails per row
            const row = 15; // Number of thumbnails per column
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

                        thumbOutput += `${newStr}-${k + 1 < 10 ? '0' : ''}${k + 1}.jpg#xywh=${j * width},${
                            i * height
                        },${width},${height}\n\n`;

                        startTime.add(interval, 'seconds');
                        endTime.add(interval, 'seconds');
                    }
                }
            }
            fs.writeFileSync(`${filename}.vtt`, thumbOutput);
            console.log('\x1b[32m%s\x1b[0m', `${filename} Processing complete`);
            const ffmpegProcess = spawn('ffmpeg', ['-i', `${filename}`, '-vf', 'fps=1,scale=320:180,tile=15x15', '-y', `${filename}-%02d.jpg`]);
            ffmpegProcess.on('close', (code) => {
                console.log(`FFmpeg process exited with code ${code}`);
            });
            console.log(`${filename} thumbnail generation successes`);
        } else {
            console.log('\x1b[33m%s\x1b[0m', `${filename}.vtt are already exists, skipping processing`);
        }
    });
}*/


async function generateVttFile(filename, duration) {
    try {
        await fs.promises.access(`${filename}.vtt`);
        console.log('\x1b[33m%s\x1b[0m', `${filename}.vtt already exists, skipping processing`);

    } catch (err) {
        const width = 160;
        const height = 90;
        const interval = 5;
        const col = 15;
        const row = 15;
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

                    thumbOutput += `${newStr}-${k + 1 < 10 ? '0' : ''}${k + 1}.jpg#xywh=${j * width},${i * height},${width},${height}\n\n`;

                    startTime.add(interval, 'seconds');
                    endTime.add(interval, 'seconds');
                }
            }
        }
        fs.writeFileSync(`${filename}.vtt`, thumbOutput);
        console.log('\x1b[32m%s\x1b[0m', `${filename} Processing complete`);
        fs.access(`${filename}-01.jpg`, (err) => {
            if (!err) {
                return;
            }
            const ffmpeg = spawn('ffmpeg', ['-i', `${filename}`, '-vf', 'fps=0.2,scale=160:90,tile=15x15', '-n', `${filename}-%02d.jpg`]);
            ffmpeg.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            ffmpeg.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });
            ffmpeg.on('close', (code) => {
                console.log('\x1b[32m%s\x1b[0m', `${filename} thumbnail generation successes`);
            });
        });
    }
}