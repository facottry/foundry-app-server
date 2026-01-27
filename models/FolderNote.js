const mongoose = require('mongoose');

const FolderNoteSchema = new mongoose.Schema({
    folder_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SavedFolder', required: true, unique: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Redundant but good for security checks
    content: { type: String, default: '' },
    updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FolderNote', FolderNoteSchema);
