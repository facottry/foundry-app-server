const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PUBLIC_DIR = path.join(__dirname, '../../appclient/public');
const SITEMAPS_DIR = path.join(PUBLIC_DIR, 'sitemaps');
const SITEMAP_INDEX_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');
const BLOG_DATA_PATH = path.join(__dirname, '../../appclient/src/data/blogData.js');

const DOMAIN = 'https://appfoundry.vercel.app';
const R2_BASE = process.env.R2_PUBLIC_BASE_URL || '';

// Ensure sitemaps directory exists
if (!fs.existsSync(SITEMAPS_DIR)) {
    fs.mkdirSync(SITEMAPS_DIR, { recursive: true });
}

// Static Routes
const STATIC_ROUTES = [
    { url: '/', priority: 1.0, changefreq: 'daily' },
    { url: '/pricing', priority: 0.8, changefreq: 'weekly' },
    { url: '/about', priority: 0.7, changefreq: 'monthly' },
    { url: '/mission', priority: 0.7, changefreq: 'monthly' },
    { url: '/how-it-works', priority: 0.7, changefreq: 'monthly' },
    { url: '/contact', priority: 0.5, changefreq: 'yearly' },
    { url: '/login', priority: 0.4, changefreq: 'yearly' },
    { url: '/signup', priority: 0.6, changefreq: 'yearly' },
];

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

const getBlogData = () => {
    try {
        const content = fs.readFileSync(BLOG_DATA_PATH, 'utf8');

        // Extract Post Slugs, Images, Categories, Tags
        const posts = [];

        // We will do a robust regex to capture the whole object key-by-key
        // This is a bit manual but safe for this strict format
        // Finding object blocks inside "export const blogPosts = ["

        const postsArrayMatch = content.match(/export const blogPosts = \[([\s\S]*?)\];/);
        if (!postsArrayMatch) return { posts: [], authors: [], categories: new Set(), tags: new Set() };

        const postsBlock = postsArrayMatch[1];
        // Split by object curly braces roughly
        const postObjects = postsBlock.split(/},\s*{/); // quick split

        const categories = new Set();
        const tags = new Set();

        postObjects.forEach(block => {
            const slugMatch = block.match(/slug:\s*'([^']+)'/);
            const imageMatch = block.match(/image:\s*'([^']+)'/);
            const categoryMatch = block.match(/category:\s*'([^']+)'/);
            const tagsMatch = block.match(/tags:\s*\[([^\]]+)\]/); // capture content inside brackets

            if (slugMatch) {
                const slug = slugMatch[1];
                const image = imageMatch ? imageMatch[1] : null;
                const category = categoryMatch ? categoryMatch[1] : null;

                if (category) categories.add(category);

                if (tagsMatch) {
                    // split 'Tag1', 'Tag2'
                    tagsMatch[1].split(',').forEach(t => {
                        const tag = t.trim().replace(/['"]/g, '');
                        if (tag) tags.add(tag);
                    });
                }

                posts.push({ slug, image, category });
            }
        });

        // Extract Authors
        const authors = [];
        const authorBlockRegex = /export const authors = {([\s\S]*?)};/;
        const authorBlock = content.match(authorBlockRegex);

        if (authorBlock && authorBlock[1]) {
            const keyRegex = /^\s*(\w+):/gm;
            let match;
            while ((match = keyRegex.exec(authorBlock[1])) !== null) {
                authors.push(match[1]);
            }
        }

        return { posts, authors, categories: Array.from(categories), tags: Array.from(tags) };
    } catch (err) {
        console.error('Error reading blogData.js:', err);
        return { posts: [], authors: [], categories: [], tags: [] };
    }
};

const buildImageUrl = (keyOrPath) => {
    if (!keyOrPath) return null;
    if (keyOrPath.startsWith('http')) return keyOrPath;
    if (keyOrPath.startsWith('/')) return `${DOMAIN}${keyOrPath}`;
    return `${R2_BASE}/${keyOrPath}`;
};

const generateXml = (urls) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => {
        let entry = `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>`;
        if (u.lastmod) entry += `\n    <lastmod>${u.lastmod.split('T')[0]}</lastmod>`;
        if (u.image) {
            entry += `\n    <image:image>
      <image:loc>${u.image.loc}</image:loc>${u.image.title ? `\n      <image:title>${u.image.title.replace(/&/g, '&amp;')}</image:title>` : ''}
    </image:image>`;
        }
        entry += `\n  </url>`;
        return entry;
    }).join('\n')}
</urlset>`;
};

const generateIndex = (sitemaps) => {
    const today = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(s => `  <sitemap>
    <loc>${DOMAIN}/sitemaps/${s}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
};

const main = async () => {
    await connectDB();
    const User = require('../models/User');
    const Product = require('../models/Product');

    console.log('Fetching data...');

    // 1. Products
    const products = await Product.find({ status: { $in: ['approved', 'promoted'] }, deleted_at: null })
        .select('slug updated_at name logoKey logo_url tagline categories');

    // 2. Founders
    const founders = await User.find({ role: 'FOUNDER' }).select('_id updated_at created_at name avatar_url profileImageKey');

    // 3. Blog Data
    const { posts, authors, categories, tags } = getBlogData();
    console.log(`Stats: ${products.length} Products, ${founders.length} Founders, ${posts.length} Posts, ${authors.length} Authors, ${categories.length} Categories, ${tags.length} Tags`);

    // --- GENERATE SITEMAPS ---

    const sitemapList = [];

    // 1. static.xml
    const staticUrls = STATIC_ROUTES.map(r => ({
        loc: `${DOMAIN}${r.url}`,
        priority: r.priority,
        changefreq: r.changefreq
    }));
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'static.xml'), generateXml(staticUrls));
    sitemapList.push('static.xml');

    // 2. product.xml
    const productUrls = products.map(p => {
        const logo = p.logoKey ? buildImageUrl(p.logoKey) : p.logo_url;
        return {
            loc: `${DOMAIN}/product/${p.slug}`,
            priority: 0.9,
            changefreq: 'weekly',
            lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
            image: logo ? { loc: logo, title: p.name } : null
        };
    });
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'product.xml'), generateXml(productUrls));
    sitemapList.push('product.xml');

    // 3. founder.xml
    const founderUrls = founders.map(f => {
        const avatar = f.profileImageKey ? buildImageUrl(f.profileImageKey) : f.avatar_url;
        return {
            loc: `${DOMAIN}/founder/${f._id}`,
            priority: 0.6,
            changefreq: 'monthly',
            lastmod: f.updated_at || f.created_at ? new Date(f.updated_at || f.created_at).toISOString() : undefined,
            image: avatar ? { loc: avatar, title: f.name } : null
        };
    });
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'founder.xml'), generateXml(founderUrls));
    sitemapList.push('founder.xml');

    // 4. blog.xml
    const blogUrls = posts.map(p => ({
        loc: `${DOMAIN}/blog/${p.slug}`,
        priority: 0.8,
        changefreq: 'monthly',
        image: p.image ? { loc: buildImageUrl(p.image), title: p.slug } : null
    }));
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'blog.xml'), generateXml(blogUrls));
    sitemapList.push('blog.xml');

    // 5. writer.xml
    const writerUrls = authors.map(id => ({
        loc: `${DOMAIN}/blog/author/${id}`,
        priority: 0.6,
        changefreq: 'monthly'
    }));
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'writer.xml'), generateXml(writerUrls));
    sitemapList.push('writer.xml');

    // 6. category.xml
    // We combine Product Categories and Blog Categories if they share URL structure?
    // Current App seems to have `/category/:category` for products.
    // Blog categories are just filters on the blog page usually, or query params?
    // Let's assume `/category/:slug` is for products.
    // We will extract unique product categories from DB products + the ones found in blog if they map to the same route.
    // Actually, distinct product categories first.

    const productCategories = new Set();
    products.forEach(p => {
        if (p.categories) p.categories.forEach(c => productCategories.add(c));
    });
    // Add known static ones
    ['ai', 'devtools', 'marketing', 'design', 'productivity'].forEach(c => productCategories.add(c));

    const categoryUrls = Array.from(productCategories).map(c => ({
        loc: `${DOMAIN}/category/${c}`,
        priority: 0.8,
        changefreq: 'daily'
    }));
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'category.xml'), generateXml(categoryUrls));
    sitemapList.push('category.xml');

    // 7. tag.xml (Blog Tags)
    // Assuming we have a route for `?tag=X` or `/blog/tag/X`. 
    // The previous analysis didn't show a dedicated tag route, but for SEO we often create one.
    // If no route exists, we shouldn't sitemap it.
    // Current `Blog.jsx` filters by query param `?tag=`. Query params are usually canonicalized to the main page.
    // However, if the user specifically asked for `tag.xml`, they likely want these indexed.
    // I will generate them as `/blog?tag=X` or check if `AuthorBlog` supports it.
    // Wait, the user request explicitly asked for `tag.xml`.
    // I will generate URLs for `/blog?tag=tagName`. 
    // Google treats query params as separate pages if content differs.
    const tagUrls = tags.map(t => ({
        loc: `${DOMAIN}/blog?tag=${encodeURIComponent(t)}`,
        priority: 0.5,
        changefreq: 'weekly'
    }));
    fs.writeFileSync(path.join(SITEMAPS_DIR, 'tag.xml'), generateXml(tagUrls));
    sitemapList.push('tag.xml');

    // GENERATE INDEX
    fs.writeFileSync(SITEMAP_INDEX_PATH, generateIndex(sitemapList));
    console.log(`Sitemap Index generated at ${SITEMAP_INDEX_PATH}`);
    console.log(`Sub-sitemaps generated in ${SITEMAPS_DIR}`);

    process.exit(0);
};

main();
