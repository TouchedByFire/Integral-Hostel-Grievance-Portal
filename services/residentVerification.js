const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

let cachedRoster = null;
let lastLoadedTime = 0;

/**
 * Normalizes and extracts hostel resident records from Excel file or JSON fallback.
 */
function loadRoster() {
  const excelPath = process.env.HOSTEL_EXCEL_PATH || path.join(__dirname, '..', 'data', 'hostel_residents.xlsx');
  const jsonPath = path.join(__dirname, '..', 'data', 'hostel_residents.json');

  const rosterMap = new Map();

  // 1. Try reading from Excel file first
  if (fs.existsSync(excelPath)) {
    try {
      const workbook = XLSX.readFile(excelPath);
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet);

      rawRows.forEach((row, idx) => {
        // Robust column matching
        const enrollmentRaw = row['Enrollment No.'] || row['Enrollment No'] || row['Enrollment'] || row['enrollmentNo'] || row['EnrollmentNo'] || row['Enrollment_No'] || '';
        const cleanEnrollment = String(enrollmentRaw).replace(/\D/g, '').trim();

        if (cleanEnrollment.length === 10) {
          const name = (row['Name'] || row['Student Name'] || row['name'] || '').toString().trim();
          const gender = (row['Gender'] || row['gender'] || '').toString().trim();
          const campus = (row['Campus'] || row['campus'] || 'Phase I').toString().trim();
          const hostel = (row['Hostel Name'] || row['Hostel'] || row['hostel'] || '').toString().trim();
          const room = (row['Room No.'] || row['Room'] || row['room'] || '').toString().trim();
          const course = (row['Course'] || row['course'] || '').toString().trim();
          const mobile = (row['Mobile No.'] || row['Mobile'] || row['Phone'] || row['mobile'] || '').toString().trim();

          rosterMap.set(cleanEnrollment, {
            sNo: idx + 1,
            enrollmentNo: cleanEnrollment,
            name,
            gender: gender || (hostel.toLowerCase().includes('girl') || hostel.startsWith('Block') || hostel.startsWith('Wing') ? 'Girl' : 'Boy'),
            campus: campus || 'Phase I',
            hostel,
            room,
            course,
            mobile
          });
        }
      });

      console.log(`✓ Loaded ${rosterMap.size} student resident records from Excel: ${excelPath}`);
      cachedRoster = rosterMap;
      lastLoadedTime = Date.now();
      return rosterMap;
    } catch (e) {
      console.warn(`Warning reading Excel file (${e.message}), falling back to JSON roster...`);
    }
  }

  // 2. Fallback to JSON
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      data.forEach(item => {
        const cleanEnrollment = String(item.enrollmentNo || '').replace(/\D/g, '').trim();
        if (cleanEnrollment.length === 10) {
          rosterMap.set(cleanEnrollment, {
            ...item,
            enrollmentNo: cleanEnrollment
          });
        }
      });
      console.log(`✓ Loaded ${rosterMap.size} student resident records from JSON fallback: ${jsonPath}`);
      cachedRoster = rosterMap;
      lastLoadedTime = Date.now();
      return rosterMap;
    } catch (e) {
      console.error(`Error loading JSON fallback roster:`, e);
    }
  }

  cachedRoster = rosterMap;
  lastLoadedTime = Date.now();
  return rosterMap;
}

/**
 * Verifies if enrollment number is strictly 10 digits and exists in hostel resident records.
 * @param {string} enrollmentNo
 * @returns {{ valid: boolean, error?: string, resident?: object }}
 */
function verifyEnrollment(enrollmentNo) {
  if (!enrollmentNo) {
    return { valid: false, error: 'Enrollment number is required.' };
  }

  const rawStr = String(enrollmentNo).trim();

  // Strict 10 digits only
  if (!/^\d{10}$/.test(rawStr)) {
    return { 
      valid: false, 
      error: 'Enrollment number must be strictly 10 digits (digits only: 0-9).' 
    };
  }

  // Refresh cache if not loaded or older than 30 seconds
  if (!cachedRoster || (Date.now() - lastLoadedTime > 30000)) {
    loadRoster();
  }

  const resident = cachedRoster.get(rawStr);
  if (!resident) {
    return { 
      valid: false, 
      error: `Enrollment number "${rawStr}" was not found in approved hostel resident records. Registration is only permitted for active hostel residents. Please contact Provost Office.` 
    };
  }

  return {
    valid: true,
    resident
  };
}

/**
 * Gets all eligible residents
 */
function getAllResidents() {
  if (!cachedRoster) loadRoster();
  return Array.from(cachedRoster.values());
}

module.exports = {
  loadRoster,
  verifyEnrollment,
  getAllResidents
};
