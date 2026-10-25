// Пролог «Ваш заказ у двери»: ночная Тула, проспект Ленина и площадь у кремля.
// Сцена — это мир и общий набор систем; сюжетные отрезки («биты») идут друг за другом.

import * as THREE from 'three';
import type { InputFrame } from '../../core/input';
import { isPressed } from '../../core/input';
import { LevelScene } from '../level-scene';
import { vec3 } from '../../core/math';
import { MAP } from '../../data/levels/prologue-map';
import { buildCity, type City } from './city';
import { buildVan } from './props';
import { armDruzhinnik, armNika, Npc } from './npc';
import { DRUZHINNIK, NIKA } from '../../data/characters';
import { RIDE } from '../../data/levels/prologue-ride';
import { DialogueRunner, type Script } from '../../dialogue/engine';
import type { GameContext } from '../../core/context';

export interface Beat {
  enter(): void;
  update(dt: number, f: InputFrame): void;
  render(alpha: number, frameDt: number): void;
  exit(): void;
  /** Сюжетная метка из диалога. */
  onCue?(name: string): void;
}

export type BeatId = 'ride' | 'brawl' | 'kern' | 'boss' | 'aftermath';

/** Фабрики битов регистрируются отдельно, чтобы сцена не зависела от каждого файла. */
export type BeatFactory = (scene: PrologueScene) => Beat;

export class PrologueScene extends LevelScene {
  readonly id = 'prologue';
  city!: City;
  dialogue: DialogueRunner;
  private beat: Beat | null = null;
  private pendingBeat: BeatId | null = null;
  private focus = new THREE.Vector3();
  private druzhinnik: Npc | null = null;
  private nika: Npc | null = null;

  constructor(
    ctx: GameContext,
    private beats: Record<BeatId, BeatFactory>,
    private startBeat: BeatId = 'ride',
  ) {
    super(ctx);
    this.dialogue = new DialogueRunner({
      showLine: (sp, text) => ctx.ui.subtitle(sp, text),
      hideLine: () => ctx.ui.subtitle(null),
      showChoice: (prompt, opts) => ctx.ui.choice(prompt, opts),
      hideChoice: () => ctx.ui.choice(undefined, null),
      cue: (name) => this.beat?.onCue?.(name),
      choice: (id, value) => ctx.bus.emit('choiceMade', { id, value }),
    });
    ctx.ui.onChoice = (v) => this.dialogue.choose(v);
  }

  get ui() {
    return this.ctx.ui;
  }

  get bus() {
    return this.ctx.bus;
  }

  protected buildWorld(): void {
    this.city = buildCity(this.scene, this.physics);
    // Второй минивэн Реставраторов перегораживает проспект у площади.
    const blockVan = buildVan();
    blockVan.position.set(0, 0, RIDE.blockVanZ);
    blockVan.rotation.y = Math.PI / 2;
    this.city.root.add(blockVan);
    this.physics.addBox(vec3(0, 1.2, RIDE.blockVanZ), vec3(3.4, 1.2, 1.1));
  }

  /** Дружинник вне боя (кат-сцены, повтор записи). */
  druzhinnikNpc(): Npc {
    if (!this.druzhinnik) {
      this.druzhinnik = new Npc(this.city.root, DRUZHINNIK, vec3(0, 0, -590), 0);
      armDruzhinnik(this.druzhinnik.rig);
      this.druzhinnik.opacity = 0;
    }
    return this.druzhinnik;
  }

  nikaNpc(): Npc {
    if (!this.nika) {
      this.nika = new Npc(this.city.root, NIKA, vec3(-30, 0, -540), 0);
      armNika(this.nika.rig);
      this.nika.opacity = 0;
    }
    return this.nika;
  }

  protected spawnPoint() {
    return { pos: vec3(4, 0.05, MAP.startZ - 4), yaw: Math.PI };
  }

  override async load(): Promise<void> {
    await super.load();
    this.setBeat(this.startBeat);
  }

  /** Переключить сюжетный отрезок (выполняется в начале следующего шага). */
  goTo(id: BeatId): void {
    this.pendingBeat = id;
  }

  private setBeat(id: BeatId): void {
    this.beat?.exit();
    this.dialogue.stop();
    this.beat = this.beats[id](this);
    this.beat.enter();
  }

  /** Проиграть диалог; confirm (Пробел/Enter) или ЛКМ пропускают реплику. */
  play(script: Script, onDone?: () => void): void {
    this.dialogue.play(script, onDone);
  }

  protected tick(dt: number, f: InputFrame): void {
    if (this.pendingBeat) {
      const id = this.pendingBeat;
      this.pendingBeat = null;
      this.setBeat(id);
    }
    this.dialogue.update(dt, isPressed(f, 'confirm'));
    this.beat?.update(dt, f);
  }

  protected renderWorld(alpha: number, frameDt: number): void {
    this.beat?.render(alpha, frameDt);
    const p = this.interpPlayer(alpha);
    this.focus.set(p.x, p.y, p.z);
    this.city.update(this.focus, this.time);
  }

  override dispose(): void {
    this.beat?.exit();
    this.dialogue.stop();
    this.ui.clear();
    super.dispose();
  }
}
