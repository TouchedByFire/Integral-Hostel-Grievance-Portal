const { initDatabase, getPool } = require('../db');

async function migrate() {
  await initDatabase();
  const pool = getPool();

  console.log('Running schema updates...');

  // 1. Add columns to users if missing
  const cols = [
    { name: 'campus', type: 'VARCHAR(64) NULL' },
    { name: 'gender', type: 'VARCHAR(16) NULL' },
    { name: 'emp_code', type: 'VARCHAR(32) NULL' }
  ];

  for (const c of cols) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN ${c.name} ${c.type};`);
      console.log(`✓ Added column ${c.name} to users.`);
    } catch (e) {
      // Column might already exist
    }
  }

  // 2. Also create hostel_eligible_students table in MySQL for direct DB matching as well
  await pool.query(`
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
  `);
  console.log('✓ Verified hostel_eligible_students table.');

  // Populate hostel_eligible_students with data from docx / JSON
  const fs = require('fs');
  const path = require('path');
  const residents = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'hostel_residents.json'), 'utf8'));

  for (const r of residents) {
    await pool.query(`
      INSERT INTO hostel_eligible_students (s_no, enrollment_no, name, gender, campus, hostel, room, course, mobile)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        gender = VALUES(gender),
        campus = VALUES(campus),
        hostel = VALUES(hostel),
        room = VALUES(room),
        course = VALUES(course),
        mobile = VALUES(mobile);
    `, [r.sNo, r.enrollmentNo, r.name, r.gender, r.campus, r.hostel, r.room, r.course, r.mobile]);
  }
  console.log(`✓ Populated ${residents.length} eligible students in database.`);

  // 3. Upsert Supervisors according to Integral Hostel 13.10.2026.docx
  const officialSupervisors = [
    {
      id: 'usr_sup_zahid',
      name: 'Zahid Raza',
      email: 'zahidraza@iul.ac.in',
      empCode: 'A00219',
      phone: '+91 82998 99297',
      category: 'Electrical',
      hostel: 'Hall 2 & 3',
      title: 'Supervisor - Hall 2 & 3 (Electrical & Maintenance)'
    },
    {
      id: 'usr_sup_aamir',
      name: 'Mohd Aamir Khan',
      email: 'maamirk@iul.ac.in',
      empCode: 'A00310',
      phone: '+91 94558 96120',
      category: 'Plumbing',
      hostel: 'Hall 1 & 4',
      title: 'Supervisor - Hall 1 & 4 (Plumbing & Sanitation)'
    },
    {
      id: 'usr_sup_tanveer',
      name: 'Dr. Tanveer Ahmad',
      email: 'tanveera@iul.ac.in',
      empCode: 'A00477',
      phone: '+91 78606 89788',
      category: 'Carpentry',
      hostel: 'Hall 5',
      title: 'Full Time Warden - Hall 5 (Carpentry & Infrastructure)'
    },
    {
      id: 'usr_sup_irfan',
      name: 'Dr. Irfan Ahmad Siddiqui',
      email: 'iasiddiqui@iul.ac.in',
      empCode: 'A00325',
      phone: '+91 98383 26547',
      category: 'Food',
      hostel: 'Old Girls Hostel',
      title: 'Supervisor - Old Girls Hostel (Mess & Food Quality)'
    },
    {
      id: 'usr_sup_sidra',
      name: 'Sidra Jameel',
      email: 'sidraj@iul.ac.in',
      empCode: 'A00487',
      phone: '+91 62020 63274',
      category: 'Discipline',
      hostel: 'Wing A',
      title: 'Full Time Warden - Wing A (Hostel Discipline & Proctor)'
    },
    {
      id: 'usr_sup_shahnaz',
      name: 'Shahnaz Siddiqui',
      email: 'shahnazs@iul.ac.in',
      empCode: 'A00337',
      phone: '+91 88402 95997',
      category: 'Discipline',
      hostel: 'Wing B',
      title: 'Full Time Warden - Wing B (Block B)'
    },
    {
      id: 'usr_sup_shaista',
      name: 'Shaista Aziz',
      email: 'shaestaa@iul.ac.in',
      empCode: 'A00438',
      phone: '+91 99357 42822',
      category: 'Electrical',
      hostel: 'Wing C',
      title: 'Full Time Warden - Wing C (Block C)'
    }
  ];

  for (const s of officialSupervisors) {
    // Check if exists by email
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [s.email]);
    if (existing.length > 0) {
      await pool.query(`
        UPDATE users SET 
          name = ?, category = ?, phone = ?, title = ?, hostel = ?, emp_code = ?
        WHERE email = ?
      `, [s.name, s.category, s.phone, s.title, s.hostel, s.empCode, s.email]);
      console.log(`✓ Updated supervisor ${s.name} (${s.email})`);
    } else {
      await pool.query(`
        INSERT INTO users (id, role, category, name, email, password, phone, title, hostel, emp_code)
        VALUES (?, 'supervisor', ?, ?, ?, 'super123', ?, ?, ?, ?)
      `, [s.id, s.category, s.name, s.email, s.phone, s.title, s.hostel, s.empCode]);
      console.log(`✓ Created supervisor ${s.name} (${s.email})`);
    }
  }

  // Update complaints assigned supervisor names if they had old placeholder names
  await pool.query(`UPDATE complaints SET assigned_supervisor_id = 'usr_sup_zahid', assigned_supervisor_name = 'Zahid Raza' WHERE assigned_supervisor_id = 'usr_sup_electrical'`);
  await pool.query(`UPDATE complaints SET assigned_supervisor_id = 'usr_sup_aamir', assigned_supervisor_name = 'Mohd Aamir Khan' WHERE assigned_supervisor_id = 'usr_sup_plumbing'`);
  await pool.query(`UPDATE complaints SET assigned_supervisor_id = 'usr_sup_tanveer', assigned_supervisor_name = 'Dr. Tanveer Ahmad' WHERE assigned_supervisor_id = 'usr_sup_carpentry'`);
  await pool.query(`UPDATE complaints SET assigned_supervisor_id = 'usr_sup_irfan', assigned_supervisor_name = 'Dr. Irfan Ahmad Siddiqui' WHERE assigned_supervisor_id = 'usr_sup_food'`);
  await pool.query(`UPDATE complaints SET assigned_supervisor_id = 'usr_sup_sidra', assigned_supervisor_name = 'Sidra Jameel' WHERE assigned_supervisor_id = 'usr_sup_discipline'`);

  // Remove old placeholder supervisor accounts so only official supervisors remain
  await pool.query(`
    DELETE FROM users 
    WHERE id IN ('usr_sup_electrical', 'usr_sup_plumbing', 'usr_sup_carpentry', 'usr_sup_food', 'usr_sup_discipline')
      AND email NOT IN ('zahidraza@iul.ac.in', 'maamirk@iul.ac.in', 'tanveera@iul.ac.in', 'iasiddiqui@iul.ac.in', 'sidraj@iul.ac.in', 'shahnazs@iul.ac.in', 'shaestaa@iul.ac.in')
  `);
  console.log('✓ Cleaned up old generic supervisor placeholders.');

  // Also ensure resident students from docx are present in users or available for testing
  const sampleStudent = residents[0]; // Mohd Uzair 2600105579
  const [hasUzair] = await pool.query('SELECT id FROM users WHERE enrollment_no = ?', [sampleStudent.enrollmentNo]);
  if (hasUzair.length === 0) {
    await pool.query(`
      INSERT INTO users (id, role, category, name, email, password, enrollment_no, student_id, campus, gender, hostel, room, phone, title)
      VALUES ('usr_uzair', 'student', NULL, ?, 'uzair@iul.ac.in', 'student123', ?, ?, ?, ?, ?, ?, ?, 'B.Tech CSE Student')
    `, [sampleStudent.name, sampleStudent.enrollmentNo, sampleStudent.enrollmentNo, sampleStudent.campus, sampleStudent.gender, sampleStudent.hostel, sampleStudent.room, sampleStudent.mobile]);
    console.log(`✓ Seeded sample resident student ${sampleStudent.name} (${sampleStudent.enrollmentNo})`);
  }

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
