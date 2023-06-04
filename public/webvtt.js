function generateThumbnails(thumbnailPrefix, duration) {
    const fs = require('fs');
    const moment = require('moment');
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

// This loop is for generating multiple 5x5 sprite, you can remove this if you want all thumbnails in a single sprite
    /*    for (let k = 0; k < totalSpirits; k++) {
            for (let i = 0; i < row; i++) {
                for (let j = 0; j < col; j++) {
                    const currentImageCount = k * row * col + i * col + j;
                    if (currentImageCount > totalImages) {
                        break;
                    }
                    thumbOutput += `${startTime.format('HH:mm:ss.SSS')} --> ${endTime.format('HH:mm:ss.SSS')}\n`;

                    thumbOutput += `${thumbnailPrefix}-${k + 1 < 10 ? '0' : ''}${k + 1}.jpg#xywh=${j * width},${
                        i * height
                    },${width},${height}\n\n`;

                    startTime.add(interval, 'seconds');
                    endTime.add(interval, 'seconds');
                }
            }
        }*/
    let currentImageCount = 0;
    let currentTime = startTime.clone();

    for (let k = 0; k < totalSpirits; k++) {
        for (let i = 0; i < row; i++) {
            for (let j = 0; j < col; j++) {
                currentImageCount = k * row * col + i * col + j;
                if (currentImageCount > totalImages) {
                    break;
                }
                const thumbnailUrl = `${thumbnailPrefix}-${k + 1 < 10 ? '0' : ''}${k + 1}.jpg#xywh=${j * width},${i * height},${width},${height}`;
                thumbOutput += `${currentTime.format('HH:mm:ss.SSS')} --> ${currentTime.add(interval, 'seconds').format('HH:mm:ss.SSS')}\n${thumbnailUrl}\n\n`;
            }
        }
    }


    fs.writeFileSync(`public/thumbs/${thumbnailPrefix}.vtt`, thumbOutput);
}