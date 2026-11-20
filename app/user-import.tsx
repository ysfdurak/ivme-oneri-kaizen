"use client";
import { getLocale, untranslate } from "../lib/i18n";
// Toplu kullanıcı yükleme: Excel (.xlsx), CSV ya da Excel'den kopyala-yapıştır.
// Akış: dosyayı oku → sütunları eşleştir → sunucuda deneme (dryRun) → onayla → yeni kişilerin geçici şifrelerini indir.
import React, { useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { csvSafe } from "../lib/csv-cell";

type Row = {
  name: string;
  username: string;
  email: string;
  department: string;
  role: string;
  manager: string;
};

// Başlık satırındaki olası yazımlar → alan adı. Büyük/küçük harf ve Türkçe karakter farkı önemsizdir.
const HEADERS: Record<keyof Row, string[]> = {
  name: ["ad soyad", "ad", "adı soyadı", "isim", "name", "full name"],
  username: ["kullanıcı adı", "kullanici adi", "username", "sicil", "sicil no"],
  email: ["e-posta", "eposta", "e-mail", "email", "mail"],
  department: ["departman", "bölüm", "birim", "department"],
  role: ["rol", "role", "yetki"],
  manager: ["yönetici kullanıcı adı", "yönetici", "yonetici", "manager", "manager username"],
};
const norm = (s: any) =>
  String(s ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ");

function toRows(table: any[][]): { rows: Row[]; missing: string[] } {
  const head = (table[0] || []).map(norm);
  const index = Object.fromEntries(
    (Object.keys(HEADERS) as (keyof Row)[]).map((k) => [
      k,
      head.findIndex((h) => HEADERS[k].includes(h)),
    ]),
  ) as Record<keyof Row, number>;
  const missing = (["name", "username", "department"] as (keyof Row)[])
    .filter((k) => index[k] < 0)
    .map((k) => HEADERS[k][0]);
  const rows = table
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((r) => {
      const get = (k: keyof Row) =>
        index[k] >= 0 ? String(r[index[k]] ?? "").trim() : "";
      return {
        name: get("name"),
        username: get("username"),
        email: get("email"),
        department: get("department"),
        // Rol İngilizce yazılmışsa ("Employee") Türkçe adına döner; sunucu rolü Türkçe adından tanır.
        role: untranslate(get("role")) || "Çalışan",
        manager: get("manager"),
      };
    });
  return { rows, missing };
}

// Basit CSV/TSV ayrıştırıcı: tırnak içindeki ayraçları korur; ayraç ilk satıra bakılarak seçilir.
export function parseText(text: string): any[][] {
  const first = text.split(/\r?\n/)[0] || "";
  const sep = first.includes("\t")
    ? "\t"
    : first.split(";").length > first.split(",").length
      ? ";"
      : ",";
  const out: any[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') ((cell += '"'), i++);
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) (row.push(cell), (cell = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      (row.push(cell), out.push(row), (row = []), (cell = ""));
    } else cell += c;
  }
  if (cell || row.length) (row.push(cell), out.push(row));
  return out;
}

export function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csvCell = (raw: string) => {
  const v = csvSafe(raw);
  return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

export default function UserImport({
  onClose,
  onDone,
  alert,
}: {
  onClose: () => void;
  onDone: () => Promise<void> | void;
  alert: (m: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    create: number;
    update: number;
  } | null>(null);
  const [created, setCreated] = useState<
    { name: string; username: string; password: string }[] | null
  >(null);
  const [busy, setBusy] = useState(false);

  function load(table: any[][]) {
    setError("");
    setErrors([]);
    setPreview(null);
    const { rows, missing } = toRows(table);
    if (missing.length) {
      setRows([]);
      return setError(
        "Başlık satırında bulunamayan sütun: " + missing.join(", ") + ".",
      );
    }
    if (!rows.length) return setError("Başlık dışında dolu satır yok.");
    setRows(rows);
    send(rows, true);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        // read-excel-file 9: varsayılan dışa aktarım yok; readSheet ilk sayfanın satırlarını döndürür.
        const { readSheet } = await import("read-excel-file/browser");
        load((await readSheet(f)) as any[][]);
      } else load(parseText(await f.text()));
    } catch {
      setError("Dosya okunamadı. .xlsx ya da .csv kaydedip tekrar deneyin.");
    }
  }

  async function send(list: Row[], dryRun: boolean) {
    setBusy(true);
    setError("");
    setErrors([]);
    try {
      const r = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importUsers", rows: list, dryRun }),
      });
      const b: any = await r.json();
      if (!r.ok) {
        setPreview(null);
        setError(b.error || "Yükleme yapılamadı.");
        setErrors(b.errors || []);
        return;
      }
      if (dryRun) setPreview(b.preview);
      else {
        setCreated(b.created || []);
        setPreview(null);
        await onDone();
        alert(
          `${b.created.length} kullanıcı eklendi, ${b.updated} kullanıcı güncellendi.`,
        );
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const template = () =>
    getLocale() === "en"
      ? download(
          "ivme-user-template.csv",
          "Full name;Username;E-mail;Department;Role;Manager username\n" +
            "Jane Smith;jane.smith;jane.smith@example.com;Production;Employee;mark.taylor\n",
        )
      : download(
          "ivme-kullanici-sablonu.csv",
          "Ad soyad;Kullanıcı adı;E-posta;Departman;Rol;Yönetici kullanıcı adı\n" +
            "Ayşe Yılmaz;ayse.yilmaz;ayse.yilmaz@ornek.com;Üretim;Çalışan;mehmet.kaya\n",
        );

  return (
    <section className="panel import-panel" aria-labelledby="import-title">
      <div className="section-heading">
        <h2 id="import-title">
          <FileSpreadsheet size={18} /> Excel'den kullanıcı yükle
        </h2>
        <button
          className="icon-button"
          aria-label="Yüklemeyi kapat"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {created ? (
        <div className="import-result">
          <p>
            <b>Yükleme tamamlandı.</b>{" "}
            {created.length
              ? `${created.length} yeni kişiye tek kullanımlık şifre verildi. Listeyi indirip kişilere güvenli bir yoldan iletin; bu ekran kapanınca şifreler bir daha gösterilmez.`
              : "Yeni kişi yok; mevcut kayıtlar güncellendi."}
          </p>
          <div className="buttons">
            {created.length > 0 && (
              <button
                className="primary"
                onClick={() =>
                  download(
                    "ivme-gecici-sifreler.csv",
                    "Ad soyad;Kullanıcı adı;Geçici şifre\n" +
                      created
                        .map((c) =>
                          [c.name, c.username, c.password]
                            .map(csvCell)
                            .join(";"),
                        )
                        .join("\n"),
                  )
                }
              >
                <Download size={16} /> Geçici şifreleri indir
              </button>
            )}
            <button className="secondary" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="muted">
            Sütunlar: <b>Ad soyad, Kullanıcı adı, Departman</b> (zorunlu),
            E-posta, Rol, Yönetici kullanıcı adı. Aynı kullanıcı adı varsa kayıt
            güncellenir; şifresine dokunulmaz. Direktör ve genel müdür buradan
            eklenmez.{" "}
            <button className="text-button" onClick={template}>
              Şablonu indir
            </button>
          </p>
          <div className="import-inputs">
            <label className="secondary file-button">
              <Upload size={16} /> Dosya seç (.xlsx / .csv)
              <input
                type="file"
                className="sr-only"
                accept=".xlsx,.csv,.txt"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="muted">
              ya da Excel'den kopyalayıp yapıştırın:
            </span>
          </div>
          <textarea
            aria-label="Excel'den yapıştırılan satırlar"
            rows={4}
            placeholder={
              "Ad soyad\tKullanıcı adı\tE-posta\tDepartman\tRol\tYönetici kullanıcı adı"
            }
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="buttons">
            <button
              className="secondary"
              disabled={!paste.trim() || busy}
              onClick={() => load(parseText(paste))}
            >
              Yapıştırılanı kontrol et
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              {errors.length > 0 && (
                <ul>
                  {errors.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {rows.length > 0 && (
            <div className="table-scroll">
              <table className="mini-table">
                <caption className="sr-only">Yüklenecek ilk satırlar</caption>
                <thead>
                  <tr>
                    <th>Ad soyad</th>
                    <th>Kullanıcı adı</th>
                    <th>E-posta</th>
                    <th>Departman</th>
                    <th>Rol</th>
                    <th>Yönetici</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.username}</td>
                      <td>{r.email || "—"}</td>
                      <td>{r.department}</td>
                      <td>{r.role}</td>
                      <td>{r.manager || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && (
                <p className="muted">… ve {rows.length - 8} satır daha</p>
              )}
            </div>
          )}
          {preview && (
            <div className="buttons">
              <span>
                Kontrol tamam: <b>{preview.create}</b> yeni,{" "}
                <b>{preview.update}</b> güncelleme.
              </span>
              <button
                className="primary"
                disabled={busy}
                onClick={() => send(rows, false)}
              >
                Yüklemeyi onayla
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
