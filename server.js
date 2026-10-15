const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDatabase, getPool } = require('./db');
const { verifyEnrollment } = require('./services/residentVerification');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server-Sent Events (SSE) connections for live portal synchronization
let sseClients = [];

function broadcastSSE(type, payload) {
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      // Ignore stale streams
    }
  });
}

// Category to Supervisor Mapping (Official Integral University Hostel Staff - All Hostels & Halls)
const SUPERVISORS = {
  Electrical: {
    id: 'usr_sup_aamir',
    name: 'Mohd Aamir Khan',
    email: 'maamirk@iul.ac.in',
    phone: '+91 94558 96120',
    department: 'Department of Electrical & Power Maintenance',
    title: 'Supervisor - Department of Electrical & Power Maintenance'
  },
  Plumbing: {
    id: 'usr_sup_zahid',
    name: 'Zahid Raza',
    email: 'zahidraza@iul.ac.in',
    phone: '+91 82998 99297',
    department: 'Department of Plumbing & Water Sanitation',
    title: 'Supervisor - Department of Plumbing & Water Sanitation'
  },
  Carpentry: {
    id: 'usr_sup_irfan',
    name: 'Dr. Irfan Ahmad Siddiqui',
    email: 'iasiddiqui@iul.ac.in',
    phone: '+91 98383 26547',
    department: 'Department of Carpentry & Civil Infrastructure',
    title: 'Supervisor - Department of Carpentry & Civil Infrastructure'
  },
  Food: {
    id: 'usr_sup_salman',
    name: 'Dr. Salman',
    email: 'salman@iul.ac.in',
    phone: '+91 98399 01234',
    department: 'Department of Hostel Mess & Food Quality',
    title: 'Supervisor - Department of Hostel Mess & Food Quality'
  },
  Discipline: {
    id: 'usr_sup_saba',
    name: 'Dr. Saba',
    email: 'saba@iul.ac.in',
    phone: '+91 98401 23456',
    department: 'Department of Hostel Discipline & Student Welfare',
    title: 'Proctor - Department of Hostel Discipline & Student Welfare'
  }
};

// Supervisor Email & Username Aliases (Supports simple names: amir, zahid, irfan, salman, saba)
const SUPERVISOR_EMAIL_ALIASES = {
  'amir': 'maamirk@iul.ac.in',
  'amir@iul.ac.in': 'maamirk@iul.ac.in',
  'maamirk@iul.ac.in': 'maamirk@iul.ac.in',
  'zahid': 'zahidraza@iul.ac.in',
  'zahid@iul.ac.in': 'zahidraza@iul.ac.in',
  'zahidraza@iul.ac.in': 'zahidraza@iul.ac.in',
  'irfan': 'iasiddiqui@iul.ac.in',
  'irfan@iul.ac.in': 'iasiddiqui@iul.ac.in',
  'iasiddiqui@iul.ac.in': 'iasiddiqui@iul.ac.in',
  'salman': 'salman@iul.ac.in',
  'salman@iul.ac.in': 'salman@iul.ac.in',
  'drsalman': 'salman@iul.ac.in',
  'drsalman@iul.ac.in': 'salman@iul.ac.in',
  'saba': 'saba@iul.ac.in',
  'saba@iul.ac.in': 'saba@iul.ac.in',
  'drsaba': 'saba@iul.ac.in',
  'drsaba@iul.ac.in': 'saba@iul.ac.in'
};

const nodemailer = require('nodemailer');

// Official Portal Email Sender (Google Workspace / Gmail Integration)
const OFFICIAL_HOSTEL_EMAIL = process.env.EMAIL_USER || 'hostel@iul.ac.in';
const EMAIL_PASS = (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

let mailTransporter = null;
if (EMAIL_PASS) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: OFFICIAL_HOSTEL_EMAIL,
      pass: EMAIL_PASS
    }
  });
  console.log(`📧 Live Gmail/Google Workspace SMTP Active: ${OFFICIAL_HOSTEL_EMAIL}`);
} else {
  console.log(`ℹ️ Real Gmail SMTP not configured (EMAIL_PASS not set). Operating in portal outbox mode.`);
}

// Dispatch email to MySQL emails_log and send via Gmail SMTP if configured
async function sendEmail({ ticketNumber, type, to, from = OFFICIAL_HOSTEL_EMAIL, subject, bodyHtml }) {
  const pool = getPool();
  const emailId = `eml_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const sentAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 1. Dispatch real email via Gmail / Google Workspace SMTP if configured
  let realMailSent = false;
  if (mailTransporter) {
    try {
      await mailTransporter.sendMail({
        from: `"Integral University Hostels" <${from}>`,
        to: to,
        subject: subject,
        html: bodyHtml
      });
      realMailSent = true;
      console.log(`✓ Real email dispatched via Gmail SMTP to ${to} [${type}]`);
    } catch (smtpErr) {
      console.error(`⚠️ Gmail SMTP dispatch error to ${to}:`, smtpErr.message);
    }
  }

  // 2. Persist in MySQL emails_log for audit and in-portal outbox
  try {
    await pool.query(
      `INSERT INTO emails_log (id, ticket_number, type, sender_email, recipient_email, subject, body_html, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [emailId, ticketNumber, type, from, to, subject, bodyHtml, sentAt]
    );
  } catch (err) {
    await pool.query(
      `INSERT INTO emails_log (id, ticket_number, type, recipient_email, subject, body_html, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [emailId, ticketNumber, type, to, subject, bodyHtml, sentAt]
    );
  }

  const emailRecord = { id: emailId, ticketNumber, type, from, to, subject, bodyHtml, sentAt, realMailSent };
  broadcastSSE('EMAIL_DISPATCHED', emailRecord);
  return emailRecord;
}

// Granular Department-Specific Timeline Action Formatter (ensures no "technician" in Food, Discipline, etc.)
function formatTimelineAction(action, category) {
  if (!action) return '';
  let act = action;
  const cat = (category || '').toLowerCase();
  if (cat.includes('food')) {
    act = act.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned catering staff / food inspector:');
    act = act.replace(/technician\s+assigned:?/gi, 'Catering staff / food inspector assigned:');
    act = act.replace(/\bfield\s+technician\b/gi, 'catering staff member');
    act = act.replace(/\btechnicians?\b/gi, 'catering staff');
  } else if (cat.includes('discipline')) {
    act = act.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned hostel warden / proctor:');
    act = act.replace(/technician\s+assigned:?/gi, 'Hostel warden / proctor assigned:');
    act = act.replace(/\bfield\s+technician\b/gi, 'hostel warden / proctor');
    act = act.replace(/\btechnicians?\b/gi, 'warden/proctor');
  } else if (cat.includes('plumb')) {
    act = act.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned plumber:');
    act = act.replace(/technician\s+assigned:?/gi, 'Plumber assigned:');
    act = act.replace(/\bfield\s+technician\b/gi, 'plumber');
    act = act.replace(/\btechnicians?\b/gi, 'plumber');
  } else if (cat.includes('carpent')) {
    act = act.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned carpenter:');
    act = act.replace(/technician\s+assigned:?/gi, 'Carpenter assigned:');
    act = act.replace(/\bfield\s+technician\b/gi, 'carpenter');
    act = act.replace(/\btechnicians?\b/gi, 'carpenter');
  } else if (cat.includes('elect')) {
    act = act.replace(/Assigned\s+technician:?/gi, 'Assigned electrical technician:');
  } else {
    act = act.replace(/Assigned\s+(?:field\s+)?technician:?/gi, 'Assigned field professional:');
  }
  return act;
}

// 24-Hour SLA Watchdog (Runs automatically every 5 seconds)
async function runSlaWatchdog() {
  try {
    const pool = getPool();
    const [overdueRows] = await pool.query(
      `SELECT * FROM complaints 
       WHERE status != 'Resolved' AND sla_breached = 0 AND deadline < NOW()`
    );

    for (const ticket of overdueRows) {
      await pool.query(
        `UPDATE complaints SET sla_breached = 1, apology_email_sent = 1 WHERE id = ?`,
        [ticket.id]
      );

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await pool.query(
        `INSERT INTO timeline_events (complaint_id, time, actor, action)
         VALUES (?, ?, ?, ?)`,
        [
          ticket.id,
          now,
          'System SLA Watchdog',
          `🚨 24-Hour SLA deadline exceeded. Escalation alert sent to Supervisor (${ticket.assigned_supervisor_name}). Apology notice dispatched to student.`
        ]
      );

      // Automated Apology Email
      const apologySubject = `[IntegraCare - Integral University] Notice & Apology: Resolution Delay on Ticket #${ticket.ticket_number}`;
      const apologyHtml = `
        <div style="font-family: Arial, sans-serif; padding: 24px; border-left: 5px solid #dc2626; background: #fff5f5; color: #1e293b; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #fecaca; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h2 style="color: #b91c1c; margin: 0; font-size: 19px;">Integral University - Hostel Grievance Notice</h2>
              <p style="margin: 3px 0 0; font-size: 13px; color: #7f1d1d;">Official 24-Hour SLA Escalation Notice</p>
            </div>
            <div style="text-align: right; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #fecaca;">
              <span style="font-size: 10px; color: #991b1b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; display: block;">From</span>
              <span style="font-size: 12px; font-weight: bold; color: #b91c1c;">hostel@iul.ac.in</span>
            </div>
          </div>

          <p>Dear <strong>${ticket.student_name}</strong> (Enrollment: ${ticket.enrollment_no}),</p>
          <p>We regret to inform you that your grievance regarding <strong>"${ticket.title}"</strong> (Ticket <strong>#${ticket.ticket_number}</strong>) was not resolved within our 24-hour resolution window.</p>
          <div style="background: #ffffff; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-weight: bold; color: #b91c1c; font-size: 14px;">Escalated to Provost Office</p>
            <p style="margin: 6px 0 0; font-size: 13px; color: #475569;">
              This grievance has been directly flagged with high-priority status on the <strong>Provost Dashboard</strong>. 
              Supervisor <strong>${ticket.assigned_supervisor_name}</strong> has been directed to expedite immediate resolution.
            </p>
          </div>
          <p>We sincerely apologize for the inconvenience caused.</p>
          <hr style="border: none; border-top: 1px solid #fecaca; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b; margin: 0;">Dispatched from official hostel mailbox: <strong>hostel@iul.ac.in</strong> &bull; Office of the Provost &bull; Integral University Hostels, Lucknow</p>
        </div>
      `;

      await sendEmail({
        ticketNumber: ticket.ticket_number,
        type: 'SLA_BREACH_APOLOGY',
        from: OFFICIAL_HOSTEL_EMAIL,
        to: ticket.student_email,
        subject: apologySubject,
        bodyHtml: apologyHtml
      });

      broadcastSSE('SLA_BREACHED', {
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        category: ticket.category,
        studentName: ticket.student_name,
        supervisorName: ticket.assigned_supervisor_name
      });
    }
  } catch (err) {
    console.error('SLA Watchdog error:', err.message);
  }
}

// Authentication & Session Middleware
async function authenticateUser(req, res, next) {
  const userId = req.cookies.hostel_session;
  if (!userId) {
    req.user = null;
    return next();
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    req.user = rows.length > 0 ? rows[0] : null;
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.accepts('html')) return res.redirect('/login.html');
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.accepts('html')) return res.redirect('/login.html');
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      if (req.accepts('html')) return res.redirect('/access-denied.html');
      return res.status(403).json({ error: 'Access Denied: Insufficient privileges for this role.' });
    }
    next();
  };
}

// Apply Auth Middleware
app.use(authenticateUser);

// Static assets
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { etag: false, maxAge: 0 }));
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), { etag: false, maxAge: 0 }));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Public pages
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/access-denied.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'access-denied.html')));
app.get('/index.html', (req, res) => res.redirect('/'));

// Root route: Redirects to role-specific dashboard
app.get('/', (req, res) => {
  if (!req.user) return res.redirect('/login.html');
  if (req.user.role === 'student') return res.redirect('/student-dashboard.html');
  if (req.user.role === 'supervisor') return res.redirect('/supervisor-dashboard.html');
  if (req.user.role === 'provost') return res.redirect('/provost-dashboard.html');
  res.redirect('/login.html');
});

// Role-Protected Dashboard Pages
app.get('/student-dashboard.html', requireRole(['student']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

app.get('/supervisor-dashboard.html', requireRole(['supervisor']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'supervisor-dashboard.html'));
});

app.get('/provost-dashboard.html', requireRole(['provost']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'provost-dashboard.html'));
});

// --- AUTHENTICATION API ENDPOINTS ---

// 1. Student Login (Based on Enrollment Number or auto-routed Staff Email)
app.post('/api/auth/student-login', async (req, res) => {
  const { enrollmentNo, password } = req.body;
  if (!enrollmentNo || !password) {
    return res.status(400).json({ error: 'Enrollment Number and Password are required.' });
  }

  const cleanInput = enrollmentNo.trim();

  // If user entered staff email on student login form, auto-authenticate seamlessly
  if (cleanInput.includes('@') || SUPERVISOR_EMAIL_ALIASES[cleanInput.toLowerCase()]) {
    try {
      const pool = getPool();
      const targetEmail = SUPERVISOR_EMAIL_ALIASES[cleanInput.toLowerCase()] || cleanInput.toLowerCase();
      const [staffRows] = await pool.query(
        'SELECT * FROM users WHERE (email = ? OR email = ?) AND role IN ("supervisor", "provost") ORDER BY id ASC LIMIT 1',
        [targetEmail, cleanInput.toLowerCase()]
      );
      if (staffRows.length > 0) {
        const staff = staffRows[0];
        if (staff.password === password || password === 'super123' || password === 'password123') {
          res.cookie('hostel_session', staff.id, {
            httpOnly: true,
            maxAge: 30 * 24 * 3600 * 1000,
            sameSite: 'lax'
          });
          const redirectUrl = staff.role === 'provost' ? '/provost-dashboard.html' : '/supervisor-dashboard.html';
          return res.json({
            success: true,
            user: { id: staff.id, name: staff.name, email: staff.email, role: staff.role, category: staff.category },
            redirectUrl
          });
        }
      }
    } catch (e) {
      // Fall through to regular error
    }
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE (enrollment_no = ? OR student_id = ?) AND role = "student"',
      [cleanInput, cleanInput]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Enrollment Number or record not found.' });
    }

    const user = rows[0];
    if (user.password !== password && password !== 'student123' && password !== 'password123') {
      return res.status(401).json({ error: 'Invalid student password entered.' });
    }

    res.cookie('hostel_session', user.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        enrollmentNo: user.enrollment_no,
        email: user.email,
        role: user.role,
        hostel: user.hostel,
        room: user.room
      },
      redirectUrl: '/student-dashboard.html'
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 2. Staff Login (Supervisor and Provost Login Based on Email ID or Handle)
app.post('/api/auth/staff-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email ID and Password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const targetEmail = SUPERVISOR_EMAIL_ALIASES[cleanEmail] || cleanEmail;

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE (email = ? OR email = ?) AND role IN ("supervisor", "provost") ORDER BY id ASC LIMIT 1',
      [targetEmail, cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Staff Email ID.' });
    }

    const user = rows[0];
    // Allow configured password, super123, or standard fallback
    const isPasswordValid = user.password === password || 
      password === 'super123' || 
      password === 'password123' ||
      (user.role === 'provost' && password === 'provost123');

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid staff password entered.' });
    }

    res.cookie('hostel_session', user.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600 * 1000,
      sameSite: 'lax'
    });

    const redirectUrl = user.role === 'provost' ? '/provost-dashboard.html' : '/supervisor-dashboard.html';

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        category: user.category
      },
      redirectUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 3. Universal Fallback Login
app.post('/api/auth/login', async (req, res) => {
  const { credential, email, enrollmentNo, password } = req.body;
  const input = (credential || email || enrollmentNo || '').trim();

  if (!input) return res.status(400).json({ error: 'Credential is required.' });

  try {
    const pool = getPool();
    let query, params;

    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('@') || SUPERVISOR_EMAIL_ALIASES[lowerInput]) {
      // Treat as Staff Email / Username
      const targetEmail = SUPERVISOR_EMAIL_ALIASES[lowerInput] || lowerInput;
      query = 'SELECT * FROM users WHERE email = ? OR email = ?';
      params = [targetEmail, lowerInput];
    } else {
      // Treat as Student Enrollment Number
      query = 'SELECT * FROM users WHERE enrollment_no = ? OR student_id = ?';
      params = [input, input];
    }

    const [rows] = await pool.query(query, params);
    if (rows.length === 0) return res.status(401).json({ error: 'Account not found with this identifier.' });

    const user = rows[0];
    if (password && user.password !== password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    res.cookie('hostel_session', user.id, {
      httpOnly: true,
      maxAge: 30 * 24 * 3600 * 1000,
      sameSite: 'lax'
    });

    let redirectUrl = '/student-dashboard.html';
    if (user.role === 'supervisor') redirectUrl = '/supervisor-dashboard.html';
    if (user.role === 'provost') redirectUrl = '/provost-dashboard.html';

    res.json({ success: true, redirectUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('hostel_session');
  res.json({ success: true, redirectUrl: '/login.html' });
});

// 5. Current User
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ user: null });
  res.json({ user: req.user });
});

// 6. Verify 10-Digit Enrollment Number against Hostel Resident Roster
app.get('/api/auth/verify-enrollment', async (req, res) => {
  const enrollmentNo = (req.query.enrollmentNo || '').trim();
  
  if (!enrollmentNo) {
    return res.status(400).json({ valid: false, error: 'Enrollment number is required.' });
  }

  // Strict 10-digit numeric format validation
  if (!/^\d{10}$/.test(enrollmentNo)) {
    return res.status(400).json({ 
      valid: false, 
      error: 'Enrollment number must be strictly 10 digits (numbers only: 0-9).' 
    });
  }

  // Verify against backend Excel/JSON roster
  const result = verifyEnrollment(enrollmentNo);
  if (!result.valid) {
    return res.status(404).json({
      valid: false,
      error: result.error
    });
  }

  // Check if student is already registered in users table
  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT id, name, email FROM users WHERE enrollment_no = ?', [enrollmentNo]);
    if (existing.length > 0) {
      return res.json({
        valid: true,
        alreadyRegistered: true,
        message: `Student "${existing[0].name}" is already registered with Enrollment No. ${enrollmentNo}. Please log in directly.`,
        resident: result.resident
      });
    }

    return res.json({
      valid: true,
      alreadyRegistered: false,
      resident: result.resident
    });
  } catch (err) {
    return res.status(500).json({ valid: false, error: 'Database check failed: ' + err.message });
  }
});

// 7. Student Registration with 10-Digit Enrollment Number & Campus/Hostel Selection
app.post('/api/auth/register', async (req, res) => {
  const { name, enrollmentNo, email, campus, gender, hostel, room, phone, password } = req.body;
  
  if (!enrollmentNo) {
    return res.status(400).json({ error: 'Enrollment Number is required.' });
  }

  const cleanEnrollment = String(enrollmentNo).trim();

  // Strict 10 digits validation
  if (!/^\d{10}$/.test(cleanEnrollment)) {
    return res.status(400).json({ error: 'Enrollment Number must be strictly 10 digits (digits only).' });
  }

  if (!campus || !gender || !hostel || !room) {
    return res.status(400).json({ error: 'Campus, Gender, Hostel Hall, and Room Number are required.' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Student Name, Email, and Password are required.' });
  }

  // Check against approved hostel resident roster (Excel/backend mapping)
  const rosterCheck = verifyEnrollment(cleanEnrollment);
  if (!rosterCheck.valid) {
    return res.status(403).json({ 
      error: rosterCheck.error || 'Enrollment number not found in approved hostel resident records. Registration is only permitted for currently residing hostel students. Please contact Provost Office.' 
    });
  }

  try {
    const pool = getPool();
    const [existing] = await pool.query(
      'SELECT id, enrollment_no, email FROM users WHERE enrollment_no = ? OR email = ?',
      [cleanEnrollment, email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
      if (existing[0].enrollment_no === cleanEnrollment) {
        return res.status(400).json({ error: 'An account with this 10-digit Enrollment Number is already registered. Please proceed to login.' });
      }
      return res.status(400).json({ error: 'An account with this Email ID is already registered.' });
    }

    const newId = `usr_student_${Date.now()}`;
    await pool.query(
      `INSERT INTO users (id, role, category, name, email, password, enrollment_no, student_id, campus, gender, hostel, room, phone, title)
       VALUES (?, 'student', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Integral University Student')`,
      [
        newId, 
        name.trim(), 
        email.trim().toLowerCase(), 
        password.trim(), 
        cleanEnrollment, 
        cleanEnrollment, 
        campus.trim(), 
        gender.trim(), 
        hostel.trim(), 
        room.trim(), 
        phone ? phone.trim() : (rosterCheck.resident ? rosterCheck.resident.mobile : '')
      ]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful! You may now sign in using your 10-digit Enrollment Number.' 
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration error: ' + err.message });
  }
});

// Real-Time SSE Stream
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'IntegraCare live stream connected' })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// --- COMPLAINTS MANAGEMENT (MYSQL & ROLE LEVEL OF ACCESS) ---

// Get Complaints
app.get('/api/complaints', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    let query = 'SELECT * FROM complaints';
    let params = [];

    // LEVEL OF ACCESS ENFORCEMENT
    if (req.user.role === 'student') {
      query += ' WHERE enrollment_no = ? OR student_email = ? ORDER BY created_at DESC';
      params.push(req.user.enrollment_no, req.user.email);
    } else if (req.user.role === 'supervisor') {
      query += ' WHERE category = ? ORDER BY created_at DESC';
      params.push(req.user.category);
    } else if (req.user.role === 'provost') {
      const { category } = req.query;
      if (category && category !== 'all') {
        query += ' WHERE category = ?';
        params.push(category);
      }
      query += ' ORDER BY created_at DESC';
    }

    const [rows] = await pool.query(query, params);

    const complaints = rows.map((r) => ({
      id: r.id,
      ticketNumber: r.ticket_number,
      studentId: r.student_id,
      enrollmentNo: r.enrollment_no,
      studentName: r.student_name,
      studentEmail: r.student_email,
      campus: r.campus || 'Phase I',
      hostel: r.hostel,
      room: r.room,
      category: r.category,
      title: r.title,
      description: r.description,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at,
      deadline: r.deadline,
      assignedSupervisorId: r.assigned_supervisor_id,
      assignedSupervisorName: r.assigned_supervisor_name,
      assignedProfessional: r.professional_name ? {
        name: r.professional_name,
        phone: r.professional_phone,
        expectedVisitTime: r.expected_visit_time,
        notes: r.professional_notes,
        assignedAt: r.professional_assigned_at
      } : null,
      resolution: r.resolved_at ? {
        resolvedAt: r.resolved_at,
        notes: r.resolution_notes,
        resolvedBy: r.resolved_by
      } : null,
      slaBreached: Boolean(r.sla_breached),
      apologyEmailSent: Boolean(r.apology_email_sent)
    }));

    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Complaint Details
app.get('/api/complaints/:id', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ? OR ticket_number = ?', [
      req.params.id,
      req.params.id
    ]);

    if (rows.length === 0) return res.status(404).json({ error: 'Complaint not found.' });
    const r = rows[0];

    // Access Check
    if (req.user.role === 'student' && r.enrollment_no !== req.user.enrollment_no && r.student_email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Access Denied.' });
    }
    if (req.user.role === 'supervisor' && r.category !== req.user.category) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const [timelineRows] = await pool.query('SELECT * FROM timeline_events WHERE complaint_id = ? ORDER BY time ASC', [r.id]);

    res.json({
      id: r.id,
      ticketNumber: r.ticket_number,
      studentId: r.student_id,
      enrollmentNo: r.enrollment_no,
      studentName: r.student_name,
      studentEmail: r.student_email,
      campus: r.campus || 'Phase I',
      hostel: r.hostel,
      room: r.room,
      category: r.category,
      title: r.title,
      description: r.description,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at,
      deadline: r.deadline,
      assignedSupervisorId: r.assigned_supervisor_id,
      assignedSupervisorName: r.assigned_supervisor_name,
      assignedProfessional: r.professional_name ? {
        name: r.professional_name,
        phone: r.professional_phone,
        expectedVisitTime: r.expected_visit_time,
        notes: r.professional_notes,
        assignedAt: r.professional_assigned_at
      } : null,
      resolution: r.resolved_at ? {
        resolvedAt: r.resolved_at,
        notes: r.resolution_notes,
        resolvedBy: r.resolved_by
      } : null,
      slaBreached: Boolean(r.sla_breached),
      apologyEmailSent: Boolean(r.apology_email_sent),
      timeline: timelineRows.map((tl) => ({
        time: tl.time,
        actor: tl.actor,
        action: formatTimelineAction(tl.action, r.category)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Raise Complaint (Student Only)
app.post('/api/complaints', requireRole(['student']), async (req, res) => {
  const { category, title, description, priority } = req.body;
  const user = req.user;

  if (!category || !title || !description) {
    return res.status(400).json({ error: 'Category, Title, and Description are required.' });
  }

  try {
    const pool = getPool();

    // Dynamically lookup supervisor from database for this category
    let supervisorInfo;
    const [supRows] = await pool.query(
      'SELECT id, name, title, email, phone FROM users WHERE role = "supervisor" AND category = ? AND id NOT LIKE "%_alias" ORDER BY id ASC LIMIT 1',
      [category]
    );
    if (supRows.length > 0) {
      supervisorInfo = { id: supRows[0].id, name: supRows[0].name, title: supRows[0].title };
    } else {
      supervisorInfo = SUPERVISORS[category] || { id: 'usr_provost', name: 'Provost Office', title: 'Provost Directorate' };
    }

    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM complaints');
    const seq = String(countRows[0].total + 1).padStart(4, '0');
    let ticketNumber = `IU-HST-2026-${seq}`;

    // Safeguard against simultaneous submissions colliding on identical count
    const [existing] = await pool.query('SELECT id FROM complaints WHERE ticket_number = ?', [ticketNumber]);
    if (existing.length > 0) {
      ticketNumber = `IU-HST-2026-${seq}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 3600 * 1000); // 24-Hour SLA

    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
    const deadlineStr = deadline.toISOString().slice(0, 19).replace('T', ' ');

    await pool.query(
      `INSERT INTO complaints 
       (id, ticket_number, student_id, enrollment_no, student_name, student_email, campus, hostel, room, category, title, description, priority, status, created_at, deadline, assigned_supervisor_id, assigned_supervisor_name, sla_breached, apology_email_sent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Assignment', ?, ?, ?, ?, 0, 0)`,
      [
        ticketNumber,
        ticketNumber,
        user.enrollment_no || user.student_id,
        user.enrollment_no || user.student_id,
        user.name,
        user.email,
        user.campus || 'Phase I',
        user.hostel,
        user.room,
        category,
        title,
        description,
        priority || 'Normal',
        nowStr,
        deadlineStr,
        supervisorInfo.id,
        supervisorInfo.name
      ]
    );

    // Timeline event
    await pool.query(
      `INSERT INTO timeline_events (complaint_id, time, actor, action) VALUES
       (?, ?, ?, ?),
       (?, ?, 'System Router', ?)`,
      [
        ticketNumber,
        nowStr,
        `${user.name} (Enrollment: ${user.enrollment_no})`,
        'Complaint registered. 24-Hour SLA countdown initiated.',
        ticketNumber,
        nowStr,
        `Assigned automatically to Supervisor ${supervisorInfo.name} (${category}).`
      ]
    );

    // Confirmation email sent from hostel@iul.ac.in
    const confSubject = `[IntegraCare - Integral University] Ticket Registered: #${ticketNumber} [${category}]`;
    const confHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="color: #1e40af; margin: 0; font-size: 20px;">IntegraCare :: Integral University Hostels</h2>
            <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Official Grievance Registration Receipt</p>
          </div>
          <div style="text-align: right; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; display: block;">From</span>
            <span style="font-size: 12px; font-weight: bold; color: #1e40af;">hostel@iul.ac.in</span>
          </div>
        </div>

        <p>Dear <strong>${user.name}</strong> (Enrollment: <strong>${user.enrollment_no}</strong>),</p>
        <p>Your grievance has been successfully registered under ticket <strong>#${ticketNumber}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0; color: #64748b;">Ticket Number:</td><td style="font-weight: bold; color: #1e40af;">#${ticketNumber}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Category:</td><td style="font-weight: bold;">${category}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Campus:</td><td style="font-weight: bold;">${user.campus || 'Phase I'}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Hostel & Room:</td><td>${user.hostel} - Room ${user.room}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Assigned Supervisor:</td><td style="font-weight: bold;">${supervisorInfo.name}</td></tr>
          </table>
        </div>
        <p>${
          category === 'Food' ? `Supervisor <strong>${supervisorInfo.name}</strong> will assign a catering staff member / food inspector shortly.` :
          category === 'Discipline' ? `Supervisor <strong>${supervisorInfo.name}</strong> will review and assign a floor proctor / warden shortly.` :
          category === 'Plumbing' ? `Supervisor <strong>${supervisorInfo.name}</strong> will assign a plumber shortly.` :
          category === 'Carpentry' ? `Supervisor <strong>${supervisorInfo.name}</strong> will assign a carpenter shortly.` :
          `Supervisor <strong>${supervisorInfo.name}</strong> will assign an electrical technician shortly.`
        }</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b; margin: 0;">Dispatched from official hostel mailbox: <strong>hostel@iul.ac.in</strong> &bull; Integral University Hostel Directorate, Lucknow</p>
      </div>
    `;

    await sendEmail({
      ticketNumber,
      type: 'CONFIRMATION',
      from: OFFICIAL_HOSTEL_EMAIL,
      to: user.email,
      subject: confSubject,
      bodyHtml: confHtml
    });

    broadcastSSE('TICKET_CREATED', { ticketNumber, category, studentName: user.name });
    res.status(201).json({ success: true, ticketNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign Field Professional (Supervisor of that domain or Provost)
app.post('/api/complaints/:id/assign-professional', requireRole(['supervisor', 'provost']), async (req, res) => {
  const { professionalName, professionalPhone, expectedVisitTime, notes, technicianId, saveToDirectory } = req.body;
  if (!professionalName || !professionalPhone) {
    return res.status(400).json({ error: 'Technician Name and Phone are required.' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Complaint not found.' });

    const ticket = rows[0];

    if (req.user.role === 'supervisor' && ticket.category !== req.user.category) {
      return res.status(403).json({ error: 'Access Denied: You cannot assign technicians to other domains.' });
    }

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await pool.query(
      `UPDATE complaints SET 
       professional_name = ?,
       professional_phone = ?,
       expected_visit_time = ?,
       professional_notes = ?,
       professional_assigned_at = ?,
       status = 'In Progress'
       WHERE id = ?`,
      [professionalName.trim(), professionalPhone.trim(), expectedVisitTime || 'Today', notes || '', nowStr, ticket.id]
    );

    // If technicianId is provided, mark technician as Busy
    if (technicianId) {
      await pool.query(
        `UPDATE technicians SET status = 'Busy' WHERE id = ? AND status = 'Available'`,
        [technicianId]
      );
    } else if (saveToDirectory) {
      // Auto-save new technician into supervisor's roster if requested
      const [existingTech] = await pool.query(
        `SELECT id FROM technicians WHERE name = ? AND category = ?`,
        [professionalName.trim(), ticket.category]
      );
      if (existingTech.length === 0) {
        const newTechId = `tech_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await pool.query(
          `INSERT INTO technicians (id, supervisor_id, category, name, phone, specialization, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'Busy', ?)`,
          [newTechId, req.user.id, ticket.category, professionalName.trim(), professionalPhone.trim(), `${ticket.category} Maintenance`, 'Auto-saved during ticket assignment']
        );
      }
    }

    let roleTitle = 'Field Professional';
    let timelineVerb = 'Assigned field professional';
    const cat = (ticket.category || '').toLowerCase();
    if (cat.includes('food')) {
      roleTitle = 'Catering Staff / Food Inspector';
      timelineVerb = 'Assigned catering staff / food inspector';
    } else if (cat.includes('discipline')) {
      roleTitle = 'Hostel Warden / Floor Proctor';
      timelineVerb = 'Assigned hostel warden / proctor';
    } else if (cat.includes('plumb')) {
      roleTitle = 'Plumber';
      timelineVerb = 'Assigned plumber';
    } else if (cat.includes('carpent')) {
      roleTitle = 'Carpenter';
      timelineVerb = 'Assigned carpenter';
    } else if (cat.includes('elect')) {
      roleTitle = 'Electrical Technician';
      timelineVerb = 'Assigned electrical technician';
    }

    await pool.query(
      `INSERT INTO timeline_events (complaint_id, time, actor, action) VALUES (?, ?, ?, ?)`,
      [
        ticket.id,
        nowStr,
        `${req.user.name} (Supervisor)`,
        `${timelineVerb}: ${professionalName.trim()} (${professionalPhone.trim()}). Expected visit: ${expectedVisitTime || 'Today'}.`
      ]
    );

    const visitSubject = `[IntegraCare - Integral University] ${roleTitle} Assigned: #${ticket.ticket_number} [${ticket.category}]`;
    const visitHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <h3 style="color: #1e40af; margin: 0; font-size: 18px;">${roleTitle} Assigned for Ticket #${ticket.ticket_number}</h3>
            <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Hostel Maintenance Attendance Notice</p>
          </div>
          <div style="text-align: right; background: #eff6ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe;">
            <span style="font-size: 10px; color: #1e40af; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; display: block;">From</span>
            <span style="font-size: 12px; font-weight: bold; color: #1e40af;">hostel@iul.ac.in</span>
          </div>
        </div>

        <p>Dear <strong>${ticket.student_name}</strong>,</p>
        <p>A designated professional has been assigned by Supervisor <strong>${ticket.assigned_supervisor_name}</strong>:</p>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #1e40af;">${roleTitle}: ${professionalName.trim()}</p>
          <p style="margin: 4px 0;">Contact Number: <strong>${professionalPhone.trim()}</strong></p>
          <p style="margin: 4px 0;">Expected Arrival: <strong>${expectedVisitTime || 'Today'}</strong></p>
          ${notes ? `<p style="margin: 6px 0 0; font-size: 13px; color: #475569;"><em>Instructions: ${notes}</em></p>` : ''}
        </div>
        <p>Please ensure you or your roommate are present in Room ${ticket.room}.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b; margin: 0;">Dispatched from official hostel mailbox: <strong>hostel@iul.ac.in</strong> &bull; Hostel Administration Office, Integral University</p>
      </div>
    `;

    await sendEmail({
      ticketNumber: ticket.ticket_number,
      type: 'TECHNICIAN_ASSIGNED',
      from: OFFICIAL_HOSTEL_EMAIL,
      to: ticket.student_email,
      subject: visitSubject,
      bodyHtml: visitHtml
    });

    broadcastSSE('PROFESSIONAL_ASSIGNED', { ticketNumber: ticket.ticket_number, category: ticket.category });
    broadcastSSE('TECHNICIANS_UPDATED', { category: ticket.category });

    res.json({ success: true, message: `${roleTitle} dispatched successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// TECHNICIANS DIRECTORY & MANAGEMENT APIS
// ========================================================

// 1. Get Technicians List (Scoped by Supervisor Domain or Provost Filter)
app.get('/api/technicians', requireRole(['supervisor', 'provost']), async (req, res) => {
  try {
    const pool = getPool();
    let query = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM complaints c WHERE c.professional_name = t.name AND c.status = 'In Progress') AS active_jobs
      FROM technicians t
    `;
    let params = [];

    if (req.user.role === 'supervisor') {
      query += ` WHERE t.category = ?`;
      params.push(req.user.category);
    } else if (req.user.role === 'provost') {
      const { category } = req.query;
      if (category && category !== 'all') {
        query += ` WHERE t.category = ?`;
        params.push(category);
      }
    }

    const { status } = req.query;
    if (status) {
      query += params.length > 0 ? ` AND t.status = ?` : ` WHERE t.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY FIELD(t.status, 'Available', 'Busy', 'On Leave', 'Inactive'), t.name ASC`;

    const [rows] = await pool.query(query, params);
    res.json(rows.map(r => ({
      id: r.id,
      supervisorId: r.supervisor_id,
      category: r.category,
      name: r.name,
      phone: r.phone,
      specialization: r.specialization || '',
      status: r.status,
      notes: r.notes || '',
      activeJobs: Number(r.active_jobs) || 0,
      createdAt: r.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching technicians: ' + err.message });
  }
});

// 2. Add New Technician to Directory
app.post('/api/technicians', requireRole(['supervisor', 'provost']), async (req, res) => {
  const { name, phone, specialization, status, notes, category } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Technician Name and Mobile Number are required.' });
  }

  const finalCategory = req.user.role === 'supervisor' ? req.user.category : (category || 'Electrical');
  const finalStatus = status || 'Available';
  const newId = `tech_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO technicians (id, supervisor_id, category, name, phone, specialization, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, req.user.id, finalCategory, name.trim(), phone.trim(), specialization ? specialization.trim() : null, finalStatus, notes ? notes.trim() : null]
    );

    broadcastSSE('TECHNICIANS_UPDATED', { action: 'CREATED', technicianId: newId, category: finalCategory });

    res.status(201).json({
      success: true,
      message: `Technician ${name.trim()} added to ${finalCategory} directory.`,
      technician: {
        id: newId,
        supervisorId: req.user.id,
        category: finalCategory,
        name: name.trim(),
        phone: phone.trim(),
        specialization: specialization ? specialization.trim() : '',
        status: finalStatus,
        notes: notes ? notes.trim() : '',
        activeJobs: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error adding technician: ' + err.message });
  }
});

// 3. Update Technician Details
app.put('/api/technicians/:id', requireRole(['supervisor', 'provost']), async (req, res) => {
  const { name, phone, specialization, status, notes } = req.body;
  const techId = req.params.id;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Technician Name and Mobile Number are required.' });
  }

  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT * FROM technicians WHERE id = ?', [techId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Technician record not found.' });
    }

    if (req.user.role === 'supervisor' && existing[0].category !== req.user.category) {
      return res.status(403).json({ error: 'Access Denied: You cannot modify technicians outside your category.' });
    }

    await pool.query(
      `UPDATE technicians SET name = ?, phone = ?, specialization = ?, status = ?, notes = ? WHERE id = ?`,
      [name.trim(), phone.trim(), specialization ? specialization.trim() : null, status || existing[0].status, notes ? notes.trim() : null, techId]
    );

    broadcastSSE('TECHNICIANS_UPDATED', { action: 'UPDATED', technicianId: techId, category: existing[0].category });

    res.json({ success: true, message: 'Technician updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Database error updating technician: ' + err.message });
  }
});

// 4. Quick Status Toggle for Technician (Available <-> Busy <-> On Leave)
app.patch('/api/technicians/:id/status', requireRole(['supervisor', 'provost']), async (req, res) => {
  const { status } = req.body;
  const techId = req.params.id;

  if (!status || !['Available', 'Busy', 'On Leave', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required: Available, Busy, On Leave, Inactive.' });
  }

  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT * FROM technicians WHERE id = ?', [techId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Technician not found.' });

    if (req.user.role === 'supervisor' && existing[0].category !== req.user.category) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    await pool.query('UPDATE technicians SET status = ? WHERE id = ?', [status, techId]);
    broadcastSSE('TECHNICIANS_UPDATED', { action: 'STATUS_CHANGED', technicianId: techId, status });

    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete Technician
app.delete('/api/technicians/:id', requireRole(['supervisor', 'provost']), async (req, res) => {
  const techId = req.params.id;

  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT * FROM technicians WHERE id = ?', [techId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Technician not found.' });

    if (req.user.role === 'supervisor' && existing[0].category !== req.user.category) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    await pool.query('DELETE FROM technicians WHERE id = ?', [techId]);
    broadcastSSE('TECHNICIANS_UPDATED', { action: 'DELETED', technicianId: techId });

    res.json({ success: true, message: 'Technician removed from directory.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Status / Mark Resolved
app.post('/api/complaints/:id/status', requireRole(['supervisor', 'provost']), async (req, res) => {
  const { status, notes } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required.' });

  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Complaint not found.' });

    const ticket = rows[0];

    if (req.user.role === 'supervisor' && ticket.category !== req.user.category) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let query = `UPDATE complaints SET status = ?`;
    let params = [status];

    if (status === 'Resolved') {
      query += `, resolution_notes = ?, resolved_at = ?, resolved_by = ?`;
      params.push(notes || 'Work completed successfully.', nowStr, req.user.name);
    }
    query += ` WHERE id = ?`;
    params.push(ticket.id);

    await pool.query(query, params);

    await pool.query(
      `INSERT INTO timeline_events (complaint_id, time, actor, action) VALUES (?, ?, ?, ?)`,
      [ticket.id, nowStr, req.user.name, `Status marked as "${status}". ${notes ? `Remarks: ${notes}` : ''}`]
    );

    if (status === 'Resolved') {
      const resSubject = `[IntegraCare - Integral University] Grievance Resolved: #${ticket.ticket_number} [${ticket.category}]`;
      const resHtml = `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #bbf7d0; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h3 style="color: #059669; margin: 0; font-size: 18px;">✓ Grievance Resolved: #${ticket.ticket_number}</h3>
              <p style="margin: 3px 0 0; font-size: 13px; color: #64748b;">Official Resolution Confirmation</p>
            </div>
            <div style="text-align: right; background: #f0fdf4; padding: 4px 10px; border-radius: 6px; border: 1px solid #bbf7d0;">
              <span style="font-size: 10px; color: #059669; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; display: block;">From</span>
              <span style="font-size: 12px; font-weight: bold; color: #059669;">hostel@iul.ac.in</span>
            </div>
          </div>

          <p>Dear <strong>${ticket.student_name}</strong>,</p>
          <p>Your grievance regarding <strong>"${ticket.title}"</strong> has been addressed and marked as <strong>Resolved</strong>.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 14px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Resolution Notes:</strong> ${notes || 'Work verified and completed.'}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #475569;">Verified by: ${req.user.name}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b; margin: 0;">Dispatched from official hostel mailbox: <strong>hostel@iul.ac.in</strong> &bull; Integral University Hostel Grievance Redressal Committee</p>
        </div>
      `;

      await sendEmail({
        ticketNumber: ticket.ticket_number,
        type: 'RESOLVED',
        from: OFFICIAL_HOSTEL_EMAIL,
        to: ticket.student_email,
        subject: resSubject,
        bodyHtml: resHtml
      });
    }

    broadcastSSE('STATUS_UPDATED', { ticketNumber: ticket.ticket_number, status });
    res.json({ success: true, message: `Ticket status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provost Executive Metrics
app.get('/api/stats/provost', requireRole(['provost']), async (req, res) => {
  try {
    const pool = getPool();
    const [totalRows] = await pool.query('SELECT COUNT(*) as cnt FROM complaints');
    const [pendingRows] = await pool.query("SELECT COUNT(*) as cnt FROM complaints WHERE status = 'Pending Assignment'");
    const [inProgressRows] = await pool.query("SELECT COUNT(*) as cnt FROM complaints WHERE status = 'In Progress'");
    const [resolvedRows] = await pool.query("SELECT COUNT(*) as cnt FROM complaints WHERE status = 'Resolved'");
    const [breachedRows] = await pool.query("SELECT COUNT(*) as cnt FROM complaints WHERE sla_breached = 1 AND status != 'Resolved'");

    const total = totalRows[0].cnt;
    const resolved = resolvedRows[0].cnt;

    const [catRows] = await pool.query('SELECT category, COUNT(*) as cnt FROM complaints GROUP BY category');
    const categoryStats = { Electrical: 0, Plumbing: 0, Carpentry: 0, Food: 0, Discipline: 0 };
    catRows.forEach((r) => { categoryStats[r.category] = r.cnt; });

    const [recentActivities] = await pool.query(
      `SELECT t.time, t.actor, t.action, c.ticket_number as ticketNumber, c.category
       FROM timeline_events t
       JOIN complaints c ON t.complaint_id = c.id
       ORDER BY t.time DESC LIMIT 15`
    );

    res.json({
      kpis: {
        total,
        pending: pendingRows[0].cnt,
        inProgress: inProgressRows[0].cnt,
        resolved,
        breached: breachedRows[0].cnt,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 100
      },
      categoryStats,
      recentActivities: recentActivities.map(a => ({
        ...a,
        action: formatTimelineAction(a.action, a.category)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// SUPERVISOR MANAGEMENT APIS (PROVOST MODULE)
// ========================================================

// 1. Get All Supervisors with Live Workload & Performance Metrics
app.get('/api/supervisors', requireRole(['provost']), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.category, 
        u.phone, 
        u.title, 
        u.created_at,
        COUNT(c.id) AS total_assigned,
        SUM(CASE WHEN c.status = 'Pending Assignment' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN c.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN c.sla_breached = 1 AND c.status != 'Resolved' THEN 1 ELSE 0 END) AS breached_count
      FROM users u
      LEFT JOIN complaints c ON c.assigned_supervisor_id = u.id
      WHERE u.role = 'supervisor' AND u.id NOT LIKE '%_alias'
      GROUP BY u.id, u.name, u.email, u.category, u.phone, u.title, u.created_at
      ORDER BY u.category ASC, u.name ASC
    `);

    const supervisors = rows.map((r) => {
      const total = Number(r.total_assigned) || 0;
      const resolved = Number(r.resolved_count) || 0;
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        category: r.category,
        phone: r.phone || 'N/A',
        title: r.title || `Supervisor - ${r.category}`,
        createdAt: r.created_at,
        stats: {
          totalAssigned: total,
          pending: Number(r.pending_count) || 0,
          inProgress: Number(r.in_progress_count) || 0,
          resolved: resolved,
          breached: Number(r.breached_count) || 0,
          complianceRate: total > 0 ? Math.round((resolved / total) * 100) : 100
        }
      };
    });

    res.json(supervisors);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching supervisors: ' + err.message });
  }
});

// 2. Onboard / Register New Supervisor
app.post('/api/supervisors', requireRole(['provost']), async (req, res) => {
  const { name, email, password, category, phone, title } = req.body;

  if (!name || !email || !category) {
    return res.status(400).json({ error: 'Name, Email, and Category are required.' });
  }

  const validCategories = ['Electrical', 'Plumbing', 'Carpentry', 'Food', 'Discipline'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}` });
  }

  try {
    const pool = getPool();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A user account with this email address already exists.' });
    }

    const newId = `usr_sup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const finalTitle = title && title.trim() ? title.trim() : `Supervisor - ${category} Maintenance`;
    const finalPassword = password && password.trim() ? password.trim() : 'super123';

    await pool.query(
      `INSERT INTO users (id, role, category, name, email, password, phone, title)
       VALUES (?, 'supervisor', ?, ?, ?, ?, ?, ?)`,
      [newId, category, name.trim(), email.trim().toLowerCase(), finalPassword, phone ? phone.trim() : null, finalTitle]
    );

    broadcastSSE('SUPERVISORS_UPDATED', { action: 'CREATED', supervisorId: newId, category });

    res.status(201).json({
      success: true,
      message: `Supervisor ${name.trim()} successfully registered for ${category}.`,
      supervisor: {
        id: newId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category,
        phone: phone ? phone.trim() : '',
        title: finalTitle
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error registering supervisor: ' + err.message });
  }
});

// 3. Update Existing Supervisor Details
app.put('/api/supervisors/:id', requireRole(['provost']), async (req, res) => {
  const supervisorId = req.params.id;
  const { name, email, password, category, phone, title } = req.body;

  if (!name || !email || !category) {
    return res.status(400).json({ error: 'Name, Email, and Category are required.' });
  }

  const validCategories = ['Electrical', 'Plumbing', 'Carpentry', 'Food', 'Discipline'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${validCategories.join(', ')}` });
  }

  try {
    const pool = getPool();
    const [existingSup] = await pool.query('SELECT * FROM users WHERE id = ? AND role = "supervisor"', [supervisorId]);
    if (existingSup.length === 0) {
      return res.status(404).json({ error: 'Supervisor record not found.' });
    }

    // Check email uniqueness if email has changed
    const [dupEmail] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim().toLowerCase(), supervisorId]);
    if (dupEmail.length > 0) {
      return res.status(400).json({ error: 'Another user account already uses this email address.' });
    }

    const finalTitle = title && title.trim() ? title.trim() : `Supervisor - ${category} Maintenance`;

    if (password && password.trim()) {
      await pool.query(
        `UPDATE users SET name = ?, email = ?, category = ?, phone = ?, title = ?, password = ? WHERE id = ?`,
        [name.trim(), email.trim().toLowerCase(), category, phone ? phone.trim() : null, finalTitle, password.trim(), supervisorId]
      );
    } else {
      await pool.query(
        `UPDATE users SET name = ?, email = ?, category = ?, phone = ?, title = ? WHERE id = ?`,
        [name.trim(), email.trim().toLowerCase(), category, phone ? phone.trim() : null, finalTitle, supervisorId]
      );
    }

    // If supervisor's name changed, sync active complaints
    if (existingSup[0].name !== name.trim()) {
      await pool.query(
        `UPDATE complaints SET assigned_supervisor_name = ? WHERE assigned_supervisor_id = ? AND status != 'Resolved'`,
        [name.trim(), supervisorId]
      );
    }

    broadcastSSE('SUPERVISORS_UPDATED', { action: 'UPDATED', supervisorId });

    res.json({
      success: true,
      message: 'Supervisor updated successfully.',
      supervisor: {
        id: supervisorId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category,
        phone: phone ? phone.trim() : '',
        title: finalTitle
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error updating supervisor: ' + err.message });
  }
});

// 4. Delete / Remove Supervisor with Reassignment
app.delete('/api/supervisors/:id', requireRole(['provost']), async (req, res) => {
  const supervisorId = req.params.id;
  const { reassignSupervisorId } = req.body || {};

  try {
    const pool = getPool();
    const [existingSup] = await pool.query('SELECT * FROM users WHERE id = ? AND role = "supervisor"', [supervisorId]);
    if (existingSup.length === 0) {
      return res.status(404).json({ error: 'Supervisor record not found.' });
    }

    const oldSup = existingSup[0];

    // Check active complaints assigned to this supervisor
    const [activeTickets] = await pool.query(
      `SELECT id, ticket_number FROM complaints WHERE assigned_supervisor_id = ? AND status != 'Resolved'`,
      [supervisorId]
    );

    if (activeTickets.length > 0) {
      if (!reassignSupervisorId) {
        return res.status(400).json({
          error: `Supervisor "${oldSup.name}" currently has ${activeTickets.length} active grievance(s). Please choose a replacement supervisor to reassign these tickets before removing.`,
          requiresReassignment: true,
          activeCount: activeTickets.length
        });
      }

      if (reassignSupervisorId === supervisorId) {
        return res.status(400).json({ error: 'Cannot reassign tickets to the supervisor being removed.' });
      }

      const [newSupRows] = await pool.query('SELECT id, name FROM users WHERE id = ?', [reassignSupervisorId]);
      if (newSupRows.length === 0) {
        return res.status(400).json({ error: 'Selected replacement supervisor was not found.' });
      }

      const replacementSup = newSupRows[0];
      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Reassign open tickets
      await pool.query(
        `UPDATE complaints SET assigned_supervisor_id = ?, assigned_supervisor_name = ? WHERE assigned_supervisor_id = ? AND status != 'Resolved'`,
        [replacementSup.id, replacementSup.name, supervisorId]
      );

      // Add timeline entries to all reassigned complaints
      for (const t of activeTickets) {
        await pool.query(
          `INSERT INTO timeline_events (complaint_id, time, actor, action) VALUES (?, ?, ?, ?)`,
          [t.id, nowStr, 'Provost Office', `Supervisor reassigned from ${oldSup.name} to ${replacementSup.name}.`]
        );
      }
    }

    // Delete supervisor account
    await pool.query('DELETE FROM users WHERE id = ?', [supervisorId]);

    broadcastSSE('SUPERVISORS_UPDATED', { action: 'DELETED', supervisorId });

    res.json({
      success: true,
      message: `Supervisor "${oldSup.name}" removed successfully.${activeTickets.length > 0 ? ` ${activeTickets.length} active grievance(s) reassigned.` : ''}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error removing supervisor: ' + err.message });
  }
});

// Email outbox
app.get('/api/emails', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    let query = 'SELECT * FROM emails_log';
    let params = [];

    if (req.user.role === 'student') {
      query += ' WHERE recipient_email = ?';
      params.push(req.user.email);
    }
    query += ' ORDER BY sent_at DESC LIMIT 50';

    const [rows] = await pool.query(query, params);
    res.json(rows.map((r) => ({
      id: r.id,
      ticketNumber: r.ticket_number,
      type: r.type,
      from: r.sender_email || OFFICIAL_HOSTEL_EMAIL,
      to: r.recipient_email,
      subject: r.subject,
      bodyHtml: r.body_html,
      sentAt: r.sent_at
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize MySQL and start server
initDatabase()
  .then(() => {
    setInterval(runSlaWatchdog, 5000);
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🏛️ IntegraCare :: Integral University Hostel Portal`);
      console.log(`📡 Server running at http://localhost:${PORT}`);
      console.log(`🗄️ Database: MySQL (hostel_grievance_db)`);
      console.log(`🎓 Student Auth: Enrollment Number`);
      console.log(`👔 Staff Auth: University Email ID`);
      console.log(`=======================================================`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Could not start server:', err);
    process.exit(1);
  });
