const mongoose = require('mongoose');

// Simple slugify function
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')     // Replace spaces and underscores with -
        .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
        .replace(/\-\-+/g, '-')      // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start
        .replace(/-+$/, '');         // Trim - from end
};

/**
 * Generate a unique slug for a Mongoose model
 * @param {Model} Model - The Mongoose model to check against
 * @param {String} source - The text to slugify (e.g. name)
 * @param {ObjectId} existingId - Optional ID to exclude from check (for updates)
 * @returns {String} Unique slug
 */
const generateUniqueSlug = async (Model, source, existingId = null) => {
    let slug = slugify(source);
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
        const query = { slug: uniqueSlug };
        if (existingId) {
            query._id = { $ne: existingId };
        }

        const existing = await Model.findOne(query);
        if (!existing) {
            return uniqueSlug;
        }

        uniqueSlug = `${slug}-${counter}`;
        counter++;
    }
};

module.exports = { slugify, generateUniqueSlug };
