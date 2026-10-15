/**
 * Migration Script: Add campus column to complaints table and populate existing records
 */
const { initDatabase, getPool } = require('../db');

async function main() {
  await initDatabase();
  const pool = getPool();
  console.log('🔄 Checking campus column in complaints table...');

  try {
    await pool.query('ALTER TABLE complaints ADD COLUMN campus VARCHAR(64) NULL AFTER student_email;');
    console.log('✓ Added campus column to complaints table.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ Campus column already exists.');
    } else {
      console.error('Migration note:', err.message);
    }
  }

  // Populate campus for all existing complaints
  await pool.query(`
    UPDATE complaints c 
    LEFT JOIN users u ON (c.enrollment_no = u.enrollment_no OR c.student_email = u.email)
    SET c.campus = COALESCE(u.campus, 'Phase I')
    WHERE c.campus IS NULL OR c.campus = ''
  `);
  console.log('✓ Populated campus for existing complaints.');

  const [rows] = await pool.query('SELECT ticket_number, student_name, campus, hostel, room FROM complaints LIMIT 5');
  console.log('Sample updated records:');
  console.log(rows);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
