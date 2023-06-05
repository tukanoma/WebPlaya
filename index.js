const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const app = express();
const upload = multer({dest: 'uploads/'});
const {exec} = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
require('videojs-thumbnail-sprite');

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

fs.watch('/public/videos', (eventType, filename) => {
    if (eventType === 'rename') {
        if (filename.endsWith('.mp4') || filename.endsWith('.mkv')) {
            ffmpeg.ffprobe(filename, function (err, metadata) {
                if (err) {
                    console.error(err);
                    return;
                }
                const duration = metadata.format.duration;
                generateVttFile(filename, duration);
                console.log(filename + 'succeeded');
            });
        }
    }
});

const {generateThumbnails} = require('/public/webvtt.js');

function generateVttFile(filename, duration) {
    generateThumbnails(filename, duration);
}
