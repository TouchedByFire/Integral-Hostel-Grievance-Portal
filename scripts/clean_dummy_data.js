const { initDatabase, getPool } = require('../db');

async function cleanData() {
  console.log('Initiating database cleanup for Integral University Hostel Grievance Portal...');
  await initDatabase();
  const pool = getPool();

  console.log('1. Clearing timeline events...');
  await pool.query('DELETE FROM timeline_events');

  console.log('2. Clearing email notification logs...');
  await pool.query('DELETE FROM emails_log');

  console.log('3. Clearing complaints master ledger...');
  await pool.query('DELETE FROM complaints');

  console.log('4. Clearing student accounts and alias rows...');
  await pool.query("DELETE FROM users WHERE role = 'student' OR id LIKE '%_alias'");

  console.log('5. Resetting all technician statuses to Available...');
  await pool.query("UPDATE technicians SET status = 'Available'");

  console.log('6. Verifying remaining users and state...');
  const [users] = await pool.query('SELECT id, role, category, name, email, phone FROM users ORDER BY role, id');
  console.log('\n--- Active Staff Profiles in Database ---');
  console.table(users);

  const [cCount] = await pool.query('SELECT COUNT(*) as count FROM complaints');
  const [sCount] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
  const [tCount] = await pool.query("SELECT COUNT(*) as count FROM technicians WHERE status = 'Available'");

  console.log(`\nComplaints in database: ${cCount[0].count} (Expected: 0)`);
  console.log(`Students in database:   ${sCount[0].count} (Expected: 0)`);
  console.log(`Available Technicians:  ${tCount[0].count} (Expected: 15)`);
  console.log('\n✓ Database cleanup completed successfully! Portal is ready for real pilot testing.');
}

cleanData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
