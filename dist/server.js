"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const extract_1 = require("./extract");
const app = (0, express_1.default)();
const PORT = 3000;
// Configure Multer for memory storage
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
app.post('/api/extract', upload.single('image'), async (req, res) => {
    try {
        let targetUrl;
        // Check if file was uploaded
        if (req.file) {
            const base64Image = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype;
            targetUrl = `data:${mimeType};base64,${base64Image}`;
        }
        else if (req.body.imageUrl) {
            targetUrl = req.body.imageUrl;
        }
        if (!targetUrl) {
            return res.status(400).json({ error: 'Image URL or File is required' });
        }
        const text = await (0, extract_1.extractTextFromImage)(targetUrl);
        res.json({ text });
    }
    catch (error) {
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
        const data = await (0, extract_1.parseBillText)(text);
        res.json({ data });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to parse text' });
    }
});
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
