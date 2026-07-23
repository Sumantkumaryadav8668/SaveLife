import Entity from './entity.model.js';

export const getHospitalResources = async (req, res) => {
  const { id } = req.params;
  try {
    const hospital = await Entity.findOne({ _id: id, type: 'hospital' }).exec();
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    res.json({ success: true, resources: hospital.hospitalResources, name: hospital.name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateHospitalResources = async (req, res) => {
  const { id } = req.params;
  const { roomsTotal, roomsOccupied, bedsGeneralTotal, bedsGeneralOccupied, bedsIcuTotal, bedsIcuOccupied, bloodBank, ambulances, doctors } = req.body;

  try {
    const hospital = await Entity.findOne({ _id: id, type: 'hospital' }).exec();
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    if (req.user.role !== 'system_admin' && req.user.entityId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this hospital resource' });
    }

    if (roomsTotal !== undefined) hospital.hospitalResources.roomsTotal = roomsTotal;
    if (roomsOccupied !== undefined) hospital.hospitalResources.roomsOccupied = roomsOccupied;
    if (bedsGeneralTotal !== undefined) hospital.hospitalResources.bedsGeneralTotal = bedsGeneralTotal;
    if (bedsGeneralOccupied !== undefined) hospital.hospitalResources.bedsGeneralOccupied = bedsGeneralOccupied;
    if (bedsIcuTotal !== undefined) hospital.hospitalResources.bedsIcuTotal = bedsIcuTotal;
    if (bedsIcuOccupied !== undefined) hospital.hospitalResources.bedsIcuOccupied = bedsIcuOccupied;
    if (bloodBank !== undefined) hospital.hospitalResources.bloodBank = bloodBank;
    if (ambulances !== undefined) hospital.hospitalResources.ambulances = ambulances;
    if (doctors !== undefined) hospital.hospitalResources.doctors = doctors;

    await hospital.save();
    res.json({ success: true, message: 'Resources updated successfully', resources: hospital.hospitalResources });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalList = async (req, res) => {
  try {
    const hospitals = await Entity.find({ type: 'hospital' }).exec();
    res.json({ success: true, hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bookBed = async (req, res) => {
  const { id } = req.params;
  const { patientName, bedType } = req.body;

  try {
    const hospital = await Entity.findOne({ _id: id, type: 'hospital' }).exec();
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }

    if (bedType === 'icu') {
      if (hospital.hospitalResources.bedsIcuOccupied >= hospital.hospitalResources.bedsIcuTotal) {
        return res.status(400).json({ success: false, message: 'No ICU beds available' });
      }
      hospital.hospitalResources.bedsIcuOccupied += 1;
    } else {
      if (hospital.hospitalResources.bedsGeneralOccupied >= hospital.hospitalResources.bedsGeneralTotal) {
        return res.status(400).json({ success: false, message: 'No General beds available' });
      }
      hospital.hospitalResources.bedsGeneralOccupied += 1;
    }

    await hospital.save();
    res.json({
      success: true,
      message: `Bed booked successfully for ${patientName}`,
      resources: hospital.hospitalResources
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

