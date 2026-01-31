import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { extractTextFromImage, parseBillText } from './extract';

const app = express();
const PORT = 3000;

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/extract', upload.single('image'), async (req, res) => {
    try {
        let targetUrl: string | undefined;

        // Check if file was uploaded
        if (req.file) {
            const base64Image = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype;
            targetUrl = `data:${mimeType};base64,${base64Image}`;
        } else if (req.body.imageUrl) {
            targetUrl = req.body.imageUrl;
        }

        if (!targetUrl) {
            return res.status(400).json({ error: 'Image URL or File is required' });
        }

        const text = await extractTextFromImage(targetUrl);
        res.json({ text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to extract text' });
    }
});

app.post('/api/parse', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const data = await parseBillText(text);
        res.json({ data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to parse text' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
