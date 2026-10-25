// Бит «После боя»: Ника объясняет, что произошло (кварц и буря 2024 года).
// Если запись добили — через сорок секунд Дружинник снова спрашивает, где князь.
// Итог главы записывается в прохождение, затем — дом и кассета деда.

import type { InputFrame } from '../../../core/input';
import { vec3 } from '../../../core/math';
import type { Beat, PrologueScene } from '../prologue-scene';
import { DRUZHINNIK_BOSS as CFG } from '../../../data/bosses/druzhinnik';
import {
  AFTER_BARKS,
  AFTER_TEXT,
  BOSS_BARKS,
  SCRIPT_AFTER_FINISH,
  SCRIPT_AFTER_KILL,
  SCRIPT_EXPLAIN,
  SCRIPT_RESTART,
} from '../../../data/text/prologue';
import { addTail, setChapterJam } from '../../../systems/progress';
import { wait, type Script } from '../../../dialogue/engine';

type Phase = 'talk1' | 'waitRestart' | 'restart' | 'talk2' | 'outro';

const EXPLAIN_SPLIT = 7;

export class AftermathBeat implements Beat {
  private phase: Phase = 'talk1';
  private phaseTime = 0;
  private restartLeft: number = CFG.restartSeconds;
  private askTimer = 0;
  private restarted = false;

  constructor(private s: PrologueScene) {}

  private get killed(): boolean {
    return this.s.prologueResult === 'kill';
  }

  enter(): void {
    const s = this.s;
    s.player.controllable = false;
    s.player.hp = s.player.maxHp;
    s.ctx.hud.show(false);
    s.ui.objective(null);
    s.bus.emit('serious', { on: true });
    s.bus.emit('music', { mode: 'serious' });
    this.recordResult();
    // Керн принимает форму самой громкой записи рядом: доиграна — снова камень.
    s.playerView.setWeapon(this.killed ? 'sword' : 'kern');
    const nika = s.nikaNpc();
    nika.opacity = 1;
    nika.goTo(vec3(s.player.pos.x - 1.6, 0, s.player.pos.z - 1.2), 2);
    nika.lookAt = s.player.pos;
    const dr = s.druzhinnikNpc();
    dr.opacity = 0;
    if (this.killed) {
      this.restartLeft = Math.max(8, CFG.restartSeconds - (s.time - s.killTime));
      s.play([...SCRIPT_AFTER_KILL, ...SCRIPT_EXPLAIN.slice(0, EXPLAIN_SPLIT)], () => this.setPhase('waitRestart'));
    } else {
      s.play([...SCRIPT_AFTER_FINISH, ...SCRIPT_EXPLAIN], () => this.outro());
    }
  }

  /** Итог пролога в состоянии прохождения: выбор, хвост, заедание за главу. */
  private recordResult(): void {
    const s = this.s;
    const p = s.ctx.progress;
    const result = s.prologueResult ?? 'finish';
    p.choices.prologue = result;
    if (result === 'finish') addTail(p, CFG.id);
    else if (!p.bossesKilled.includes(CFG.id)) p.bossesKilled.push(CFG.id);
    setChapterJam(p, 0, s.prologueJam);
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseTime = 0;
  }

  onCue(name: string): void {
    const s = this.s;
    if (name === 'afterCam') {
      const p = s.player.pos;
      s.cutCam = { pos: vec3(p.x + 3.2, 2.1, p.z + 3), look: vec3(p.x - 0.8, 1.5, p.z - 0.6) };
    }
    if (name === 'restartRecord') {
      const dr = s.druzhinnikNpc();
      dr.pos = vec3(0, 0, -588);
      dr.yaw = 0;
      dr.pose = { raised: 0.15 };
      this.restarted = true;
      s.bus.emit('sfx', { id: 'recordRise' });
      s.bus.emit('sfx', { id: 'ask', pos: { ...dr.pos } });
      s.city.coldLight.intensity = 50;
      s.cutCam = { pos: vec3(s.player.pos.x + 2, 2.4, s.player.pos.z + 4), look: vec3(0, 2, -588) };
    }
  }

  private outro(): void {
    const s = this.s;
    this.setPhase('outro');
    s.cutCam = null;
    s.bus.emit('serious', { on: false });
    s.bus.emit('music', { mode: 'calm' });
    s.bus.emit('bark', AFTER_BARKS.streamEnd);
    s.ui.orderTimer(null);
    s.onPrologueStreetDone();
  }

  update(dt: number, f: InputFrame): void {
    const s = this.s;
    this.phaseTime += dt;
    s.nikaNpc().update(dt);
    const dr = s.druzhinnikNpc();
    dr.update(dt);
    s.movePlayer(dt, f, null);

    if (this.killed && !this.restarted) {
      this.restartLeft -= dt;
      s.ui.orderTimer(`${AFTER_TEXT.restartTimer} ${Math.max(0, Math.ceil(this.restartLeft))} с`, true);
    }
    if (this.restarted) {
      // Запись проявляется и спрашивает снова — каждые сорок секунд.
      dr.opacity = Math.min(1, dr.opacity + dt * 0.8);
      this.askTimer += dt;
      if (this.askTimer >= CFG.restartSeconds) {
        this.askTimer = 0;
        s.ui.say('druzhinnik', BOSS_BARKS.ask, 2.4);
        s.bus.emit('sfx', { id: 'ask', pos: { ...dr.pos } });
      }
    }

    if (this.phase === 'waitRestart' && this.restartLeft <= 0) {
      s.ui.orderTimer(null);
      this.setPhase('restart');
      const rest: Script = [...SCRIPT_RESTART, wait(0.5), ...SCRIPT_EXPLAIN.slice(EXPLAIN_SPLIT)];
      s.play(rest, () => this.outro());
    }
  }

  render(alpha: number, frameDt: number): void {
    const s = this.s;
    s.playerView.update(s.player, alpha, frameDt);
    s.nikaNpc().render();
    s.druzhinnikNpc().render();
  }

  exit(): void {
    this.s.ui.orderTimer(null);
  }
}
