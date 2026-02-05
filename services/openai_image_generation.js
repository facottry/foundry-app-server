import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import OpenAI from "openai";

// ---------- ESM SAFE SETUP ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, "./../.env")
});

// ---------- CONFIG ----------
const PROMPT =
    "Minimal premium SaaS category card UI, clean white background, soft shadows, modern typography";
const ASSET_SIZE = "1536x1024"; // MUST be valid OpenAI size
const ASSET_COUNT = 3;
const ASSET_FOLDER = "GEMINI_IMAGE"; // you can rename later
// ----------------------------

if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing in .env");
}

const OUTPUT_DIR = path.join(__dirname, "../../public", ASSET_FOLDER);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateImages() {
    console.log("Starting OpenAI image generation...");
    console.log({ PROMPT, ASSET_SIZE, ASSET_COUNT, OUTPUT_DIR });

    for (let i = 1; i <= ASSET_COUNT; i++) {
        try {
            const result = await openai.images.generate({
                model: "gpt-image-1",
                prompt: PROMPT,
                size: ASSET_SIZE
            });

            const image_base64 = result.data[0].b64_json;
            const buffer = Buffer.from(image_base64, "base64");

            const fileName = `asset_${Date.now()}_${i}.png`;
            fs.writeFileSync(path.join(OUTPUT_DIR, fileName), buffer);

            console.log(`✓ Saved ${fileName}`);
        } catch (err) {
            console.error(`✗ Failed image ${i}:`, err.message);
        }
    }

    console.log("Image generation completed.");
}

generateImages();
