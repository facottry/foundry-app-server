import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";


const PROMPT =
    "Minimal premium SaaS category card UI, clean white background, soft shadows, modern typography";
const ASSET_COUNT = 3;
const ASSET_FOLDER = "GEMINI_IMAGE";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, "./../.env")
});

const OUTPUT_DIR = path.join(__dirname, "../../public", ASSET_FOLDER);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateImages() {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-preview-image-generation"
    });

    console.log("Starting Gemini image generation...");

    for (let i = 1; i <= ASSET_COUNT; i++) {
        try {
            const result = await model.generateContent({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: PROMPT }]
                    }
                ]
            });

            const parts = result.response.candidates[0].content.parts;
            const imagePart = parts.find(p => p.inlineData);

            if (!imagePart?.inlineData?.data) {
                throw new Error("Image data missing");
            }

            const buffer = Buffer.from(
                imagePart.inlineData.data,
                "base64"
            );

            const fileName = `asset_${Date.now()}_${i}.png`;
            fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buffer);

            console.log(`✓ Saved ${fileName}`);
        } catch (err) {
            console.error(`✗ Failed image ${i}`, err.message);
        }
    }

    console.log("Image generation completed.");
}

generateImages();
