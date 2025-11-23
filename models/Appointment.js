// models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: { type: String, required: true },
    service: { type: String, required: true },
    preferredDate: String,
    preferredTime: String,
    message: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
