const fs = require('fs');
const moment = require('moment');

const thumbnailPrefix = 'thumbs';

const width = 160; // width of each thumbnail
const height = 90; // height of each thumbnail

const duration = 112; // Total duration of the video in seconds
const interval = 1; // Interval between thumbnails in seconds

const col = 10; // Number of thumbnails per row
const row = 12; // Number of thumbnails per column

let thumbOutput = 'WEBVTT\n\n';
const startTime = moment('00:00:00', 'HH:mm:ss.SSS');
const endTime = moment('00:00:00', 'HH:mm:ss.SSS').add(interval, 'seconds');

const totalImages = Math.floor(duration / interval); // Total no of thumbnails

const totalSpirits = Math.ceil(duration / interval / (row * col)); // Total no of spirits

// This loop is for generating multiple 5x5 sprite, you can remove this if you want all thumbnails in a single sprite
for (let k = 0; k < totalSpirits; k++) {
    for (let i = 0; i < row; i++) {
        for (let j = 0; j < col; j++) {
            const currentImageCount = k * row * col + i * col + j;
            if (currentImageCount > totalImages) {
                break;
            }
            thumbOutput += `${startTime.format('HH:mm:ss.SSS')} --> ${endTime.format('HH:mm:ss.SSS')}\n`;

            thumbOutput += `${thumbnailPrefix}.jpg#xywh=${j * width},${
                i * height
            },${width},${height}\n\n`;

            startTime.add(interval, 'seconds');
            endTime.add(interval, 'seconds');
        }
    }
}

fs.writeFileSync('./output.vtt', thumbOutput);