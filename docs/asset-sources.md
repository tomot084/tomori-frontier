# Third-party 3D assets

Selected for Tomori Frontier on 2026-10-05. All runtime assets are self-hosted;
there are no runtime requests to asset sites, Drive or CDNs.

| Asset                                                                         | Author / primary source                                                          | License                                                   | Published representation                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `tree_oak`, `tree_pineRoundD`, `tree_pineTallA_detailed`                      | [Kenney Nature Kit 2.1](https://kenney.nl/assets/nature-kit)                     | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `src/assets/nature-meshes.json`, bundled vertex positions/normals/colours |
| Ranger character, skeleton, texture, Idle / Run / Punch / PickUp / RecieveHit | [Quaternius RPG Character Pack](https://quaternius.com/packs/rpgcharacters.html) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | `public/models/keeper.glb`                                                |

## Adaptation

Kenney OBJ geometry is triangulated, sized to Tomori's resource trees, given
Tomori forest greens/bark colours and gold lantern fruit. Seeded rotations and
sizes avoid identical silhouettes. Each tree is merged to one mesh, preserving
hit flash, shaking, felling, occlusion and bounded draw counts.

The Ranger GLTF is converted to a self-contained GLB. Only selected animations
remain in its JSON. The model keeps its painted material treatment, with
Tomori's own scarf, lantern, eye details, tools and bounded resource stack.
The bow is disabled. Tools follow the animated hand node. Clips are sampled by
game time, including the existing brief held impact pose. Imported models alter
presentation, not save data, resource quantities, reach, costs or collision.

Author preview images, full downloaded packs, alternate candidates (including
Warrior and Stylized Nature), and user reference images are local working
material, not public assets. Distribution is restricted to the selected model,
built code and CSS. License records are in `docs/licenses/`.

## License verification

The current general Quaternius license page displays QAL v1.0 (2026-08-28),
which differs from the RPG pack page. The actual downloaded RPG Characters
folder includes its own `License.txt` explicitly granting CC0 1.0. That
pack-specific license was downloaded with the model and is retained verbatim
in `docs/licenses/quaternius-rpg-characters.txt`, with its source file link.
This project relies on that explicit pack license, not an assumption that all
Quaternius assets are CC0.

## Reproduction

`python scripts/prepare-cc0-assets.py '<Nature Kit Models/OBJ format>' '<Ranger.gltf>'`

The script triangulates the selected trees and packs the selected character's
accessors, image and animation samples. Unused bow geometry, its material, and
unused animation buffers are removed. Retained binary payloads are copied
byte-for-byte and checked during packing. The final character is about 1.30 MB,
versus the 2.99 MB downloaded self-contained GLTF.

Original Ranger GLTF SHA-256:
`2732741d5e21c20760d7f3dd9d71812d4b796f466be1a6cba212f45483dd56ed`.

Source downloads stay in ignored local storage; the source packs are not part of
the repository or distribution. The tree JSON contains only derived geometry
for the three selected trees; it is compiled into the application bundle.

## Living-island pass (2026-10-05)

The approved GLB and Kenney geometry are unchanged. Runtime adaptations now use
scene lighting on the Ranger, adjusted proportions, a slightly larger head,
and brighter hood cloth. Per-island leaf colours are applied to copied vertex
colours. Fourteen additional background trees fill the opening forest.

Lantern helpers are original code-built meshes (hood, lantern body, face, hands,
and cargo), not an imported character or a reference-image derivative. Short
feedback cues are generated with Web Audio oscillators after a user gesture;
there are no audio assets or runtime requests to another origin. These meshes
and cues ship inside the built JavaScript. The existing third-party licences
and public-artifact allowlist remain unchanged.

### 投資拠点・市場の追加（2026-10-05）

5種の地面タイルと費用表示（DynamicTexture）、道具台・かご・市場の小物、客用の板張りはプロジェクト内のコードで生成。配達係・客は既存のTomori独自精霊モデルを使用。追加の外部素材、参考画像由来の画像、外部音源は含まない。既存Kenney/QuaterniusのCC0出典は変更なし。
