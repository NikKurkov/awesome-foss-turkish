#!/usr/bin/env node
// Builds every markdown list from data/apps.json and data/related-lists.json.
// Usage: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apps = JSON.parse(readFileSync(join(root, "data/apps.json"), "utf8"));
const related = JSON.parse(readFileSync(join(root, "data/related-lists.json"), "utf8"));
const UPDATED = new Date().toISOString().slice(0, 10);

// Which OS buckets each raw platform value belongs to.
const PLATFORM_MAP = {
  "Linux": ["linux"], "Windows": ["windows"], "macOS": ["macos"],
  "Android": ["android"], "iOS": ["ios"],
  "Mobil": ["android", "ios"],
  "Masaüstü": ["linux", "windows", "macos"],
  "Tümü": ["linux", "windows", "macos", "android", "ios"],
  "Web": ["web"], "Sunucu": ["selfhosted"], "Sunucu + istemciler": ["selfhosted"],
  "Docker": ["selfhosted"], "Ubuntu/Debian": ["selfhosted"], "Bare metal": ["selfhosted"],
  "CLI": ["cli"],
  "VS Code": ["extensions"], "JetBrains": ["extensions"], "Tarayıcı eklentisi": ["extensions"],
  "Laravel paketi": ["extensions"], "Repo": ["extensions"],
};
const PLATFORMS = {
  linux: "Linux", windows: "Windows", macos: "macOS", android: "Android", ios: "iOS",
  web: "Web", selfhosted: "Self-hosted (sunucu)", cli: "Komut satırı (CLI)",
  extensions: "Eklenti, paket ve repolar",
};
const LICENSES = {
  osi: { title: "OSI onaylı açık kaynak", desc: "MIT, GPL, AGPL, Apache, MPL, BSD gibi OSI onaylı lisanslar." },
  restricted: { title: "Kısıtlı lisans", desc: "Source-available veya fair-code (BSL, FSL, Sustainable Use, Elastic vb.). Kodu okuyabilir ve kendin barındırabilirsin ama ticari kullanım sınırlı olabilir." },
};

const bucketsOf = a => [...new Set(a.platforms.flatMap(p => PLATFORM_MAP[p] ?? []))];
const badges = a => [
  a.license_type === "osi" ? "OSI" : "⚠️ Kısıtlı",
  a.laravel ? "🟥 Laravel" : null,
  a.trending ? "🔥 Trend" : null,
].filter(Boolean).join(" · ");
const cell = s => String(s).replace(/\|/g, "\\|");

function table(list, { withCategory = false } = {}) {
  const head = withCategory
    ? "| Alternatif | Yerine geçtiği | Kategori | Lisans | Platform | Açıklama |\n| --- | --- | --- | --- | --- | --- |"
    : "| Alternatif | Yerine geçtiği | Lisans | Platform | Açıklama |\n| --- | --- | --- | --- | --- |";
  const rows = [...list]
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map(a => {
      const cols = [
        `[${cell(a.name)}](${a.url})`, cell(a.replaces),
        ...(withCategory ? [`[${cell(a.category)}](../categories/${a.category_slug}.md)`] : []),
        `${badges(a)}<br><sub>${cell(a.license)}</sub>`,
        cell(a.platforms.join(", ")), cell(a.description),
      ];
      return `| ${cols.join(" | ")} |`;
    });
  return `${head}\n${rows.join("\n")}`;
}

const LEGEND = "**Etiketler:** OSI = OSI onaylı açık kaynak · ⚠️ Kısıtlı = source-available/fair-code · 🟥 Laravel = Laravel ile yazılmış · 🔥 Trend = 2025-2026'da hızla yükselen";
const backLink = "[← Ana sayfa](../README.md)";

function write(rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content.trimEnd() + "\n");
}

// Clean generated folders so removed categories don't linger.
for (const d of ["categories", "platforms", "licenses"]) rmSync(join(root, d), { recursive: true, force: true });

// ---- categories/<slug>.md
const categories = [...new Map(apps.map(a => [a.category_slug, a.category])).entries()];
for (const [slug, title] of categories) {
  const list = apps.filter(a => a.category_slug === slug);
  write(`categories/${slug}.md`, `# ${title}

${backLink}

${list.length} araç. ${LEGEND}

${table(list)}
`);
}

// ---- platforms/<os>.md
const platformCounts = {};
for (const [key, title] of Object.entries(PLATFORMS)) {
  const list = apps.filter(a => bucketsOf(a).includes(key));
  platformCounts[key] = list.length;
  if (!list.length) continue;
  write(`platforms/${key}.md`, `# ${title}

${backLink}

${list.length} araç. ${LEGEND}

${table(list, { withCategory: true })}
`);
}

// ---- licenses/<type>.md
const licenseCounts = {};
for (const [key, { title, desc }] of Object.entries(LICENSES)) {
  const list = apps.filter(a => a.license_type === key);
  licenseCounts[key] = list.length;
  write(`licenses/${key}.md`, `# ${title}

${backLink}

${desc} ${list.length} araç.

${table(list, { withCategory: true })}
`);
}

// ---- special lists
const laravel = apps.filter(a => a.laravel);
const trending = apps.filter(a => a.trending);
write("lists/laravel.md", `# Laravel ile yazılmış uygulamalar

${backLink}

Kaynak kodu Laravel olan, kendin barındırabileceğin ve inceleyip katkı verebileceğin ${laravel.length} uygulama.

${table(laravel, { withCategory: true })}
`);
write("lists/trending.md", `# Trend ve yeni projeler (2025-2026)

${backLink}

GitHub'da son dönemde hızla yıldız toplayan ${trending.length} proje. Hızlı yükselen bazı repoların lisansı belirsiz olabiliyor veya yıldızları şişirilmiş olabiliyor; kurmadan önce kodu incele.

${table(trending, { withCategory: true })}
`);

// ---- README.md
const osi = licenseCounts.osi;
const relatedRows = related.map(r =>
  `| ${r.links.map(l => `[${cell(l.name)}](${l.url})`).join(" · ")} | ${cell(r.tag)} | ${cell(r.description)} |`
).join("\n");

write("README.md", `# Awesome FOSS Alternatives [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> Ücretli veya kapalı kaynak uygulamaların yerine kullanılabilecek açık kaynak alternatifler; alana, işletim sistemine ve lisansa göre düzenlenmiş.

**${apps.length} araç · ${categories.length} kategori · ${osi} OSI lisanslı** · Son güncelleme: ${UPDATED}

${LEGEND}

## İçindekiler

- [Alana göre](#alana-göre)
- [İşletim sistemine göre](#işletim-sistemine-göre)
- [Lisansa göre](#lisansa-göre)
- [Özel listeler](#özel-listeler)
- [Benzer listeler](#benzer-listeler)
- [Katkıda bulunma](#katkıda-bulunma)

## Alana göre

| Kategori | Araç sayısı |
| --- | --- |
${categories.map(([slug, title]) => `| [${title}](categories/${slug}.md) | ${apps.filter(a => a.category_slug === slug).length} |`).join("\n")}

## İşletim sistemine göre

| Platform | Araç sayısı |
| --- | --- |
${Object.entries(PLATFORMS).filter(([k]) => platformCounts[k]).map(([k, t]) => `| [${t}](platforms/${k}.md) | ${platformCounts[k]} |`).join("\n")}

## Lisansa göre

| Lisans türü | Araç sayısı | Açıklama |
| --- | --- | --- |
${Object.entries(LICENSES).map(([k, { title, desc }]) => `| [${title}](licenses/${k}.md) | ${licenseCounts[k]} | ${desc} |`).join("\n")}

## Özel listeler

- [🟥 Laravel ile yazılmış uygulamalar](lists/laravel.md) (${laravel.length})
- [🔥 Trend ve yeni projeler](lists/trending.md) (${trending.length})

## Benzer listeler

| Liste | Odak | Açıklama |
| --- | --- | --- |
${relatedRows}

## Katkıda bulunma

Bu repodaki markdown dosyaları elle düzenlenmez, hepsi [\`data/apps.json\`](data/apps.json) dosyasından üretilir. Detaylar için [CONTRIBUTING.md](CONTRIBUTING.md).

## Lisans

[![CC0](https://licensebuttons.net/p/zero/1.0/88x31.png)](LICENSE) Liste içeriği CC0-1.0 ile kamu malıdır.
`);

console.log(`Built: ${apps.length} apps, ${categories.length} categories, ${Object.values(platformCounts).filter(Boolean).length} platform pages.`);
