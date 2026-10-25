// Реестр моделей. Пока у всех url пустой — используются заглушки из примитивов.
// Когда появится glTF-файл, положить его в public/models/ и прописать url (и лицензию в CREDITS.md).

export const MODELS: Record<string, { url?: string; scale?: number }> = {
  leva: {},
  nika: {},
  restorer: {},
  druzhinnik: {},
  ratnik: {},
  scooter: {},
};
