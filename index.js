
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const app = express();

// Set up secure headers with customized CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://images.unsplash.com",
          "https://images.pexels.com",
        ],
        connectSrc: ["'self'"],
      },
    },
  }),
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many login attempts. Please try again after 15 minutes.",
  },
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many booking attempts from this IP. Please try again later.",
  },
});

app.use("/api/", generalLimiter);

// Database Connection Caching for Serverless Execution
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
  }
  cachedDb = await mongoose.connect(mongoUri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });
  return cachedDb;
}

// Ensure DB middleware for API routes
app.use("/api", async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error("Database connection error:", err);
    return res.status(503).json({
      error:
        "Database service unavailable. Please check backend environment configuration.",
    });
  }
});

// Database Schemas
const BookingSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  serviceId: { type: String, required: true },
  serviceName: { type: String, required: true },
  dentistId: { type: String, required: true },
  dentistName: { type: String, required: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  timeSlot: { type: String, required: true }, // e.g. "10:00 AM"
  reason: { type: String, maxlength: 500, default: "" },
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Completed", "Cancelled", "Rejected"],
    default: "Pending",
  },
  createdAt: { type: Date, default: Date.now },
});

// Compound index to assist double-booking checks
BookingSchema.index({ dentistId: 1, date: 1, timeSlot: 1, status: 1 });

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

// Static Data Definitions (Demo Content)
const SERVICES = [
  {
    id: "srv_1",
    name: "General Dental Checkup",
    price: 500,
    duration: "30 mins",
    description:
      "Comprehensive dental exam, digital X-rays evaluation, and personalized oral health assessment.",
    icon: "fa-tooth",
  },
  {
    id: "srv_2",
    name: "Professional Teeth Cleaning",
    price: 1200,
    duration: "45 mins",
    description:
      "Ultrasound scaling and polishing to remove plaque, tartar, and surface stains thoroughly.",
    icon: "fa-sparkles",
  },
  {
    id: "srv_3",
    name: "Laser Teeth Whitening",
    price: 4500,
    duration: "60 mins",
    description:
      "Advanced in-clinic laser whitening for up to 8 shades brighter smile safely.",
    icon: "fa-wand-magic-sparkles",
  },
  {
    id: "srv_4",
    name: "Root Canal Treatment",
    price: 3500,
    duration: "60 mins",
    description:
      "Pain-free root canal therapy using microscopic precision to save damaged teeth.",
    icon: "fa-microscope",
  },
  {
    id: "srv_5",
    name: "Braces & Aligners Consultation",
    price: 800,
    duration: "40 mins",
    description:
      "3D digital scan & expert consultation for clear aligners or traditional ceramic braces.",
    icon: "fa-layer-group",
  },
  {
    id: "srv_6",
    name: "Dental Implants Consultation",
    price: 1000,
    duration: "45 mins",
    description:
      "Permanent tooth replacement consultation with 3D bone density assessment.",
    icon: "fa-gem",
  },
  {
    id: "srv_7",
    name: "Painless Tooth Extraction",
    price: 1500,
    duration: "30 mins",
    description:
      "Gentle, painless tooth or wisdom tooth removal under local anesthesia.",
    icon: "fa-shield-halved",
  },
  {
    id: "srv_8",
    name: "Pediatric Dental Care",
    price: 600,
    duration: "30 mins",
    description:
      "Child-friendly dental checks, fluoride treatments, and preventative cavity sealants.",
    icon: "fa-child",
  },
  {
    id: "srv_9",
    name: "Emergency Dental Consultation",
    price: 900,
    duration: "30 mins",
    description:
      "Immediate care for severe toothaches, chipped teeth, bleeding, or dental trauma.",
    icon: "fa-kit-medical",
  },
];

const DENTISTS = [
  {
    id: "den_1",
    name: "Dr. Rajesh Sharma",
    qualification: "BDS, MDS (Prosthodontics)",
    specialty: "Implants & Restorative Dentistry",
    experience: "14+ Years",
    photo:
      "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&q=80",
  },
  {
    id: "den_2",
    name: "Dr. Priya Patel",
    qualification: "BDS, MDS (Orthodontics)",
    specialty: "Clear Aligners & Braces Specialist",
    experience: "10+ Years",
    photo:
      "https://images.unsplash.com/photo-1594824813566-78a5e375338d?w=400&q=80",
  },
  {
    id: "den_3",
    name: "Dr. Amit Kumar",
    qualification: "BDS, MDS (Endodontics)",
    specialty: "Root Canal & Laser Dentistry",
    experience: "12+ Years",
    photo:
      "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&q=80",
  },
  {
    id: "den_4",
    name: "Dr. Ananya Verma",
    qualification: "BDS, Fellowship in Pediatric Dentistry",
    specialty: "Pediatric & Preventive Dentistry",
    experience: "8+ Years",
    photo:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
  },
];

const TIME_SLOTS = [
  "09:00 AM",
  "09:40 AM",
  "10:20 AM",
  "11:00 AM",
  "11:40 AM",
  "12:20 PM",
  "02:00 PM",
  "02:40 PM",
  "03:20 PM",
  "04:00 PM",
  "04:40 PM",
  "05:20 PM",
  "06:00 PM",
];

// Auth Middleware
function authenticateAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  try {
    const secret =
      process.env.JWT_SECRET || "fallback-secret-for-demo-purposes-only";
    const decoded = jwt.verify(token, secret);
    req.admin = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or expired token" });
  }
}

// Helpers
function generateBookingRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "DSS-";
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

function getTodayIST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000;
  const istDate = new Date(utc + istOffset);
  return istDate.toISOString().split("T")[0];
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

app.get("/api/services", (req, res) => {
  res.json(SERVICES);
});

app.get("/api/dentists", (req, res) => {
  res.json(DENTISTS);
});

app.get("/api/availability", async (req, res) => {
  try {
    const { date, dentistId } = req.query;
    if (!date || !dentistId) {
      return res.status(400).json({ error: "Date and dentistId are required" });
    }

    // Reject Sunday
    const selectedDate = new Date(date + "T00:00:00");
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    if (selectedDate.getUTCDay() === 0) {
      return res.json({
        availableSlots: [],
        reason: "Clinic is closed on Sundays",
      });
    }

    // Reject past dates in IST
    const today = getTodayIST();
    if (date < today) {
      return res.json({
        availableSlots: [],
        reason: "Cannot book appointments for past dates",
      });
    }

    // Find existing non-cancelled bookings
    const existingBookings = await Booking.find({
      dentistId,
      date,
      status: { $ne: "Cancelled" },
    }).select("timeSlot");

    const bookedSlots = existingBookings.map((b) => b.timeSlot);
    const availableSlots = TIME_SLOTS.filter(
      (slot) => !bookedSlots.includes(slot),
    );

    res.json({ availableSlots, bookedSlots });
  } catch (err) {
    console.error("Error fetching availability:", err);
    res.status(500).json({ error: "Failed to calculate slot availability" });
  }
});

app.post("/api/bookings", bookingLimiter, async (req, res) => {
  try {
    const {
      fullName,
      phone,
      email,
      serviceId,
      dentistId,
      date,
      timeSlot,
      reason,
    } = req.body;

    // Validation
    if (
      !fullName ||
      !phone ||
      !email ||
      !serviceId ||
      !dentistId ||
      !date ||
      !timeSlot
    ) {
      return res
        .status(400)
        .json({ error: "All required fields must be provided" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }

    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      return res
        .status(400)
        .json({ error: "Please enter a valid phone number" });
    }

    const service = SERVICES.find((s) => s.id === serviceId);
    const dentist = DENTISTS.find((d) => d.id === dentistId);

    if (!service || !dentist) {
      return res
        .status(400)
        .json({ error: "Selected service or dentist is invalid" });
    }

    // Check past date
    const today = getTodayIST();
    if (date < today) {
      return res
        .status(400)
        .json({ error: "Cannot book appointments in the past" });
    }

    // Double-booking check
    const existing = await Booking.findOne({
      dentistId,
      date,
      timeSlot,
      status: { $ne: "Cancelled" },
    });

    if (existing) {
      return res.status(409).json({
        error:
          "This time slot is no longer available. Please select another slot.",
      });
    }

    const reference = generateBookingRef();

    const booking = new Booking({
      reference,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      serviceId,
      serviceName: service.name,
      dentistId,
      dentistName: dentist.name,
      date,
      timeSlot,
      reason: (reason || "").trim(),
      status: "Pending",
    });

    await booking.save();

    res.status(201).json({
      success: true,
      message: "Booking request submitted successfully",
      booking: {
        reference: booking.reference,
        fullName: booking.fullName,
        serviceName: booking.serviceName,
        dentistName: booking.dentistName,
        date: booking.date,
        timeSlot: booking.timeSlot,
        status: booking.status,
      },
    });
  } catch (err) {
    console.error("Booking submission error:", err);
    res.status(500).json({
      error: "An unexpected error occurred while processing your booking.",
    });
  }
});

app.get("/api/bookings/status", async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).json({ error: "Booking reference is required" });
    }

    const booking = await Booking.findOne({
      reference: reference.trim().toUpperCase(),
    });
    if (!booking) {
      return res
        .status(404)
        .json({ error: "No booking found with this reference code" });
    }

    // Sanitized output for privacy
    res.json({
      reference: booking.reference,
      serviceName: booking.serviceName,
      dentistName: booking.dentistName,
      date: booking.date,
      timeSlot: booking.timeSlot,
      status: booking.status,
      createdAt: booking.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve booking status" });
  }
});

// Admin Auth Routes
app.post("/api/admin/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    let isValid = false;
    if (username === adminUser) {
      if (adminPasswordHash) {
        isValid = await bcrypt.compare(password, adminPasswordHash);
      } else {
        // Fallback default password 'admin123' if hash not configured in env
        isValid = password === "admin123";
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const secret =
      process.env.JWT_SECRET || "fallback-secret-for-demo-purposes-only";
    const token = jwt.sign({ username, role: "admin" }, secret, {
      expiresIn: "12h",
    });

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.json({ success: true, message: "Logged in successfully" });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true, message: "Logged out successfully" });
});

app.get("/api/admin/me", authenticateAdmin, (req, res) => {
  res.json({ authenticated: true, user: req.admin });
});

// Admin Dashboard & Bookings Management APIs
app.get("/api/admin/dashboard", authenticateAdmin, async (req, res) => {
  try {
    const today = getTodayIST();
    const totalBookings = await Booking.countDocuments();
    const pendingCount = await Booking.countDocuments({ status: "Pending" });
    const confirmedCount = await Booking.countDocuments({
      status: "Confirmed",
    });
    const completedCount = await Booking.countDocuments({
      status: "Completed",
    });
    const todayCount = await Booking.countDocuments({ date: today });

    res.json({
      metrics: {
        total: totalBookings,
        pending: pendingCount,
        confirmed: confirmedCount,
        completed: completedCount,
        today: todayCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});

app.get("/api/admin/bookings", authenticateAdmin, async (req, res) => {
  try {
    const { search, status, date, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status && status !== "All") {
      query.status = status;
    }

    if (date) {
      query.date = date;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { reference: searchRegex },
        { fullName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { serviceName: searchRegex },
        { dentistName: searchRegex },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      bookings,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.patch(
  "/api/admin/bookings/:id/status",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (
        ![
          "Pending",
          "Confirmed",
          "Completed",
          "Cancelled",
          "Rejected",
        ].includes(status)
      ) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      const booking = await Booking.findByIdAndUpdate(
        id,
        { status },
        { new: true },
      );
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      res.json({
        success: true,
        booking,
        notificationNotice:
          "Status updated. External email/WhatsApp notifications are disabled (no external provider API configured).",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to update booking status" });
    }
  },
);

app.patch(
  "/api/admin/bookings/:id/reschedule",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { date, timeSlot } = req.body;

      if (!date || !timeSlot) {
        return res
          .status(400)
          .json({ error: "Date and time slot are required for rescheduling" });
      }

      const currentBooking = await Booking.findById(id);
      if (!currentBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check conflict
      const conflict = await Booking.findOne({
        _id: { $ne: id },
        dentistId: currentBooking.dentistId,
        date,
        timeSlot,
        status: { $ne: "Cancelled" },
      });

      if (conflict) {
        return res.status(409).json({
          error: "The selected slot is already booked for this dentist.",
        });
      }

      currentBooking.date = date;
      currentBooking.timeSlot = timeSlot;
      await currentBooking.save();

      res.json({
        success: true,
        booking: currentBooking,
        message: "Appointment rescheduled successfully",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to reschedule booking" });
    }
  },
);

// Serve the admin frontend at /admin.js (required by /admin page).
// Disable caching so Vercel/browser cannot keep an older endpoint version.
app.get("/admin.js", (req, res) => {
  const adminPath = path.join(__dirname, "admin.js");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (!fs.existsSync(adminPath)) {
    return res.status(404).send('console.error("admin.js file not found on server");');
  }
  return res.sendFile(adminPath);
});

// Legacy fallback: serve admin.js via /?serveFile=admin.js as well.
app.get("/", (req, res) => {
  if (req.query.serveFile === "admin.js") {
    const adminPath = path.join(__dirname, "admin.js");
    if (fs.existsSync(adminPath)) {
      res.setHeader("Content-Type", "application/javascript");
      return res.sendFile(adminPath);
    }
    return res.status(404).send('console.error("admin.js file not found");');
  }

  // Customer Facing UI Render
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DentalCare Smile Studio | Premier Dental Clinic in Raipur</title>
    <meta name="description" content="Experience world-class, painless dental care at DentalCare Smile Studio. Book your appointment online today!">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
            colors: {
              brand: { 50: '#f0f9ff', 100: '#e0f2fe', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1' },
              tealAccent: '#14b8a6',
              coralAccent: '#ff6b6b'
            }
          }
        }
      }
    </script>
    <style>
      body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }
      .glass-card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }
      .glass-card-hover:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(56, 189, 248, 0.4); transform: translateY(-4px); transition: all 0.3s ease; }
      .glass-nav { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
      .text-gradient { background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #2dd4bf 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .btn-gradient { background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%); transition: all 0.3s ease; }
      .btn-gradient:hover { box-shadow: 0 0 20px rgba(56, 189, 248, 0.5); transform: translateY(-2px); }
    </style>
</head>
<body class="antialiased selection:bg-brand-500 selection:text-white">

    <!-- Header Navigation -->
    <header class="fixed top-0 left-0 right-0 z-50 glass-nav transition-all duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <a href="#" class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-tealAccent flex items-center justify-center text-white text-xl shadow-lg shadow-brand-500/30">
                    <i class="fa-solid fa-tooth"></i>
                </div>
                <div>
                    <span class="text-xl font-bold tracking-tight text-white block leading-tight">DentalCare</span>
                    <span class="text-xs text-brand-400 font-medium tracking-widest uppercase block">Smile Studio</span>
                </div>
            </a>

            <nav class="hidden md:flex items-center gap-8 font-medium text-sm text-slate-300">
                <a href="#home" class="hover:text-brand-400 transition-colors">Home</a>
                <a href="#services" class="hover:text-brand-400 transition-colors">Services</a>
                <a href="#dentists" class="hover:text-brand-400 transition-colors">Dentists</a>
                <a href="#about" class="hover:text-brand-400 transition-colors">Why Us</a>
                <a href="#reviews" class="hover:text-brand-400 transition-colors">Reviews</a>
                <a href="#faq" class="hover:text-brand-400 transition-colors">FAQ</a>
                <a href="#contact" class="hover:text-brand-400 transition-colors">Contact</a>
            </nav>

            <div class="hidden md:flex items-center gap-4">
                <a href="/admin" class="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition">Admin Portal</a>
                <a href="#book" class="btn-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg">Book Appointment</a>
            </div>

            <button id="mobileMenuBtn" class="md:hidden text-slate-300 text-2xl focus:outline-none">
                <i class="fa-solid fa-bars"></i>
            </button>
        </div>

        <!-- Mobile Navigation Drawer -->
        <div id="mobileMenu" class="hidden md:hidden glass-card border-b border-slate-700/50 px-6 py-6 space-y-4">
            <a href="#home" class="block text-slate-200 font-medium mobile-link">Home</a>
            <a href="#services" class="block text-slate-200 font-medium mobile-link">Services</a>
            <a href="#dentists" class="block text-slate-200 font-medium mobile-link">Dentists</a>
            <a href="#about" class="block text-slate-200 font-medium mobile-link">Why Us</a>
            <a href="#reviews" class="block text-slate-200 font-medium mobile-link">Reviews</a>
            <a href="#faq" class="block text-slate-200 font-medium mobile-link">FAQ</a>
            <a href="#contact" class="block text-slate-200 font-medium mobile-link">Contact</a>
            <div class="pt-4 border-t border-slate-700/50 flex flex-col gap-3">
                <a href="/admin" class="text-center text-sm font-semibold py-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">Admin Portal</a>
                <a href="#book" class="mobile-link text-center btn-gradient text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg">Book Appointment</a>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section id="home" class="pt-32 pb-20 md:pt-40 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
            <div class="space-y-6 text-center lg:text-left">
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-brand-400 text-xs font-semibold uppercase tracking-wider">
                    <span class="w-2 h-2 rounded-full bg-tealAccent animate-ping"></span>
                    Raipur's Premier Dental Clinic
                </div>
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                    Your Smile, <br/><span class="text-gradient">Our Absolute Priority.</span>
                </h1>
                <p class="text-slate-300 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    Experience world-class, painless dental procedures powered by state-of-the-art laser technology and experienced dental specialists in Raipur.
                </p>
                <div class="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                    <a href="#book" class="btn-gradient text-white font-semibold px-8 py-4 rounded-xl shadow-xl w-full sm:w-auto flex items-center justify-center gap-2">
                        <span>Book Your Visit</span>
                        <i class="fa-solid fa-arrow-right text-sm"></i>
                    </a>
                    <a href="#services" class="glass-card hover:bg-slate-800/60 text-white font-semibold px-8 py-4 rounded-xl w-full sm:w-auto text-center border border-slate-700 transition">
                        Explore Treatments
                    </a>
                </div>
                
                <!-- Trust Indicators -->
                <div class="pt-8 grid grid-cols-3 gap-4 border-t border-slate-800/80 text-center lg:text-left">
                    <div>
                        <div class="text-2xl font-bold text-white">12,000+</div>
                        <div class="text-xs text-slate-400 mt-1">Happy Smiles</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-white">15+ Yrs</div>
                        <div class="text-xs text-slate-400 mt-1">Clinical Excellence</div>
                    </div>
                    <div>
                        <div class="text-2xl font-bold text-white">4.9 ★</div>
                        <div class="text-xs text-slate-400 mt-1">Patient Rating</div>
                    </div>
                </div>
            </div>

            <div class="relative">
                <div class="absolute -top-10 -left-10 w-72 h-72 bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div class="absolute -bottom-10 -right-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
                
                <div class="glass-card p-4 rounded-3xl relative">
                    <img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80" alt="Modern Dental Clinic" class="rounded-2xl w-full h-[400px] object-cover shadow-2xl">
                    
                    <div class="absolute bottom-8 left-8 right-8 glass-card p-4 rounded-xl border border-white/20 flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-tealAccent/20 flex items-center justify-center text-tealAccent text-xl">
                            <i class="fa-solid fa-user-shield"></i>
                        </div>
                        <div>
                            <div class="text-sm font-bold text-white">100% Painless & Hygienic</div>
                            <div class="text-xs text-slate-300">Strict hospital-grade sterilization protocols</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Services Section -->
    <section id="services" class="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Our Expertise</span>
            <h2 class="text-3xl sm:text-4xl font-bold">Comprehensive Dental Treatments</h2>
            <p class="text-slate-400 text-sm sm:text-base">From routine dental checkups to complex full-mouth restorative surgeries.</p>
        </div>

        <div id="servicesGrid" class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Dynamic services loaded via JavaScript -->
        </div>
    </section>

    <!-- Meet Our Dentists -->
    <section id="dentists" class="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-slate-900/40 rounded-3xl my-10 border border-slate-800">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Expert Team</span>
            <h2 class="text-3xl sm:text-4xl font-bold">Meet Our Dental Specialists</h2>
            <p class="text-slate-400 text-sm sm:text-base">Dedicated doctors committed to deliver gentle and precision-driven dental care.</p>
        </div>

        <div id="dentistsGrid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- Dynamic dentists loaded via JavaScript -->
        </div>
    </section>

    <!-- Why Choose Us -->
    <section id="about" class="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div class="grid lg:grid-cols-2 gap-12 items-center">
            <div class="space-y-6">
                <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Why DentalCare Studio</span>
                <h2 class="text-3xl sm:text-4xl font-bold">Setting New Standards in Modern Dentistry</h2>
                <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
                    We combine compassionate care with cutting-edge dental technology to deliver painless treatments in a relaxing, spa-like environment.
                </p>

                <div class="space-y-4 pt-2">
                    <div class="flex items-start gap-4 p-4 rounded-xl glass-card">
                        <div class="w-10 h-10 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center text-lg shrink-0">
                            <i class="fa-solid fa-microscope"></i>
                        </div>
                        <div>
                            <h3 class="font-semibold text-white">Ultra-Modern Equipment</h3>
                            <p class="text-xs text-slate-400 mt-1">3D Intraoral scanners, low-radiation digital X-rays, and pain-free dental lasers.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-4 p-4 rounded-xl glass-card">
                        <div class="w-10 h-10 rounded-lg bg-tealAccent/20 text-tealAccent flex items-center justify-center text-lg shrink-0">
                            <i class="fa-solid fa-pump-soap"></i>
                        </div>
                        <div>
                            <h3 class="font-semibold text-white">Class-B Autoclave Sterilization</h3>
                            <p class="text-xs text-slate-400 mt-1">Strict multi-tier hospital hygiene protocols for 100% safety & infection control.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-4 p-4 rounded-xl glass-card">
                        <div class="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg shrink-0">
                            <i class="fa-solid fa-handshake-angle"></i>
                        </div>
                        <div>
                            <h3 class="font-semibold text-white">Transparent & Fair Pricing</h3>
                            <p class="text-xs text-slate-400 mt-1">No hidden charges or unexpected fees. Clear treatment plans explained upfront.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <img src="https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=500&q=80" alt="Clinic Interior" class="rounded-2xl object-cover h-64 w-full glass-card">
                <img src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=500&q=80" alt="Dentist at Work" class="rounded-2xl object-cover h-64 w-full glass-card mt-8">
            </div>
        </div>
    </section>

    <!-- Appointment Booking Section -->
    <section id="book" class="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div class="glass-card p-8 sm:p-12 rounded-3xl border border-brand-500/30 relative overflow-hidden">
            <div class="absolute -top-24 -right-24 w-60 h-60 bg-brand-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div class="text-center space-y-2 mb-8">
                <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Online Booking</span>
                <h2 class="text-2xl sm:text-3xl font-bold">Schedule Your Appointment</h2>
                <p class="text-xs sm:text-sm text-slate-400">Instant confirmation request • No advance payment required</p>
            </div>

            <!-- Booking Form -->
            <form id="bookingForm" class="space-y-6">
                <div class="grid sm:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name *</label>
                        <input type="text" id="fullName" required placeholder="e.g. Rahul Sharma" class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Phone Number *</label>
                        <input type="tel" id="phone" required placeholder="+91 98765 43210" class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                    </div>
                </div>

                <div class="grid sm:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address *</label>
                        <input type="email" id="email" required placeholder="rahul@example.com" class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Select Treatment *</label>
                        <select id="serviceSelect" required class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                            <option value="">Loading services...</option>
                        </select>
                    </div>
                </div>

                <div class="grid sm:grid-cols-3 gap-6">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Preferred Dentist *</label>
                        <select id="dentistSelect" required class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                            <option value="">Loading dentists...</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Preferred Date *</label>
                        <input type="date" id="bookingDate" required class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Available Slot *</label>
                        <select id="timeSlotSelect" required disabled class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 disabled:opacity-50">
                            <option value="">Select Date & Dentist First</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Reason for Visit / Symptoms (Optional)</label>
                    <textarea id="reason" rows="3" placeholder="Briefly describe your toothache, routine checkup need, or specific query..." class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500"></textarea>
                </div>

                <div id="bookingAlert" class="hidden p-4 rounded-xl text-sm"></div>

                <button type="submit" id="submitBookingBtn" class="w-full btn-gradient text-white font-bold py-4 rounded-xl shadow-xl flex items-center justify-center gap-2">
                    <i class="fa-solid fa-calendar-check"></i>
                    <span>Confirm Booking Request</span>
                </button>
            </form>

            <!-- Success Confirmation Screen -->
            <div id="bookingConfirmation" class="hidden text-center space-y-6 py-6">
                <div class="w-20 h-20 rounded-full bg-tealAccent/20 text-tealAccent mx-auto flex items-center justify-center text-3xl">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-bold text-white">Booking Submitted!</h3>
                    <p class="text-slate-300 text-sm mt-1">Your appointment request has been recorded.</p>
                </div>

                <div class="glass-card p-6 rounded-2xl text-left max-w-md mx-auto space-y-3 border border-slate-700">
                    <div class="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                        <span class="text-slate-400">Reference Code</span>
                        <span id="confRef" class="font-mono font-bold text-brand-400"></span>
                    </div>
                    <div class="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                        <span class="text-slate-400">Treatment</span>
                        <span id="confService" class="font-semibold text-white"></span>
                    </div>
                    <div class="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                        <span class="text-slate-400">Dentist</span>
                        <span id="confDentist" class="text-white"></span>
                    </div>
                    <div class="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                        <span class="text-slate-400">Date & Time</span>
                        <span id="confDateTime" class="text-white"></span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-400">Status</span>
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300">Pending Approval</span>
                    </div>
                </div>

                <p class="text-xs text-slate-400">Save your Reference Code to track appointment status anytime below.</p>

                <button onclick="resetBookingForm()" class="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 transition">
                    Book Another Appointment
                </button>
            </div>
        </div>
    </section>

    <!-- Track Booking Status Widget -->
    <section class="py-10 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto">
        <div class="glass-card p-6 rounded-2xl border border-slate-800 text-center space-y-4">
            <h3 class="text-lg font-bold text-white"><i class="fa-solid fa-magnifying-glass text-brand-400 mr-2"></i>Check Appointment Status</h3>
            <div class="flex gap-2">
                <input type="text" id="trackRefInput" placeholder="Enter Ref Code (e.g. DSS-X8K2M1)" class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none uppercase">
                <button onclick="trackBooking()" class="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition">Check</button>
            </div>
            <div id="trackResult" class="hidden text-left p-4 rounded-xl text-sm glass-card border border-slate-700"></div>
        </div>
    </section>

    <!-- Patient Reviews & Testimonials -->
    <section id="reviews" class="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Patient Experiences</span>
            <h2 class="text-3xl sm:text-4xl font-bold">What Our Patients Say</h2>
            <p class="text-slate-400 text-xs sm:text-sm">* Note: The reviews below are sample demonstration content for showcase purposes.</p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
            <div class="glass-card p-6 rounded-2xl space-y-4">
                <div class="flex text-amber-400 text-sm gap-1">
                    <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                </div>
                <p class="text-slate-300 text-sm italic">"Dr. Rajesh made my root canal completely painless. The clinic looks like a luxury lounge and hygiene standards are exceptional."</p>
                <div class="flex items-center gap-3 pt-2">
                    <div class="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 font-bold flex items-center justify-center text-xs">PS</div>
                    <div>
                        <div class="text-sm font-semibold text-white">Pooja Sharma</div>
                        <div class="text-xs text-slate-400">Raipur • Demo Review</div>
                    </div>
                </div>
            </div>

            <div class="glass-card p-6 rounded-2xl space-y-4">
                <div class="flex text-amber-400 text-sm gap-1">
                    <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                </div>
                <p class="text-slate-300 text-sm italic">"Got clear aligners from Dr. Priya. The 3D scan explanation was clear and pricing was transparent with no hidden add-ons."</p>
                <div class="flex items-center gap-3 pt-2">
                    <div class="w-9 h-9 rounded-full bg-tealAccent/20 text-tealAccent font-bold flex items-center justify-center text-xs">VK</div>
                    <div>
                        <div class="text-sm font-semibold text-white">Vikram Kulkarni</div>
                        <div class="text-xs text-slate-400">Bhilai • Demo Review</div>
                    </div>
                </div>
            </div>

            <div class="glass-card p-6 rounded-2xl space-y-4">
                <div class="flex text-amber-400 text-sm gap-1">
                    <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                </div>
                <p class="text-slate-300 text-sm italic">"Best dental care for kids! Dr. Ananya was super gentle with my 7-year-old son during his fluoride treatment."</p>
                <div class="flex items-center gap-3 pt-2">
                    <div class="w-9 h-9 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs">AR</div>
                    <div>
                        <div class="text-sm font-semibold text-white">Anjali Rao</div>
                        <div class="text-xs text-slate-400">Raipur • Demo Review</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- FAQ Accordion -->
    <section id="faq" class="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Got Questions?</span>
            <h2 class="text-3xl sm:text-4xl font-bold">Frequently Asked Questions</h2>
        </div>

        <div class="space-y-4">
            <details class="glass-card p-5 rounded-2xl group cursor-pointer">
                <summary class="font-semibold text-white flex justify-between items-center">
                    <span>How do I book an online appointment?</span>
                    <i class="fa-solid fa-chevron-down text-brand-400 transition-transform group-open:rotate-180"></i>
                </summary>
                <p class="text-slate-300 text-sm mt-3 pt-3 border-t border-slate-800">Fill out the appointment booking form above with your preferred doctor, date, and time. You will receive a reference code instantly. Our desk will confirm your slot.</p>
            </details>

            <details class="glass-card p-5 rounded-2xl group cursor-pointer">
                <summary class="font-semibold text-white flex justify-between items-center">
                    <span>Are dental procedures at your studio painful?</span>
                    <i class="fa-solid fa-chevron-down text-brand-400 transition-transform group-open:rotate-180"></i>
                </summary>
                <p class="text-slate-300 text-sm mt-3 pt-3 border-t border-slate-800">We prioritize patient comfort utilizing computer-controlled local anesthesia, micro-laser instruments, and non-invasive dental techniques to ensure pain-free care.</p>
            </details>

            <details class="glass-card p-5 rounded-2xl group cursor-pointer">
                <summary class="font-semibold text-white flex justify-between items-center">
                    <span>What are your operating hours?</span>
                    <i class="fa-solid fa-chevron-down text-brand-400 transition-transform group-open:rotate-180"></i>
                </summary>
                <p class="text-slate-300 text-sm mt-3 pt-3 border-t border-slate-800">We are open Monday to Saturday from 9:00 AM to 7:00 PM. We remain closed on Sundays except for pre-scheduled emergency consultations.</p>
            </details>
        </div>
    </section>

    <!-- Contact & Location Section -->
    <section id="contact" class="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div class="grid lg:grid-cols-2 gap-12 glass-card p-8 sm:p-12 rounded-3xl">
            <div class="space-y-6">
                <span class="text-xs font-semibold uppercase tracking-widest text-brand-400">Get In Touch</span>
                <h2 class="text-3xl font-bold">Visit Our Clinic</h2>
                <p class="text-slate-300 text-sm leading-relaxed">Conveniently located in Raipur with dedicated parking and step-free patient accessibility.</p>

                <div class="space-y-4 pt-4">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center text-base"><i class="fa-solid fa-location-dot"></i></div>
                        <div>
                            <div class="text-xs text-slate-400">Address</div>
                            <div class="text-sm font-semibold text-white">123 Smile Avenue, Raipur, Chhattisgarh, India</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-tealAccent/20 text-tealAccent flex items-center justify-center text-base"><i class="fa-solid fa-phone"></i></div>
                        <div>
                            <div class="text-xs text-slate-400">Phone / Call</div>
                            <div class="text-sm font-semibold text-white">+91 98765 43210 (Demo Number)</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-base"><i class="fa-solid fa-envelope"></i></div>
                        <div>
                            <div class="text-xs text-slate-400">Email</div>
                            <div class="text-sm font-semibold text-white">hello@dentalcare-demo.example</div>
                        </div>
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-base"><i class="fa-solid fa-clock"></i></div>
                        <div>
                            <div class="text-xs text-slate-400">Working Hours</div>
                            <div class="text-sm font-semibold text-white">Mon – Sat: 9:00 AM – 7:00 PM | Sun: Closed</div>
                        </div>
                    </div>
                </div>

                <div class="pt-4 flex gap-4">
                    <a href="https://wa.me/919876543210" target="_blank" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl text-sm flex items-center gap-2 transition">
                        <i class="fa-brands fa-whatsapp text-lg"></i> Chat on WhatsApp
                    </a>
                </div>
            </div>

            <!-- Map Placeholder Card -->
            <div class="glass-card rounded-2xl overflow-hidden min-h-[300px] flex flex-col items-center justify-center p-6 text-center space-y-3 border border-slate-700">
                <i class="fa-solid fa-map-location-dot text-5xl text-brand-400"></i>
                <h3 class="text-lg font-bold text-white">Clinic Map Location</h3>
                <p class="text-xs text-slate-400 max-w-xs">123 Smile Avenue, Central District, Raipur, Chhattisgarh 492001</p>
                <a href="https://maps.google.com" target="_blank" class="px-4 py-2 rounded-lg bg-slate-800 text-brand-400 hover:bg-slate-700 text-xs font-semibold">Open in Google Maps</a>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-slate-800 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-400 text-sm">
        <div class="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
            <div class="space-y-3">
                <div class="flex items-center gap-2 text-white font-bold text-lg">
                    <i class="fa-solid fa-tooth text-brand-400"></i> DentalCare Smile Studio
                </div>
                <p class="text-xs text-slate-400">Setting excellence standards in painless restorative and cosmetic dentistry.</p>
            </div>
            <div>
                <h4 class="text-white font-semibold text-xs uppercase tracking-wider mb-3">Quick Links</h4>
                <ul class="space-y-2 text-xs">
                    <li><a href="#services" class="hover:text-white">Treatments</a></li>
                    <li><a href="#dentists" class="hover:text-white">Specialists</a></li>
                    <li><a href="#book" class="hover:text-white">Book Appointment</a></li>
                </ul>
            </div>
            <div>
                <h4 class="text-white font-semibold text-xs uppercase tracking-wider mb-3">Admin</h4>
                <ul class="space-y-2 text-xs">
                    <li><a href="/admin" class="hover:text-white text-brand-400">Admin Login Portal</a></li>
                </ul>
            </div>
            <div>
                <h4 class="text-white font-semibold text-xs uppercase tracking-wider mb-3">Demo Notice</h4>
                <p class="text-xs text-slate-400">This website is a demonstration project with fictional dentist names, reviews, and address details.</p>
            </div>
        </div>
        <div class="max-w-7xl mx-auto pt-8 border-t border-slate-900 text-center text-xs text-slate-500">
            &copy; 2026 DentalCare Smile Studio. All rights reserved. Built for showcase purposes.
        </div>
    </footer>

    <!-- Frontend Script -->
    <script>
      let servicesData = [];
      let dentistsData = [];

      document.addEventListener('DOMContentLoaded', async () => {
        setupMobileMenu();
        setupMinDate();
        await loadInitialData();
      });

      function setupMobileMenu() {
        const btn = document.getElementById('mobileMenuBtn');
        const menu = document.getElementById('mobileMenu');
        btn?.addEventListener('click', () => menu.classList.toggle('hidden'));
        document.querySelectorAll('.mobile-link').forEach(link => {
          link.addEventListener('click', () => menu.classList.add('hidden'));
        });
      }

      function setupMinDate() {
        const dateInput = document.getElementById('bookingDate');
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
      }

      async function loadInitialData() {
        try {
          const [srvRes, denRes] = await Promise.all([
            fetch('/api/services'),
            fetch('/api/dentists')
          ]);
          servicesData = await srvRes.json();
          dentistsData = await denRes.json();

          renderServices();
          renderDentists();
          populateFormSelects();
          setupBookingListeners();
        } catch (err) {
          console.error('Error loading initial data:', err);
        }
      }

      function renderServices() {
        const grid = document.getElementById('servicesGrid');
        grid.innerHTML = servicesData.map(s => \`
          <div class="glass-card glass-card-hover p-6 rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div class="w-12 h-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center text-2xl mb-4">
                <i class="fa-solid \${s.icon}"></i>
              </div>
              <h3 class="text-lg font-bold text-white mb-2">\${s.name}</h3>
              <p class="text-slate-400 text-xs leading-relaxed mb-4">\${s.description}</p>
            </div>
            <div class="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span class="text-xs text-slate-400 block">Est. Price</span>
                <span class="text-base font-bold text-tealAccent">₹\${s.price}</span>
              </div>
              <a href="#book" onclick="preselectService('\${s.id}')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-brand-600 text-white text-xs font-semibold transition">
                Book Now
              </a>
            </div>
          </div>
        \`).join('');
      }

      function renderDentists() {
        const grid = document.getElementById('dentistsGrid');
        grid.innerHTML = dentistsData.map(d => \`
          <div class="glass-card glass-card-hover p-5 rounded-2xl space-y-4">
            <img src="\${d.photo}" alt="\${d.name}" class="w-full h-48 object-cover rounded-xl">
            <div>
              <h3 class="font-bold text-white text-base">\${d.name}</h3>
              <p class="text-xs text-brand-400 font-medium mt-0.5">\${d.specialty}</p>
              <p class="text-xs text-slate-400 mt-1">\${d.qualification} • \${d.experience}</p>
            </div>
            <a href="#book" onclick="preselectDentist('\${d.id}')" class="block text-center py-2 rounded-xl bg-slate-800/80 hover:bg-brand-600 text-white text-xs font-semibold transition">
              Consult \${d.name.split(' ')[1]}
            </a>
          </div>
        \`).join('');
      }

      function populateFormSelects() {
        const sSelect = document.getElementById('serviceSelect');
        sSelect.innerHTML = '<option value="">-- Choose Treatment --</option>' + 
          servicesData.map(s => \`<option value="\${s.id}">\${s.name} (₹\${s.price})</option>\`).join('');

        const dSelect = document.getElementById('dentistSelect');
        dSelect.innerHTML = '<option value="">-- Choose Dentist --</option>' + 
          dentistsData.map(d => \`<option value="\${d.id}">\${d.name} (\${d.specialty})</option>\`).join('');
      }

      function preselectService(id) {
        document.getElementById('serviceSelect').value = id;
      }

      function preselectDentist(id) {
        document.getElementById('dentistSelect').value = id;
        triggerSlotFetch();
      }

      function setupBookingListeners() {
        const dateInput = document.getElementById('bookingDate');
        const dentistSelect = document.getElementById('dentistSelect');
        const form = document.getElementById('bookingForm');

        dateInput.addEventListener('change', triggerSlotFetch);
        dentistSelect.addEventListener('change', triggerSlotFetch);

        form.addEventListener('submit', handleBookingSubmit);
      }

      async function triggerSlotFetch() {
        const date = document.getElementById('bookingDate').value;
        const dentistId = document.getElementById('dentistSelect').value;
        const timeSlotSelect = document.getElementById('timeSlotSelect');

        if (!date || !dentistId) {
          timeSlotSelect.disabled = true;
          timeSlotSelect.innerHTML = '<option value="">Select Date & Dentist First</option>';
          return;
        }

        timeSlotSelect.disabled = true;
        timeSlotSelect.innerHTML = '<option value="">Checking slots...</option>';

        try {
          const res = await fetch(\`/api/availability?date=\${date}&dentistId=\${dentistId}\`);
          const data = await res.json();

          if (data.reason) {
            timeSlotSelect.innerHTML = \`<option value="">\${data.reason}</option>\`;
            return;
          }

          if (data.availableSlots && data.availableSlots.length > 0) {
            timeSlotSelect.disabled = false;
            timeSlotSelect.innerHTML = '<option value="">-- Choose Slot --</option>' + 
              data.availableSlots.map(slot => \`<option value="\${slot}">\${slot}</option>\`).join('');
          } else {
            timeSlotSelect.innerHTML = '<option value="">No available slots for selected date</option>';
          }
        } catch (err) {
          timeSlotSelect.innerHTML = '<option value="">Error fetching slots</option>';
        }
      }

      async function handleBookingSubmit(e) {
        e.preventDefault();
        const alertBox = document.getElementById('bookingAlert');
        const submitBtn = document.getElementById('submitBookingBtn');
        alertBox.classList.add('hidden');

        const payload = {
          fullName: document.getElementById('fullName').value,
          phone: document.getElementById('phone').value,
          email: document.getElementById('email').value,
          serviceId: document.getElementById('serviceSelect').value,
          dentistId: document.getElementById('dentistSelect').value,
          date: document.getElementById('bookingDate').value,
          timeSlot: document.getElementById('timeSlotSelect').value,
          reason: document.getElementById('reason').value
        };

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Submitting...';

        try {
          const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Failed to submit booking');
          }

          // Show confirmation screen
          document.getElementById('bookingForm').classList.add('hidden');
          document.getElementById('confRef').textContent = data.booking.reference;
          document.getElementById('confService').textContent = data.booking.serviceName;
          document.getElementById('confDentist').textContent = data.booking.dentistName;
          document.getElementById('confDateTime').textContent = \`\${data.booking.date} at \${data.booking.timeSlot}\`;
          document.getElementById('bookingConfirmation').classList.remove('hidden');

        } catch (err) {
          alertBox.className = 'p-4 rounded-xl text-sm bg-rose-500/20 text-rose-300 border border-rose-500/30';
          alertBox.textContent = err.message;
          alertBox.classList.remove('hidden');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> <span>Confirm Booking Request</span>';
        }
      }

      function resetBookingForm() {
        document.getElementById('bookingForm').reset();
        document.getElementById('bookingForm').classList.remove('hidden');
        document.getElementById('bookingConfirmation').classList.add('hidden');
        document.getElementById('timeSlotSelect').disabled = true;
        document.getElementById('timeSlotSelect').innerHTML = '<option value="">Select Date & Dentist First</option>';
      }

      async function trackBooking() {
        const ref = document.getElementById('trackRefInput').value.trim();
        const resBox = document.getElementById('trackResult');

        if (!ref) {
          alert('Please enter a booking reference');
          return;
        }

        resBox.classList.remove('hidden');
        resBox.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-brand-400"></i> Querying...';

        try {
          const res = await fetch(\`/api/bookings/status?reference=\${encodeURIComponent(ref)}\`);
          const data = await res.json();

          if (!res.ok) {
            resBox.innerHTML = \`<span class="text-rose-400"><i class="fa-solid fa-triangle-exclamation mr-1"></i> \${data.error}</span>\`;
            return;
          }

          let badgeColor = 'bg-amber-500/20 text-amber-300';
          if (data.status === 'Confirmed') badgeColor = 'bg-emerald-500/20 text-emerald-300';
          if (data.status === 'Completed') badgeColor = 'bg-blue-500/20 text-blue-300';
          if (data.status === 'Cancelled' || data.status === 'Rejected') badgeColor = 'bg-rose-500/20 text-rose-300';

          resBox.innerHTML = \`
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="font-bold text-white">\${data.reference}</span>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold \${badgeColor}">\${data.status}</span>
              </div>
              <div class="text-xs text-slate-300"><strong>Treatment:</strong> \${data.serviceName}</div>
              <div class="text-xs text-slate-300"><strong>Doctor:</strong> \${data.dentistName}</div>
              <div class="text-xs text-slate-300"><strong>Date & Time:</strong> \${data.date} at \${data.timeSlot}</div>
            </div>
          \`;
        } catch (err) {
          resBox.innerHTML = '<span class="text-rose-400">Unable to query status. Please try again.</span>';
        }
      }
    </script>
</body>
</html>`);
});

// Admin Route Host - Serves Admin Interface Layout
app.get("/admin", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.send(`<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard | DentalCare Studio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      body { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }
      .glass-card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }
    </style>
</head>
<body class="antialiased selection:bg-sky-500 selection:text-white">
    <div id="adminApp"></div>
    <script src="/admin.js"></script>
</body>
</html>`);
});

// Start express server locally if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`DentalCare Studio running on port ${PORT}`);
  });
}

// Export Express App for Vercel Serverless Function Execution
module.exports = app;
