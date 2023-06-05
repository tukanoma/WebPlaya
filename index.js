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

app.get('/public/thumbs/:fileName', function (req, res) {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'public/thumbs', fileName);
    res.sendFile(filePath);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function watchVideos(dir) {
    chokidar.watch(dir, {ignored: /^\./, persistent: true})
        .on('add', (filePath) => {
            console.log('Watching ' + filePath);
            if (filePath.endsWith('.mkv') || filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.avi')) {
                ffmpeg.ffprobe(filePath, function (err, metadata) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    const duration = metadata.format.duration;
                    generateVttFile(filePath, duration);
                });
            }
        });
}

watchVideos('/app/public/videos');

function generateVttFile(filename, duration) {
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
            let currentImageCount = 0;
            let currentTime = startTime.clone();
            let str = filename;
            let newStr = str.replace(/^\/app\/public\//, "");
            for (let k = 0; k < totalSpirits; k++) {
                for (let i = 0; i < row; i++) {
                    for (let j = 0; j < col; j++) {
                        currentImageCount = k * row * col + i * col + j;
                        if (currentImageCount > totalImages) {
                            break;
                        }
                        const thumbnailUrl = `${newStr}-${k + 1 < 10 ? '0' : ''}${k + 1}.jpg#xywh=${j * width},${i * height},${width},${height}`;
                        thumbOutput += `${currentTime.format('HH:mm:ss.SSS')} --> ${currentTime.add(interval, 'seconds').format('HH:mm:ss.SSS')}\n${thumbnailUrl}\n\n`;
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
}
