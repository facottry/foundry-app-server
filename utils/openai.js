const OpenAI = require('openai');

const getClient = () => {
    const key = process.env.FOUNDRY_OPENAI_KEY || process.env.OPENAI_API_KEY;
    if (!key) return null;
    return new OpenAI({ apiKey: key });
};

/**
 * Generate tags for a product using AI
 * @param {string} name - Product name
 * @param {string} description - Product description
 * @param {string} category - Product category
 * @returns {Promise<string[]>} Array of tags
 */
const generateTags = async (name, description, category) => {
    try {
        const openai = getClient();
        if (!openai) {
            console.log('OpenAI key not configured, skipping generateTags');
            return [];
        }

        const prompt = `Given this product information:
Name: ${name}
Category: ${category}
Description: ${description}

Generate 5-8 relevant tags for this product. Tags should be:
- Single words or short phrases (2-3 words max)
- Lowercase
- Relevant to the product's features, use cases, or target audience
- No duplicates

Return ONLY a comma-separated list of tags, nothing else.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a product categorization assistant. Generate relevant, concise tags for SaaS products."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        const tagsString = completion.choices[0].message.content.trim();
        const tags = tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);

        return tags.slice(0, 8); // Limit to 8 tags
    } catch (error) {
        console.error('Error generating tags:', error.message);
        return []; // Return empty array on error
    }
};

/**
 * Improve product description by fixing minor typos and grammar
 * @param {string} description - Original description
 * @returns {Promise<string>} Improved description
 */
const improveDescription = async (description) => {
    try {
        const openai = getClient();
        if (!openai) return description;

        const prompt = `Fix ONLY minor typos, spelling errors, and obvious grammar mistakes in this product description. Keep the original tone, style, and content. Do not rewrite or add new information. Return ONLY the corrected text.

Original description:
${description}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a copy editor. Fix only typos and grammar errors. Do not rewrite or change the meaning."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error improving description:', error.message);
        return description; // Return original on error
    }
};

/**
 * Process product with AI enhancements
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} Enhanced product data
 */
const enhanceProduct = async (productData) => {
    const { name, description, categories } = productData;

    // Only enhance if OpenAI key is available
    if (!process.env.FOUNDRY_OPENAI_KEY) {
        console.log('OpenAI key not configured, skipping AI enhancements');
        return productData;
    }

    try {
        // Run both operations in parallel
        const [improvedDescription, generatedTags] = await Promise.all([
            improveDescription(description),
            generateTags(name, description, categories[0] || 'SaaS')
        ]);

        return {
            ...productData,
            description: improvedDescription,
            tags: generatedTags
        };
    } catch (error) {
        console.error('Error enhancing product:', error.message);
        return productData; // Return original on error
    }
};

/**
 * Tag contact message and assign priority
 * @param {string} subject - Message subject
 * @param {string} message - Message content
 * @returns {Promise<Object>} Tags and priority
 */
const tagContactMessage = async (subject, message) => {
    try {
        const openai = getClient();
        if (!openai) {
            return { tags: ['other'], priority: 'medium' };
        }

        const prompt = `Analyze this contact message and categorize it with relevant tags.

Subject: ${subject}
Message: ${message}

Available tags:
- urgent: Critical issues, security concerns, payment problems
- feature-request: New feature suggestions
- bug-report: Bug reports or technical issues
- question: General questions or help requests
- feedback: Product feedback or suggestions
- partnership: Business partnerships or collaborations
- other: Anything else

Return ONLY a JSON object with this exact format:
{
  "tags": ["tag1", "tag2"],
  "priority": "high|medium|low"
}

Priority rules:
- high: urgent issues, security, payment problems
- medium: bug reports, feature requests, partnerships
- low: general questions, feedback`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a message classification assistant. Return only valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 100
        });

        const response = completion.choices[0].message.content.trim();
        const result = JSON.parse(response);

        return {
            tags: result.tags || ['other'],
            priority: result.priority || 'medium'
        };
    } catch (error) {
        console.error('Error tagging contact message:', error.message);
        return {
            tags: ['other'],
            priority: 'medium'
        };
    }
};

module.exports = {
    generateTags,
    improveDescription,
    enhanceProduct,
    tagContactMessage
};
