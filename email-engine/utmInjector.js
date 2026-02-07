/**
 * UTM Injector - Automatically adds UTM parameters to all links in HTML
 * 
 * UTM Rules:
 * utm_source=email
 * utm_medium=notification
 * utm_campaign={templateKey}
 * utm_content={cta_name} (derived from link context)
 */

/**
 * Injects UTM parameters into all href links in HTML
 * @param {string} html - The HTML content
 * @param {string} templateKey - The template key for utm_campaign
 * @returns {string} - HTML with UTM-injected links
 */
function injectUtmParams(html, templateKey) {
    // Match all href attributes with URLs
    const hrefRegex = /href=["']([^"']+)["']/gi;

    return html.replace(hrefRegex, (match, url) => {
        // Skip mailto: and tel: links
        if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
            return match;
        }

        // Derive utm_content from URL path
        const ctaName = deriveCtaName(url);

        // Build UTM params
        const utmParams = new URLSearchParams({
            utm_source: 'email',
            utm_medium: 'notification',
            utm_campaign: templateKey,
            utm_content: ctaName
        });

        // Append to URL
        const separator = url.includes('?') ? '&' : '?';
        const newUrl = `${url}${separator}${utmParams.toString()}`;

        return `href="${newUrl}"`;
    });
}

/**
 * Derives CTA name from URL for utm_content
 * @param {string} url - The URL to derive from
 * @returns {string} - The derived CTA name
 */
function deriveCtaName(url) {
    try {
        // Extract path from URL
        let path = url;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const urlObj = new URL(url);
            path = urlObj.pathname;
        }

        // Remove leading slash and get meaningful segment
        const segments = path.replace(/^\//, '').split('/').filter(s => s);

        if (segments.length === 0) return 'homepage';

        // Map common paths to CTA names
        const pathMappings = {
            'submit-product': 'submit_product',
            'discover': 'explore_launches',
            'founder': 'dashboard',
            'product': 'view_product',
            'today': 'view_all_launches',
            'share': 'share_launch',
            'products': 'track_status'
        };

        const firstSegment = segments[0].toLowerCase();
        return pathMappings[firstSegment] || firstSegment.replace(/-/g, '_');
    } catch (e) {
        return 'cta_link';
    }
}

module.exports = { injectUtmParams, deriveCtaName };
