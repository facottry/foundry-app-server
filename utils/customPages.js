/**
 * Custom Query Intent Mapping
 * Maps search keywords to curated pages.
 */
const CUSTOM_PAGES = [
    {
        name: 'Best AI Tools',
        url: '/category/AI',
        description: 'Curated list of top performing AI tools',
        keywords: ['best ai', 'ai tools', 'artificial intelligence', 'gpt', 'llm'],
        type: 'PAGE'
    },
    {
        name: 'Free Marketing Tools',
        url: '/category/Marketing', // Or a dedicated /best-marketing-tools if existed
        description: 'Grow your startup for free',
        keywords: ['marketing', 'seo', 'growth', 'social media', 'email'],
        type: 'PAGE'
    },
    {
        name: 'Developer Productivity',
        url: '/category/DevTools',
        description: 'Tools to ship faster',
        keywords: ['dev tools', 'coding', 'programming', 'developer', 'ide'],
        type: 'PAGE'
    },
    {
        name: 'Trending Products',
        url: '/', // Home has trending
        description: 'See what is hot this week',
        keywords: ['trending', 'hot', 'new', 'popular'],
        type: 'PAGE'
    },
    {
        name: 'About Clicktory',
        url: '/about',
        description: 'Learn about our mission',
        keywords: ['about', 'mission', 'team', 'contact'],
        type: 'PAGE'
    },
    {
        name: 'For Founders',
        url: '/login', // Or a landing page
        description: 'List your product on Clicktory',
        keywords: ['founder', 'submit', 'list product', 'launch'],
        type: 'PAGE'
    }
];

module.exports = CUSTOM_PAGES;
