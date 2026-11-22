// Twenty distinct original embroidered compositions, not recolors of one template.
const patches = [
  ['midnight-meadow', 'Midnight Meadow Bouquet', 'flowers botanical meadow bouquet', 'scallop', '#253d51', '#d9b45c'],
  ['peony-poetry', 'Peony Poetry', 'flowers peony pink floral', 'oval', '#eed7cf', '#a14b63'],
  ['wildflower-letter', 'Wildflower Love Letter', 'flowers envelope botanical letter', 'shield', '#849b81', '#f2e3bd'],
  ['apricot-sky', 'Apricot Cloudscape', 'skies sunset sun clouds', 'arch', '#c16b54', '#f6d69b'],
  ['moon-garden', 'Moon Garden', 'skies moon stars flowers night celestial', 'circle', '#303853', '#d2b56e'],
  ['rainbow-drizzle', 'Rainbow Drizzle', 'skies rainbow clouds rain', 'oval', '#c9dadd', '#496a80'],
  ['pearl-shell', 'Pearl in a Coral Shell', 'beach shell seashell pearl ocean', 'scallop', '#e7b0a7', '#a95c61'],
  ['tidal-treasures', 'Tidal Treasures', 'beach shell starfish sea ocean coral', 'circle', '#346f75', '#ebd2a3'],
  ['coastal-bouquet', 'Coastal Keepsake Bouquet', 'beach shell flowers sea lavender sand', 'shield', '#ddc7a0', '#7b8c85'],
  ['secret-garden-library', 'Secret Garden Library', 'books flowers book reading library', 'arch', '#6c4e6d', '#d9b77c'],
  ['one-more-chapter', 'One More Moonlit Chapter', 'books skies moon stars reading', 'oval', '#416581', '#e8c77f'],
  ['matcha-book-club', 'Matcha Book Club', 'matcha books tea reading', 'rounded', '#7d9270', '#f3dfb9'],
  ['golden-quill', 'Golden Quill Flourish', 'calligraphy quill writing lettering ink', 'circle', '#eee0bb', '#7f5e82'],
  ['bloom-script', 'Let Yourself Bloom', 'calligraphy flowers lettering bloom art', 'oval', '#d8b2bd', '#70475e'],
  ['violet-ink', 'Violet Ink & Petals', 'calligraphy art ink pen flowers lavender', 'shield', '#645f80', '#cbbdda'],
  ['painted-daydream', 'Painted Daydream', 'art artist palette paint colors', 'scallop', '#bd805e', '#f2d8aa'],
  ['brush-bouquet', 'A Bouquet of Brushes', 'art paint brushes flowers artist', 'arch', '#537e76', '#e6bd80'],
  ['matcha-ceremony', 'Little Matcha Ceremony', 'matcha tea bowl whisk flowers', 'oval', '#e1c3b5', '#777f54'],
  ['iced-matcha-sunshine', 'Iced Matcha Sunshine', 'matcha iced tea skies sun glass', 'rounded', '#e9cf83', '#69826a'],
  ['strawberry-matcha', 'Strawberry Matcha Picnic', 'matcha strawberry tea picnic flowers', 'shield', '#668a75', '#efc4b4'],
];
export const PATCH_STYLES = Object.freeze(patches.map(([art, title, tags, shape, color, border]) => Object.freeze({
  id: `patch-${art}`, kind: 'patch', collectionId: 'embroidered-patches', collection: 'Embroidered patches',
  art, title, name: `${title} · Embroidered patch`, tags, shape, color, border,
})));
