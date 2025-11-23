// models/Enquiry.js
const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: { type: String, required: true },
    subject: String,
    message: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
