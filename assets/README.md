# Авторы и лицензии 3D-моделей

| Модели | Автор и источник | Лицензия |
| --- | --- | --- |
| Деревни, хозяйственные постройки и реквизит | [Quaternius — Medieval Village Pack](https://quaternius.com/packs/medievalvillage.html) | CC0 1.0 |
| Стены, башни и укрепления | [Quaternius — Modular Medieval Building Pack](https://quaternius.com/packs/modularmedievalbuildings.html) | CC0 1.0 |
| Деревья, растения, полевые культуры и камни | [Quaternius — Ultimate Nature Pack](https://quaternius.com/packs/ultimatenature.html) | CC0 1.0 |
| Поселенцы и основа для части войск | [Quaternius — Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html) | CC0 1.0 |
| Персонажи, огнестрельное оружие, пушки и сокровища | [Quaternius — Pirate Kit](https://quaternius.com/packs/piratekit.html) | CC0 1.0 |
| Холодное оружие, лук и щит | [Quaternius — Modular Weapons Pack](https://quaternius.com/packs/medievalweapons.html) | CC0 1.0 |
| Лошади, волки и оленевые. Вилорог и карибу адаптированы из моделей оленей | [Quaternius — Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html) | CC0 1.0 |
| Медведь | [Pixor — Bear](https://pixor.art/library/creatures/bear/) | CC0 1.0 |
| Бизон | [Poly by Google — Bison](https://poly.pizza/m/9sTrha-TxdS) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Застава | [Kenney — Pirate Kit](https://kenney.nl/assets/pirate-kit), [версия Aether Assets на Hugging Face](https://huggingface.co/datasets/StarAtNyte1/aether-assets/resolve/main/models/watchtower/watchtower.glb) | CC0 1.0 |

Модели адаптированы для игры. Масштаб, палитры и сетки изменены. Для бизона упрощена сетка, а цвета запечены в вершины. Олень, карибу и вилорог используют оригинальные циклы покоя, ходьбы, галопа и падения из набора Quaternius.

`models.json` содержит игровые сетки. Обычная сборка использует этот файл локально. Для обновления набора установите Python-библиотеки NumPy и Pillow и запустите `python tools/import-models.py`. Источники и ревизии указаны в скрипте.
