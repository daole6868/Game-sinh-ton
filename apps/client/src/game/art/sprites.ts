import { type PixelSprite, overlay, px, recolor, scale2 } from './pixel';

// ═════════════════════════ VẬT THỂ TỰ NHIÊN ═════════════════════════

const TREE_ROWS = [
  '......gggg......',
  '....ggGGGGgg....',
  '...gGGGHHGGGg...',
  '..gGGHHHHHHGGg..',
  '.gGGHHHHHHHHGGg.',
  '.gGGHHHHHHHHGGg.',
  'gGGGHHHHHHHGGGGg',
  'gGGGGHHHHHGGGGGg',
  'gGGGGGHHGGGGGGGg',
  'gGGGGGGGGGGGGGGg',
  '.gGGGGGGGGGGGGg.',
  '.ggGGGGGGGGGGgg.',
  '..ggGGGGGGGGgg..',
  '...gggGGGGggg...',
  '.....ggggggg....',
  '......bBBb......',
  '......bBBb......',
  '......bBBb......',
  '......bBBb......',
  '.....bbBBbb.....',
  '....:bbbbbb:....',
  '.....::::::.....',
];
const tree = px(TREE_ROWS, { g: '#2d5a27', G: '#3e7b33', H: '#5c9e44', b: '#4a2f1d', B: '#6e4627' });
const bloodTree = px(
  TREE_ROWS.map((r, y) => (y === 5 ? '.gGGHHcHHHHHGGg.' : y === 9 ? 'gGGGGGGGGGcGGGGg' : y === 3 ? '..gGGHHHHHHGcg..' : r)),
  { g: '#3a0f1e', G: '#5e1a30', H: '#8e2a40', b: '#1e0c12', B: '#34161e', c: '#ff5a6e' },
);

const pine = px(
  [
    '.......pp.......',
    '......pPPp......',
    '......pPLp......',
    '.....pPPPPp.....',
    '.....pPLPPp.....',
    '....pPPPPLPp....',
    '....pPLPPPPp....',
    '...pPPPPPLPPp...',
    '...pPPLPPPPPp...',
    '..pPPPPPPPLPPp..',
    '..pPPLPPPPPPPp..',
    '.pPPPPPPPLPPPPp.',
    '.pPPLPPPPPPPPPp.',
    'pPPPPPPPPPPLPPPp',
    'ppppPPPPPPPPpppp',
    '....pppppppp....',
    '......bBBb......',
    '......bBBb......',
    '.....:bBBb:.....',
    '......::::......',
  ],
  { p: '#1f4a34', P: '#2e6a46', L: '#4d8f5e', b: '#4a2f1d', B: '#6e4627' },
);

const deadTree = px(
  [
    '..b.........b...',
    '..bb.......bb...',
    '...bb..b..bb....',
    '....bb.b.bb.....',
    '.b...bbBbb...b..',
    '.bb...bBb...bb..',
    '..bbb.bBb.bbb...',
    '....bbbBbbb.....',
    '......bBb.......',
    '......bBb.......',
    '......bBb.......',
    '......bBb.......',
    '......bBBb......',
    '.....bbBBb......',
    '....:bbBBbb:....',
    '.....::::::.....',
  ],
  { b: '#5a4636', B: '#7a6250' },
);

const bush = px(
  [
    '................',
    '................',
    '................',
    '................',
    '.....gggggg.....',
    '...ggGGGGGGgg...',
    '..gGGrGGGGrGGg..',
    '..gGGGGGrGGGGg..',
    '.gGrGGGGGGGGrGg.',
    '.gGGGGrGGGrGGGg.',
    '.gGGGGGGGGGGGGg.',
    '..gGGrGGGGGrGg..',
    '..ggGGGGGGGGgg..',
    '...::gggggg::...',
    '....::::::::....',
    '................',
  ],
  { g: '#2f5e2a', G: '#468a3a', r: '#d0304a' },
);

const grassTuft = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......g...g.....',
    '..g...gG.gG..g..',
    '..gG.gGG.GG.gG..',
    '...GgGGgGGGgG...',
    '...gGGGGGGGGg...',
    '....gGgGGgGg....',
    '....::::::::....',
    '................',
    '................',
  ],
  { g: '#4f8a3a', G: '#7abe5a' },
);

const twig = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........b....',
    '....b.....bB....',
    '.....bB..bB.....',
    '......bBBB......',
    '.....bBbB.bb....',
    '....bB......b...',
    '....:.::::::....',
    '................',
  ],
  { b: '#5a3a20', B: '#8a5a32' },
);

const pebble = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kk........',
    '.....kRRk..kk...',
    '.....kRrk.kRk...',
    '......kk..kk....',
    '..kk............',
    '.kRrk...........',
    '..kk............',
  ],
  { k: '#4a4a52', R: '#9a9aa2', r: '#c4c4ca' },
);

const ROCK_ROWS = [
  '................',
  '................',
  '................',
  '................',
  '.....kkkkk......',
  '...kkRRrRRkk....',
  '..kRRrrRRRRRk...',
  '..kRrRRRRRRRRk..',
  '.kRRRRRRRRRRRk..',
  '.kRRRRRRRdRRRRk.',
  '.kRRRdRRRRRRRRk.',
  '.kRRRRRRRRRdRRk.',
  '..kdRRRRRRRRRdk.',
  '..kkddddddddkk..',
  '...::kkkkkk::...',
  '................',
];
const rockPal = { k: '#34343c', R: '#8a8a92', r: '#b8b8c0', d: '#64646c' };
const rock = px(ROCK_ROWS, rockPal);
function speckle(rows: string[], ch: string, spots: [number, number][]): string[] {
  const out = rows.map((r) => [...r]);
  for (const [x, y] of spots) if (out[y]?.[x] && out[y]![x] !== '.' && out[y]![x] !== 'k') out[y]![x] = ch;
  return out.map((r) => r.join(''));
}
const SPOTS: [number, number][] = [
  [5, 6], [9, 7], [4, 9], [11, 9], [7, 10], [3, 11], [10, 12], [6, 12], [12, 10], [8, 8],
];
const ironRock = px(speckle(ROCK_ROWS, 'o', SPOTS), { ...rockPal, o: '#e08a3a' });
const coalRock = px(speckle(ROCK_ROWS, 'c', SPOTS), { ...rockPal, c: '#141418' });
const crystalNode = overlay(
  px(ROCK_ROWS, { k: '#24141c', R: '#4a3040', r: '#6a4a5a', d: '#3a2432' }),
  px(
    [
      '.......x........',
      '......xXx.......',
      '......xXx..x....',
      '.....xXwXx.xX...',
      '.....xXwXxxXXx..',
      '..x..xXXXxxXXx..',
      '..xX.xXXXXxXx...',
      '..xXxxXXXXxXx...',
    ],
    { x: '#a01830', X: '#e03a50', w: '#ffc0c8' },
  ),
  0,
  1,
);

const cactus = px(
  [
    '......gg........',
    '.....gGGg.......',
    '.....gGLg.......',
    '.....gGGg..gg...',
    '.gg..gGLg.gGGg..',
    'gGGg.gGGg.gGLg..',
    'gGLg.gGLg.gGGg..',
    'gGGggGGGg.gGGg..',
    '.gGGGGGLgggGGg..',
    '..ggggGGGGGGg...',
    '.....gGLgggg....',
    '.....gGGg.......',
    '.....gGLg.......',
    '.....gGGg.......',
    '....:gGGg:......',
    '.....::::.......',
  ],
  { g: '#2f6b3a', G: '#4f9a52', L: '#8ac878' },
);

const reeds = px(
  [
    '................',
    '................',
    '....y.....y.....',
    '....Y..y..Y.....',
    '....g..Y..g..y..',
    '...gG..g.gG..Y..',
    '...gG.gG.gG..g..',
    '...gG.gG.gG.gG..',
    '..gGg.gG.gG.gG..',
    '..gG.gGg.gGggG..',
    '..gG.gG.gGg.gG..',
    '...gGgG.gG.gG...',
    '...gGGGggGgG....',
    '....::::::::....',
    '................',
    '................',
  ],
  { y: '#7a5a2a', Y: '#b08a50', g: '#5a7a3a', G: '#7a9a4a' },
);

const herbPlant = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......l.l.......',
    '.....lLwLl......',
    '...l.lLLLl.l....',
    '..lLlLLwLLlLl...',
    '...lLLLLLLLl....',
    '....llLLLLll....',
    '......lLl.......',
    '.....::::.......',
    '................',
  ],
  { l: '#2a6a4a', L: '#4aaa6a', w: '#f0f0a0' },
);

const mushroomPatch = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....rrr.........',
    '...rRwRr...rr...',
    '...rRRRr..rRwr..',
    '....ccc...rRRr..',
    '....cCc....cc...',
    '.rr.cCc....cC...',
    'rRwr..::...::...',
    '.cc.::::........',
    '.cC.............',
  ],
  { r: '#8a2a2a', R: '#d0403a', w: '#f8e8d8', c: '#d8c8a8', C: '#f0e8d0' },
);

const clayPit = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkk......',
    '..kkCCcCCCkk....',
    '.kCCcCCCcCCCk...',
    '.kCCCCcCCCCCk...',
    '..kkCCCCCcCk....',
    '....kkkkkkk.....',
    '................',
  ],
  { k: '#5a3018', C: '#a8603a', c: '#d08a5a' },
);

const scrapPile = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......mm........',
    '.....mMMm.r.....',
    '...mmMmmMmRr....',
    '..mMmMMRrmMMm...',
    '.mMMmrRRMmmMMm..',
    '.mmMMmmMMMrmMMm.',
    '..::mmmmmmmm::..',
    '....::::::::....',
    '................',
  ],
  { m: '#4a4a52', M: '#8a8a94', r: '#7a3a22', R: '#b0643a' },
);

const wreck = px(
  [
    '................................',
    '........kkkkkkkkkkkkk...........',
    '.......kGGGGkWWWWkGGGk..........',
    '......kGGGGGkWWWWkGGGGk.........',
    '....kkkkkkkkkkkkkkkkkkkkkkk.....',
    '...kRRRRRrRRRRRRRRRrRRRRRRRk....',
    '..kRRRrRRRRRRRRRrRRRRRRRRRRRk...',
    '..kRRRRRRRRRRRRRRRRRRRRRrRRRk...',
    '..kkkkkkkkkkkkkkkkkkkkkkkkkkk...',
    '...kkkk..............kkkk.......',
    '..kTTTTk............kTTTTk......',
    '..kTkkTk............kTkkTk......',
    '...kkkk..............kkkk.......',
    '..::::::::::::::::::::::::::....',
  ],
  { R: '#7a3424', r: '#a85a3a', G: '#4a5a6a', W: '#6a7a8a', k: '#221a1e', T: '#34343a' },
);

const crate = px(
  [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '..kBBBBBBBBBBk..',
    '..kBbkbbbbkbBk..',
    '..kBbbkbbkbbBk..',
    '..kBbbbrrbbbBk..',
    '..kBbbrrrrbbBk..',
    '..kBbbbrrbbbBk..',
    '..kBbbkbbkbbBk..',
    '..kBbkbbbbkbBk..',
    '..kBBBBBBBBBBk..',
    '..kkkkkkkkkkkk..',
    '...::::::::::...',
    '................',
  ],
  { k: '#3a2a1a', B: '#8a6a3a', b: '#a8844a', r: '#c03a3a' },
);

const bones = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..ww.......w....',
    '..wWw.....wWw...',
    '....wWw.wWw.....',
    '......wWWw......',
    '....wWw.wWw.....',
    '..wWw.....wWw...',
    '..ww.......ww...',
    '....::::::::....',
    '................',
  ],
  { w: '#b8b0a0', W: '#f0e8d8' },
);

export const OBJECT_SPRITES: Record<string, PixelSprite> = {
  tree,
  pine,
  dead_tree: deadTree,
  blood_tree: bloodTree,
  bush,
  grass_tuft: grassTuft,
  twig,
  pebble,
  rock,
  iron_rock: ironRock,
  coal_rock: coalRock,
  crystal_node: crystalNode,
  cactus,
  reeds,
  herb_plant: herbPlant,
  mushroom_patch: mushroomPatch,
  clay_pit: clayPit,
  scrap_pile: scrapPile,
  wreck,
  crate,
  bones,
};

// ═════════════════════════ CÔNG TRÌNH ═════════════════════════

const WALL_ROWS = [
  'kkkkkkkkkkkkkkkk',
  'kTTTTTTTTTTTTTTk',
  'kTtTTTTtTTTTtTTk',
  'kTTTTtTTTTtTTTTk',
  'kTTTTTTTTTTTTTTk',
  'kkkkkkkkkkkkkkkk',
  'kBBBkBBBBkBBBBBk',
  'kBbBkBBbBkBBbBBk',
  'kBBBkBBBBkBBBBbk',
  'kBBbkBbBBkbBBBBk',
  'kkkkkkkkkkkkkkkk',
  'kBBBBBkBBBBkBBBk',
  'kBbBBBkBBbBkBBBk',
  'kBBBBbkBBBBkBbBk',
  'kBBBBBkbBBBkBBBk',
  'kkkkkkkkkkkkkkkk',
  'kBBBkBBBBkBBBBBk',
  'kBbBkBBBbkBBbBBk',
  'kBBBkBBBBkBBBBBk',
  'kBBbkBbBBkbBBBBk',
  'kkkkkkkkkkkkkkkk',
  '::::::::::::::::',
];
const woodWall = px(WALL_ROWS, { k: '#2e1e14', T: '#b08a50', t: '#8a6a3a', B: '#7a5530', b: '#5e4024' });
const stoneWall = px(WALL_ROWS, { k: '#24242a', T: '#b4b4bc', t: '#94949c', B: '#80808a', b: '#606068' });
const ironWall = px(
  WALL_ROWS.map((r, y) => (y === 7 || y === 12 || y === 17 ? r.replace(/^k(.)/, 'kr').replace(/(.)k$/, 'rk') : r)),
  { k: '#20262c', T: '#a8b4c0', t: '#8a96a2', B: '#6a7684', b: '#505a66', r: '#d8e0e8' },
);

const DOOR_ROWS = [
  'kkkkkkkkkkkkkkkk',
  'kTTTTTTTTTTTTTTk',
  'kTtTTTTtTTTTtTTk',
  'kTTTTTTTTTTTTTTk',
  'kkkkkkkkkkkkkkkk',
  'kFFkkkkkkkkkkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkddddddddkFFk',
  'kFFkDDDDDdDDkFFk',
  'kFFkDDDDDdDhkFFk',
  'kFFkDDDDDdDhkFFk',
  'kFFkDDDDDdDDkFFk',
  'kFFkddddddddkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkDDDdDDDDkFFk',
  'kFFkDDDdDDDDkFFk',
  'kkkkkkkkkkkkkkkk',
  '::::::::::::::::',
];
const woodDoor = px(DOOR_ROWS, { k: '#2e1e14', T: '#b08a50', t: '#8a6a3a', F: '#6a4628', D: '#9a6e3e', d: '#7a5530', h: '#f0c040' });
const ironDoor = px(DOOR_ROWS, { k: '#20262c', T: '#a8b4c0', t: '#8a96a2', F: '#505a66', D: '#7a8694', d: '#5a6674', h: '#f0c040' });

const woodFloor = px(
  [
    'kkkkkkkkkkkkkkkk',
    'kPPPPPPkPPPPPPPk',
    'kPpPPPPkPPPPpPPk',
    'kkkkkkkkkkkkkkkk',
    'kPPPkPPPPPPPkPPk',
    'kPPpkPPPPpPPkPPk',
    'kkkkkkkkkkkkkkkk',
    'kPPPPPPPkPPPPPPk',
    'kPpPPPPPkPPPPpPk',
    'kkkkkkkkkkkkkkkk',
    'kPPPPkPPPPPPkPPk',
    'kPPpPkPPPpPPkPPk',
    'kkkkkkkkkkkkkkkk',
    'kPPPPPPPkPPPPPPk',
    'kPPPpPPPkPPpPPPk',
    'kkkkkkkkkkkkkkkk',
  ],
  { k: '#5a3e24', P: '#a07848', p: '#8a6438' },
);

const chest = px(
  [
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kBBBBBBBBBBBBk.',
    '.kBbBBBBBBBBbBk.',
    '.kkkkkkkkkkkkkk.',
    '.kBBBBByyBBBBBk.',
    '.kBbBBByYBBBbBk.',
    '.kBBBBBBBBBBBBk.',
    '.kBbBBBBBBBBbBk.',
    '.kBBBBBBBBBBBBk.',
    '.kkkkkkkkkkkkkk.',
    '..::::::::::::..',
    '................',
    '................',
  ],
  { k: '#2e1e14', B: '#8a5a2a', b: '#a8743a', y: '#c8a040', Y: '#f0d060' },
);

const workbench = px(
  [
    '................',
    '................',
    '........gg......',
    '...H.....gG.....',
    '..HHk.....g.....',
    '...kk.ss........',
    'kkkkkkkkkkkkkkkk',
    'kTTTTTTTTTTTTTTk',
    'kTtTTTTtTTTTtTTk',
    'kkkkkkkkkkkkkkkk',
    '.kL.........Lk..',
    '.kL.........Lk..',
    '.kLkkkkkkkkkLk..',
    '.kL.........Lk..',
    '.kk.........kk..',
    '.::::::::::::::.',
  ],
  { k: '#2e1e14', T: '#b08a50', t: '#8a6a3a', L: '#6a4628', H: '#8a8a92', g: '#5a3a20', G: '#8a5a32', s: '#c8c8d0' },
);

const furnace = px(
  [
    '................',
    '....kkkkkk......',
    '....kSSSSk......',
    '....kSssSk......',
    '..kkkkkkkkkkkk..',
    '.kSSSSSSSSSSSSk.',
    '.kSsSSSSSSSsSSk.',
    '.kSSSkkkkkkSSSk.',
    '.kSSkOOOOOOkSSk.',
    '.kSskOYYYYOksSk.',
    '.kSSkOYrrYOkSSk.',
    '.kSSkkkkkkkkSSk.',
    '.kSsSSSSSSSSsSk.',
    '.kkkkkkkkkkkkkk.',
    '..::::::::::::..',
    '................',
  ],
  { k: '#24242a', S: '#8a8a92', s: '#6a6a72', O: '#c04a20', Y: '#f0a030', r: '#fff0a0' },
);

const mechBench = px(
  [
    '................',
    '................',
    '..kGk......ppp..',
    '.kGGGk....pPPp..',
    '..kGk.....ppp...',
    '.......bb.......',
    'kkkkkkkkkkkkkkkk',
    'kMMMMMMMMMMMMMMk',
    'kMmMMMMMMMMMmMMk',
    'kkkkkkkkkkkkkkkk',
    '.kL..kkkkkk.Lk..',
    '.kL..kMMMMk.Lk..',
    '.kL..kkkkkk.Lk..',
    '.kL.........Lk..',
    '.kk.........kk..',
    '.::::::::::::::.',
  ],
  { k: '#20242a', M: '#7a8490', m: '#9aa4b0', L: '#4a5460', G: '#c8a040', p: '#3a3a42', P: '#6a6a74', b: '#c03a3a' },
);

const crystalForge = px(
  [
    '................',
    '.......x........',
    '......xXx.......',
    '......xwx.......',
    '.....xXXXx......',
    '..kkkkkkkkkkkk..',
    '.kAAAAAAAAAAAAk.',
    '.kAaAAAAAAAAaAk.',
    '.kkkkAAAAAAkkkk.',
    '....kAAAAAAk....',
    '....kAaAAaAk....',
    '...kkkkkkkkkk...',
    '..kAAAAAAAAAAk..',
    '..kAAxAAAAxAAk..',
    '..kkkkkkkkkkkk..',
    '..::::::::::::..',
  ],
  { k: '#140a10', A: '#3a2a34', a: '#5a4250', x: '#c02040', X: '#ff4a60', w: '#ffd0d8' },
);

const bed = px(
  [
    '................',
    '................',
    '................',
    '................',
    'kk............kk',
    'kBkkkkkkkkkkkkBk',
    'kBwwwkRRRRRRRRBk',
    'kBwwwkRrRRRRRRBk',
    'kBwwwkRRRRRrRRBk',
    'kBkkkkRRRRRRRRBk',
    'kBBBBkRRRrRRRRBk',
    'kkkkkkkkkkkkkkkk',
    'kB............Bk',
    'kk............kk',
    '::::::::::::::::',
    '................',
  ],
  { k: '#2e1e14', B: '#8a5a2a', w: '#f0f0f0', R: '#b02a3a', r: '#d04a5a' },
);

const sleepingBag = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwkGGGGGGGGk.',
    '.kwwwkGgGGGGgGk.',
    '.kwwwkGGGGgGGGk.',
    '.kkkkkGGgGGGGGk.',
    '..kkkkkkkkkkkk..',
    '..::::::::::::..',
    '................',
    '................',
    '................',
  ],
  { k: '#1e2a1a', w: '#d8d0c0', G: '#4a6a3a', g: '#6a8a4a' },
);

const totem = px(
  [
    '.......kk.......',
    '......kRRk......',
    '.....kRRRRk.....',
    '.....kRRRRRkk...',
    '.....kRRRRRRRk..',
    '.....kRrRRRRRk..',
    '.....kRRRRRkk...',
    '.....kRRk.......',
    '......kWk.......',
    '.....kWWWk......',
    '....kWyWyWk.....',
    '....kWWWWWk.....',
    '....kWwWwWk.....',
    '.....kWWWk......',
    '......kWk.......',
    '.....kWWWk......',
    '....kWWWWWk.....',
    '....kWyWyWk.....',
    '....kWWWWWk.....',
    '.....kWWWk......',
    '......kWk.......',
    '......kWk.......',
    '.....kkWkk......',
    '....:kkkkk:.....',
    '.....:::::......',
  ],
  { k: '#1e140e', R: '#c02a3a', r: '#ff5a6a', W: '#7a5530', w: '#5a3a20', y: '#f0c040' },
);

const farmPlot = px(
  [
    'kkkkkkkkkkkkkkkk',
    'kDDDDDDDDDDDDDDk',
    'kdddddddddddddDk',
    'kDDDDDDDDDDDDDDk',
    'kddddddddddddddk',
    'kDDDDDDDDDDDDDDk',
    'kdddddddddddddDk',
    'kDDDDDDDDDDDDDDk',
    'kddddddddddddddk',
    'kDDDDDDDDDDDDDDk',
    'kdddddddddddddDk',
    'kDDDDDDDDDDDDDDk',
    'kddddddddddddddk',
    'kDDDDDDDDDDDDDDk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  { k: '#3a2414', D: '#6a4228', d: '#4e301c' },
);

const sprout = px(
  ['................', '................', '................', '................', '................', '................', '................', '................', '......g..g......', '.....gG..Gg.....', '......gGGg......', '.......gg.......'],
  { g: '#3a8a3a', G: '#6ac85a' },
);
const carrotMid = px(
  ['................', '................', '................', '................', '................', '....g.g..g.g....', '....gGgggGgG....', '.....gGGGGg.....', '...g.gGGGGg.g...', '...gGgGGGGgGg...', '....ggGGGGgg....', '......gGGg......'],
  { g: '#2f7a2f', G: '#5ab84a' },
);
const carrotRipe = overlay(carrotMid, px(['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '......oOOo......', '......oOOo......', '.......oo.......'], { o: '#d06a1a', O: '#f08a2a' }));
const pumpkinMid = px(
  ['................', '................', '................', '................', '................', '................', '.....gg...gg....', '....gGGg.gGGg...', '..ggGGGGgGGGgg..', '.gGGgGGGGGgGGGg.', '..gg.gggggg.gg..'],
  { g: '#2f6a2f', G: '#58a84a' },
);
const pumpkinRipe = overlay(
  pumpkinMid,
  px(['................', '................', '................', '................', '................', '.......g........', '.....kogok.....', '....kOoOoOk....', '...kOOoOOoOk...', '...kOOoOOoOk...', '....kOoOoOk....', '.....kkkkk.....'], { o: '#c8641a', O: '#f08a2a', k: '#7a3a10', g: '#3a6a2a' }),
);

const spikeTrap = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...w...w...w....',
    '..wW..wW..wW....',
    '..bW..bW..bW..w.',
    '..b...b...b..wW.',
    '.bb..bb..bb..bW.',
    'kkkkkkkkkkkkkkb.',
    'kBBBBBBBBBBBBkk.',
    'kkkkkkkkkkkkkk..',
    '.:::::::::::::..',
    '................',
  ],
  { w: '#d8d0c0', W: '#a89880', b: '#6a4a2a', B: '#8a6a3a', k: '#2e1e14' },
);

const marketStall = px(
  [
    'rrrrwwwwrrrrwwww',
    'rRRrwWWwrRRrwWWw',
    'rrrrwwwwrrrrwwww',
    '.kk.........kk..',
    '.kL.........Lk..',
    '.kL..o..g...Lk..',
    '.kL.oOogGg..Lk..',
    'kkkkkkkkkkkkkkkk',
    'kTTTTTTTTTTTTTTk',
    'kTtTTTTtTTTTtTTk',
    'kkkkkkkkkkkkkkkk',
    '.kL.........Lk..',
    '.kL.........Lk..',
    '.kL.........Lk..',
    '.kk.........kk..',
    '.::::::::::::::.',
  ],
  { r: '#b02a3a', R: '#d04a5a', w: '#f0e8e0', W: '#ffffff', k: '#2e1e14', L: '#6a4628', T: '#b08a50', t: '#8a6a3a', o: '#d06a1a', O: '#f08a2a', g: '#3a8a3a', G: '#6ac85a' },
);

function campfire(frame: 0 | 1 | 2): PixelSprite {
  const base = px(
    [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....b......b....',
      '.....bB..Bb.....',
      '......bBBb......',
      '..kk.bBbbBb.kk..',
      '.kRRkkbkkbkkRRk.',
      '.kRk.kRRRRk.kRk.',
      '..kkkk.kk.kkkk..',
    ],
    { b: '#4a2f1d', B: '#7a4f2c', k: '#34343c', R: '#8a8a92' },
  );
  if (frame === 0) return base;
  const flame =
    frame === 1
      ? ['................', '................', '.......y........', '......yY........', '......yYy.......', '.....yYOYy......', '.....yYOOYy.....', '....yYOOOOy.....', '....yYOrrOYy....', '.....yOrrOy.....', '......yrry......']
      : ['................', '................', '........y.......', '........Yy......', '.......yYy......', '......yYOYy.....', '.....yYOOYy.....', '.....yOOOOYy....', '....yYOrrOYy....', '.....yOrrOy.....', '......yrry......'];
  return overlay(base, px(flame, { y: '#c8401a', Y: '#f07a20', O: '#ffb030', r: '#fff0a0' }), 0, 1);
}

const torchStand = px(
  [
    '.......y........',
    '......yYy.......',
    '......YOY.......',
    '.....yOrOy......',
    '......kkk.......',
    '......kBk.......',
    '.......B........',
    '.......B........',
    '.......B........',
    '.......B........',
    '.......B........',
    '.......B........',
    '......bBb.......',
    '.....bbBbb......',
    '.....::::::.....',
  ],
  { y: '#c8401a', Y: '#f07a20', O: '#ffb030', r: '#fff0a0', k: '#2e1e14', B: '#7a4f2c', b: '#4a2f1d' },
);

const lamp = px(
  [
    '................',
    '.......kk.......',
    '......k..k......',
    '.....kkkkkk.....',
    '.....kYYYYk.....',
    '.....kYrrYk.....',
    '.....kYrrYk.....',
    '.....kYYYYk.....',
    '.....kkkkkk.....',
    '.......kk.......',
    '.......MM.......',
    '.......MM.......',
    '.......MM.......',
    '.....kkMMkk.....',
    '....kMMMMMMk....',
    '....::::::::....',
  ],
  { k: '#20242a', Y: '#f0b030', r: '#fff6c0', M: '#5a6470' },
);

export const STRUCTURE_SPRITES: Record<string, PixelSprite> = {
  campfire: campfire(0),
  campfire_1: campfire(1),
  campfire_2: campfire(2),
  torch_stand: torchStand,
  lamp,
  wood_wall: woodWall,
  stone_wall: stoneWall,
  iron_wall: ironWall,
  wood_door: woodDoor,
  iron_door: ironDoor,
  wood_floor: woodFloor,
  chest,
  workbench,
  furnace,
  mech_bench: mechBench,
  crystal_forge: crystalForge,
  bed,
  sleeping_bag: sleepingBag,
  totem,
  farm_plot: farmPlot,
  spike_trap: spikeTrap,
  market_stall: marketStall,
  crop_sprout: sprout,
  crop_carrot_1: carrotMid,
  crop_carrot_2: carrotRipe,
  crop_pumpkin_1: pumpkinMid,
  crop_pumpkin_2: pumpkinRipe,
};

// ═════════════════════════ NHÂN VẬT ═════════════════════════

const HUMAN_TOP = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhSSSShh....',
  '....hSSSSeSh....',
  '....hSSSSeSh....',
  '.....SSSSSS.....',
  '......cccc......',
  '.....cCCCCc.....',
  '....SCCCCCCS....',
  '....SCCCCCCS....',
  '.....CCCCCC.....',
];
const LEGS = [
  ['.....pp..pp.....', '.....pp..pp.....', '.....bb..bb.....', '....::::::::....'],
  ['.....pp...pp....', '.....pp...bb....', '.....bb.........', '....::::::::....'],
  ['....pp...pp.....', '....bb...pp.....', '..........bb....', '....::::::::....'],
];

export const SHIRT_COLORS = ['#3a6ab0', '#b03a3a', '#3a9a5a', '#b08a2a', '#7a3ab0', '#2a9aa8', '#c0602a', '#5a5a6a'];

function human(frame: number, pal: Record<string, string>): PixelSprite {
  return px([...HUMAN_TOP, ...LEGS[frame]!], { h: '#3a2418', S: '#e8b890', e: '#1a1a1a', p: '#34405a', b: '#2a1a14', ...pal });
}

export const CHARACTER_SPRITES: Record<string, PixelSprite> = {};
SHIRT_COLORS.forEach((c, i) => {
  for (let f = 0; f < 3; f++) {
    CHARACTER_SPRITES[`player_${i}_${f}`] = human(f, { C: c, c: shade(c, -0.25) });
  }
});

/** NPC: áo khác màu, một số đội nón lá. */
const NON_LA = px(
  ['.......yy.......', '......yYYy......', '....yyYyYYyy....', '..yyYYYYYYYYyy..', '.yyyyyyyyyyyyyy.'],
  { y: '#b8963a', Y: '#e8c870' },
);
function npc(pal: Record<string, string>, hat: boolean): PixelSprite {
  const base = human(0, pal);
  return hat ? overlay(base, NON_LA, 0, -1) : base;
}
CHARACTER_SPRITES.npc_general = npc({ C: '#8a3a8a', c: '#6a2a6a', h: '#141010' }, true);
CHARACTER_SPRITES.npc_smith = npc({ C: '#5a3a24', c: '#3a2414', h: '#5a5a5a', S: '#d0a078' }, false);
CHARACTER_SPRITES.npc_doctor = npc({ C: '#f0f0f0', c: '#c8c8d0', h: '#2a1a14' }, false);
CHARACTER_SPRITES.npc_scrap = npc({ C: '#4a6a3a', c: '#344a28', h: '#6a4a2a' }, true);
CHARACTER_SPRITES.npc_keeper = npc({ C: '#4a4a6a', c: '#34344a', h: '#c8c8c8' }, false);
CHARACTER_SPRITES.npc_guide = npc({ C: '#2a7a6a', c: '#1a5a4a', h: '#2a1a10' }, true);

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  r = f(r);
  g = f(g);
  b = f(b);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ═════════════════════════ QUÁI VẬT ═════════════════════════

const rabbit = px(
  [
    '................',
    '................',
    '................',
    '................',
    '..........ww....',
    '..........wW....',
    '.........wwWw...',
    '........wwwwew..',
    '...wwwwwwwwwwn..',
    '..wwWWWWWwwww...',
    '.wwWWWWWWWww....',
    '.wWWWWWWWWw.....',
    '..wwwwwwwww.....',
    '...ww...ww......',
    '..::::::::......',
    '................',
  ],
  { w: '#a89880', W: '#e0d4c0', e: '#1a1a1a', n: '#e08080' },
);

const deer = px(
  [
    '..........a.a...',
    '..........aaa...',
    '...........a....',
    '..........dDd...',
    '.........dDDed..',
    '...........DDdn.',
    '..dddddddddDd...',
    '.dDDDDDDDDDDd...',
    '.dDDwDDDDwDd....',
    '.dDDDDDDDDDd....',
    '..dDDDDDDDd.....',
    '..dd.d...d.d....',
    '..d..d...d..d...',
    '..d..d...d..d...',
    '..k..k...k..k...',
    '.::::::::::::...',
  ],
  { a: '#8a7050', d: '#6a3a1e', D: '#a8683a', w: '#e8d8c0', e: '#1a1a1a', n: '#2a1a14', k: '#2a1a14' },
);

const boar = px(
  [
    '................',
    '................',
    '................',
    '................',
    '......bbbbbb....',
    '....bbBBBBBBbb..',
    '...bBBBBBBBBBbb.',
    '..bBBBBBBBBBeBbb',
    '..bBBBBBBBBBBBnw',
    '..bBBBBBBBBBBBBb',
    '...bBBBBBBBBBbb.',
    '...bb.bb..bb.b..',
    '...bb.bb..bb.b..',
    '...kk.kk..kk.k..',
    '..::::::::::::..',
    '................',
  ],
  { b: '#3a2418', B: '#6a4a30', e: '#e0e0e0', n: '#d8a090', w: '#f0f0e0', k: '#1a1010' },
);

const crab = px(
  [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..rr........rr..',
    '.rRr........rRr.',
    '.rRRr.e..e.rRRr.',
    '..rr.rrrrrr.rr..',
    '....rRRRRRRr....',
    '...rRRRRRRRRr...',
    '..r.rRRRRRRr.r..',
    '.r..r.r..r.r..r.',
    '................',
    '...::::::::::...',
    '................',
  ],
  { r: '#7a2214', R: '#c04a2a', e: '#1a1a1a' },
);

const wolf = px(
  [
    '................',
    '................',
    '................',
    '...........g.g..',
    '...........gGg..',
    '..........gGGGg.',
    '..........gGGeGg',
    '.gggggggggGGGGkk',
    'gGGGGGGGGGGGGg..',
    '.gGGGGGGGGGGGg..',
    '..gGGGGGGGGGg...',
    '..gg.gg..gg.gg..',
    '..g..g....g..g..',
    '..k..k....k..k..',
    '.:::::::::::::..',
    '................',
  ],
  { g: '#3e3e46', G: '#74747e', e: '#f0c840', k: '#141418' },
);

const BEAR_ROWS = [
  '................',
  '..........bb.bb.',
  '.........bBBbBBb',
  '...bbbbbbBBBBBBb',
  '..bBBBBBBBBBBeBb',
  '.bBBBBBBBBBBBBBn',
  '.bBBBBBBBBBBBBbk',
  '.bBBBBBBBBBBBBb.',
  '.bBBBBBBBBBBBBb.',
  '.bBBBBBBBBBBBb..',
  '..bBBbbBBbbBBb..',
  '..bBb..bb..bBb..',
  '..bBb..bb..bBb..',
  '..kkk..kk..kkk..',
  '.::::::::::::::.',
  '................',
];
const bear = px(BEAR_ROWS, { b: '#2e1c12', B: '#5a3a24', e: '#1a1010', n: '#100808', k: '#100808' });
const frostBear = scale2(
  px(
    BEAR_ROWS.map((r, y) => (y === 3 ? '...bbbbbbBBBBBBb'.replace('bbb', 'xbx') : y === 7 ? '.bBBxBBBBBBxBBb.' : r)),
    { b: '#7a9ab0', B: '#d8ecf8', e: '#ff3a50', n: '#2a3a4a', k: '#2a3a4a', x: '#ff4a60' },
  ),
);

const scorpion = px(
  [
    '................',
    '................',
    '........yy......',
    '.........yY.....',
    '..........yY....',
    '..........yY....',
    '..........yY....',
    '.......yyyY.....',
    '..yy..yYYYy..yy.',
    '.yYy.yYYYYYy.yYy',
    '..yYyYYeYeYYyYy.',
    '....yYYYYYYYy...',
    '...y.y.y.y.y.y..',
    '................',
    '...::::::::::...',
    '................',
  ],
  { y: '#5a3a14', Y: '#a8742a', e: '#1a1a1a' },
);

const snake = px(
  [
    '................',
    '................',
    '................',
    '................',
    '........gGg.....',
    '.......gGeGg....',
    '........gGGg....',
    '.........gGg....',
    '....gggggGg.....',
    '...gGGGGGGg.....',
    '..gGg.ggggg.gg..',
    '..gGgggGGGGGGGg.',
    '...gGGGGggggggr.',
    '....ggggg.......',
    '..::::::::::::..',
    '................',
  ],
  { g: '#2a5a1a', G: '#5a9a2a', e: '#f0e040', r: '#e03030' },
);

const INFECTED_ROWS = [
  '................',
  '.....hhhhh......',
  '....hZZZZZh.....',
  '....ZZZZrZZ.....',
  '....ZZZZZZZ.....',
  '.....ZZmZZ......',
  '......tttt......',
  '..ZZtTTTTTtZZZ..',
  '..ZtTTtTTTTTZZ..',
  '.....TTTTTT.....',
  '.....TTtTTT.....',
  '.....pp..pp.....',
  '.....pp..pp.....',
  '....pp....pp....',
  '....kk....kk....',
  '...::::::::::...',
];
const infected = px(INFECTED_ROWS, { h: '#2a2a20', Z: '#7a8a5a', r: '#e02020', m: '#3a1a1a', T: '#5a5448', t: '#3a362e', p: '#3a3440', k: '#1a1418' });
const runner = px(
  INFECTED_ROWS.map((r, y) => (y === 3 ? '....ZZZrZrZ.....' : r)),
  { h: '#1a1014', Z: '#a85a5a', r: '#ffe040', m: '#2a0a0a', T: '#2a1a1e', t: '#1a0e12', p: '#2a2028', k: '#120a0e' },
);
const bloodHerald = scale2(
  overlay(
    px(INFECTED_ROWS.map((r, y) => (y === 3 ? '....ZZZrZrZ.....' : r)), { h: '#0a0408', Z: '#5a1a24', r: '#ff2a40', m: '#ff2a40', T: '#1a0a10', t: '#0e0408', p: '#140a10', k: '#000000' }),
    px(['...x.....x......', '...xx...xx......', '....xxxxx.......'], { x: '#c02040' }),
    0,
    -1,
  ),
);

const bloater = px(
  [
    '................',
    '......zzzz......',
    '.....zZZZZz.....',
    '.....ZZrZrZ.....',
    '....zZZZZZZz....',
    '..zzZZZZZZZZzz..',
    '.zZZZgZZZZgZZZz.',
    '.zZZZZZZgZZZZZz.',
    'zZZgZZZZZZZZgZZz',
    'zZZZZZZgZZZZZZZz',
    '.zZZZZZZZZZZZZz.',
    '.zZZgZZZZZZgZZz.',
    '..zzZZZZZZZZzz..',
    '....zz....zz....',
    '....kk....kk....',
    '..::::::::::::..',
  ],
  { Z: '#94a466', z: '#5a6a3a', g: '#d0e050', r: '#ff3030', k: '#1a1a10' },
);

const mistSpider = px(
  [
    '................',
    '................',
    '..l..........l..',
    '...l...bb...l...',
    'l...l.bBBb.l...l',
    '.l...lBBBBl...l.',
    '..llllBrrBllll..',
    '......BBBB......',
    '..lllBBBBBBlll..',
    '.l..lBBxBBBl..l.',
    'l..l.BBBBxB.l..l',
    '...l..BBBB..l...',
    '..l....bb....l..',
    '................',
    '..::::::::::::..',
    '................',
  ],
  { b: '#6a3a6a', B: '#3a1e3a', l: '#24122a', r: '#ff4060', x: '#c02a5a' },
);

export const MOB_SPRITES: Record<string, PixelSprite> = {
  rabbit,
  deer,
  boar,
  crab,
  wolf,
  bear,
  scorpion,
  snake,
  infected,
  ruin_infected: infected,
  runner,
  bloater,
  mist_spider: mistSpider,
  frost_bear: frostBear,
  blood_herald: bloodHerald,
};

// Túi hành trang khi chết
export const BAG_SPRITE = px(
  [
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '.....kBBBBk.....',
    '....kkkkkkkk....',
    '...kBBBBBBBBk...',
    '..kBBbBBBBbBBk..',
    '..kBBBByyBBBBk..',
    '..kBBBByyBBBBk..',
    '..kBbBBBBBBbBk..',
    '...kBBBBBBBBk...',
    '....kkkkkkkk....',
    '...::::::::::...',
    '................',
  ],
  { k: '#2a1a10', B: '#7a5a3a', b: '#5a4028', y: '#d8b040' },
);

export { recolor };
