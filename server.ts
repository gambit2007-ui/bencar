import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const MAX_JSON_SIZE = process.env.MAX_JSON_SIZE || "1mb";
const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 10);
const MAX_UPLOAD_FILES = Number(process.env.MAX_UPLOAD_FILES || 20);
const SERVER_API_KEY = (process.env.SERVER_API_KEY || "").trim();
const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const db = new Database("auto_gestao.db");
db.pragma("foreign_keys = ON");

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT,
      model TEXT,
      year INTEGER,
      color TEXT,
      plate TEXT,
      mileage INTEGER,
      chassis TEXT,
      purchase_date TEXT,
      purchase_value REAL,
      acquisition_source TEXT,
      fipe_value REAL,
      sale_value REAL,
      status TEXT DEFAULT 'Em Preparação',
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      document TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      client_id INTEGER,
      sale_date TEXT,
      sale_price REAL,
      payment_method TEXT,
      profit REAL,
      notes TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      description TEXT,
      amount REAL,
      date TEXT,
      notes TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER,
      observations TEXT,
      media_urls TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS client_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicle_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sale_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      checklist_date TEXT NOT NULL,
      observations TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sale_checklist_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (checklist_id) REFERENCES sale_checklists (id) ON DELETE CASCADE
    );
  `);

  try {
    const salesColumns = db.prepare("PRAGMA table_info(sales)").all() as any[];
    if (!salesColumns.some(c => c.name === "client_id")) {
      db.prepare("ALTER TABLE sales ADD COLUMN client_id INTEGER").run();
    }
    if (!salesColumns.some(c => c.name === "profit")) {
      db.prepare("ALTER TABLE sales ADD COLUMN profit REAL DEFAULT 0").run();
    }
    if (!salesColumns.some(c => c.name === "notes")) {
      db.prepare("ALTER TABLE sales ADD COLUMN notes TEXT").run();
    }
  } catch (e) {
    console.error("Migration error (sales table):", e);
  }

  try {
    const vehicleColumns = db.prepare("PRAGMA table_info(vehicles)").all() as any[];
    if (!vehicleColumns.some(c => c.name === "chassis")) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN chassis TEXT").run();
    }
    if (!vehicleColumns.some(c => c.name === "acquisition_source")) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN acquisition_source TEXT").run();
    }
    if (!vehicleColumns.some(c => c.name === "fipe_value")) {
      db.prepare("ALTER TABLE vehicles ADD COLUMN fipe_value REAL DEFAULT 0").run();
    }
  } catch (e) {
    console.error("Migration error (vehicles table):", e);
  }

  try {
    const checklistColumns = db.prepare("PRAGMA table_info(checklists)").all() as any[];
    if (!checklistColumns.some(c => c.name === "client_id")) {
      db.prepare("ALTER TABLE checklists ADD COLUMN client_id INTEGER").run();
    }
  } catch (e) {
    console.error("Migration error (checklists table):", e);
  }

  try {
    const clientColumns = db.prepare("PRAGMA table_info(clients)").all() as any[];
    if (!clientColumns.some(c => c.name === "rg")) {
      db.prepare("ALTER TABLE clients ADD COLUMN rg TEXT").run();
    }
  } catch (e) {
    console.error("Migration error (clients table):", e);
  }
}

runMigrations();

const vehicleCount = db.prepare("SELECT COUNT(*) as count FROM vehicles").get() as { count: number };
if (vehicleCount.count === 0) {
  db.prepare(`
    INSERT INTO vehicles (brand, model, year, color, plate, mileage, purchase_value, sale_value, status, purchase_date, image_url)
    VALUES
    ('Ford', 'Fiesta', 2013, 'Prata', 'ABC-1234', 107123, 24180.00, 33900.00, 'Em Preparação', '2026-02-05', 'https://picsum.photos/seed/fiesta/800/600'),
    ('Fiat', 'Punto', 2010, 'Preto', 'XYZ-5678', 85000, 24000.00, 32900.00, 'Em Estoque', '2026-02-06', 'https://picsum.photos/seed/punto/800/600'),
    ('Volkswagen', 'Gol', 2012, 'Branco', 'GOL-1010', 120000, 18000.00, 25000.00, 'Em Estoque', '2026-02-10', 'https://picsum.photos/seed/gol/800/600')
  `).run();
}

async function startServer() {
  const app = express();

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      cb(null, `${unique}-${safeBase}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
      files: MAX_UPLOAD_FILES,
    },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_UPLOAD_MIME.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype || "desconhecido"}`));
    },
  });

  app.use(express.json({ limit: MAX_JSON_SIZE }));
  app.use("/uploads", express.static(uploadsDir));

  if (SERVER_API_KEY) {
    app.use("/api", (req, res, next) => {
      const providedApiKey = String(req.header("x-api-key") || "").trim();
      if (providedApiKey !== SERVER_API_KEY) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      next();
    });
  } else {
    console.warn("SERVER_API_KEY is not configured. API routes are unsecured.");
  }

  function fileUrl(filename: string) {
    return `/uploads/${filename}`;
  }

  // Uploads
  app.post("/api/uploads/:entity/:id", upload.array("files", 20), (req, res) => {
    try {
      const entity = String(req.params.entity || "");
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (!files.length) {
        return res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
      }

      const out: any[] = [];

      if (entity === "clients") {
        const stmt = db.prepare(`INSERT INTO client_files (client_id, filename, original_name, mime_type, size, url) VALUES (?,?,?,?,?,?)`);
        for (const f of files) {
          const url = fileUrl(f.filename);
          const info = stmt.run(id, f.filename, f.originalname, f.mimetype, f.size, url);
          out.push({ id: Number(info.lastInsertRowid), url, original_name: f.originalname, mime_type: f.mimetype, size: f.size, created_at: new Date().toISOString() });
        }
        return res.json({ success: true, files: out });
      }

      if (entity === "vehicles") {
        const stmt = db.prepare(`INSERT INTO vehicle_files (vehicle_id, filename, original_name, mime_type, size, url) VALUES (?,?,?,?,?,?)`);
        for (const f of files) {
          const url = fileUrl(f.filename);
          const info = stmt.run(id, f.filename, f.originalname, f.mimetype, f.size, url);
          out.push({ id: Number(info.lastInsertRowid), url, original_name: f.originalname, mime_type: f.mimetype, size: f.size, created_at: new Date().toISOString() });
        }
        return res.json({ success: true, files: out });
      }

      if (entity === "sale-checklists") {
        const stmt = db.prepare(`INSERT INTO sale_checklist_files (checklist_id, filename, original_name, mime_type, size, url) VALUES (?,?,?,?,?,?)`);
        for (const f of files) {
          const url = fileUrl(f.filename);
          const info = stmt.run(id, f.filename, f.originalname, f.mimetype, f.size, url);
          out.push({ id: Number(info.lastInsertRowid), url, original_name: f.originalname, mime_type: f.mimetype, size: f.size, created_at: new Date().toISOString() });
        }
        return res.json({ success: true, files: out });
      }

      return res.status(400).json({ success: false, message: "Entity inválida. Use clients, vehicles ou sale-checklists." });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ success: false, message: "Erro no upload" });
    }
  });

  app.get("/api/uploads/:entity/:id", (req, res) => {
    try {
      const entity = String(req.params.entity || "");
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: "ID inválido" });
      }

      let rows: any[] = [];
      if (entity === "clients") rows = db.prepare(`SELECT * FROM client_files WHERE client_id=? ORDER BY id DESC`).all(id) as any[];
      else if (entity === "vehicles") rows = db.prepare(`SELECT * FROM vehicle_files WHERE vehicle_id=? ORDER BY id DESC`).all(id) as any[];
      else if (entity === "sale-checklists") rows = db.prepare(`SELECT * FROM sale_checklist_files WHERE checklist_id=? ORDER BY id DESC`).all(id) as any[];
      else return res.status(400).json({ success: false, message: "Entity inválida" });

      return res.json({ success: true, files: rows });
    } catch (err) {
      console.error("List uploads error:", err);
      return res.status(500).json({ success: false, message: "Erro ao listar uploads" });
    }
  });

  app.delete("/api/uploads/:entity/file/:fileId", (req, res) => {
    try {
      const entity = String(req.params.entity || "");
      const fileId = Number(req.params.fileId);
      if (!fileId || Number.isNaN(fileId)) {
        return res.status(400).json({ success: false, message: "File ID inválido" });
      }

      let row: any | undefined;
      if (entity === "clients") row = db.prepare(`SELECT * FROM client_files WHERE id=?`).get(fileId);
      else if (entity === "vehicles") row = db.prepare(`SELECT * FROM vehicle_files WHERE id=?`).get(fileId);
      else if (entity === "sale-checklists") row = db.prepare(`SELECT * FROM sale_checklist_files WHERE id=?`).get(fileId);
      else return res.status(400).json({ success: false, message: "Entity inválida" });

      if (!row) return res.status(404).json({ success: false, message: "Arquivo não encontrado" });

      const filepath = path.join(uploadsDir, row.filename);
      try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch {
        // ignore file deletion errors
      }

      if (entity === "clients") db.prepare(`DELETE FROM client_files WHERE id=?`).run(fileId);
      else if (entity === "vehicles") db.prepare(`DELETE FROM vehicle_files WHERE id=?`).run(fileId);
      else db.prepare(`DELETE FROM sale_checklist_files WHERE id=?`).run(fileId);

      return res.json({ success: true });
    } catch (err) {
      console.error("Delete upload error:", err);
      return res.status(500).json({ success: false, message: "Erro ao excluir upload" });
    }
  });

  // Vehicles
  app.get("/api/vehicles", (_req, res) => {
    try {
      const vehicles = db.prepare(`
        SELECT v.*,
          EXISTS(SELECT 1 FROM checklists c WHERE c.vehicle_id = v.id) as has_checklist
        FROM vehicles v
        ORDER BY v.created_at DESC
      `).all();
      res.json(vehicles);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/vehicles", (req, res) => {
    try {
      const {
        brand, model, year, color, plate, mileage, chassis,
        purchase_date, purchase_value, acquisition_source,
        fipe_value, sale_value, status, description, image_url
      } = req.body;

      const info = db.prepare(`
        INSERT INTO vehicles (
          brand, model, year, color, plate, mileage, chassis,
          purchase_date, purchase_value, acquisition_source,
          fipe_value, sale_value, status, description, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        brand, model, year, color, plate, mileage, chassis,
        purchase_date, purchase_value, acquisition_source,
        fipe_value, sale_value, status, description, image_url
      );

      res.json({ id: Number(info.lastInsertRowid) });
    } catch (err: any) {
      console.error("Error creating vehicle:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/vehicles/:id", (req, res) => {
    try {
      const { id } = req.params;
      const {
        brand, model, year, color, plate, mileage, chassis,
        purchase_date, purchase_value, acquisition_source,
        fipe_value, sale_value, status, description, image_url
      } = req.body;

      db.prepare(`
        UPDATE vehicles SET
          brand = ?, model = ?, year = ?, color = ?, plate = ?,
          mileage = ?, chassis = ?, purchase_date = ?, purchase_value = ?,
          acquisition_source = ?, fipe_value = ?, sale_value = ?,
          status = ?, description = ?, image_url = ?
        WHERE id = ?
      `).run(
        brand, model, year, color, plate, mileage, chassis,
        purchase_date, purchase_value, acquisition_source,
        fipe_value, sale_value, status, description, image_url, id
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating vehicle:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/vehicles/:id", (req, res) => {
    const vehicleId = Number(req.params.id);
    try {
      db.transaction(() => {
        db.prepare("DELETE FROM expenses WHERE vehicle_id = ?").run(vehicleId);
        db.prepare("DELETE FROM sales WHERE vehicle_id = ?").run(vehicleId);
        db.prepare("DELETE FROM checklists WHERE vehicle_id = ?").run(vehicleId);
        db.prepare("DELETE FROM vehicle_files WHERE vehicle_id = ?").run(vehicleId);

        const saleChecklists = db.prepare("SELECT id FROM sale_checklists WHERE vehicle_id = ?").all(vehicleId) as any[];
        for (const sc of saleChecklists) {
          db.prepare("DELETE FROM sale_checklist_files WHERE checklist_id = ?").run(sc.id);
        }
        db.prepare("DELETE FROM sale_checklists WHERE vehicle_id = ?").run(vehicleId);

        const result = db.prepare("DELETE FROM vehicles WHERE id = ?").run(vehicleId);
        if (result.changes === 0) throw new Error("Veículo não encontrado no banco de dados.");
      })();

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting vehicle:", err);
      res.status(500).json({ success: false, message: "Erro ao excluir: " + err.message });
    }
  });

  // Clients
  app.get("/api/clients", (_req, res) => {
    try {
      const clients = db.prepare("SELECT * FROM clients ORDER BY name ASC").all();
      res.json(clients);
    } catch (err: any) {
      console.error("Error fetching clients:", err);
      res.status(500).json({ success: false, message: "Erro ao buscar clientes: " + err.message });
    }
  });

  app.post("/api/clients", (req, res) => {
    try {
      const { name, email, phone, document, rg, address } = req.body;
      const info = db.prepare(`
        INSERT INTO clients (name, email, phone, document, rg, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, email, phone, document, rg || "", address || "");
      res.json({ id: Number(info.lastInsertRowid) });
    } catch (err: any) {
      console.error("Error creating client:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/clients/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, document, rg, address } = req.body;
      db.prepare(`
        UPDATE clients
        SET name = ?, email = ?, phone = ?, document = ?, rg = ?, address = ?
        WHERE id = ?
      `).run(name, email, phone, document, rg || "", address || "", id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating client:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/clients/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("UPDATE sales SET client_id = NULL WHERE client_id = ?").run(id);
      db.prepare("DELETE FROM client_files WHERE client_id = ?").run(id);
      const result = db.prepare("DELETE FROM clients WHERE id = ?").run(id);
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Cliente não encontrado." });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting client:", err);
      res.status(500).json({ success: false, message: "Erro ao excluir cliente: " + err.message });
    }
  });

  // Expenses
  app.get("/api/expenses", (_req, res) => {
    try {
      const expenses = db.prepare(`
        SELECT e.*, v.brand, v.model
        FROM expenses e
        JOIN vehicles v ON e.vehicle_id = v.id
        ORDER BY e.date DESC
      `).all();
      res.json(expenses);
    } catch (err: any) {
      console.error("Error fetching expenses:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/expenses", (req, res) => {
    try {
      const { vehicle_id, description, amount, date, notes } = req.body;
      const info = db.prepare(`
        INSERT INTO expenses (vehicle_id, description, amount, date, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(vehicle_id, description, amount, date, notes);
      res.json({ id: Number(info.lastInsertRowid) });
    } catch (err: any) {
      console.error("Error creating expense:", err);
      res.status(500).json({ success: false, message: "Erro ao cadastrar despesa: " + err.message });
    }
  });

  app.delete("/api/expenses/:id", (req, res) => {
    try {
      const { id } = req.params;
      const result = db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Despesa não encontrada." });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting expense:", err);
      res.status(500).json({ success: false, message: "Erro ao excluir despesa: " + err.message });
    }
  });

  // Sales
  app.get("/api/sales", (_req, res) => {
    try {
      const sales = db.prepare(`
        SELECT s.*, v.brand, v.model, c.name as client_name
        FROM sales s
        JOIN vehicles v ON s.vehicle_id = v.id
        LEFT JOIN clients c ON s.client_id = c.id
        ORDER BY s.sale_date DESC
      `).all();
      res.json(sales);
    } catch (err: any) {
      console.error("Error fetching sales:", err);
      res.status(500).json({ success: false, message: "Erro ao buscar vendas: " + err.message });
    }
  });

  app.post("/api/sales", (req, res) => {
    const { vehicle_id, client_id, sale_date, sale_price, payment_method, notes } = req.body;

    try {
      const saleId = db.transaction(() => {
        const vehicle = db.prepare("SELECT purchase_value FROM vehicles WHERE id = ?").get(vehicle_id) as any;
        if (!vehicle) throw new Error("Veículo não encontrado");

        const expenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE vehicle_id = ?").get(vehicle_id) as any;
        const totalExpenses = Number(expenses?.total || 0);
        const profit = Number(sale_price) - (Number(vehicle.purchase_value || 0) + totalExpenses);

        const info = db.prepare(`
          INSERT INTO sales (vehicle_id, client_id, sale_date, sale_price, payment_method, profit, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(vehicle_id, client_id, sale_date, sale_price, payment_method, profit, notes);

        db.prepare("UPDATE vehicles SET status = 'Vendido' WHERE id = ?").run(vehicle_id);
        return Number(info.lastInsertRowid);
      })();

      res.json({ id: saleId });
    } catch (err: any) {
      console.error("Error registering sale:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/sales/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.transaction(() => {
        const sale = db.prepare("SELECT vehicle_id FROM sales WHERE id = ?").get(id) as any;
        if (sale?.vehicle_id) {
          db.prepare("UPDATE vehicles SET status = 'Em Estoque' WHERE id = ?").run(sale.vehicle_id);
        }
        db.prepare("DELETE FROM sales WHERE id = ?").run(id);
      })();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting sale:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Checklists (antigo por veículo)
  app.get("/api/checklists", (_req, res) => {
    try {
      const checklists = db.prepare(`
        SELECT ck.*, v.brand, v.model, v.plate, c.name as client_name
        FROM checklists ck
        JOIN vehicles v ON ck.vehicle_id = v.id
        LEFT JOIN clients c ON ck.client_id = c.id
        ORDER BY ck.created_at DESC
      `).all();
      res.json(checklists);
    } catch (err: any) {
      console.error("Error fetching checklists:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/checklists/:vehicleId", (req, res) => {
    try {
      const { vehicleId } = req.params;
      const checklist = db.prepare("SELECT * FROM checklists WHERE vehicle_id = ? ORDER BY created_at DESC LIMIT 1").get(vehicleId);
      const parsed = checklist
        ? {
            ...(checklist as any),
            media_urls: safeJsonParse<string[]>((checklist as any).media_urls, []),
          }
        : null;
      res.json(parsed);
    } catch (err: any) {
      console.error("Error fetching checklist:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/checklists", (req, res) => {
    try {
      const { vehicle_id, client_id, observations, media_urls } = req.body;
      const info = db.prepare(`
        INSERT INTO checklists (vehicle_id, client_id, observations, media_urls)
        VALUES (?, ?, ?, ?)
      `).run(vehicle_id, client_id || null, observations, JSON.stringify(media_urls || []));
      res.json({ id: Number(info.lastInsertRowid) });
    } catch (err: any) {
      console.error("Error creating checklist:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/checklists/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { observations, media_urls } = req.body;
      const result = db.prepare(`
        UPDATE checklists
        SET observations = ?, media_urls = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(observations || "", JSON.stringify(media_urls || []), id);

      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Checklist não encontrado." });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating checklist:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/checklists/:id", (req, res) => {
    try {
      const { id } = req.params;
      const result = db.prepare("DELETE FROM checklists WHERE id = ?").run(id);
      if (result.changes === 0) {
        return res.status(404).json({ success: false, message: "Checklist não encontrado." });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting checklist:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Sale checklists (novo)
  app.get("/api/sale-checklists", (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT sc.*, v.brand as vehicle_brand, v.model as vehicle_model, v.plate as vehicle_plate, c.name as client_name
        FROM sale_checklists sc
        JOIN vehicles v ON sc.vehicle_id = v.id
        JOIN clients c ON sc.client_id = c.id
        ORDER BY sc.checklist_date DESC, sc.id DESC
      `).all() as any[];

      const filesStmt = db.prepare(`SELECT * FROM sale_checklist_files WHERE checklist_id = ? ORDER BY id DESC`);
      const result = rows.map((row) => ({
        ...row,
        files: filesStmt.all(row.id),
      }));

      res.json(result);
    } catch (err: any) {
      console.error("Error fetching sale checklists:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/sale-checklists", (req, res) => {
    try {
      const { vehicle_id, client_id, checklist_date, observations } = req.body;
      const info = db.prepare(`
        INSERT INTO sale_checklists (vehicle_id, client_id, checklist_date, observations)
        VALUES (?, ?, ?, ?)
      `).run(vehicle_id, client_id, checklist_date, observations || "");
      res.json({ id: Number(info.lastInsertRowid) });
    } catch (err: any) {
      console.error("Error creating sale checklist:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/sale-checklists/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.transaction(() => {
        db.prepare("DELETE FROM sale_checklist_files WHERE checklist_id = ?").run(id);
        const result = db.prepare("DELETE FROM sale_checklists WHERE id = ?").run(id);
        if (result.changes === 0) throw new Error("Checklist não encontrado.");
      })();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting sale checklist:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Stats
  app.get("/api/stats", (_req, res) => {
    try {
      const totalStock = db.prepare(`
        SELECT
          COUNT(*) as count,
          SUM(purchase_value) as total_purchase_value,
          SUM(sale_value) as total_sale_value
        FROM vehicles
        WHERE status != 'Vendido'
      `).get() as any;

      const monthlySales = db.prepare(`
        SELECT
          SUM(sale_price) as revenue,
          SUM(profit) as profit
        FROM sales
        WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now')
      `).get() as any;

      const monthlyExpenses = db.prepare(`
        SELECT SUM(amount) as total_expenses
        FROM expenses
        WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
      `).get() as any;

      const totalSalesRow = db.prepare(`SELECT SUM(sale_price) as total_sales, SUM(profit) as total_profit FROM sales`).get() as any;
      const totalPurchasesRow = db.prepare(`SELECT SUM(purchase_value) as total_purchases FROM vehicles`).get() as any;
      const totalExpensesRow = db.prepare(`SELECT SUM(amount) as total_expenses FROM expenses`).get() as any;

      const totalExpenses = Number(monthlyExpenses?.total_expenses || 0);
      const salesProfit = Number(monthlySales?.profit || 0);
      const totalSales = Number(totalSalesRow?.total_sales || 0);
      const totalPurchases = Number(totalPurchasesRow?.total_purchases || 0);
      const overallExpenses = Number(totalExpensesRow?.total_expenses || 0);
      const totalProfit = Number(totalSalesRow?.total_profit || 0) - overallExpenses;
      const cashValue = totalSales - totalPurchases - overallExpenses;

      res.json({
        stockCount: Number(totalStock?.count || 0),
        stockValue: Number(totalStock?.total_purchase_value || 0),
        stockSaleValue: Number(totalStock?.total_sale_value || 0),
        monthlyRevenue: Number(monthlySales?.revenue || 0),
        monthlyExpenses: totalExpenses,
        monthlyProfit: salesProfit,
        cashValue,
        totalSales,
        totalPurchases,
        totalProfit,
      });
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      res.status(500).json({ success: false, message: "Erro ao buscar estatísticas: " + err.message });
    }
  });

  // Monthly reports
  app.get("/api/reports/monthly", (_req, res) => {
    try {
      const monthlyData: Record<string, any> = {};

      const salesByMonth = db.prepare(`
        SELECT
          strftime('%Y-%m', sale_date) as month,
          SUM(sale_price) as revenue,
          SUM(profit) as gross_profit
        FROM sales
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all() as any[];

      const expensesByMonth = db.prepare(`
        SELECT
          strftime('%Y-%m', date) as month,
          SUM(amount) as total_expenses
        FROM expenses
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all() as any[];

      const purchasesByMonth = db.prepare(`
        SELECT
          strftime('%Y-%m', purchase_date) as month,
          SUM(purchase_value) as total_purchases
        FROM vehicles
        WHERE purchase_date IS NOT NULL AND purchase_date != ''
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `).all() as any[];

      const initMonth = (month: string) => {
        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            revenue: 0,
            expenses: 0,
            purchases: 0,
            grossProfit: 0,
            netProfit: 0,
            cashBalance: 0,
            salesDetails: [],
            expenseDetails: [],
            purchaseDetails: [],
            cashflow: [],
          };
        }
      };

      salesByMonth.forEach((s) => {
        initMonth(s.month);
        monthlyData[s.month].revenue = Number(s.revenue || 0);
        monthlyData[s.month].grossProfit = Number(s.gross_profit || 0);
      });

      expensesByMonth.forEach((e) => {
        initMonth(e.month);
        monthlyData[e.month].expenses = Number(e.total_expenses || 0);
      });

      purchasesByMonth.forEach((p) => {
        initMonth(p.month);
        monthlyData[p.month].purchases = Number(p.total_purchases || 0);
      });

      const allExpenses = db.prepare(`
        SELECT e.*, v.brand, v.model, v.plate
        FROM expenses e
        JOIN vehicles v ON e.vehicle_id = v.id
        ORDER BY e.date DESC
      `).all() as any[];

      for (const e of allExpenses) {
        const month = (e.date || "").substring(0, 7);
        if (!month) continue;
        initMonth(month);
        monthlyData[month].expenseDetails.push(e);
        monthlyData[month].cashflow.push({
          type: "Despesa",
          date: e.date,
          direction: "out",
          amount: Number(e.amount || 0),
          description: `${e.description} (${e.brand} ${e.model})`,
        });
      }

      const allSales = db.prepare(`
        SELECT s.*, v.brand, v.model, v.plate, c.name as client_name
        FROM sales s
        JOIN vehicles v ON s.vehicle_id = v.id
        LEFT JOIN clients c ON s.client_id = c.id
        ORDER BY s.sale_date DESC
      `).all() as any[];

      for (const s of allSales) {
        const month = (s.sale_date || "").substring(0, 7);
        if (!month) continue;
        initMonth(month);
        monthlyData[month].salesDetails.push(s);
        monthlyData[month].cashflow.push({
          type: "Venda",
          date: s.sale_date,
          direction: "in",
          amount: Number(s.sale_price || 0),
          description: `${s.brand} ${s.model} (${s.plate || "s/placa"}) - ${s.client_name || "Cliente"}`,
        });
      }

      const allPurchases = db.prepare(`
        SELECT id, brand, model, plate, purchase_date, purchase_value
        FROM vehicles
        WHERE purchase_date IS NOT NULL AND purchase_date != ''
        ORDER BY purchase_date DESC
      `).all() as any[];

      for (const v of allPurchases) {
        const month = (v.purchase_date || "").substring(0, 7);
        if (!month) continue;
        initMonth(month);
        monthlyData[month].purchaseDetails.push(v);
        monthlyData[month].cashflow.push({
          type: "Compra",
          date: v.purchase_date,
          direction: "out",
          amount: Number(v.purchase_value || 0),
          description: `${v.brand} ${v.model} (${v.plate || "s/placa"})`,
        });
      }

      Object.values(monthlyData).forEach((m: any) => {
        m.netProfit = Number(m.grossProfit || 0) - Number(m.expenses || 0);
        m.cashBalance = Number(m.revenue || 0) - Number(m.expenses || 0) - Number(m.purchases || 0);
        m.cashflow.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));
      });

      const result = Object.values(monthlyData).sort((a: any, b: any) => b.month.localeCompare(a.month));
      res.json(result);
    } catch (err: any) {
      console.error("Error fetching monthly reports:", err);
      res.status(500).json({ success: false, message: "Erro ao buscar relatórios: " + err.message });
    }
  });

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (err?.message?.includes?.("Tipo de arquivo")) {
      return res.status(400).json({ success: false, message: err.message });
    }

    return next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();




