// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Appointment = require('./models/Appointment');
const Enquiry = require('./models/Enquiry');
const User = require('./models/User');
const { auth, authorizeRoles } = require('./middleware/auth');

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: '*'
  })
);

// Health check
app.get('/', (req, res) => {
  res.send('Jayade Dental Clinic API is running');
});

/* ========= DEFAULT STAFF SEEDING ========= */

async function seedDefaultStaff() {
  const defaultUsers = [
    {
      name: 'Dr. Gautam Jayade',
      email: 'gautam@jayadedental.com',
      phone: '+91 90000 00001',
      role: 'doctor',
      password: 'Gautam@123'
    },
    {
      name: 'Dr. Deepa Jayade',
      email: 'deepa@jayadedental.com',
      phone: '+91 90000 00002',
      role: 'doctor',
      password: 'Deepa@123'
    },
    {
      name: 'Dr. Rohan Shetty',
      email: 'rohan@jayadedental.com',
      phone: '+91 90000 00003',
      role: 'doctor',
      password: 'Rohan@123'
    },
    {
      name: 'Dr. Ananya Kulkarni',
      email: 'ananya@jayadedental.com',
      phone: '+91 90000 00004',
      role: 'doctor',
      password: 'Ananya@123'
    },
    {
      name: 'Clinic Admin',
      email: 'admin@jayadedental.com',
      phone: '+91 90000 00005',
      role: 'admin',
      password: 'Admin@123'
    }
  ];

  for (const u of defaultUsers) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      const hashed = await bcrypt.hash(u.password, 10);
      await User.create({
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        password: hashed
      });
      console.log(`Seeded staff user: ${u.email} (${u.role})`);
    }
  }
}

/* ========= AUTH ROUTES ========= */

// Register – ONLY PATIENTS
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Force role to 'patient' (ignore any role sent from frontend)
    const user = new User({
      name,
      email,
      phone,
      password: hashed,
      role: 'patient'
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login – staff (doctor/admin) AND patients can log in
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple profile to test auth
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ========= APPOINTMENTS & ENQUIRIES ========= */

// Public appointment creation (patients)
app.post('/api/appointments', async (req, res) => {
  try {
    const { name, email, phone, service, preferredDate, preferredTime, message } = req.body;

    if (!name || !phone || !service) {
      return res.status(400).json({ error: 'Name, phone and service are required' });
    }

    const appointment = new Appointment({
      name,
      email,
      phone,
      service,
      preferredDate,
      preferredTime,
      message
    });

    await appointment.save();
    res.status(201).json({ message: 'Appointment request submitted successfully' });
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public enquiry creation
app.post('/api/enquiries', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'Name, phone and message are required' });
    }

    const enquiry = new Enquiry({
      name,
      email,
      phone,
      subject,
      message
    });

    await enquiry.save();
    res.status(201).json({ message: 'Enquiry submitted successfully' });
  } catch (err) {
    console.error('Error creating enquiry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected: list appointments (doctor/admin only)
app.get('/api/appointments', auth, authorizeRoles('doctor', 'admin'), async (req, res) => {
  try {
    const data = await Appointment.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected: list enquiries (doctor/admin only)
app.get('/api/enquiries', auth, authorizeRoles('doctor', 'admin'), async (req, res) => {
  try {
    const data = await Enquiry.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error('Error fetching enquiries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin overview
app.get('/api/admin/overview', auth, authorizeRoles('admin'), async (req, res) => {
  try {
    const [appointmentsCount, enquiriesCount, usersCount] = await Promise.all([
      Appointment.countDocuments(),
      Enquiry.countDocuments(),
      User.countDocuments()
    ]);
    res.json({ appointmentsCount, enquiriesCount, usersCount });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ========= DB CONNECTION ========= */

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedDefaultStaff(); // create default doctors/admin if missing
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
