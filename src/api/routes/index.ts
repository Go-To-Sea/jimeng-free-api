import fs from 'fs-extra';

import Response from '@/lib/response/Response.ts';
import images from "./images.ts";
import chat from "./chat.ts";
import ping from "./ping.ts";
import token from './token.js';
import models from './models.ts';
import referenceImages from './imagesReference.ts';
import upload from './upload.ts';
import video from './video.ts';

export default [
    {
        get: {
            '/': async () => {
                const content = await fs.readFile('public/welcome.html');
                return new Response(content, {
                    type: 'html',
                    headers: {
                        Expires: '-1'
                    }
                });
            }
        }
    },
    images,
    chat,
    ping,
    token,
    models,
    referenceImages,
    upload,
    video
];