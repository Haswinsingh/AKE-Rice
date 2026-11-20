const express = require('express');
const router = express.Router();
const { upload } = require('../config/storage');
const uploadController = require('../controllers/uploadController');

// Upload single file (screenshot, review photo, receipt)
router.post('/', upload.single('file'), uploadController.uploadFile);

module.exports = router;
