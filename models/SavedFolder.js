const mongoose = require('mongoose');

const SavedFolderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    parent_folder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SavedFolder', default: null },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedFolder', SavedFolderSchema);
