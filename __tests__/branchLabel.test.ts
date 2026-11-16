import {
  branchCity,
  branchDisplayMeta,
  branchDisplayName,
  branchSearchKey,
  decodeHtmlEntities,
  incomingOrderStoreName,
} from '../src/lib/branchLabel';
import { Branch } from '../src/types';

describe('decodeHtmlEntities', () => {
  it('decodes numeric, hex and named entities', () => {
    expect(decodeHtmlEntities('Enjoy Doner Kebab &#8211; Janowiec Wlkp')).toBe(
      'Enjoy Doner Kebab – Janowiec Wlkp'
    );
    expect(decodeHtmlEntities('A &#x2013; B')).toBe('A – B');
    expect(decodeHtmlEntities('Fish &amp; Chips')).toBe('Fish & Chips');
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b');
  });

  it('leaves unknown entities untouched', () => {
    expect(decodeHtmlEntities('&notanentity;')).toBe('&notanentity;');
  });
});

describe('branchDisplayName', () => {
  it('splits a trailing city out of the brand name', () => {
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab Mosina',
        code: 'EDK-MOSINA',
        address: 'Poznańska 3 62-050 Mosina',
      })
    ).toBe('Enjoy Doner Kebab – Mosina');
  });

  it('appends the city from the code when the name has none', () => {
    expect(
      branchDisplayName({ name: 'Radhuni 2.0', code: 'RAD-LESZNO', address: '' })
    ).toBe('Radhuni 2.0 – Leszno');
  });

  it('normalises shouting and lowercase city names', () => {
    expect(
      branchDisplayName({
        name: 'ENJOY DONER KEBAB Smigiel',
        code: 'EDK-SMIGIEL',
        address: '',
      })
    ).toBe('Enjoy Doner Kebab – Smigiel');
    expect(
      branchDisplayName({ name: 'Enjoy Doner Kebab buk', code: 'EDK-BUK', address: '' })
    ).toBe('Enjoy Doner Kebab – Buk');
  });

  it('decodes entities without duplicating the separator', () => {
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab &#8211; Janowiec Wlkp',
        code: 'EDK-JANOWIEC-WLKP',
        address: '',
      })
    ).toBe('Enjoy Doner Kebab – Janowiec Wlkp');
  });

  it('prefers the diacritic-correct city from the postal address', () => {
    expect(
      branchDisplayName({
        name: 'Crispy Chicken',
        code: 'CC-POZNAN',
        address: 'Głogowska 86/4, 60-262 Poznań',
      })
    ).toBe('Crispy Chicken – Poznań');
  });

  it('does not duplicate a city already inside the name', () => {
    expect(
      branchDisplayName({
        name: 'Food Circle Witkowo',
        code: 'FC-WITKOWO',
        address: '',
      })
    ).toBe('Food Circle – Witkowo');
    expect(
      branchDisplayName({ name: 'Kebab Poznań Centrum', code: 'KB-POZNAN', address: '' })
    ).toBe('Kebab Poznań Centrum');
  });

  it('falls back to the code when the name is empty', () => {
    expect(branchDisplayName({ name: '', code: 'EDK-BUK', address: '' })).toBe('Buk');
    expect(branchDisplayName({ name: '  ', code: '', address: '' })).toBe(
      'Unnamed branch'
    );
  });

  it('keeps a name intact when no city can be derived', () => {
    expect(branchDisplayName({ name: 'Radhuni', code: 'RADHUNI', address: '' })).toBe(
      'Radhuni'
    );
  });

  it('ignores the "gmina" suffix on postal addresses', () => {
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab Międzyzdroje',
        code: 'EDK-MIEDZYZDROJE',
        address: 'Norwida 5 (U5), 72-500 Międzyzdroje gmina',
      })
    ).toBe('Enjoy Doner Kebab – Międzyzdroje');
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab Piątek',
        code: 'EDK-PIATEK',
        address: 'Stodolniana 2a 99-120 Gmina Piątek',
      })
    ).toBe('Enjoy Doner Kebab – Piątek');
  });

  it('ignores a trailing country on postal addresses', () => {
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab Miejska Górka',
        code: 'EDK-MIEJSKA-GORKA',
        address: 'Ignacego Paderewskiego 22, 63-910 Miejska Górka, Poland',
      })
    ).toBe('Enjoy Doner Kebab – Miejska Górka');
  });

  it('trusts the code when the address names a different town', () => {
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab Poniec',
        code: 'EDK-PONIEC',
        address: 'ul.Armi Poznań 20 62-250 Czerniejewo',
      })
    ).toBe('Enjoy Doner Kebab – Poniec');
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab &#8211; Janowiec Wlkp',
        code: 'EDK-JANOWIEC-WLKP',
        address: 'Gnieźnieńska 2, 88-430 Janowiec Wielkopolski, Poland',
      })
    ).toBe('Enjoy Doner Kebab – Janowiec Wlkp');
  });

  it('upgrades ASCII code spelling from an agreeing address', () => {
    expect(
      branchDisplayName({
        name: 'Enjoy Doner Kebab Odolanow',
        code: 'EDK-ODOLANOW',
        address: 'Ul. Bartosza 1B 63-430 Odolanów gmina',
      })
    ).toBe('Enjoy Doner Kebab – Odolanow');
    expect(
      branchCity({
        code: 'EDK-RASZKOW',
        address: 'Raszkow rynek 3 63-440 Raszków',
      })
    ).toBe('Raszków');
  });
});

describe('branchCity', () => {
  it('reads the city after a Polish postal code', () => {
    expect(branchCity({ code: 'EDK-MOSINA', address: 'Poznańska 3 62-050 Mosina' })).toBe(
      'Mosina'
    );
  });

  it('falls back to the code suffix', () => {
    expect(branchCity({ code: 'EDK-JANOWIEC-WLKP', address: '' })).toBe('Janowiec Wlkp');
    expect(branchCity({ code: 'RADHUNI', address: '' })).toBe('');
  });
});

describe('branchDisplayMeta', () => {
  it('shows the address alongside the branch code', () => {
    expect(
      branchDisplayMeta({ code: 'EDK-MOSINA', address: 'Poznańska 3 62-050 Mosina' })
    ).toBe('Poznańska 3 62-050 Mosina • EDK-MOSINA');
  });

  it('shows the code alone when there is no address', () => {
    expect(branchDisplayMeta({ code: 'RAD-LESZNO', address: '' })).toBe('RAD-LESZNO');
  });
});

/** Every row of the live `branches` directory, with its expected label. */
const LIVE_DIRECTORY: Array<[string, string, string, string]> = [
  ['Crispy Chicken', 'CC-POZNAN', 'Głogowska 86/4, 60-262 Poznań', 'Crispy Chicken – Poznań'],
  ['ENJOY DONER KEBAB Smigiel', 'EDK-SMIGIEL', 'plac Rozstrzelanych 24 64-030 Smigiel', 'Enjoy Doner Kebab – Smigiel'],
  ['Enjoy Doner Kebab &#8211; Janowiec Wlkp', 'EDK-JANOWIEC-WLKP', 'Gnieźnieńska 2, 88-430 Janowiec Wielkopolski, Poland', 'Enjoy Doner Kebab – Janowiec Wlkp'],
  ['Enjoy Doner Kebab Bojanowo', 'EDK-BOJANOWO', 'Rynek 28 63-940 Bojanowo', 'Enjoy Doner Kebab – Bojanowo'],
  ['Enjoy Doner Kebab Bytom', 'EDK-BYTOM', 'Zabrzańska 163, 41-905 Bytom', 'Enjoy Doner Kebab – Bytom'],
  ['Enjoy Doner Kebab Czerniejewo', 'EDK-CZERNIEJEWO', 'Armii Poznań 20, 62-250 Czerniejewo, Poland', 'Enjoy Doner Kebab – Czerniejewo'],
  ['Enjoy Doner Kebab Dobiegniew', 'EDK-DOBIEGNIEW', 'Wyszyńskiego 10 66-520 Dobiegniew', 'Enjoy Doner Kebab – Dobiegniew'],
  ['Enjoy Doner Kebab Dobrzyca', 'EDK-DOBRZYCA', 'Koźmińska 14/16 63-330 Dobrzyca', 'Enjoy Doner Kebab – Dobrzyca'],
  ['Enjoy Doner Kebab Kleczew', 'EDK-KLECZEW', 'plac Wolności 7 62-540 Kleczew', 'Enjoy Doner Kebab – Kleczew'],
  ['Enjoy Doner Kebab Leszno', 'EDK-LESZNO', 'Dworcowa 5, 64-100 Leszno, Poland', 'Enjoy Doner Kebab – Leszno'],
  ['Enjoy Doner Kebab Miejska Górka', 'EDK-MIEJSKA-GORKA', 'Ignacego Paderewskiego 22, 63-910 Miejska Górka, Poland', 'Enjoy Doner Kebab – Miejska Górka'],
  ['Enjoy Doner Kebab Międzyzdroje', 'EDK-MIEDZYZDROJE', 'Norwida 5 (U5), 72-500 Międzyzdroje gmina', 'Enjoy Doner Kebab – Międzyzdroje'],
  ['Enjoy Doner Kebab Miłosław', 'EDK-MILOSLAW', 'ul. Kościelna 62-320 Miłosław gmina', 'Enjoy Doner Kebab – Miłosław'],
  ['Enjoy Doner Kebab Mosina', 'EDK-MOSINA', 'Poznańska 3 62-050 Mosina', 'Enjoy Doner Kebab – Mosina'],
  ['Enjoy Doner Kebab Obrzycko', 'EDK-OBRZYCKO', 'Dworcowa 4A 64-520 Obrzycko', 'Enjoy Doner Kebab – Obrzycko'],
  ['Enjoy Doner Kebab Odolanow', 'EDK-ODOLANOW', 'Ul. Bartosza 1B 63-430 Odolanów gmina', 'Enjoy Doner Kebab – Odolanow'],
  ['Enjoy Doner Kebab Piątek', 'EDK-PIATEK', 'Stodolniana 2a 99-120 Gmina Piątek', 'Enjoy Doner Kebab – Piątek'],
  ['Enjoy Doner Kebab Poniec', 'EDK-PONIEC', 'ul.Armi Poznań 20 62-250 Czerniejewo', 'Enjoy Doner Kebab – Poniec'],
  ['Enjoy Doner Kebab Poznan', 'EDK-POZNAN', 'ul.Głogowska 142 60-205 Poznan', 'Enjoy Doner Kebab – Poznan'],
  ['Enjoy Doner Kebab Przemęt', 'EDK-PRZEMET', 'Powstańców Wielkopolskich 29A, 64-234 Przemęt, Poland', 'Enjoy Doner Kebab – Przemęt'],
  ['Enjoy Doner Kebab Puszczykowo', 'EDK-PUSZCZYKOWO', 'Rynek 6 62-040 Puszczykowo', 'Enjoy Doner Kebab – Puszczykowo'],
  ['Enjoy Doner Kebab Raszkow', 'EDK-RASZKOW', 'Raszkow rynek 3 63-440 Raszków', 'Enjoy Doner Kebab – Raszkow'],
  ['Enjoy Doner Kebab Rawicz', 'EDK-RAWICZ', 'Rynek 36, 63-900 Rawicz, Poland', 'Enjoy Doner Kebab – Rawicz'],
  ['Enjoy Doner Kebab Rogowo', 'EDK-ROGOWO', 'Kościelna 4 88-420 Rogowo', 'Enjoy Doner Kebab – Rogowo'],
  ['Enjoy Doner Kebab Sułów', 'EDK-SULOW', 'Rynek 14, 56-300 Sułów', 'Enjoy Doner Kebab – Sułów'],
  ['Enjoy Doner Kebab Słupca', 'EDK-SLUPCA', 'Rotmistrza Witolda Pileckiego 5 62-400 Słupca', 'Enjoy Doner Kebab – Słupca'],
  ['Enjoy Doner Kebab Trzemeszno', 'EDK-TRZEMESZNO', 'pl Świętego Wojciecha 24 Trzemeszno', 'Enjoy Doner Kebab – Trzemeszno'],
  ['Enjoy Doner Kebab Wijewo', 'EDK-WIJEWO', 'Witosa 2A, 64-150 Wijewo', 'Enjoy Doner Kebab – Wijewo'],
  ['Enjoy Doner Kebab Witkowo', 'EDK-WITKOWO', 'Poznańska 1 62-230 Witkowo', 'Enjoy Doner Kebab – Witkowo'],
  ['Enjoy Doner Kebab Włoszakowice', 'EDK-WLOSZAKOWICE', 'ul.Powstańców Wielkopolskich 1A 64-140 Włoszakowice', 'Enjoy Doner Kebab – Włoszakowice'],
  ['Enjoy Doner Kebab Zagorow', 'EDK-ZAGOROW', 'ul.Duzy rynek 16 Zagórów', 'Enjoy Doner Kebab – Zagorow'],
  ['Enjoy Doner Kebab buk', 'EDK-BUK', 'plac Przemysława 20 Buk gmina', 'Enjoy Doner Kebab – Buk'],
  ['Food Circle Witkowo', 'FC-WITKOWO', 'Nowa 2 62-230 Witkowo', 'Food Circle – Witkowo'],
  ['Radhuni 2.0', 'RAD-LESZNO', '', 'Radhuni 2.0 – Leszno'],
];

describe('live branch directory', () => {
  it.each(LIVE_DIRECTORY)('%s', (name, code, address, expected) => {
    expect(branchDisplayName({ name, code, address })).toBe(expected);
  });

  it('never leaks an HTML entity or a raw code into a label', () => {
    for (const [name, code, address] of LIVE_DIRECTORY) {
      const label = branchDisplayName({ name, code, address });
      expect(label).not.toMatch(/&#?\w+;/);
      expect(label).not.toBe(code);
    }
  });
});

describe('branchSearchKey', () => {
  it('folds Polish diacritics so an ASCII query matches', () => {
    expect(branchSearchKey('Enjoy Doner Kebab Międzyzdroje')).toBe(
      'enjoy doner kebab miedzyzdroje'
    );
    expect(branchSearchKey('EDK-WŁOSZAKOWICE')).toBe('edk-wloszakowice');
    expect(branchSearchKey('Sułów')).toBe('sulow');
  });

  it('decodes entities and collapses whitespace', () => {
    expect(branchSearchKey('Enjoy Doner Kebab &#8211;  Janowiec Wlkp')).toBe(
      'enjoy doner kebab – janowiec wlkp'
    );
    expect(branchSearchKey('  Radhuni   2.0 ')).toBe('radhuni 2.0');
  });

  it('matches every live store by code, city or name fragment', () => {
    for (const [name, code, address] of LIVE_DIRECTORY) {
      const haystack = branchSearchKey([name, code, address].join(' '));
      expect(haystack).toContain(branchSearchKey(code));
      expect(haystack).toContain(branchSearchKey(name.split(' ').pop() ?? ''));
    }
  });
});

describe('incomingOrderStoreName', () => {
  const branch = (overrides: Partial<Branch>): Branch => ({
    id: 'branch_1',
    name: 'Enjoy Doner Kebab Mosina',
    code: 'EDK-MOSINA',
    address: 'Poznańska 3 62-050 Mosina',
    phone: '',
    isActive: true,
    ...overrides,
  });

  const radhuni = branch({
    id: 'branch_rad',
    name: 'Radhuni 2.0',
    code: 'RAD-LESZNO',
    address: '',
  });
  const crispy = branch({
    id: 'branch_cc',
    name: 'Crispy Chicken',
    code: 'CC-POZNAN',
    address: 'Głogowska 86/4, 60-262 Poznań',
  });
  const edkPoznan = branch({
    id: 'branch_edk_poz',
    name: 'Enjoy Doner Kebab Poznan',
    code: 'EDK-POZNAN',
    address: 'ul.Głogowska 142 60-205 Poznan',
  });
  const mosina = branch({});
  const directory = [radhuni, crispy, edkPoznan, mosina];

  it('resolves a Crispy Chicken order even on a Radhuni-active terminal', () => {
    expect(
      incomingOrderStoreName({ branchId: 'branch_cc' }, directory, radhuni)
    ).toBe('Crispy Chicken – Poznań');
  });

  it('resolves the correct EDK branch among many', () => {
    expect(
      incomingOrderStoreName({ branchId: 'branch_edk_poz' }, directory, radhuni)
    ).toBe('Enjoy Doner Kebab – Poznan');
    expect(
      incomingOrderStoreName({ branchId: 'branch_1' }, directory, crispy)
    ).toBe('Enjoy Doner Kebab – Mosina');
  });

  it('resolves a single-unit Radhuni order', () => {
    expect(
      incomingOrderStoreName({ branchId: 'branch_rad' }, directory, radhuni)
    ).toBe('Radhuni 2.0 – Leszno');
  });

  it('falls back to the active branch when the order branch is unknown or absent', () => {
    expect(
      incomingOrderStoreName({ branchId: 'missing' }, directory, crispy)
    ).toBe('Crispy Chicken – Poznań');
    expect(incomingOrderStoreName({}, directory, radhuni)).toBe('Radhuni 2.0 – Leszno');
    expect(incomingOrderStoreName(null, directory, radhuni)).toBe('Radhuni 2.0 – Leszno');
  });
});