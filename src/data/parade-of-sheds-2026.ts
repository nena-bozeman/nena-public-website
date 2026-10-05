/**
 * 2026 Parade of Sheds tour pins.
 * Coordinates are street-address geocodes for the interactive map.
 * Stop 3 (721 ½) uses the 721 N Montana Ave house point.
 * Stops 13 and 14 are both at 424 N Church Ave and share one pin.
 */
export type ParadeTourRole = 'potluck' | 'stop';

export interface ParadeTourStop {
  label: string;
  name?: string;
  address: string;
  description?: string;
  lat: number;
  lng: number;
  role: ParadeTourRole;
}

export const paradeOfSheds2026Stops: ParadeTourStop[] = [
  {
    label: 'P',
    role: 'potluck',
    name: 'Tinworks Art',
    address: '719 N Ida Ave',
    lat: 45.687347,
    lng: -111.026852,
  },
  {
    label: '1',
    role: 'stop',
    name: 'Hot dogs and Big Vehicles',
    address: 'Simkins Lumber, 326 N Broadway Ave',
    description:
      'Enjoy a hot dog off the grill while your kids climb up into the cab of some big machinery (photo op!)',
    lat: 45.682902,
    lng: -111.024556,
  },
  {
    label: '2',
    role: 'stop',
    name: 'Every Puff a Pleasure!',
    address: '720 Front St.',
    description:
      'Admire the iconic mural and wander the gardens and grounds of this historic building that once served as cold storage for the railroad. Mountain Man is the maker of Mystic Trellises and bi-ski devices for disabled skiers.',
    lat: 45.687154,
    lng: -111.025281,
  },
  {
    label: '3',
    role: 'stop',
    name: 'An After Life for License Plates',
    address: '721 ½ N. Montana Ave.',
    description:
      'The Bozeman Montana License Plate Exhibit features over 265 license plates from around the world! Contribute to the exhibition by donating your own plates.',
    lat: 45.686878,
    lng: -111.033144,
  },
  {
    label: '4',
    role: 'stop',
    name: 'Swedish Pancakes made by a Real Swede!',
    address: '514 N. Ida',
    description:
      'Back by popular demand! Better bring your go-mug of coffee cuz there’s bound to be a line of hungry neighbors! If you have it, place $1 in the jar for the food bank. Välkomna!',
    lat: 45.684873,
    lng: -111.026472,
  },
  {
    label: '5',
    role: 'stop',
    name: 'Visit the She-shed Art Gallery',
    address: 'Off the alley behind 706 E. Peach St',
    description:
      'While you are digesting your yummy Swedish pancake, stroll across the alley and visit this tiny pop-up art gallery.',
    lat: 45.685597,
    lng: -111.026324,
  },
  {
    label: '6',
    role: 'stop',
    name: 'Disco shed, hot cider around the bonfire, and original artwork!',
    address: '711 E Orange St',
    description:
      'Right next door to Swedish pancakes! Come visit 2 FUNky sheds in Daniel’s backyard. We will have a bonfire going, hot apple cider, disco lights and music in one shed and Brittney Banks’ flower art and greeting cards in another.',
    lat: 45.684804,
    lng: -111.026343,
  },
  {
    label: '7',
    role: 'stop',
    name: 'Feel the heat at Raven Forge!',
    address: '810 East Davis',
    description:
      'This longtime blacksmith and craftsman uses hammers, anvils, and a forge to produce both traditional and contemporary ironwork. Come by and see a forging demonstration.',
    lat: 45.682656,
    lng: -111.025945,
  },
  {
    label: '8',
    role: 'stop',
    name: 'Tiny Porch Concert',
    address: '620 N Tracy Ave.',
    description:
      'Enjoy tunes performed by your neighbors and/or step up to perform open mic-style! A host of instruments and full PA system available for your music-making & listening pleasure.',
    lat: 45.685797,
    lng: -111.037183,
  },
  {
    label: '9',
    role: 'stop',
    name: 'Boiled peanuts from the South',
    address: '719 N Wallace Ave',
    description:
      'Enjoy a southern treat on our front lawn and porch. People from the South know boiled peanuts as a roadside attraction from road trips. People from elsewhere often wonder why one would eat a mushy peanut. Come try some and join the debate.',
    lat: 45.686917,
    lng: -111.028475,
  },
  {
    label: '10',
    role: 'stop',
    name: 'Garden of Delights',
    address: '415 N. Grand Ave',
    description:
      'Welcome to Annette’s Garden of Delights. Look for the found object crows. How many VW Vanagons can you spot? Can you find the candy corn Corgi? Go through the front or back gate to enter this wonderland.',
    lat: 45.683287,
    lng: -111.04017,
  },
  {
    label: '11',
    role: 'stop',
    name: 'MHTR Mural History Trivia & Raffle',
    address: '8 E. Peach St.',
    description:
      'Enjoy the new mural. Grab a raffle ticket for each of these if you can guess (1) the subject (2) the source (3) the event, and share some history.',
    lat: 45.685431,
    lng: -111.036967,
  },
  {
    label: '12',
    role: 'stop',
    name: 'Zeitgeitz (Spirit of Our Times)',
    address: '701 N. Wallace (driveway)',
    description:
      'Come see some northeast side Graffiti prints by Paul Wiese and numerous Northeast Graffiti artists!',
    lat: 45.686776,
    lng: -111.028478,
  },
  {
    label: '13',
    role: 'stop',
    name: 'Ping Pong & Coors',
    address: '424 N Church Ave',
    description: 'Need we say more?',
    lat: 45.684045,
    lng: -111.030078,
  },
  {
    label: '14',
    role: 'stop',
    name: 'Little Free TOOL Library',
    address: '424 N Church Ave',
    description:
      'Check out the grand opening of Bozeman’s first little free tool library! A neighborhood resource to help fulfill your DIY dreams and foster collective creativity.',
    lat: 45.684045,
    lng: -111.030078,
  },
];
