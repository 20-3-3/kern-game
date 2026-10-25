// Внешний вид персонажей-заглушек из примитивов (до появления glTF-моделей).

import type { RigSpec } from '../render/characters';

export const LEVA: RigSpec = {
  height: 1.76,
  skin: 0xe0b08f,
  top: 0x1f5f73,
  bottom: 0x2b3442,
  shoes: 0xe8e8e8,
  hair: 0x4a3222,
  accessories: ['cap', 'headset', 'courierBag'],
};

export const NIKA: RigSpec = {
  height: 1.68,
  skin: 0xe8c0a0,
  top: 0x6b6f3a,
  bottom: 0x22262e,
  shoes: 0x3a2a20,
  hair: 0x1c1410,
  accessories: ['coat', 'glasses', 'ponytail'],
};

export const RESTORER: RigSpec = {
  height: 1.82,
  skin: 0xd8b090,
  top: 0x2a2d33,
  bottom: 0x1d1f24,
  shoes: 0x111111,
  hair: 0x2b2b2b,
  accessories: ['coat'],
  bulk: 1.1,
};

export const RESTORER_LEADER: RigSpec = {
  ...RESTORER,
  top: 0x3b2f2a,
  accessories: ['coat', 'glasses'],
};

export const DRUZHINNIK: RigSpec = {
  height: 2.2,
  skin: 0xc8d8e8,
  top: 0x51606e,
  bottom: 0x3b4550,
  shoes: 0x2a3038,
  hair: 0x9aa8b8,
  accessories: ['chainmail', 'helmet', 'shield', 'beard'],
  imprint: { color: 0x7fd8ff, opacity: 0.86 },
  bulk: 1.25,
};

export const RATNIK: RigSpec = {
  height: 1.8,
  skin: 0xc8d8e8,
  top: 0x51606e,
  bottom: 0x3b4550,
  shoes: 0x2a3038,
  hair: 0x9aa8b8,
  accessories: ['helmet', 'chainmail'],
  imprint: { color: 0x7fd8ff, opacity: 0.7 },
};
