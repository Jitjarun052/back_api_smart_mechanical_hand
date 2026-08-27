const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospitalController');

router.get('/', hospitalController.getAllHospitals);
// router.post('/', hospitalController.createHospital);
router.delete('/:id', hospitalController.deleteHospital);
router.get('/:id/details', hospitalController.getHospitalDetails);
router.post('/', hospitalController.uploadHospital.single('image'), hospitalController.createHospital);

module.exports = router;