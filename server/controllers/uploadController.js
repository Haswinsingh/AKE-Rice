const path = require('path');

/**
 * Handle single file upload (Payment screenshot, feedback photo, receipt)
 */
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Return the relative URL served by static express middleware
    const fileUrl = `/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[UploadController] error:', error);
    return res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
};
