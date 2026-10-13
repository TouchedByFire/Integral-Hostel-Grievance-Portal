const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDatabase, getPool } = require('./db');

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

// Category to Supervisor Mapping
const SUPERVISORS = {
  Electrical: { id: 'usr_sup_electrical', name: 'Rajesh Verma', title: 'Supervisor - Electrical Maintenance' },
  Plumbing: { id: 'usr_sup_plumbing', name: 'Suresh Patel', title: 'Supervisor - Water & Plumbing Systems' },
  Carpentry: { id: 'usr_sup_carpentry', name: 'Mohan Lal', title: 'Supervisor - Carpentry & Furniture' },
  Food: { id: 'usr_sup_food', name: 'Anil Deshmukh', title: 'Supervisor - Hostel Mess & Catering Quality' },
  Discipline: { id: 'usr_sup_discipline', name: 'Col. R. Singh', title: 'Hostel Warden & Discipline Proctor' }
};

// Dispatch email to MySQL emails_log
async function sendEmail({ ticketNumber, type, to, subject, bodyHtml }) {
  const pool = getPool();
  const emailId = `eml_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const sentAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  await pool.query(
    `INSERT INTO emails_log (id, ticket_number, type, recipient_email, subject, body_html, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [emailId, ticketNumber, type, to, subject, bodyHtml, sentAt]
  );

  const emailRecord = { id: emailId, ticketNumber, type, to, subject, bodyHtml, sentAt };
  broadcastSSE('EMAIL_DISPATCHED', emailRecord);
  return emailRecord;
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
          <h2 style="color: #b91c1c; margin-top: 0;">Integral University - Hostel Grievance Notice</h2>
          <p>Dear <strong>${ticket.student_name}</strong> (Enrollment: ${ticket.enrollment_no}),</p>
          <p>We regret to inform you that your grievance regarding <strong>"${ticket.title}"</strong> (Ticket <strong>#${ticket.ticket_number}</strong>) was not resolved within our 24-hour resolution window.</p>
          <div style="background: #ffffff; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-weight: bold; color: #b91c1c; font-size: 14px;">Escalated to Chief Provost Office</p>
            <p style="margin: 6px 0 0; font-size: 13px; color: #475569;">
              This grievance has been directly flagged with high-priority status on the <strong>Chief Provost's Dashboard</strong>. 
              Supervisor <strong>${ticket.assigned_supervisor_name}</strong> has been directed to expedite immediate resolution.
            </p>
          </div>
          <p>We sincerely apologize for the inconvenience caused.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b; margin: 0;">Office of the Chief Provost &bull; Integral University Hostels, Lucknow</p>
        </div>
      `;

      await sendEmail({
        ticketNumber: ticket.ticket_number,
        type: 'SLA_BREACH_APOLOGY',
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
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

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

// 1. Student Login (Based on Enrollment Number)
app.post('/api/auth/student-login', async (req, res) => {
  const { enrollmentNo, password } = req.body;
  if (!enrollmentNo || !password) {
    return res.status(400).json({ error: 'Enrollment Number and Password are required.' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE (enrollment_no = ? OR student_id = ?) AND role = "student"',
      [enrollmentNo.trim(), enrollmentNo.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Enrollment Number or record not found.' });
    }

    const user = rows[0];
    if (user.password !== password) {
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

// 2. Staff Login (Supervisor and Provost Login Based on Email ID)
app.post('/api/auth/staff-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email ID and Password are required.' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND role IN ("supervisor", "provost")',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Staff Email ID.' });
    }

    const user = rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password entered.' });
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

    if (input.includes('@')) {
      // Treat as Staff Email
      query = 'SELECT * FROM users WHERE email = ?';
      params = [input.toLowerCase()];
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

// 6. Student Registration with Enrollment Number
app.post('/api/auth/register', async (req, res) => {
  const { name, enrollmentNo, email, hostel, room, phone, password } = req.body;
  if (!name || !enrollmentNo || !email || !hostel || !room) {
    return res.status(400).json({ error: 'Name, Enrollment Number, Email, Hostel, and Room are required.' });
  }

  try {
    const pool = getPool();
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE enrollment_no = ? OR email = ?',
      [enrollmentNo.trim(), email.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'A student with this Enrollment Number or Email is already registered.' });
    }

    const newId = `usr_student_${Date.now()}`;
    await pool.query(
      `INSERT INTO users (id, role, category, name, email, password, enrollment_no, student_id, hostel, room, phone, title)
       VALUES (?, 'student', NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'Integral University Student')`,
      [newId, name.trim(), email.trim().toLowerCase(), password || 'student123', enrollmentNo.trim(), enrollmentNo.trim(), hostel, room, phone || '']
    );

    res.status(201).json({ success: true, message: 'Student successfully registered! You can now log in using your Enrollment Number.' });
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
      timeline: timelineRows.map((tl) => ({ time: tl.time, actor: tl.actor, action: tl.action }))
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
      'SELECT id, name, title, email, phone FROM users WHERE role = "supervisor" AND category = ? LIMIT 1',
      [category]
    );
    if (supRows.length > 0) {
      supervisorInfo = { id: supRows[0].id, name: supRows[0].name, title: supRows[0].title };
    } else {
      supervisorInfo = SUPERVISORS[category] || { id: 'usr_provost', name: 'Chief Provost Office', title: 'Provost Directorate' };
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
       (id, ticket_number, student_id, enrollment_no, student_name, student_email, hostel, room, category, title, description, priority, status, created_at, deadline, assigned_supervisor_id, assigned_supervisor_name, sla_breached, apology_email_sent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Assignment', ?, ?, ?, ?, 0, 0)`,
      [
        ticketNumber,
        ticketNumber,
        user.enrollment_no || user.student_id,
        user.enrollment_no || user.student_id,
        user.name,
        user.email,
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

    // Confirmation email
    const confSubject = `[IntegraCare - Integral University] Ticket Registered: #${ticketNumber} [${category}]`;
    const confHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
        <h2 style="color: #1e40af; margin-top: 0;">IntegraCare :: Integral University Hostels</h2>
        <p>Dear <strong>${user.name}</strong> (Enrollment: <strong>${user.enrollment_no}</strong>),</p>
        <p>Your grievance has been successfully registered under ticket <strong>#${ticketNumber}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0; color: #64748b;">Ticket Number:</td><td style="font-weight: bold; color: #1e40af;">#${ticketNumber}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Category:</td><td style="font-weight: bold;">${category}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Hostel & Room:</td><td>${user.hostel} - Room ${user.room}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Assigned Supervisor:</td><td style="font-weight: bold;">${supervisorInfo.name}</td></tr>
          </table>
        </div>
        <p>Supervisor <strong>${supervisorInfo.name}</strong> will assign a field technician shortly.</p>
        <p style="font-size: 12px; color: #64748b;">Integral University Hostel Directorate, Lucknow</p>
      </div>
    `;

    await sendEmail({
      ticketNumber,
      type: 'CONFIRMATION',
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
  const { professionalName, professionalPhone, expectedVisitTime, notes } = req.body;
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
      [professionalName, professionalPhone, expectedVisitTime || 'Today', notes || '', nowStr, ticket.id]
    );

    await pool.query(
      `INSERT INTO timeline_events (complaint_id, time, actor, action) VALUES (?, ?, ?, ?)`,
      [
        ticket.id,
        nowStr,
        `${req.user.name} (Supervisor)`,
        `Assigned technician: ${professionalName} (${professionalPhone}). Expected visit: ${expectedVisitTime || 'Today'}.`
      ]
    );

    const visitSubject = `[IntegraCare - Integral University] Technician Assigned: #${ticket.ticket_number} [${ticket.category}]`;
    const visitHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
        <h3 style="color: #1e40af; margin-top: 0;">Technician Assigned for Ticket #${ticket.ticket_number}</h3>
        <p>Dear <strong>${ticket.student_name}</strong>,</p>
        <p>A field professional has been assigned by Supervisor <strong>${ticket.assigned_supervisor_name}</strong>:</p>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-weight: bold; color: #1e40af;">Technician: ${professionalName}</p>
          <p style="margin: 4px 0;">Contact Number: <strong>${professionalPhone}</strong></p>
          <p style="margin: 4px 0;">Expected Arrival: <strong>${expectedVisitTime || 'Today'}</strong></p>
          ${notes ? `<p style="margin: 6px 0 0; font-size: 13px; color: #475569;"><em>Instructions: ${notes}</em></p>` : ''}
        </div>
        <p>Please ensure you or your roommate are present in Room ${ticket.room}.</p>
      </div>
    `;

    await sendEmail({
      ticketNumber: ticket.ticket_number,
      type: 'TECHNICIAN_ASSIGNED',
      to: ticket.student_email,
      subject: visitSubject,
      bodyHtml: visitHtml
    });

    broadcastSSE('PROFESSIONAL_ASSIGNED', { ticketNumber: ticket.ticket_number });
    res.json({ success: true, message: 'Technician dispatched successfully.' });
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
          <h3 style="color: #059669; margin-top: 0;">✓ Grievance Resolved: #${ticket.ticket_number}</h3>
          <p>Dear <strong>${ticket.student_name}</strong>,</p>
          <p>Your grievance regarding <strong>"${ticket.title}"</strong> has been addressed and marked as <strong>Resolved</strong>.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 14px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534;"><strong>Resolution Notes:</strong> ${notes || 'Work verified and completed.'}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #475569;">Verified by: ${req.user.name}</p>
          </div>
        </div>
      `;

      await sendEmail({
        ticketNumber: ticket.ticket_number,
        type: 'RESOLVED',
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
      recentActivities
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
      WHERE u.role = 'supervisor'
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
          [t.id, nowStr, 'Chief Provost Office', `Supervisor reassigned from ${oldSup.name} to ${replacementSup.name}.`]
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
