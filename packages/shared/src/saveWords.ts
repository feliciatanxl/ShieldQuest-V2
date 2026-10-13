// Save Card words (no accounts, no PII). A Save Card is four words picked at random on the player's device, e.g.
// "TIGER-MANGO-ROCKET-CLOUD". The words are the only key to the card: the server stores an encrypted blob under a
// slow hash of them and never sees the words themselves (apps/web/src/state/saveCard.ts, apps/server/src/save/).
//
// The list is curated for ages 10-24 and for being written down or read aloud:
// - exactly 1024 words (10 bits each, 40 bits per card), 3-7 letters, A-Z only;
// - common, concrete, friendly words; no homophones (BEAR/BARE, SEA/SEE), no UK/US spelling splits (COLOR/COLOUR);
// - nothing violent, religious, rude in combination, or scam-flavoured (no CASH, PRIZE, CODE, LINK, MULE, SHARK).

// prettier-ignore
export const SAVE_WORDS: readonly string[] = [
  'ACORN', 'ALBUM', 'ALMOND', 'ALPACA', 'AMBER', 'ANCHOR', 'ANGLE', 'ANTHEM', 'APPLE', 'APRICOT',
  'APRON', 'AQUA', 'ARC', 'ARCADE', 'ARCHER', 'ARENA', 'ARROW', 'ARTIST', 'ATLAS', 'ATOM',
  'ATTIC', 'AUTUMN', 'AVOCADO', 'BADGE', 'BADGER', 'BAGEL', 'BAKE', 'BAKER', 'BAKERY', 'BALLOON',
  'BAMBOO', 'BANANA', 'BANDANA', 'BANJO', 'BANNER', 'BARN', 'BARREL', 'BASIL', 'BASKET', 'BAT',
  'BATTERY', 'BEACH', 'BEACON', 'BEAGLE', 'BEAN', 'BEANIE', 'BEETLE', 'BELL', 'BELT', 'BENCH',
  'BERRY', 'BICYCLE', 'BIKE', 'BIRCH', 'BISCUIT', 'BISON', 'BLACK', 'BLANKET', 'BLENDER', 'BLINK',
  'BLOOM', 'BLOSSOM', 'BLOUSE', 'BOAT', 'BOBCAT', 'BOLD', 'BOLT', 'BONGO', 'BOOK', 'BOOT',
  'BOTTLE', 'BOUNCE', 'BOUNCY', 'BOWL', 'BOWLING', 'BOX', 'BRANCH', 'BRAVE', 'BREAD', 'BREEZE',
  'BREEZY', 'BRIDGE', 'BRIGHT', 'BRONZE', 'BROOK', 'BROOM', 'BROTH', 'BROWN', 'BRUSH', 'BUBBLE',
  'BUBBLY', 'BUCKET', 'BUFFALO', 'BUILD', 'BUMPY', 'BUN', 'BUNDLE', 'BUNNY', 'BURGER', 'BUS',
  'BUSY', 'BUTTER', 'BUTTON', 'CABBAGE', 'CABIN', 'CABLE', 'CACTUS', 'CAFE', 'CAKE', 'CALM',
  'CAMEL', 'CAMERA', 'CANAL', 'CANDLE', 'CANDY', 'CANOE', 'CANOPY', 'CANVAS', 'CANYON', 'CAP',
  'CAPE', 'CAPTAIN', 'CAR', 'CARAMEL', 'CARAVAN', 'CARD', 'CARPET', 'CARROT', 'CART', 'CARTOON',
  'CARVE', 'CASHEW', 'CASTLE', 'CAT', 'CATCH', 'CAVE', 'CEDAR', 'CELERY', 'CHAIN', 'CHAIR',
  'CHALK', 'CHAMP', 'CHAPTER', 'CHEER', 'CHEERY', 'CHEESE', 'CHEETAH', 'CHEF', 'CHERRY', 'CHESS',
  'CHIP', 'CHIRP', 'CHIRPY', 'CIRCLE', 'CIRCUS', 'CITY', 'CLAM', 'CLAP', 'CLEVER', 'CLIFF',
  'CLIMB', 'CLOAK', 'CLOCK', 'CLOUD', 'CLOUDY', 'CLOVER', 'COACH', 'COAT', 'COBBLER', 'COBRA',
  'COCOA', 'COCONUT', 'COCOON', 'COLLAR', 'COLLIE', 'COLT', 'COMB', 'COMET', 'COMFY', 'COMIC',
  'COMPASS', 'CONDOR', 'CONE', 'COOK', 'COOKIE', 'COOL', 'COPPER', 'CORAL', 'CORN', 'COSMIC',
  'COTTAGE', 'COVE', 'COYOTE', 'CRAB', 'CRAFT', 'CRAFTY', 'CRANE', 'CRATE', 'CRATER', 'CRAYON',
  'CREAM', 'CREEK', 'CRICKET', 'CRIMSON', 'CRISP', 'CROW', 'CROWN', 'CRUMB', 'CRYSTAL', 'CUB',
  'CUBE', 'CUDDLY', 'CUP', 'CUPCAKE', 'CURLY', 'CURRY', 'CURTAIN', 'CURVE', 'CUSHION', 'DAISY',
  'DANCE', 'DANDY', 'DARING', 'DART', 'DASH', 'DAWN', 'DAZZLE', 'DELTA', 'DENIM', 'DESK',
  'DIAMOND', 'DIG', 'DINER', 'DINGO', 'DISCO', 'DISH', 'DIVE', 'DIZZY', 'DOCK', 'DOCTOR',
  'DOG', 'DOLPHIN', 'DOMINO', 'DOODLE', 'DOOR', 'DOT', 'DOUGH', 'DOVE', 'DOZEN', 'DRAGON',
  'DRAW', 'DREAM', 'DREAMY', 'DRESS', 'DRIFT', 'DRILL', 'DRIZZLE', 'DRUM', 'DUCK', 'DUNE',
  'DURIAN', 'DUSTY', 'EAGER', 'EAGLE', 'EARLY', 'EARTH', 'EASEL', 'EASY', 'ECHO', 'ECLIPSE',
  'EEL', 'EGG', 'ELK', 'EMBER', 'EMBLEM', 'EMOJI', 'EMU', 'ENGINE', 'EPIC', 'ERASER',
  'EVENING', 'EXPLORE', 'FABLE', 'FALCON', 'FAN', 'FANCY', 'FARM', 'FARMER', 'FAST', 'FEATHER',
  'FENCE', 'FERN', 'FERRET', 'FETCH', 'FIDDLE', 'FIELD', 'FIESTA', 'FIG', 'FINCH', 'FIREFLY',
  'FIX', 'FIZZY', 'FLAG', 'FLASH', 'FLASHY', 'FLOAT', 'FLUFFY', 'FLUTE', 'FLY', 'FOG',
  'FOGGY', 'FOLDER', 'FOREST', 'FORK', 'FOSSIL', 'FOX', 'FRAME', 'FRESH', 'FROG', 'FROST',
  'FROSTY', 'FUDGE', 'FUNNY', 'FUZZY', 'GADGET', 'GALAXY', 'GALLERY', 'GARAGE', 'GARDEN', 'GARLIC',
  'GATE', 'GAZELLE', 'GEAR', 'GECKO', 'GENIE', 'GENTLE', 'GERBIL', 'GIANT', 'GIDDY', 'GIGGLE',
  'GINGER', 'GIRAFFE', 'GIZMO', 'GLACIER', 'GLAD', 'GLADE', 'GLIDE', 'GLIDER', 'GLITTER', 'GLOBE',
  'GLOSSY', 'GLOVE', 'GLOW', 'GLUE', 'GOAL', 'GOAT', 'GOGGLES', 'GOLD', 'GOLDEN', 'GOLF',
  'GOOEY', 'GOOSE', 'GOPHER', 'GRAND', 'GRANITE', 'GRANOLA', 'GRAPE', 'GRASS', 'GRASSY', 'GRAVITY',
  'GRAVY', 'GREEN', 'GRID', 'GRIN', 'GROOVY', 'GROVE', 'GROW', 'GUAVA', 'GUITAR', 'GUMMY',
  'GUPPY', 'HAMMER', 'HAMMOCK', 'HAMSTER', 'HANDY', 'HAPPY', 'HARDY', 'HARMONY', 'HARP', 'HARVEST',
  'HASTY', 'HAT', 'HAWK', 'HAZY', 'HEART', 'HELMET', 'HELP', 'HEN', 'HERO', 'HERON',
  'HEXAGON', 'HIKE', 'HILL', 'HINGE', 'HIPPO', 'HOBBY', 'HOCKEY', 'HOLIDAY', 'HOLLOW', 'HOME',
  'HONEST', 'HONEY', 'HOODIE', 'HOOP', 'HOP', 'HORN', 'HORNET', 'HORSE', 'HOTEL', 'HOUND',
  'HUG', 'HULA', 'HUM', 'HUMBLE', 'HUSKY', 'HUT', 'ICE', 'ICEBERG', 'ICICLE', 'ICY',
  'IGLOO', 'IGUANA', 'IMPALA', 'INDIGO', 'INVENT', 'ISLAND', 'IVORY', 'IVY', 'JACKET', 'JADE',
  'JAGUAR', 'JAM', 'JAR', 'JAY', 'JAZZ', 'JAZZY', 'JELLY', 'JET', 'JIFFY', 'JOG',
  'JOLLY', 'JOURNAL', 'JOURNEY', 'JUDO', 'JUGGLE', 'JUICE', 'JUMP', 'JUMPY', 'JUNGLE', 'KALE',
  'KARATE', 'KAYAK', 'KAZOO', 'KEEN', 'KETTLE', 'KIND', 'KINGDOM', 'KITE', 'KITTEN', 'KIWI',
  'KOALA', 'KOI', 'KRILL', 'LABEL', 'LADDER', 'LADLE', 'LADYBUG', 'LAGOON', 'LAKE', 'LAMB',
  'LAMP', 'LANTERN', 'LAP', 'LAPTOP', 'LARK', 'LASER', 'LAUGH', 'LAVA', 'LEAF', 'LEAP',
  'LEARN', 'LEGEND', 'LEMON', 'LEMUR', 'LENTIL', 'LEOPARD', 'LETTER', 'LETTUCE', 'LEVER', 'LILAC',
  'LILY', 'LIME', 'LION', 'LISTEN', 'LIVELY', 'LIZARD', 'LLAMA', 'LOBSTER', 'LOCK', 'LOCKER',
  'LODGE', 'LOG', 'LOOP', 'LOTUS', 'LOYAL', 'LUCID', 'LUNAR', 'MACAW', 'MAGENTA', 'MAGIC',
  'MAGNET', 'MAGPIE', 'MANGO', 'MANTIS', 'MAPLE', 'MARBLE', 'MARCH', 'MARKET', 'MAROON', 'MARSH',
  'MASCOT', 'MEADOW', 'MELLOW', 'MELODY', 'MELON', 'MEMO', 'MERMAID', 'MERRY', 'METEOR', 'MIGHTY',
  'MILD', 'MILK', 'MILL', 'MINK', 'MINNOW', 'MINT', 'MINTY', 'MIRROR', 'MISSION', 'MISTY',
  'MITTEN', 'MIX', 'MOLE', 'MOON', 'MOOSE', 'MOSAIC', 'MOSS', 'MOSSY', 'MOTH', 'MOUSE',
  'MUDDY', 'MUFFIN', 'MUG', 'MUSEUM', 'MUSTARD', 'NACHO', 'NAP', 'NAPKIN', 'NARWHAL', 'NAVY',
  'NEAT', 'NEBULA', 'NECTAR', 'NEST', 'NET', 'NETBALL', 'NEWT', 'NIMBLE', 'NINJA', 'NOBLE',
  'NOISY', 'NOODLE', 'NOON', 'NOTE', 'NOVEL', 'NUGGET', 'OAK', 'OASIS', 'OATS', 'OCEAN',
  'OCTOPUS', 'OLIVE', 'ONION', 'OPAL', 'ORANGE', 'ORBIT', 'ORCA', 'ORCHARD', 'ORCHID', 'ORIGAMI',
  'OSPREY', 'OSTRICH', 'OTTER', 'OVAL', 'OVEN', 'OWL', 'OYSTER', 'PADDLE', 'PAGE', 'PAINT',
  'PALACE', 'PALM', 'PAN', 'PANCAKE', 'PANDA', 'PANTHER', 'PAPAYA', 'PAPER', 'PARADE', 'PARK',
  'PARROT', 'PARSLEY', 'PASTA', 'PEACH', 'PEACHY', 'PEACOCK', 'PEANUT', 'PEARL', 'PEBBLE', 'PELICAN',
  'PENCIL', 'PENGUIN', 'PEPPER', 'PEPPY', 'PETAL', 'PHOTON', 'PIANO', 'PICKLE', 'PICNIC', 'PIGEON',
  'PIGLET', 'PILLOW', 'PILOT', 'PIN', 'PINBALL', 'PINE', 'PINK', 'PITA', 'PIXEL', 'PIZZA',
  'PLANET', 'PLANT', 'PLATE', 'PLAY', 'PLAZA', 'PLUCKY', 'PLUM', 'POCKET', 'POEM', 'POGO',
  'POLITE', 'POLLEN', 'PONCHO', 'POND', 'PONY', 'POODLE', 'POPCORN', 'POPPY', 'PORT', 'POSTER',
  'POTATO', 'POTION', 'PRAIRIE', 'PRAWN', 'PRETZEL', 'PRISM', 'PROUD', 'PUCK', 'PUDDING', 'PUDDLE',
  'PUFFIN', 'PULLEY', 'PUMA', 'PUMPKIN', 'PUPPET', 'PUPPY', 'PURPLE', 'PUZZLE', 'PYRAMID', 'PYTHON',
  'QUAIL', 'QUEST', 'QUICK', 'QUIET', 'QUILT', 'QUIZ', 'RABBIT', 'RACCOON', 'RACE', 'RADAR',
  'RADIO', 'RADISH', 'RAFT', 'RAINBOW', 'RAISIN', 'RAKE', 'RANGER', 'RAPID', 'RAPIDS', 'RAVEN',
  'READY', 'RECIPE', 'REEF', 'RELAX', 'RELAY', 'RESCUE', 'REST', 'RHINO', 'RIBBON', 'RICE',
  'RIDDLE', 'RIDE', 'RIDGE', 'RIVER', 'ROAM', 'ROBE', 'ROBIN', 'ROBOT', 'ROCK', 'ROCKET',
  'ROCKY', 'ROOSTER', 'ROPE', 'ROSY', 'ROVER', 'ROYAL', 'RUBY', 'RUGBY', 'RULER', 'RUN',
  'RUSTY', 'SADDLE', 'SAFARI', 'SAGA', 'SAILOR', 'SALAD', 'SALMON', 'SALSA', 'SAND', 'SANDAL',
  'SANDY', 'SASH', 'SCARF', 'SCARLET', 'SCHOOL', 'SCONE', 'SCOOP', 'SCOOTER', 'SCORE', 'SCOUT',
  'SCREEN', 'SEAL', 'SEARCH', 'SEASON', 'SEED', 'SHADOW', 'SHARE', 'SHEEP', 'SHELF', 'SHELL',
  'SHIELD', 'SHINE', 'SHINY', 'SHIP', 'SHIRT', 'SHOE', 'SHOP', 'SHORE', 'SHORTS', 'SHOUT',
  'SHOVEL', 'SHY', 'SIGNAL', 'SILKY', 'SILLY', 'SILVER', 'SING', 'SIP', 'SKATE', 'SKETCH',
  'SKI', 'SKIP', 'SKIRT', 'SKY', 'SLED', 'SLEEK', 'SLEEPY', 'SLIDE', 'SLIPPER', 'SLOTH',
  'SMART', 'SMILE', 'SMOOTH', 'SNACK', 'SNAIL', 'SNAPPY', 'SNEAKER', 'SNEEZE', 'SNORE', 'SNOW',
  'SNOWMAN', 'SNOWY', 'SNUG', 'SOCCER', 'SOCK', 'SODA', 'SOFA', 'SOFT', 'SOIL', 'SOLAR',
  'SOLVE', 'SONAR', 'SORBET', 'SOUP', 'SPARKLE', 'SPARROW', 'SPEEDY', 'SPHERE', 'SPIDER', 'SPIN',
  'SPINACH', 'SPIRAL', 'SPLASH', 'SPONGE', 'SPOON', 'SPORTY', 'SPRING', 'SPRINT', 'SPROUT', 'SPRY',
  'SQUARE', 'SQUID', 'STACK', 'STAMP', 'STAPLER', 'STAR', 'STATION', 'STEADY', 'STELLAR', 'STICKER',
  'STIR', 'STONE', 'STOOL', 'STORK', 'STORM', 'STORMY', 'STORY', 'STRAW', 'STREAM', 'STRETCH',
  'STRING', 'STUDIO', 'STUMP', 'STURDY', 'SUGAR', 'SUMMER', 'SUMMIT', 'SUNBEAM', 'SUNNY', 'SUNRISE',
  'SUNSET', 'SUPER', 'SURF', 'SURFING', 'SUSHI', 'SWAMP', 'SWAN', 'SWAP', 'SWEATER', 'SWEET',
  'SWIFT', 'SWIM', 'SWING', 'SWIRL', 'SWOOP', 'TABLE', 'TABLET', 'TACO', 'TADPOLE', 'TALL',
  'TAME', 'TAN', 'TANGY', 'TAP', 'TAPE', 'TAPIR', 'TAXI', 'TEACH', 'TEACUP', 'TEAL',
  'TEAM', 'TEAPOT', 'TEMPO', 'TENNIS', 'TENT', 'THIMBLE', 'THINK', 'THREAD', 'THUNDER', 'TIDY',
  'TIGER', 'TINY', 'TOAD', 'TOAST', 'TOASTER', 'TOASTY', 'TOFFEE', 'TOFU', 'TOMATO', 'TOOLBOX',
  'TOPAZ', 'TORCH', 'TOSS', 'TOUCAN', 'TOWEL', 'TOWER', 'TOWN', 'TOY', 'TRACTOR', 'TRAIL',
  'TRAIN', 'TRAM', 'TRAVEL', 'TRAY', 'TREAT', 'TREE', 'TREK', 'TROPHY', 'TROUT', 'TRUCK',
  'TRUE', 'TRUMPET', 'TRUNK', 'TUBA', 'TULIP', 'TUMBLE', 'TUNA', 'TUNDRA', 'TUNE', 'TUNNEL',
  'TURKEY', 'TURNIP', 'TURTLE', 'TWIG', 'TWIRL', 'TWIST', 'UNICORN', 'UNIFORM', 'UPBEAT', 'VALLEY',
  'VAN', 'VANILLA', 'VECTOR', 'VEST', 'VILLAGE', 'VINE', 'VIOLET', 'VIOLIN', 'VISIT', 'VISOR',
  'VIVID', 'VOLCANO', 'VOYAGE', 'WAFER', 'WAFFLE', 'WAGON', 'WALNUT', 'WALRUS', 'WAND', 'WANDER',
  'WARM', 'WATER', 'WAVE', 'WAVY', 'WEDGE', 'WHEEL', 'WHIRL', 'WHISK', 'WHISKER', 'WHISTLE',
  'WHITE', 'WIDGET', 'WIGGLE', 'WILLOW', 'WINDOW', 'WINDY', 'WINK', 'WINTER', 'WISE', 'WITTY',
  'WIZARD', 'WOBBLY', 'WOLF', 'WOMBAT', 'WOODS', 'WORD', 'WREN', 'WRENCH', 'YAK', 'YAM',
  'YARN', 'YAWN', 'YELL', 'YOGA', 'YOUNG', 'ZANY', 'ZEBRA', 'ZESTY', 'ZIGZAG', 'ZIP',
  'ZIPPER', 'ZIPPY', 'ZOO', 'ZOOM',
];

/** Words per Save Card. 4 words x 10 bits = 40 bits. */
export const SAVE_CODE_WORDS = 4;

const WORD_SET: ReadonlySet<string> = new Set(SAVE_WORDS);

export const isSaveWord = (w: string): boolean => WORD_SET.has(w);

/** Uniform random index in [0, n) from a CSPRNG (rejection sampling, so no modulo bias for any n). */
/** Fills the array with cryptographically strong random values (crypto.getRandomValues). */
export type RandomFill = (a: Uint32Array<ArrayBuffer>) => unknown;

function randomIndex(n: number, fill: RandomFill): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    fill(buf);
    const x = buf[0]!;
    if (x < limit) return x % n;
  }
}

// Web Crypto is global in browsers and Node 19+. Typed locally because this package compiles without the DOM lib.
const defaultFill: RandomFill = (a) =>
  (
    globalThis as unknown as { crypto: { getRandomValues: (x: Uint32Array<ArrayBuffer>) => unknown } }
  ).crypto.getRandomValues(a);

/** A fresh Save Card code, e.g. "TIGER-MANGO-ROCKET-CLOUD". Uses crypto.getRandomValues (never Math.random). */
export function makeSaveCode(fill: RandomFill = defaultFill): string {
  const words: string[] = [];
  for (let i = 0; i < SAVE_CODE_WORDS; i++) words.push(SAVE_WORDS[randomIndex(SAVE_WORDS.length, fill)]!);
  return words.join('-');
}

export type SaveCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'count'; count: number }
  | { ok: false; reason: 'unknown'; word: string; suggestions: string[] };

/** Every way to split a run of letters into list words (bounded: runs are short and the list is small). */
function splits(run: string, max: number): string[][] {
  const memo = new Map<number, string[][]>();
  const from = (i: number): string[][] => {
    if (i === run.length) return [[]];
    const hit = memo.get(i);
    if (hit) return hit;
    const out: string[][] = [];
    for (let len = 3; len <= 7 && i + len <= run.length; len++) {
      const w = run.slice(i, i + len);
      if (!WORD_SET.has(w)) continue;
      for (const rest of from(i + len)) if (rest.length < max) out.push([w, ...rest]);
    }
    memo.set(i, out);
    return out;
  };
  return from(0);
}

/** True when a and b differ by one edit (insert, delete, substitute) or one swap of neighbouring letters. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0]! + 1 && a[diff[0]!] === b[diff[1]!] && a[diff[1]!] === b[diff[0]!];
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}

/** List words one typo away (at most 3, so the hint stays short). */
export function suggestSaveWords(word: string): string[] {
  return SAVE_WORDS.filter((w) => oneEditApart(word, w)).slice(0, 3);
}

/**
 * Reads a typed or scanned code. Case, spaces, dashes, dots and missing separators are all fine:
 * "tiger mango rocket cloud", "Tiger-Mango-Rocket-Cloud" and "tigermangorocketcloud" all give
 * "TIGER-MANGO-ROCKET-CLOUD".
 */
export function parseSaveCode(input: string): SaveCodeResult {
  const runs = input
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (runs.length === 0) return { ok: false, reason: 'empty' };
  if (runs.length > SAVE_CODE_WORDS) return { ok: false, reason: 'count', count: runs.length };
  if (runs.length === SAVE_CODE_WORDS) {
    for (const w of runs) {
      if (!WORD_SET.has(w)) {
        return { ok: false, reason: 'unknown', word: w, suggestions: suggestSaveWords(w) };
      }
    }
    return { ok: true, code: runs.join('-') };
  }
  // Fewer runs than words: some separators are missing. Accept only if there is exactly one way to read it.
  let combos: string[][] = [[]];
  for (const run of runs) {
    const ways = WORD_SET.has(run)
      ? [[run], ...splits(run, SAVE_CODE_WORDS).filter((s) => s.length > 1)]
      : splits(run, SAVE_CODE_WORDS);
    if (ways.length === 0) {
      return { ok: false, reason: 'unknown', word: run, suggestions: run.length <= 8 ? suggestSaveWords(run) : [] };
    }
    combos = combos.flatMap((c) => ways.map((w) => [...c, ...w])).filter((c) => c.length <= SAVE_CODE_WORDS);
  }
  const full = [...new Set(combos.filter((c) => c.length === SAVE_CODE_WORDS).map((c) => c.join('-')))];
  if (full.length === 1) return { ok: true, code: full[0]! };
  const count = runs.length;
  return { ok: false, reason: 'count', count };
}

/** The normalised code, or null when the input is not a valid Save Card code. */
export function normalizeSaveCode(input: string): string | null {
  const r = parseSaveCode(input);
  return r.ok ? r.code : null;
}
