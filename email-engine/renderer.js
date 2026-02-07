/**
 * Template Renderer - Loads HTML templates and replaces variables
 * 
 * Supported Variables:
 * {{founderName}} - Founder's name
 * {{productName}} - Product name
 * {{productUrl}} - Product page URL
 * {{dashboardUrl}} - Founder dashboard URL
 * {{date}} - Current date
 * {{count}} - Count (for daily report)
 */

const fs = require('fs');
const path = require('path');
const templateMap = require('./templateMap');
const { injectUtmParams } = require('./utmInjector');

// Base URL for deep links
const BASE_URL = process.env.APP_BASE_URL || 'https://clicktory.io';

/**
 * Renders an email template with data
 * @param {string} templateKey - The template key from templateMap
 * @param {object} data - Data to inject into template
 * @returns {object} - { subject, html }
 */
function renderTemplate(templateKey, data) {
    const template = templateMap[templateKey];

    if (!template) {
        throw new Error(`Template not found: ${templateKey}`);
    }

    if (!template.isActive) {
        throw new Error(`Template is disabled: ${templateKey}`);
    }

    // Load HTML file
    const templatePath = path.join(__dirname, 'templates', template.htmlFile);
    let html = fs.readFileSync(templatePath, 'utf8');

    // Prepare data with base URL for deep links
    const enrichedData = {
        ...data,
        baseUrl: BASE_URL,
        date: data.date || new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    };

    // Replace all {{variable}} placeholders
    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return enrichedData[key] !== undefined ? enrichedData[key] : match;
    });

    // Inject UTM parameters into all links
    html = injectUtmParams(html, templateKey);

    // Process subject with variables too
    let subject = template.subject;
    subject = subject.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return enrichedData[key] !== undefined ? enrichedData[key] : match;
    });

    return { subject, html };
}

module.exports = { renderTemplate };
