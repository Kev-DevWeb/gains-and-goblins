import { ENEMIES } from './constants.js';

// Deeproot, 60×45. One character per tile; MapGenerator turns them into tiles.
//   C forest canopy   e forest edge   g grass   v flowers   Y tall grass   h bush   r rock   m mushrooms
//   d dirt path       w water         y lily pad          D dock
//   p plaza stone     o guild roof    f guild wall        W window   ( ) guild door   F flag
//   P pull-up bar     B parallel bars L lift stones       b log bench   l track start line
//   O tire            Q kettlebells   Z balance beam      U fountain    M yoga mat
//   [ ] { } goblin tent (top left, top right, bottom left, bottom right)
//   c campfire        - | palisade    s skull pole        S sign
//   k cliff top       K cliff         0-7 cave mouth (top row 0-3, bottom row 4-7)
export const DEEPROOT_LAYOUT = [
  'CCCCCCCCCCCCCCCCCCCCCooooooooooooooooooCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCooooooooooooooooooCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCffWffWffffffWffWffCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCeeeeheeeeeereeeefFffffff()ffffffFfeeeeeeeeeeeeeeeeeCCCC',
  'CCCCCgvggggggggggvgggggppppppppppppppggggghgggggggvghggghCCC',
  'CCCCCgggggvggvgvgggvgggppppppppppppppgggggggYgvgrgggggCCCCCC',
  'CCCCegggvgggggghggggggSppppppppppppppvgggggggggggghggCCCCCCC',
  'CCCCCgggggggggvggggggggppppppppppppppggggggvvvggvggggCCCCCCC',
  'CCCChggggggvvgggggggvggvggvggddgggggggggggvgYggggggggCCCCCCC',
  'CCCCggdddddddddddddggggggggggddgggggrgvggggYhggggggggCCCCCCC',
  'CCCCgdddddddddddddddggvhgggggdddggggYvggggggggvgggvYgCCCCCCC',
  'CCCegddvggggggggggddgggvggggggddvvgggvrgggggggvvgggvgeCCCeCC',
  'CCChgddgPvPvgBggUgddggvghgggggdddggggggvggvggwgggggYggeeeCCC',
  'CCeggddgggggvgggggddgggggggvgggddggggvggggggwwwgwwwggggggCCC',
  'CChggddgOgggvgggQgddggggggvggggddggggvgwwwwwwwwwwwwwggYgCCCC',
  'CCgvgllgggggbgvgvvddddddddddddgddggggggwwwwwywwwwwwwwwwCCCCC',
  'CCgggddgZZggggggggddddddddddddgddggggggwwwwwwwwwwwwwwwwCCCCC',
  'CCgggddgvgggggggLgddgSgggggggggddgggggwwwwwwwwwwwwwwwywwCCCC',
  'CCCggddvLggOgbggggddgggggggggvgddgggwwwwwwwwwwwwwwwwwwwwCCCC',
  'CCCCgddggggvggggggddvgggggggggddddddDDDDDwwwwwwwwwwwwwwwwCCC',
  'CCCCgdddddddddddddddggvgvgggggddddddgwwwwwwwwwwwwwwwwwwwCCCC',
  'CCCCggdddddddddddddgggggggggggddgggSwwwwwwwwwywwwwwwwwwweCCC',
  'CCCCggggggvggggggggggghggCCCgdddggggwwwwwwwwwwwwwwwwwwwwwCCC',
  'CCCCCCggMgMgMgMggUgvggggCCCCCddggvgvggwwywwwwwwwwwwywwwwgeCC',
  'CCCCCCCvvggggggggggggggheCCCdddggrggggvwwwwwwwwwwwwwwwwgggCC',
  'CCCCCCCYggggvggggYgggggggeeeddgYgggYhYgwwwwwwwwwwwwwwwwgghCC',
  'CCCCCCCgggggYvYggggggggggggdddgggggggggwwwwwwwwywwwwwwggggCC',
  'CCCCCC-----------------ggggddvgggggggggggggwwwwwwwwgggvgggCC',
  'CCCCee|d[]ddd[]ddd[]dd|gghgddggvvgggggggggggggggggggggggvCCC',
  'CCCegg|d{}ddd{}ddd{}dd|ggggddgvggggggggggvgggggggmgggvggvCCC',
  'CCCCgg|dddddddddddddds|YgggddgrYggggrgggYggYggvgggggYgggCCCC',
  'CCCegg|ddddddddddddddddddddddggggvggggggggCCCCCgvgghggggCCCC',
  'CCCmgg|ddddddcdddddddddddddddvggggghvggggCCCCCCCgggggggCCCCC',
  'CCeggg|d[]dddddd[]ddds|vgggdddgggggggggghCCCCCCCgggggrghCCCC',
  'CCYggg|d{}dddddd{}dddd|gggggddggggggmggggCCCCCCCgggggggCCCCC',
  'CCgggg|ddddddddddddddd|gggggdddvghgvgggYgeCCCCCegvgggggCCCCC',
  'CCCggg|ddddddddddddddd|ggggggddYggggggggggheeeegggghCCCeCCCC',
  'CCChgg-----------------ggggSgddggggggggggggYgggggvgCCCCCCCCC',
  'CCCggggggggggggggggYYggggggggddvYggggYggggggggggggCCCCCCCCCC',
  'CCCgggggvggvvgvhgvgggggkkkkk0123kkkkkggvhggvgggYggCCCCCCCCCC',
  'CCCCgvggggggggggvgvggggKKKKK4567KKKKKgYgggggrgggggCCCCCCCeCC',
  'CCCCCCCgggggmgvggCCCCgCCCCCCCCCCCCCCCCggggvggCgCCgeCCCCCeCCC',
  'CCCCCCCCCCggggCCCCCCCCCCCCCCCCCCCCCCCCCgggCCCCCCCCCCCCCegCCC',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
];

export const DEEPROOT_CHEST_SPOTS = [
  { x: 41, y: 7 },
  { x: 16, y: 18 },
  { x: 4, y: 21 },
  { x: 25, y: 26 },
  { x: 55, y: 31 },
  { x: 50, y: 33 },
];

// Safe near the guild and the park; Slimes by the lake; goblins in the camp and by the cave
export const DEEPROOT_ENEMIES = [
  { x: 36.5, y: 12.5, type: ENEMIES.SLIME },
  { x: 34.5, y: 24.5, type: ENEMIES.SLIME },
  { x: 41.5, y: 29.5, type: ENEMIES.SLIME },
  { x: 53.5, y: 29.5, type: ENEMIES.SLIME },
  { x: 56.5, y: 13.5, type: ENEMIES.SLIME },
  { x: 48.5, y: 11.5, type: ENEMIES.SLIME },
  { x: 31.5, y: 23.5, type: ENEMIES.SLIME },
  { x: 11.5, y: 31.5, type: ENEMIES.GOBLIN },
  { x: 16.5, y: 30.5, type: ENEMIES.GOBLIN },
  { x: 19.5, y: 32.5, type: ENEMIES.GOBLIN },
  { x: 26.5, y: 37.5, type: ENEMIES.GOBLIN },
  { x: 33.5, y: 36.5, type: ENEMIES.GOBLIN },
  { x: 46.5, y: 37.5, type: ENEMIES.GOBLIN },
  { x: 11.5, y: 36.5, type: ENEMIES.GOBLIN_BOW },
  { x: 20.5, y: 30.5, type: ENEMIES.GOBLIN_BOW },
  { x: 14.5, y: 35.5, type: ENEMIES.GOBLIN_MAGE },
  { x: 44.5, y: 38.5, type: ENEMIES.GOBLIN_MAGE },
];
