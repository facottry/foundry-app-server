require('dotenv').config(); // Load from current directory
const { OpenAI } = require('openai');

const getKey = () => process.env.FOUNDRY_OPENAI_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

console.log('FOUNDRY_OPENAI_KEY:', !!process.env.FOUNDRY_OPENAI_KEY);
console.log('OPENAI_API_KEY:', !!process.env.OPENAI_API_KEY);
console.log('GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY);

const run = async () => {
    const apiKey = getKey();
    console.log('API Key present:', !!apiKey);

    if (!apiKey) {
        console.error('No API Key found');
        return;
    }

    const openai = new OpenAI({
        apiKey,
        // No custom baseURL, default to OpenAI
    });

    console.log('Base URL:', openai.baseURL);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Hello, return a JSON object with message='hi'." }],
            response_format: { type: "json_object" }
        });
        console.log('Success:', completion.choices[0].message.content);
    } catch (err) {
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
            console.error('Headers:', err.response.headers);
        } else {
            console.error('Error:', err);
        }
    }
};

run();
