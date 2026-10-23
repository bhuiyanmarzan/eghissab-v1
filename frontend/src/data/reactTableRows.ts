import type { ReactTableRow } from '../lib/reactTable';
const referencePeople = [
  ['Louisa Payet', 'fobmeku@gmail.com', 51, 'Complicated', 31],
  ['Betty Dennis', 'culaha@gmail.com', 46, 'Relationship', 41],
  ['Fanny Innocenti', 'genu@gmail.com', 65, 'Relationship', 50],
  ['Dean Lloyd', 'recmumve@gmail.com', 59, 'Relationship', 59],
  ['Antonio Sharp', 'boma@gmail.com', 37, 'Relationship', 82],
  ['Harriett Giannetti', 'jin@gmail.com', 37, 'Single', 46],
  ['Verna Henderson', 'buoremeg@gmail.com', 21, 'Complicated', 23],
  ['Carlos Horton', 'serfit@gmail.com', 53, 'Complicated', 43],
  ['Madge Bouma', 'fajam@gmail.com', 28, 'Single', 17],
  ['Maude Harrington', 'uf@gmail.com', 53, 'Relationship', 21],
  ['Jessie Morita', 'biglejpib@gmail.com', 18, 'Relationship', 33],
  ['Dominic Landini', 'meri@gmail.com', 27, 'Complicated', 48],
  ['Alberta Graves', 'cuvfotu@gmail.com', 26, 'Single', 49],
  ['Brian Lopez', 'aw@gmail.com', 49, 'Complicated', 85],
  ['Emma Menichetti', 'neb@gmail.com', 31, 'Relationship', 98],
  ['Mary Guerrero', 'wufpacak@gmail.com', 19, 'Complicated', 29],
  ['Caleb Gomez', 'vih@gmail.com', 63, 'Complicated', 28],
  ['Don Long', 'ec@gmail.com', 25, 'Single', 88],
  ['Fannie Herbert', 'la@gmail.com', 60, 'Single', 71],
  ['Stella Righi', 'dep@gmail.com', 54, 'Relationship', 17],
  ['Ida Wilson', 'bolejoce@gmail.com', 54, 'Single', 5],
  ['Emma Galeotti', 'fuw@gmail.com', 51, 'Complicated', 98],
  ['Eleanor Murata', 'uri@gmail.com', 48, 'Complicated', 26],
  ['Oscar Haan', 'acibeisi@gmail.com', 42, 'Complicated', 26],
  ['Rodney Byrne', 'adoran@gmail.com', 37, 'Relationship', 71],
  ['Adelaide Guerrero', 'guwup@gmail.com', 61, 'Relationship', 5],
  ['Harvey Sommer', 'gadisi@gmail.com', 53, 'Relationship', 51],
  ['Barry Wheeler', 'pi@gmail.com', 36, 'Complicated', 42],
  ['Celia Moya', 'jez@gmail.com', 59, 'Complicated', 64],
  ['Daisy Lombardi', 'cimmewic@gmail.com', 54, 'Complicated', 40],
];
export function makeReactTableRows(tenantId = 'acme'): ReactTableRow[] {
  const roles = [
    'Manufacturing Director',
    'Pharmacist',
    'Technical Illustrator',
    'Systems Programmer',
    'Network Administrator',
    'Outplacement Specialist',
    'Anthropologist',
    'Fitness Consultant',
    'Scientific Programmer',
    'Communications Affairs Director',
  ];
  const rows = Array.from({ length: 100 }, (_, index) => {
    const person = referencePeople[index % referencePeople.length];
    const round = Math.floor(index / referencePeople.length);
    return {
      id: `${tenantId}-${index + 1}`,
      tenantId,
      deleted: false,
      name: String(person[0]) + (round ? ` ${round + 1}` : ''),
      email: round ? `person${index + 1}@example.com` : String(person[1]),
      age: Number(person[2]),
      role: roles[index % roles.length],
      visits: 1000 + ((index * 397) % 8000),
      status: person[3] as ReactTableRow['status'],
      progress: Number(person[4]),
      phone: `+1 555 010 ${String(index + 1).padStart(3, '0')}`,
      country: ['United States', 'United Kingdom', 'Canada', 'France', 'Japan'][index % 5],
      address: `${100 + index} Main Street`,
    };
  });
  return rows.map((row, index) => ({
    ...row,
    children: [
      { ...rows[(index + 10) % 100], id: `${row.id}.1` },
      { ...rows[(index + 20) % 100], id: `${row.id}.2` },
    ],
  }));
}
