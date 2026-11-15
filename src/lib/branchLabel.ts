import { Branch } from '../types';
import { titleCaseWords } from './format';

/**
 * Human-readable branch labels for the owner console.
 *
 * The live `branches` rows were imported from the website, so names arrive with
 * HTML entities (`&#8211;`), inconsistent casing (`ENJOY DONER KEBAB Smigiel`)
 * and sometimes without a city at all (`Radhuni 2.0`).
 *
 * The `{BRAND}-{CITY}` code is the curated identifier and therefore authoritative
 * for the city. Street addresses are noisy (`... gmina`, `..., Poland`) and at
 * least one row names the wrong town, so an address may only refine the spelling
 * of a city the code already agrees with.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

const SEPARATOR = '–';
const COMBINING_MARKS = /[̀-ͯ]/g;
const POSTAL_CITY = /\d{2}-\d{3}\s+(.+)$/;
const TRAILING_SEPARATOR = /[\s–—-]+$/;

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match
    );
}

function foldDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/ł/g, 'l')
    .toLowerCase();
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

/** City from a Polish postal address, e.g. `Poznańska 3 62-050 Mosina`. */
function cityFromAddress(address: string): string {
  const captured = POSTAL_CITY.exec(address)?.[1] ?? '';
  const stripped = captured
    .replace(/,\s*poland$/i, '')
    .replace(/\bgmina\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped || stripped.split(' ').length > 4) return '';
  return titleCaseWords(stripped);
}

/** City from the `{BRAND}-{CITY}` code, e.g. `EDK-JANOWIEC-WLKP` -> `Janowiec Wlkp`. */
function cityFromCode(code: string): string {
  const tokens = code.split('-').filter(Boolean);
  if (tokens.length < 2) return '';
  return titleCaseWords(tokens.slice(1).join(' '));
}

/** The location part of a branch label, or an empty string when unknown. */
export function branchCity(branch: Pick<Branch, 'code' | 'address'>): string {
  const fromCode = cityFromCode(cleanText(branch.code ?? ''));
  const fromAddress = cityFromAddress(cleanText(branch.address ?? ''));
  if (!fromCode) return fromAddress;
  // Only trust the address when it is the same town, spelled with diacritics.
  return fromAddress && foldDiacritics(fromAddress) === foldDiacritics(fromCode)
    ? fromAddress
    : fromCode;
}

/**
 * Full brand name plus location, e.g. `Enjoy Doner Kebab – Mosina`.
 * A city already present in the name is moved behind the separator instead of
 * being duplicated, keeping the name's own spelling.
 */
export function branchDisplayName(
  branch: Pick<Branch, 'name' | 'code' | 'address'>
): string {
  const name = titleCaseWords(cleanText(branch.name ?? ''));
  const city = branchCity(branch);
  if (!name) return city || cleanText(branch.code ?? '') || 'Unnamed branch';
  if (!city) return name;

  const foldedName = foldDiacritics(name);
  const foldedCity = foldDiacritics(city);
  if (foldedName === foldedCity) return name;

  if (foldedName.endsWith(foldedCity)) {
    const splitAt = name.length - city.length;
    const brand = name.slice(0, splitAt).replace(TRAILING_SEPARATOR, '').trim();
    return brand ? `${brand} ${SEPARATOR} ${name.slice(splitAt)}` : name;
  }

  if (foldedName.includes(foldedCity)) return name;
  return `${name} ${SEPARATOR} ${city}`;
}

/** Secondary line: street address when known, otherwise the branch code. */
export function branchDisplayMeta(branch: Pick<Branch, 'code' | 'address'>): string {
  const address = cleanText(branch.address ?? '');
  const code = cleanText(branch.code ?? '');
  if (address && code) return `${address} • ${code}`;
  return address || code;
}