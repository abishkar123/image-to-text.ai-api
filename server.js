const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();


const app = express();
const PORT = 8000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json()); 

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // or specify a domain instead of '*'
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage: storage }).single('file');

let filePath;

app.post('/api/v1/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            return res.status(500).json(err);
        }
        filePath = req.file.path;
        res.status(200).json({ message: 'File uploaded successfully', path: filePath });
    });
});

app.post('/api/v1/gemini', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) { 
            return res.status(400).json({ error: 'Message is required' });
        }

        function fileToGenerativePart(filePath, mimeType) {
            return {
                inlineData: {
                    data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
                    mimeType
                }
            };
        }
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            temperature: 0.7,  // Adjusts randomness, higher value = more random
            max_tokens: 150,   // Limits the number of tokens in the generated response
            top_p: 0.9,        // Nucleus sampling, consider the top p% of probability mass
            frequency_penalty: 0.5, // Discourages repeating phrases, higher value = more penalty
            presence_penalty: 0.3   // Encourages introducing new topics, higher value = more penalty
        });

        const result = await model.generateContent([
            message,
            fileToGenerativePart(filePath, "image/*")
        ]);

        const response = await result.response
        const text = response.text();
        // res.status(200).json({text});
        res.send(text)

    } catch (error) {
        console.error('Error retrieving model:', error);
        res.status(500).json({ error: 'Failed to retrieve model', details: error.message });
    }
});

app.listen(PORT, () => console.log("Listening on PORT " + PORT));
