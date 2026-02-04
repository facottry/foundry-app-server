/**
 * Centralized Category Metadata
 */
const CATEGORY_META = {
    'AI': {
        name: 'AI Tools',
        slug: 'AI',
        tagline: 'Build faster with intelligence',
        gradient: 'from-orange-400 to-amber-500',
        icon: '🤖',
        subtags: ['Chatbots', 'Automation', 'Agents'],
        isTrending: true
    },
    'DevTools': {
        name: 'Developer Tools',
        slug: 'DevTools',
        tagline: 'Ship better software',
        gradient: 'from-amber-400 to-orange-600',
        icon: '⚡',
        subtags: ['Testing', 'API', 'Monitoring'],
        isTrending: true
    },
    'Marketing': {
        name: 'Marketing',
        slug: 'Marketing',
        tagline: 'Grow your audience',
        gradient: 'from-orange-300 to-red-400',
        icon: '📈',
        subtags: ['SEO', 'Content', 'Analytics'],
        isTrending: false
    },
    'Productivity': {
        name: 'Productivity',
        slug: 'Productivity',
        tagline: 'Optimize your workflow',
        gradient: 'from-amber-300 to-orange-400',
        icon: '✅',
        subtags: ['Notes', 'Calendar', 'Tasks'],
        isTrending: false
    },
    'SaaS': {
        name: 'SaaS',
        slug: 'SaaS',
        tagline: 'Software as a Service',
        gradient: 'from-orange-200 to-amber-400',
        icon: '☁️',
        subtags: ['B2B', 'Enterprise', 'Startup'],
        isTrending: false
    }
};

module.exports = CATEGORY_META;
