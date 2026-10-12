const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'iamEminem#99',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'hostel_grievance_db';

let pool = null;

async function initDatabase() {
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();

    pool = mysql.createPool({
      ...DB_CONFIG,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 30,
      queueLimit: 0
    });

    console.log(`✓ Connected to MySQL database "${DB_NAME}".`);

    // Schema definition for Integral University HostelCare Portal
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        role ENUM('student', 'supervisor', 'provost') NOT NULL,
        category VARCHAR(32) NULL,
        name VARCHAR(128) NOT NULL,
        email VARCHAR(128) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL DEFAULT 'password123',
        enrollment_no VARCHAR(64) NULL UNIQUE,
        student_id VARCHAR(64) NULL,
        hostel VARCHAR(128) NULL,
        room VARCHAR(32) NULL,
        phone VARCHAR(32) NULL,
        title VARCHAR(128) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_enrollment (enrollment_no)
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(64) PRIMARY KEY,
        ticket_number VARCHAR(64) NOT NULL UNIQUE,
        student_id VARCHAR(64) NOT NULL,
        enrollment_no VARCHAR(64) NOT NULL,
        student_name VARCHAR(128) NOT NULL,
        student_email VARCHAR(128) NOT NULL,
        hostel VARCHAR(128) NOT NULL,
        room VARCHAR(32) NOT NULL,
        category ENUM('Electrical', 'Plumbing', 'Carpentry', 'Food', 'Discipline') NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        priority ENUM('Normal', 'High', 'Urgent') DEFAULT 'Normal',
        status ENUM('Pending Assignment', 'In Progress', 'Resolved') DEFAULT 'Pending Assignment',
        created_at DATETIME NOT NULL,
        deadline DATETIME NOT NULL,
        assigned_supervisor_id VARCHAR(64) NOT NULL,
        assigned_supervisor_name VARCHAR(128) NOT NULL,
        professional_name VARCHAR(128) NULL,
        professional_phone VARCHAR(32) NULL,
        expected_visit_time VARCHAR(128) NULL,
        professional_notes TEXT NULL,
        professional_assigned_at DATETIME NULL,
        resolution_notes TEXT NULL,
        resolved_at DATETIME NULL,
        resolved_by VARCHAR(128) NULL,
        sla_breached TINYINT(1) DEFAULT 0,
        apology_email_sent TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS timeline_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(64) NOT NULL,
        time DATETIME NOT NULL,
        actor VARCHAR(128) NOT NULL,
        action TEXT NOT NULL,
        INDEX idx_complaint (complaint_id)
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS emails_log (
        id VARCHAR(64) PRIMARY KEY,
        ticket_number VARCHAR(64) NOT NULL,
        type VARCHAR(64) NOT NULL,
        recipient_email VARCHAR(128) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html LONGTEXT NOT NULL,
        sent_at DATETIME NOT NULL
      ) ENGINE=InnoDB;
    `);

    // Ensure columns exist (migration safeguard)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN enrollment_no VARCHAR(64) NULL UNIQUE AFTER password;`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await pool.query(`ALTER TABLE complaints ADD COLUMN enrollment_no VARCHAR(64) NOT NULL DEFAULT 'IU/2023/10452' AFTER student_id;`);
    } catch (e) {
      // Column already exists, ignore
    }

    console.log('✓ MySQL schema & tables verified for Integral University.');

    // Seed / Reset users with Integral University credentials
    const [existingUsers] = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE email = ?', ['provost@iul.ac.in']);
    if (existingUsers[0].cnt === 0) {
      console.log('Populating Integral University staff and student profiles...');
      await pool.query(`
        DELETE FROM users;
        INSERT INTO users (id, role, category, name, email, password, enrollment_no, student_id, hostel, room, phone, title) VALUES
        ('usr_student_1', 'student', NULL, 'Mohammad Zaid', 'zaid@iul.ac.in', 'student123', 'IU/2023/10452', 'IU/2023/10452', 'Hall 1 (Boys)', 'K-312', '+91 98765 43210', 'B.Tech CSE Student'),
        ('usr_student_2', 'student', NULL, 'Farhan Ali', 'farhan@iul.ac.in', 'student123', 'IU/2023/20188', 'IU/2023/20188', 'Hall 2 (Boys)', 'C-204', '+91 98123 45678', 'B.Tech ME Student'),
        ('usr_student_3', 'student', NULL, 'Ayesha Khan', 'ayesha@iul.ac.in', 'student123', 'IU/2023/30514', 'IU/2023/30514', 'Hall 1 (Girls)', 'H-118', '+91 97234 56789', 'BCA Student'),
        ('usr_sup_electrical', 'supervisor', 'Electrical', 'Rajesh Verma', 'electrical.hostel@iul.ac.in', 'super123', NULL, NULL, NULL, NULL, '+91 94150 11223', 'Supervisor - Electrical Maintenance'),
        ('usr_sup_plumbing', 'supervisor', 'Plumbing', 'Suresh Patel', 'plumbing.hostel@iul.ac.in', 'super123', NULL, NULL, NULL, NULL, '+91 94150 22334', 'Supervisor - Water & Plumbing Systems'),
        ('usr_sup_carpentry', 'supervisor', 'Carpentry', 'Mohan Lal', 'carpentry.hostel@iul.ac.in', 'super123', NULL, NULL, NULL, NULL, '+91 94150 33445', 'Supervisor - Carpentry & Furniture'),
        ('usr_sup_food', 'supervisor', 'Food', 'Anil Deshmukh', 'food.hostel@iul.ac.in', 'super123', NULL, NULL, NULL, NULL, '+91 94150 44556', 'Supervisor - Hostel Mess & Catering Quality'),
        ('usr_sup_discipline', 'supervisor', 'Discipline', 'Col. R. Singh', 'discipline.hostel@iul.ac.in', 'super123', NULL, NULL, NULL, NULL, '+91 94150 55667', 'Hostel Warden & Discipline Proctor'),
        ('usr_provost', 'provost', NULL, 'Prof. (Dr.) Mohammad Faisal', 'provost@iul.ac.in', 'provost123', NULL, NULL, NULL, NULL, '+91 94150 99887', 'Chief Provost - Integral University Hostels');
      `);
      console.log('✓ Seeded Integral University users.');
    }

    // Refresh default complaints with Integral University context if empty
    const [cRows] = await pool.query('SELECT COUNT(*) as cnt FROM complaints WHERE student_email = ?', ['zaid@iul.ac.in']);
    if (cRows[0].cnt === 0) {
      console.log('Seeding initial complaints for Integral University...');
      const now = new Date();
      const past20h = new Date(now.getTime() - 20 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const past2h = new Date(now.getTime() - 2 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const past10h = new Date(now.getTime() - 10 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const future14h = new Date(now.getTime() + 14 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const past3h = new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const future21h = new Date(now.getTime() + 21 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(`
        INSERT INTO complaints (id, ticket_number, student_id, enrollment_no, student_name, student_email, hostel, room, category, title, description, priority, status, created_at, deadline, assigned_supervisor_id, assigned_supervisor_name, professional_name, professional_phone, expected_visit_time, professional_notes, professional_assigned_at, resolution_notes, resolved_at, resolved_by, sla_breached, apology_email_sent)
        VALUES 
        ('IU-HST-2026-0001', 'IU-HST-2026-0001', 'IU/2023/10452', 'IU/2023/10452', 'Mohammad Zaid', 'zaid@iul.ac.in', 'Hall 1 (Boys)', 'K-312', 'Electrical', 'Ceiling fan making rattling noise at high speed', 'Fan capacitor or bearings need lubrication and check in Room K-312.', 'High', 'Resolved', '${past20h}', '${past20h}', 'usr_sup_electrical', 'Rajesh Verma', 'Ramesh Kumar (Electrician)', '+91 98234 56789', 'Yesterday at 5:00 PM', 'Replace 2.5mfd capacitor and greased ball bearings', '${past20h}', 'Replaced capacitor and serviced ceiling fan assembly. Running noiselessly.', '${past2h}', 'Rajesh Verma', 0, 0),
        ('IU-HST-2026-0002', 'IU-HST-2026-0002', 'IU/2023/10452', 'IU/2023/10452', 'Mohammad Zaid', 'zaid@iul.ac.in', 'Hall 1 (Boys)', 'K-312', 'Plumbing', 'Bathroom geyser water inlet valve dripping', 'Continuous dripping from the cold water connection pipe.', 'Normal', 'In Progress', '${past10h}', '${future14h}', 'usr_sup_plumbing', 'Suresh Patel', 'Satish Yadav (Plumber)', '+91 98112 34567', 'Today at 2:30 PM', 'Check flexible hose and washers', '${past10h}', NULL, NULL, NULL, 0, 0),
        ('IU-HST-2026-0003', 'IU-HST-2026-0003', 'IU/2023/20188', 'IU/2023/20188', 'Farhan Ali', 'farhan@iul.ac.in', 'Hall 2 (Boys)', 'C-204', 'Food', 'Mess lunch rotis cold and delayed service in Dining Hall 1', 'Food was served cold and food warmers were not active today.', 'Normal', 'Pending Assignment', '${past3h}', '${future21h}', 'usr_sup_food', 'Anil Deshmukh', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0);
      `);

      await pool.query(`
        INSERT INTO timeline_events (complaint_id, time, actor, action) VALUES
        ('IU-HST-2026-0001', '${past20h}', 'Mohammad Zaid (Student)', 'Complaint registered. 24-Hour SLA initiated.'),
        ('IU-HST-2026-0001', '${past20h}', 'Rajesh Verma (Supervisor)', 'Assigned Electrician Ramesh Kumar (+91 98234 56789).'),
        ('IU-HST-2026-0001', '${past2h}', 'Rajesh Verma (Supervisor)', 'Marked Resolved. Replaced capacitor and serviced fan.'),
        ('IU-HST-2026-0002', '${past10h}', 'Mohammad Zaid (Student)', 'Complaint registered. 24-Hour SLA initiated.'),
        ('IU-HST-2026-0002', '${past10h}', 'Suresh Patel (Supervisor)', 'Assigned Plumber Satish Yadav (+91 98112 34567).'),
        ('IU-HST-2026-0003', '${past3h}', 'Farhan Ali (Student)', 'Complaint registered in Food & Mess category.');
      `);

      console.log('✓ Seeded initial complaints for Integral University.');
    }

    return pool;
  } catch (err) {
    console.error('MySQL initialization error:', err);
    throw err;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pool;
}

module.exports = {
  initDatabase,
  getPool
};
