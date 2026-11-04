import fs from 'fs';
const i18n = fs.readFileSync('www/i18n.js','utf8');
const game = fs.readFileSync('www/game.js','utf8');
const html = fs.readFileSync('www/index.html','utf8');
const DICT = eval('('+i18n.match(/const DICT = (\{[\s\S]*?^\s{2}\});/m)[1]+')');
const keys = Object.keys(DICT.ru);
const miss = {uk:[], en:[]};
for (const k of keys) {
  for (const L of ['uk','en']) if (DICT[L][k]==null) miss[L].push(k);
}
const used = new Set([
  ...[...game.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]),
  ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]),
  ...[...game.matchAll(/nameKey:\s*'([^']+)'/g)].map(m=>m[1]),
  ...[...game.matchAll(/descKey:\s*'([^']+)'/g)].map(m=>m[1]),
  ...[...game.matchAll(/labelKey:\s*'([^']+)'/g)].map(m=>m[1]),
  ...DICT.ru && Object.keys(DICT.ru).filter(k=>k.startsWith('boss')),
]);
// also LANG_OPTS keys
['lang_auto','lang_ru','lang_uk','lang_en','lang_auto_desc','language_section'].forEach(k=>used.add(k));
const unused = keys.filter(k=>!used.has(k));
const missingUsed = [...used].filter(k=>!keys.includes(k));
// leftover cyrillic in game (non-comment)
const cyr = [...game.matchAll(/['"]([^'"\n]*[А-Яа-яЁёІіЇїЄє][^'"\n]*)['"]/g)].map(m=>m[1]).filter(s=>!/v4\.0/.test(s));
const htmlKeys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]);
const htmlMissing = htmlKeys.filter(k=>!keys.includes(k));
const out = { keyCount: keys.length, miss, unused, missingUsed, cyrillicInGame: cyr, htmlMissing, htmlKeys: htmlKeys.length };
fs.mkdirSync('shots/v406',{recursive:true});
fs.writeFileSync('shots/v406/i18n-coverage.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
if (miss.uk.length||miss.en.length||missingUsed.length||cyr.length||htmlMissing.length) process.exit(1);
