// Дом Лёвы: коробка деда и кассета «Не бей громкое. Дослушай.»
// Тихая сцена без боя и без юмора.

import * as THREE from 'three';
import type { InputFrame } from '../../core/input';
import { isPressed } from '../../core/input';
import { LevelScene } from '../level-scene';
import { vec3, type Vec3 } from '../../core/math';
import { DialogueRunner } from '../../dialogue/engine';
import type { GameContext } from '../../core/context';
import { Npc, armNika } from './npc';
import { NIKA } from '../../data/characters';
import { HOME_KILL_ECHO, HOME_TEXT, SCRIPT_CASSETTE, SCRIPT_HOME_ENTER, VETROV_LETTER } from '../../data/text/prologue';
import { DRUZHINNIK_BOSS } from '../../data/bosses/druzhinnik';
import { groundTexture, makeLabelTexture } from '../../render/world-kit';
import type { TouchLayout } from '../../core/scene';
import { TOUCH_TEXT } from '../../data/text/ui';

type Phase = 'enter' | 'explore' | 'cassette' | 'outro';

const ROOM = { w: 7, d: 6, h: 2.8 };
const BOX_POS = vec3(1.6, 0, -1.4);

export class HomeScene extends LevelScene {
  readonly id = 'home';
  private dialogue: DialogueRunner;
  private nika!: Npc;
  private phase: Phase = 'enter';
  private phaseTime = 0;
  private lid!: THREE.Mesh;
  private reels: THREE.Mesh[] = [];
  private playing = false;
  private echoTimer = 0;
  private lamp!: THREE.PointLight;

  constructor(
    ctx: GameContext,
    private killed: boolean,
    private onDone: () => void,
    private onEnter: () => void = () => undefined,
  ) {
    super(ctx);
    this.dialogue = new DialogueRunner({
      showLine: (sp, text) => ctx.ui.subtitle(sp, text),
      hideLine: () => ctx.ui.subtitle(null),
      showChoice: () => undefined,
      hideChoice: () => undefined,
      cue: (n) => this.onCue(n),
      choice: () => undefined,
    });
  }

  protected spawnPoint() {
    return { pos: vec3(-2.4, 0.05, 2.0), yaw: Math.PI * 0.85 };
  }

  protected buildWorld(): void {
    const scene = this.scene;
    scene.background = new THREE.Color(0x07090c);
    scene.fog = null;
    scene.add(new THREE.HemisphereLight(0x8a96aa, 0x2a1e14, 1.2));
    this.lamp = new THREE.PointLight(0xffc888, 9, 9, 1.6);
    this.lamp.position.set(1.4, 1.5, -1.6);
    scene.add(this.lamp);
    const ph = this.physics;
    const { w, d, h } = ROOM;

    const floorTex = groundTexture('#5a3e2a', 21);
    floorTex.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    ph.addBox(vec3(0, -0.5, 0), vec3(w, 0.5, d));
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xd8d0c0 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    scene.add(ceil);

    // Стены с обоями; в дальней — окно на ночную Тулу.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6f7a62, roughness: 0.95 });
    const walls: [number, number, number, number][] = [
      [0, -d / 2, w, 0],
      [0, d / 2, w, Math.PI],
      [-w / 2, 0, d, Math.PI / 2],
      [w / 2, 0, d, -Math.PI / 2],
    ];
    for (const [x, z, len, rot] of walls) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat);
      m.position.set(x, h / 2, z);
      m.rotation.y = rot;
      scene.add(m);
    }
    ph.addBox(vec3(0, h / 2, -d / 2 - 0.1), vec3(w / 2, h / 2, 0.1));
    ph.addBox(vec3(0, h / 2, d / 2 + 0.1), vec3(w / 2, h / 2, 0.1));
    ph.addBox(vec3(-w / 2 - 0.1, h / 2, 0), vec3(0.1, h / 2, d / 2));
    ph.addBox(vec3(w / 2 + 0.1, h / 2, 0), vec3(0.1, h / 2, d / 2));

    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ map: nightWindowTexture(), toneMapped: false }));
    win.position.set(-1.2, 1.5, -d / 2 + 0.01);
    scene.add(win);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc });
    for (const [x, y, sw, sh] of [[-1.2, 2.22, 2.3, 0.06], [-1.2, 0.78, 2.3, 0.06], [-2.32, 1.5, 0.06, 1.5], [-0.08, 1.5, 0.06, 1.5], [-1.2, 1.5, 0.05, 1.4]]) {
      const fm = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.05), frameMat);
      fm.position.set(x, y, -d / 2 + 0.03);
      scene.add(fm);
    }

    // Мебель: стол с лампой, диван, полка с дедовыми кернами.
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.7, flatShading: true });
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.9), wood);
    top.position.y = 0.75;
    table.add(top);
    for (const [x, z] of [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), wood);
      leg.position.set(x, 0.375, z);
      table.add(leg);
    }
    table.position.set(BOX_POS.x, 0, BOX_POS.z);
    scene.add(table);
    ph.addBox(vec3(BOX_POS.x, 0.4, BOX_POS.z), vec3(0.8, 0.4, 0.45));

    const lampMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a5a3a, emissive: 0x553311, side: THREE.DoubleSide }));
    lampMesh.position.set(BOX_POS.x - 0.5, 1.15, BOX_POS.z - 0.2);
    scene.add(lampMesh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    bulb.position.set(BOX_POS.x - 0.5, 1.08, BOX_POS.z - 0.2);
    scene.add(bulb);

    // Коробка деда с надписью.
    const cardboard = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.95, flatShading: true });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.42), cardboard);
    box.position.set(BOX_POS.x + 0.2, 0.96, BOX_POS.z);
    scene.add(box);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), new THREE.MeshBasicMaterial({ map: makeLabelTexture(HOME_TEXT.boxLabel), transparent: true }));
    label.position.set(BOX_POS.x + 0.2, 0.98, BOX_POS.z + 0.212);
    scene.add(label);
    this.lid = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.44), cardboard);
    this.lid.geometry.translate(0, 0, 0.22);
    this.lid.position.set(BOX_POS.x + 0.2, 1.14, BOX_POS.z - 0.22);
    scene.add(this.lid);

    // Кассетный магнитофон.
    const player = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.24), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.3 }));
    player.position.set(BOX_POS.x - 0.45, 0.85, BOX_POS.z + 0.15);
    scene.add(player);
    for (const x of [-0.08, 0.08]) {
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 8), new THREE.MeshStandardMaterial({ color: 0xbbbbbb }));
      reel.rotation.x = Math.PI / 2;
      reel.position.set(BOX_POS.x - 0.45 + x, 0.86, BOX_POS.z + 0.271);
      scene.add(reel);
      this.reels.push(reel);
    }

    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x5a2a2a, roughness: 0.9, flatShading: true });
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.9), sofaMat);
    sofa.position.set(-1.5, 0.22, 1.9);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.2), sofaMat);
    back.position.set(-1.5, 0.7, 2.3);
    scene.add(sofa, back);
    ph.addBox(vec3(-1.5, 0.4, 2.0), vec3(1.1, 0.4, 0.5));

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 1.4), wood);
    shelf.position.set(w / 2 - 0.25, 0.9, 1.2);
    scene.add(shelf);
    ph.addBox(vec3(w / 2 - 0.25, 0.9, 1.2), vec3(0.2, 0.9, 0.7));
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x777b80, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), coreMat);
      core.rotation.z = Math.PI / 2;
      core.position.set(w / 2 - 0.47, 1.3 - (i % 2) * 0.45, 0.7 + i * 0.22);
      scene.add(core);
    }
  }

  override async load(): Promise<void> {
    await super.load();
    this.playerView.setWeapon('none');
    this.nika = new Npc(this.scene, NIKA, vec3(-1.6, 0, -2.2), 0);
    armNika(this.nika.rig);
    this.nika.lookAt = this.player.pos;
    this.cam.distance = 3.2;
    this.cam.pitch = 0.3;
    this.onEnter();
    this.ctx.bus.emit('serious', { on: true });
    this.ctx.bus.emit('music', { mode: 'home' });
    this.ctx.ui.clear();
    this.ctx.hud.show(false);
    this.ctx.ui.fade(0, 1.5);
    this.dialogue.play(SCRIPT_HOME_ENTER, () => {
      this.phase = 'explore';
      this.ctx.ui.objective(HOME_TEXT.objective);
    });
  }

  private onCue(name: string): void {
    const ui = this.ctx.ui;
    if (name === 'openBox') this.lid.rotation.x = -1.9;
    if (name === 'playCassette') {
      this.playing = true;
      ui.center(HOME_TEXT.cassette, 2.2);
      this.ctx.bus.emit('sfx', { id: 'cassette' });
    }
    if (name === 'stopCassette') {
      this.playing = false;
      this.ctx.bus.emit('sfx', { id: 'cassetteStop' });
    }
    if (name === 'letter') ui.push(VETROV_LETTER, 'ПОЧТА · фонд «Хранилище»', 9);
  }

  override touchLayout(): TouchLayout {
    const explore = this.phase === 'explore';
    const buttons: TouchLayout['buttons'] = [];
    if (explore && this.near(BOX_POS, 1.6)) buttons.push({ action: 'attack', label: TOUCH_TEXT.open, hot: true });
    if (this.dialogue.active) buttons.push({ action: 'confirm', label: TOUCH_TEXT.confirm });
    return { move: explore, look: true, buttons };
  }

  private near(p: Vec3, d: number): boolean {
    return Math.hypot(this.player.pos.x - p.x, this.player.pos.z - p.z) < d;
  }

  protected tick(dt: number, f: InputFrame): void {
    this.phaseTime += dt;
    this.dialogue.update(dt, isPressed(f, 'confirm'));
    this.nika.update(dt);
    this.player.controllable = this.phase === 'explore';
    this.movePlayer(dt, f, null);
    const ui = this.ctx.ui;
    if (this.phase === 'explore') {
      const close = this.near(BOX_POS, 1.6);
      ui.keyPrompt(close ? HOME_TEXT.prompt : null);
      if (close && (isPressed(f, 'attack') || isPressed(f, 'accord') || isPressed(f, 'confirm'))) {
        ui.keyPrompt(null);
        ui.objective(null);
        this.phase = 'cassette';
        this.nika.goTo(vec3(BOX_POS.x - 1.2, 0, BOX_POS.z + 0.9), 1.4);
        this.dialogue.play(SCRIPT_CASSETTE, () => {
          this.phase = 'outro';
          this.phaseTime = 0;
          ui.fade(1, 3);
        });
      }
    }
    if (this.phase === 'outro') {
      if (this.phaseTime > 3.2 && this.phaseTime - dt <= 3.2) ui.title(HOME_TEXT.outro.main, HOME_TEXT.outro.sub);
      if (this.phaseTime > 9) {
        this.phase = 'enter';
        ui.title(null);
        this.onDone();
      }
    }
    // Если запись добили, её слышно даже отсюда: раз в сорок секунд.
    if (this.killed && this.phase !== 'outro') {
      this.echoTimer += dt;
      if (this.echoTimer >= DRUZHINNIK_BOSS.restartSeconds) {
        this.echoTimer = 0;
        if (!this.dialogue.active) ui.say('druzhinnik', HOME_KILL_ECHO, 2.5);
        this.ctx.bus.emit('sfx', { id: 'askFar' });
      }
    }
  }

  protected renderWorld(alpha: number, frameDt: number): void {
    this.playerView.update(this.player, alpha, frameDt);
    this.nika.render();
    if (this.playing) for (const r of this.reels) r.rotation.y += frameDt * 4;
    this.lamp.intensity = 9 + Math.sin(this.time * 7) * 0.3;
  }

  override dispose(): void {
    this.dialogue.stop();
    this.ctx.ui.clear();
    super.dispose();
  }
}

/** Ночной вид из окна: тёмные дома с огнями и стена кремля вдалеке. */
const nightWindowTexture = (): THREE.Texture => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, '#060a14');
  grad.addColorStop(1, '#1c2640');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#3a1810';
  g.fillRect(0, 110, 256, 12);
  for (let x = 0; x < 256; x += 8) g.fillRect(x, 104, 5, 6);
  for (let i = 0; i < 9; i++) {
    const x = i * 30 - 5;
    const hgt = 30 + ((i * 37) % 40);
    g.fillStyle = '#0b0e14';
    g.fillRect(x, 160 - hgt, 26, hgt);
    for (let k = 0; k < 10; k++) {
      if ((i * 7 + k * 3) % 4 !== 0) continue;
      g.fillStyle = '#f0c070';
      g.fillRect(x + 4 + (k % 3) * 7, 160 - hgt + 6 + Math.floor(k / 3) * 8, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
