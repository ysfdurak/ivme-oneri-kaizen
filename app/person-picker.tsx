"use client";
// Kişi seçici: yazdıkça ad, departman veya kullanıcı adına göre süzülen liste (ad · departman · rol).
// Tek kişi veya çoklu seçim yapılabilir; klavyeyle (↑ ↓ Enter Esc) kullanılabilir.
import React, { useId, useMemo, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { ROLES, User } from "../lib/model";

type Props = {
  users: User[];
  value: string | string[];
  onChange: (v: any) => void;
  multiple?: boolean;
  required?: boolean;
  max?: number;
  exclude?: string[];
  placeholder?: string;
  label?: string;
};

const norm = (s: string) => s.toLocaleLowerCase("tr");

export default function PersonPicker({
  users,
  value,
  onChange,
  multiple = false,
  required = false,
  max = 5,
  exclude = [],
  placeholder = "Ad veya departman yaz…",
  label = "Kişi",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = multiple ? (value as string[]) || [] : value ? [value as string] : [];
  const byId = (id: string) => users.find((u) => u.id === id);
  const matches = useMemo(() => {
    const q = norm(query.trim());
    return users
      .filter((u) => u.active !== 0 && !exclude.includes(u.id) && !selected.includes(u.id))
      .filter((u) => !q || norm(u.name + " " + u.department + " " + (u.username || "")).includes(q))
      .sort((a, b) => {
        // Adı yazılan harflerle başlayanlar önce gelir.
        const sa = norm(a.name).startsWith(q) ? 0 : 1;
        const sb = norm(b.name).startsWith(q) ? 0 : 1;
        return sa - sb || a.name.localeCompare(b.name, "tr");
      })
      .slice(0, 8);
  }, [users, query, exclude, selected]);
  const full = multiple && selected.length >= max;

  function choose(u: User) {
    if (multiple) onChange([...selected, u.id].slice(0, max));
    else onChange(u.id);
    setQuery("");
    setOpen(false);
    setActive(0);
    if (multiple) setTimeout(() => inputRef.current?.focus(), 0);
  }
  function remove(id: string) {
    onChange(multiple ? selected.filter((x) => x !== id) : "");
  }

  const chip = (id: string) => {
    const u = byId(id);
    return (
      <span key={id} className="person-chip">
        {u?.name || "—"}
        {u?.department && <small>{u.department}</small>}
        <button
          type="button"
          aria-label={(u?.name || "Kişi") + " seçimini kaldır"}
          onClick={() => remove(id)}
        >
          <X size={13} />
        </button>
      </span>
    );
  };

  return (
    <div className="person-picker" onClick={(e) => e.preventDefault()}>
      {selected.length > 0 && <div className="chip-list inline">{selected.map(chip)}</div>}
      {(multiple || !selected.length) && !full && (
        <div className="picker-input">
          <Search size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label={label + " ara"}
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? listId + "-" + matches[active].id : undefined}
            value={query}
            placeholder={placeholder}
            onFocus={(e) => {
              setOpen(true);
              // Telefonda liste klavye ve alt menünün altında kalmasın diye alan ekranın ortasına alınır.
              if (window.innerWidth < 760)
                e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown")
                (e.preventDefault(), setActive((a) => Math.min(a + 1, matches.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              else if (e.key === "Enter" && open && matches[active])
                (e.preventDefault(), choose(matches[active]));
              else if (e.key === "Escape") (e.stopPropagation(), setOpen(false));
            }}
          />
        </div>
      )}
      {/* Zorunlu alan doğrulaması için görünmez alan. */}
      {required && (
        <input
          className="picker-required"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={selected.join(",")}
          onChange={() => {}}
          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("Listeden bir kişi seçin.")}
          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
        />
      )}
      {open && (multiple || !selected.length) && !full && (
        <ul className="picker-list" role="listbox" id={listId} aria-label={label + " önerileri"}>
          {matches.length === 0 && <li className="picker-empty">Eşleşen aktif kişi yok</li>}
          {matches.map((u, i) => (
            <li
              key={u.id}
              id={listId + "-" + u.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(u);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <b>{u.name}</b>
              <small>
                {u.department} · {ROLES[u.role]}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
