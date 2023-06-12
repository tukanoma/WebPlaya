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
        res.json({status: 'success'});
    } else {
        res.status(500).json({error: 'An error occurred'});
    }
});

/*Monitor changes in the folder and automatically call the generateVttFile() function to generate a thumbnail if a new video file is detected.
If the corresponding video file is deleted, automatically clean up the corresponding .vtt and thumbnail files.*/
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
                generateVttFile(filePath, duration).then(() => {
                    return true;
                });
            });
        }
    });
    watcher.on('unlink', (filePath) => {
        if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
            console.log(filePath + 'Was deleted');
            fs.unlinkSync(filePath + '.vtt');
            for (let i = 1; i <= 99; i++) {
                const filename = `${filePath}-${i.toString().padStart(2, '0')}.jpg`;
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


async function generateVttFile(filename, duration) {
    try {
        await fs.promises.access(`${filename}.vtt`);
        console.log('\x1b[33m%s\x1b[0m', `${filename}.vtt already exists, skipping processing`);

    } catch (err) {
        const width = 320;
        const height = 180;
        const interval = 1;
        const fps = 1 / interval;
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
            const ffmpeg = spawn('ffmpeg', ['-i', `${filename}`, '-vf', `fps=${fps},scale=${width}:${height},tile=${col}x${row}`, '-y', `${filename}-%02d.jpg`]);
            ffmpeg.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });
            ffmpeg.stderr.on('data', (data) => {
                console.log(`stderr: ${data}`);
            });
            ffmpeg.on('close', () => {
                console.log('\x1b[32m%s\x1b[0m', `${filename} thumbnail generation successes`);
            });
        });
    }
}