import { DatabaseSync } from "node:sqlite";
// Üretilen test verisini yerel D1 (wrangler/miniflare) veritabanına yükler. Sunucu kapalıyken çalıştırın.
// Tüm kullanıcıların şifresi Kaizen123! olur ve şifre değiştirme istenmez.
import { readFileSync, readdirSync } from "node:fs";
import { pbkdf2Sync, randomUUID } from "node:crypto";
const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/";
const file = dir + readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
const db = new DatabaseSync(file);
const users = JSON.parse(readFileSync(new URL("./users.json", import.meta.url), "utf8"));
const state = readFileSync(new URL("./state.json", import.meta.url), "utf8");
const salt = randomUUID();
const pw = salt + ":" + pbkdf2Sync("Kaizen123!", salt, 100000, 32, "sha256").toString("hex");
// Bildirim sütunları eski veritabanında yoksa eklenir. Adresler gerçek değildir (.test alan adı hiçbir yere gitmez).
for (const sql of ["ALTER TABLE users ADD COLUMN email TEXT", "ALTER TABLE users ADD COLUMN notify TEXT"]) try { db.exec(sql); } catch {}
db.exec("DELETE FROM users; DELETE FROM sessions; DELETE FROM workspace;");
try { db.exec("DELETE FROM outbox;"); } catch {}
const ins = db.prepare("INSERT INTO users (id,username,name,department,directorate,role,manager,password,must_change,active,failures,locked_until,email,notify) VALUES (?,?,?,?,?,?,?,?,0,?,0,0,?,?)");
users.forEach((u, i) => ins.run(u.id, u.username, u.name, u.department, u.directorate, u.role, u.manager || "", pw, u.active, u.username + "@ornek.test", i % 7 === 3 ? "digest" : "instant"));
db.prepare("INSERT INTO workspace (id,data,version) VALUES ('main',?,1)").run(state);
console.log("yüklendi", file, users.length);
