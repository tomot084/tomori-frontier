import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/glTFFileLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Art } from "./models";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

/** Adapted Quaternius CC0 rig, with Tomori's own tools and resource rack. */
export class Keeper {
  private active?: AnimationGroup;
  private clips = new Map<string, AnimationGroup>();
  body!: Mesh;
  private grip!: ReturnType<Art["player"]>["toolPivot"];
  async load(art: Art, rig: ReturnType<Art["player"]>) {
    const container = await LoadAssetContainerAsync(
      import.meta.env.BASE_URL + "models/keeper.glb",
      art.scene,
    );
    container.addAllToScene();
    const assetRoot = container.meshes[0];
    assetRoot.parent = rig.root;
    assetRoot.rotationQuaternion = null;
    assetRoot.rotation.y = Math.PI;
    // Match the existing feet, reach and collision dimensions.
    assetRoot.scaling.scaleInPlace(0.75);
    rig.toolPivot.parent = rig.root;
    const oldBody = rig.body;
    oldBody.dispose();
    for (const pivot of [...rig.legs, ...rig.arms])
      for (const mesh of pivot.getChildMeshes()) mesh.dispose();
    const meshes = container.meshes.filter(
      (m) => m.getTotalVertices() > 0,
    ) as Mesh[];
    for (const mesh of meshes) {
      if (/bow/i.test(mesh.name)) {
        mesh.setEnabled(false);
        continue;
      }
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      const source = mesh.material as PBRMaterial;
      source.metallic = 0;
      source.roughness = 1;
      source.albedoColor = Color3.White();
      source.unlit = true;
      source.backFaceCulling = false;
      source.emissiveColor = Color3.Black();
      if (mesh.name === "Cloak") {
        const cloth = new StandardMaterial("tomori-hood", art.scene);
        cloth.diffuseColor = new Color3(0.23, 0.66, 0.68);
        cloth.specularColor = Color3.Black();
        cloth.backFaceCulling = false;
        mesh.material = cloth;
      }
      if (!this.body || mesh.getTotalVertices() > this.body.getTotalVertices())
        this.body = mesh;
    }
    rig.body = this.body;
    // glTF animated bone transform nodes provide the grip without a second limb rig.
    const hand = container.transformNodes.find((n) => n.name === "Fist.R");
    if (!hand) throw new Error("Keeper hand attachment missing");
    this.grip = rig.toolPivot;
    rig.toolPivot.parent = hand;
    rig.toolPivot.position.set(0, 0, 0);
    rig.toolPivot.rotation.set(0, 0, -Math.PI / 2);
    rig.toolPivot.scaling.setAll(1 / 0.75);
    for (const group of container.animationGroups) {
      this.clips.set(group.name, group);
      group.stop();
    }
    // A lantern and warm scarf retain the island explorer's own identity.
    const scarf = art.cylinder(
      "keeper-lantern-scarf",
      0,
      1.62,
      0,
      0.27,
      0.27,
      0.12,
      0xf8c56b,
      10,
    );
    scarf.parent = rig.torso;
    const lantern = art.cylinder(
      "keeper-belt-lantern",
      0.34,
      0.77,
      -0.12,
      0.1,
      0.12,
      0.21,
      0xffdc8f,
      8,
    );
    lantern.parent = rig.torso;
    const head = container.transformNodes.find((n) => n.name === "Head")!;
    for (const side of [-1, 1]) {
      const eye = art.sphere(
        "keeper-eye",
        side * 0.12,
        0.29,
        0.32,
        0.065,
        0.105,
        0.035,
        0x213e49,
      );
      eye.parent = head;
    }
    this.pose(0, 0, -1, "wood");
  }
  metrics() {
    return {
      source: "Quaternius RPG Ranger",
      ready: !!this.body,
      clip: this.active?.name,
      clips: [...this.clips.keys()],
    };
  }
  pose(time: number, moving: number, phase: number, kind: string) {
    const swinging = phase >= 0 && phase < 1;
    const name = swinging
      ? kind === "food"
        ? "PickUp"
        : "Punch"
      : moving > 0.05
        ? "Run"
        : "Idle";
    const clip = this.clips.get(name)!;
    if (clip !== this.active) {
      this.active?.stop();
      clip.start(true);
      clip.pause();
      this.active = clip;
    }
    const t = swinging
      ? Math.max(0, Math.min(0.98, phase))
      : (time * (moving > 0.05 ? 1.7 : 0.32)) % 1;
    clip.goToFrame(clip.from + (clip.to - clip.from) * t);
    // Sweep the oversized axe/pick through the strike, with the hand animation.
    this.grip.rotation.x =
      swinging && kind !== "food"
        ? -0.6 + Math.sin(Math.min(1, phase) * Math.PI) * 1.5
        : 0;
  }
}
