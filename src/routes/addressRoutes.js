const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');

// GET: /api/address/provinces
router.get('/provinces', addressController.getProvinces);

// GET: /api/address/districts/:province_id
router.get('/districts/:province_id', addressController.getDistrictsByProvince);

// GET: /api/address/subdistricts/:district_id
router.get('/subdistricts/:district_id', addressController.getSubdistrictsByDistrict);

module.exports = router;