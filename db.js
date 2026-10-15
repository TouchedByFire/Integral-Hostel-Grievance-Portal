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
        campus VARCHAR(64) NULL,
        gender VARCHAR(16) NULL,
        emp_code VARCHAR(32) NULL,
        hostel VARCHAR(128) NULL,
        room VARCHAR(32) NULL,
        phone VARCHAR(32) NULL,
        title VARCHAR(128) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_enrollment (enrollment_no)
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS hostel_eligible_students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        s_no INT,
        enrollment_no VARCHAR(10) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        gender VARCHAR(16) NOT NULL,
        campus VARCHAR(64) NOT NULL DEFAULT 'Phase I',
        hostel VARCHAR(128) NOT NULL,
        room VARCHAR(32) NOT NULL,
        course VARCHAR(128) NULL,
        mobile VARCHAR(32) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_roster_enroll (enrollment_no)
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(64) PRIMARY KEY,
        ticket_number VARCHAR(64) NOT NULL UNIQUE,
        student_id VARCHAR(64) NOT NULL,
        enrollment_no VARCHAR(64) NOT NULL,
        student_name VARCHAR(128) NOT NULL,
        student_email VARCHAR(128) NOT NULL,
        campus VARCHAR(64) NULL,
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
        sender_email VARCHAR(128) NOT NULL DEFAULT 'hostel@iul.ac.in',
        recipient_email VARCHAR(128) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html LONGTEXT NOT NULL,
        sent_at DATETIME NOT NULL
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS technicians (
        id VARCHAR(64) PRIMARY KEY,
        supervisor_id VARCHAR(64) NULL,
        category VARCHAR(32) NOT NULL,
        name VARCHAR(128) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        specialization VARCHAR(128) NULL,
        status ENUM('Available', 'Busy', 'On Leave', 'Inactive') DEFAULT 'Available',
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tech_cat (category),
        INDEX idx_tech_sup (supervisor_id)
      ) ENGINE=InnoDB;
    `);

    // Ensure columns exist (migration safeguard)
    try { await pool.query(`ALTER TABLE emails_log ADD COLUMN sender_email VARCHAR(128) NOT NULL DEFAULT 'hostel@iul.ac.in' AFTER type;`); } catch (e) {}
    try { await pool.query(`UPDATE emails_log SET sender_email = 'hostel@iul.ac.in' WHERE sender_email IS NULL OR sender_email = '';`); } catch (e) {}
    try { await pool.query(`ALTER TABLE users ADD COLUMN enrollment_no VARCHAR(64) NULL UNIQUE AFTER password;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE users ADD COLUMN campus VARCHAR(64) NULL AFTER student_id;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE users ADD COLUMN gender VARCHAR(16) NULL AFTER campus;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE users ADD COLUMN emp_code VARCHAR(32) NULL AFTER gender;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE complaints ADD COLUMN enrollment_no VARCHAR(64) NOT NULL DEFAULT 'IU/2023/10452' AFTER student_id;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE complaints ADD COLUMN campus VARCHAR(64) NULL AFTER student_email;`); } catch (e) {}
    try { await pool.query(`UPDATE complaints c LEFT JOIN users u ON (c.enrollment_no = u.enrollment_no OR c.student_email = u.email) SET c.campus = COALESCE(u.campus, 'Phase I') WHERE c.campus IS NULL OR c.campus = '';`); } catch (e) {}
    try {
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned catering staff / food inspector:') WHERE c.category = 'Food' AND t.action LIKE '%Assigned technician:%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician', 'Assigned catering staff / food inspector:') WHERE c.category = 'Food' AND t.action LIKE '%Assigned technician%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned hostel warden / proctor:') WHERE c.category = 'Discipline' AND t.action LIKE '%Assigned technician:%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician', 'Assigned hostel warden / proctor:') WHERE c.category = 'Discipline' AND t.action LIKE '%Assigned technician%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned plumber:') WHERE c.category = 'Plumbing' AND t.action LIKE '%Assigned technician:%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician', 'Assigned plumber:') WHERE c.category = 'Plumbing' AND t.action LIKE '%Assigned technician%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned carpenter:') WHERE c.category = 'Carpentry' AND t.action LIKE '%Assigned technician:%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician', 'Assigned carpenter:') WHERE c.category = 'Carpentry' AND t.action LIKE '%Assigned technician%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician:', 'Assigned electrical technician:') WHERE c.category = 'Electrical' AND t.action LIKE '%Assigned technician:%';`);
      await pool.query(`UPDATE timeline_events t JOIN complaints c ON t.complaint_id = c.id SET t.action = REPLACE(t.action, 'Assigned technician', 'Assigned electrical technician:') WHERE c.category = 'Electrical' AND t.action LIKE '%Assigned technician%';`);
    } catch (e) {}

    // Seed default technicians if table is empty
    const [techCount] = await pool.query('SELECT COUNT(*) as cnt FROM technicians');
    if (techCount[0].cnt === 0) {
      console.log('Seeding initial available technicians for Integral University maintenance domains...');
      await pool.query(`
        INSERT INTO technicians (id, supervisor_id, category, name, phone, specialization, status, notes) VALUES
        ('tech_elec_1', 'usr_sup_aamir', 'Electrical', 'Ramesh Kumar', '+91 98391 23456', 'Senior Electrician & Substation Tech', 'Available', 'Electrical power, wiring and fixtures across all halls'),
        ('tech_elec_2', 'usr_sup_aamir', 'Electrical', 'Afzal Khan', '+91 98392 34567', 'Fan, Switchboard & Wiring Specialist', 'Available', 'General electrical maintenance & power switches'),
        ('tech_elec_3', 'usr_sup_aamir', 'Electrical', 'Sunil Rawat', '+91 98393 45678', 'AC & Power Line Technician', 'Available', 'AC and power line maintenance'),
        ('tech_plumb_1', 'usr_sup_zahid', 'Plumbing', 'Suresh Patel', '+91 98394 56789', 'Senior Plumber & Pipeline Technician', 'Available', 'Available 24x7 for urgent hostel pipeline leaks'),
        ('tech_plumb_2', 'usr_sup_zahid', 'Plumbing', 'Imran Ali', '+91 98395 67890', 'Geyser & Water Tank Specialist', 'Available', 'Morning and evening washroom maintenance'),
        ('tech_plumb_3', 'usr_sup_zahid', 'Plumbing', 'Dinesh Yadav', '+91 98396 78901', 'Washroom & Sanitary Fittings Tech', 'Available', 'Drainage clearing & tap valve replacements'),
        ('tech_carp_1', 'usr_sup_irfan', 'Carpentry', 'Master Aslam', '+91 98397 89012', 'Senior Carpenter & Furniture Master', 'Available', 'Almirah doors, study desks and bed joints'),
        ('tech_carp_2', 'usr_sup_irfan', 'Carpentry', 'Vikas Verma', '+91 98398 90123', 'Door, Lock & Window Tech', 'Available', 'Lock replacements, handles and tower bolts'),
        ('tech_carp_3', 'usr_sup_irfan', 'Carpentry', 'Nafees Ahmad', '+91 98399 11223', 'Furniture & Structural Woodwork', 'Available', 'Study desks, bed frames and wardrobes'),
        ('staff_food_1', 'usr_sup_salman', 'Food', 'Chef Qadir Ahmad', '+91 98399 01234', 'Hostel Mess & Catering Supervisor', 'Available', 'Meal quality, portioning and kitchen hygiene inspections'),
        ('staff_food_2', 'usr_sup_salman', 'Food', 'Naeem Khan', '+91 98400 12345', 'Kitchen Hygiene & Water Safety Inspector', 'Available', 'R.O. water coolers and dish washing sanitation'),
        ('staff_food_3', 'usr_sup_salman', 'Food', 'Shakeel Akhtar', '+91 98403 45678', 'Dining Hall Head Steward', 'Available', 'Hostel mess dining operations and breakfast service'),
        ('staff_disc_1', 'usr_sup_saba', 'Discipline', 'Mahendra Singh', '+91 98401 23456', 'Hostel Warden & Security Marshal', 'Available', 'Gate logs, night attendance and silent hours enforcement'),
        ('staff_disc_2', 'usr_sup_saba', 'Discipline', 'Shakeel Ahmad', '+91 98402 34567', 'Floor Proctor & Wing Assistant', 'Available', 'Student welfare and room occupancy checks'),
        ('staff_disc_3', 'usr_sup_saba', 'Discipline', 'Rehana Bano', '+91 98405 67890', 'Girls Wing Assistant Warden', 'Available', 'Student welfare, quiet hours and entry registry');
      `);
      console.log('✓ Seeded available technicians.');
    }

    console.log('✓ MySQL schema & tables verified for Integral University.');

    // Seed / Ensure official Integral University staff profiles (5 Supervisors + Provost only, no dummy students)
    const staffProfiles = [
      ['usr_sup_aamir', 'supervisor', 'Electrical', 'Mohd Aamir Khan', 'maamirk@iul.ac.in', 'password123', 'All Hostels', 'Boy', '+91 94558 96120', 'Supervisor - Department of Electrical & Power Maintenance', 'A00310'],
      ['usr_sup_zahid', 'supervisor', 'Plumbing', 'Zahid Raza', 'zahidraza@iul.ac.in', 'password123', 'All Hostels', 'Boy', '+91 82998 99297', 'Supervisor - Department of Plumbing & Water Sanitation', 'A00219'],
      ['usr_sup_irfan', 'supervisor', 'Carpentry', 'Dr. Irfan Ahmad Siddiqui', 'iasiddiqui@iul.ac.in', 'password123', 'All Hostels', 'Boy', '+91 98383 26547', 'Supervisor - Department of Carpentry & Civil Infrastructure', 'A00325'],
      ['usr_sup_salman', 'supervisor', 'Food', 'Dr. Salman', 'salman@iul.ac.in', 'password123', 'All Hostels', 'Boy', '+91 98399 01234', 'Supervisor - Department of Hostel Mess & Food Quality', 'A00512'],
      ['usr_sup_saba', 'supervisor', 'Discipline', 'Dr. Saba', 'saba@iul.ac.in', 'password123', 'All Hostels', 'Girl', '+91 98401 23456', 'Proctor - Department of Hostel Discipline & Student Welfare', 'A00525'],
      ['usr_provost', 'provost', null, 'Prof. (Dr.) Mohammad Faisal', 'provost@iul.ac.in', 'provost123', null, null, '+91 94150 99887', 'Provost - Integral University Hostels', null]
    ];

    for (const s of staffProfiles) {
      await pool.query(`
        INSERT INTO users (id, role, category, name, email, password, campus, gender, phone, title, emp_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          email = VALUES(email),
          password = VALUES(password),
          role = VALUES(role),
          category = VALUES(category),
          phone = VALUES(phone),
          title = VALUES(title),
          emp_code = VALUES(emp_code),
          campus = VALUES(campus),
          gender = VALUES(gender)
      `, s);
    }
    console.log('✓ Verified 5 Supervisors & Provost accounts in database (Zero dummy complaints/students).');

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
