const fs = require("fs");
const path = require("path");

const csvDir = path.join(__dirname, "..", "data");
const dbDir = __dirname;

// Simple CSV parser
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

async function main() {
  // Check if better-sqlite3 is available
  try {
    const Database = require("better-sqlite3");
    const db = new Database(path.join(dbDir, "electricity_pricing.db"));

    // Read schema
    const schema = fs.readFileSync(path.join(dbDir, "schema.sql"), "utf-8");
    db.exec(schema);
    console.log("Schema created");

    // Read and parse CSVs
    const provinces = parseCSV(fs.readFileSync(path.join(csvDir, "provinces.csv"), "utf-8"));
    const periods = parseCSV(fs.readFileSync(path.join(csvDir, "time_periods.csv"), "utf-8"));
    const sources = parseCSV(fs.readFileSync(path.join(csvDir, "sources.csv"), "utf-8"));
    const missing = parseCSV(fs.readFileSync(path.join(csvDir, "missing_data.csv"), "utf-8"));

    // Insert provinces
    const insertProvince = db.prepare("INSERT OR IGNORE INTO provinces (province_id, province_name, province_abbr, region, area_km2, data_status) VALUES (?,?,?,?,?,?)");
    for (const p of provinces) {
      insertProvince.run(p.province_id, p.province_name, p.province_abbr, p.region, parseInt(p.area_km2), p.data_status);
    }
    console.log(`Inserted ${provinces.length} provinces`);

    // Insert sources
    const insertSource = db.prepare(`INSERT OR IGNORE INTO sources (source_id, province_id, source_name, publisher, doc_number, publish_date, effective_date, source_url, reliability, collect_date) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for (const s of sources) {
      insertSource.run(s.source_id, s.province_id, s.source_name, s.publisher, s.doc_number, s.publish_date, s.effective_date, s.source_url, s.reliability, s.collect_date);
    }
    console.log(`Inserted ${sources.length} sources`);

    // Insert time periods
    const insertPeriod = db.prepare(`INSERT INTO time_periods (province_id, user_type, voltage_level, season_type, period_name, standard_category, start_time, end_time, price_yuan_per_kwh, ratio_to_flat, source_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of periods) {
      insertPeriod.run(p.province_id, p.user_type, p.voltage_level, p.season_type, p.period_name, p.standard_category, p.start_time, p.end_time, parseFloat(p.price_yuan_per_kwh), parseFloat(p.ratio_to_flat), p.source_id, p.notes);
    }
    console.log(`Inserted ${periods.length} time periods`);

    // Insert missing data
    const insertMissing = db.prepare(`INSERT OR IGNORE INTO missing_data (province_id, missing_type, missing_item, reason, search_process, search_date) VALUES (?,?,?,?,?,?)`);
    for (const m of missing) {
      insertMissing.run(m.province_id, m.missing_type, m.missing_item, m.reason, m.search_process, m.search_date);
    }
    console.log(`Inserted ${missing.length} missing data records`);

    db.close();
    console.log("Database initialized successfully at:", path.join(dbDir, "electricity_pricing.db"));
  } catch (e) {
    // Fallback: better-sqlite3 not available
    console.log("better-sqlite3 not available, SQLite init skipped.");
    console.log("To init SQLite: install better-sqlite3 (`cd db && npm install better-sqlite3`) then run `node import.js`");
    console.log("Or use SQLite CLI: `sqlite3 electricity_pricing.db < schema.sql` then import CSV manually");
  }
}

main();
