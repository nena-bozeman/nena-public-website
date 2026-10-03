/**
 * 2026 Parade of Sheds tour pins.
 * Coordinates are street-address geocodes for the interactive map.
 * Stop 3 (721 ½) uses the 721 N Montana Ave house point.
 * Stop 13 is pinned at 424 N Church Ave — the northeast address — because
 * "424 Church St" without a direction geocodes to South Church downtown.
 */
export type ParadeTourRole = 'potluck' | 'stop';

export interface ParadeTourStop {
  label: string;
  name?: string;
  address: string;
  note?: string;
  lat: number;
  lng: number;
  role: ParadeTourRole;
}

export const paradeOfSheds2026Stops: ParadeTourStop[] = [
  {
    label: 'P',
    role: 'potluck',
    name: 'Tinworks Art',
    address: '719 N Wallace Ave',
    note: 'Potluck, picnic, and parade gather. Tour stop 9 is at this site.',
    lat: 45.686917,
    lng: -111.028475,
  },
  {
    label: '1',
    role: 'stop',
    name: 'Hot dogs and Big Vehicles',
    address: 'Simkins Lumber, 326 N Broadway Ave',
    lat: 45.682902,
    lng: -111.024556,
  },
  {
    label: '2',
    role: 'stop',
    name: 'Every Puff a Pleasure!',
    address: '720 Front St.',
    lat: 45.687154,
    lng: -111.025281,
  },
  {
    label: '3',
    role: 'stop',
    name: 'An After Life for License Plates',
    address: '721 ½ N. Montana Ave.',
    lat: 45.686878,
    lng: -111.033144,
  },
  {
    label: '4',
    role: 'stop',
    name: 'Swedish Pancakes made by a Real Swede!',
    address: '514 N. Ida',
    lat: 45.684873,
    lng: -111.026472,
  },
  {
    label: '5',
    role: 'stop',
    name: 'Visit the She-shed Art Gallery',
    address: 'Off the alley behind 706 E. Peach St',
    lat: 45.685597,
    lng: -111.026324,
  },
  {
    label: '6',
    role: 'stop',
    name: 'Disco shed, hot cider around the bonfire, and original artwork!',
    address: '711 E Orange St',
    lat: 45.684804,
    lng: -111.026343,
  },
  {
    label: '7',
    role: 'stop',
    name: 'Feel the heat at Raven Forge!',
    address: '810 East Davis',
    lat: 45.682656,
    lng: -111.025945,
  },
  {
    label: '8',
    role: 'stop',
    name: 'Tiny Porch Concert',
    address: '620 N Tracy Ave.',
    lat: 45.685797,
    lng: -111.037183,
  },
  {
    label: '9',
    role: 'stop',
    name: 'Boiled peanuts from the South',
    address: '719 N Wallace Ave',
    note: 'Same site as the Tinworks Art potluck and picnic.',
    lat: 45.686917,
    lng: -111.028475,
  },
  {
    label: '10',
    role: 'stop',
    name: 'Garden of Delights',
    address: '415 N. Grand Ave',
    lat: 45.683287,
    lng: -111.04017,
  },
  {
    label: '11',
    role: 'stop',
    address: '8 E. Peach St.',
    lat: 45.685431,
    lng: -111.036967,
  },
  {
    label: '12',
    role: 'stop',
    name: 'Zeitgeitz (Spirit of Our Times)',
    address: '701 N. Wallace (driveway)',
    lat: 45.686776,
    lng: -111.028478,
  },
  {
    label: '13',
    role: 'stop',
    name: 'Ping Pong & Coors',
    address: '424 Church St',
    lat: 45.684045,
    lng: -111.030078,
  },
];
