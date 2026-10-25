// Бой керном в прологе: арена + заедание + Аккорд + HUD + эффекты.
// Используется тренировкой с отзвуками и боем с Дружинником.

import type { InputFrame } from '../../core/input';
import { isPressed } from '../../core/input';
import type { PrologueScene } from './prologue-scene';
import type { Arena } from '../../combat/arena';
import { ACCORD } from '../../data/balance';
import { SYSTEM_BARKS, SYSTEM_HINTS } from '../../data/text/prologue';

export class KernCombat {
  /** Вызывается при Аккорде (босс ломает фазу). */
  onAccord: () => void = () => undefined;
  /** Можно ли сейчас бить Аккордом. */
  accordAllowed = true;
  private taughtAccord = false;
  private taughtJam = false;
  private offs: (() => void)[] = [];

  constructor(
    private s: PrologueScene,
    private arena: Arena,
  ) {
    const sys = s.kernSys;
    sys.enabled = true;
    s.ctx.hud.setKernMode(true);
    const bus = s.bus;
    this.offs.push(
      bus.on('jamSkip', ({ strength }) => {
        s.skipFrames = 2 + Math.round(strength * 3);
        s.ui.glitch(strength);
        bus.emit('sfx', { id: 'skip' });
      }),
      bus.on('jamReplay', ({ active }) => {
        s.ui.replay(active, SYSTEM_HINTS.replay);
        if (active) {
          bus.emit('sfx', { id: 'replay' });
          bus.emit('bark', SYSTEM_BARKS.replayVanya);
        }
      }),
      bus.on('jamThreshold', ({ level }) => {
        if (level !== 'calm' && !this.taughtJam) {
          this.taughtJam = true;
          s.ui.hint(SYSTEM_HINTS.jamHigh, 7);
          bus.emit('bark', s.nikaNpc().opacity > 0 ? SYSTEM_BARKS.jamHighNika : SYSTEM_BARKS.jamHighVanya);
        }
      }),
    );
  }

  /** Шаг: возвращает ввод, прошедший через систему заедания. */
  update(dt: number, raw: InputFrame, inCombat: boolean): InputFrame {
    const s = this.s;
    const sys = s.kernSys;
    const f = sys.filter(raw);
    sys.update(dt, inCombat);
    this.arena.speedMul = sys.jam.enemySpeedMul;
    if (sys.accord.full && !this.taughtAccord && inCombat) {
      this.taughtAccord = true;
      s.ui.hint(SYSTEM_HINTS.accordFull, 6);
    }
    if (inCombat && this.accordAllowed && isPressed(f, 'accord') && s.player.controllable && s.player.action !== 'down') {
      if (sys.accord.spend()) this.accord();
    }
    return f;
  }

  private accord(): void {
    const s = this.s;
    const p = s.player.pos;
    this.arena.cast(0.55);
    s.bus.emit('playerAction', { action: 'accord' });
    s.bus.emit('accord', { pos: { ...p } });
    s.bus.emit('sfx', { id: 'accord', pos: { ...p } });
    s.bus.emit('bark', SYSTEM_BARKS.accord);
    this.arena.areaBlast(p, ACCORD.radius, ACCORD.damage);
    s.fx.ring(p, 0x9fe8ff, ACCORD.radius * 1.2, 0.7);
    s.fx.ring(p, 0xffffff, ACCORD.radius * 0.7, 0.45);
    s.fx.burst({ x: p.x, y: 1, z: p.z }, 0xbff4ff, 24, 7);
    s.ui.flash('rgba(190,240,255,0.45)', 0.5);
    s.cam.kick(1.2);
    this.onAccord();
  }

  render(dt: number): void {
    const s = this.s;
    const sys = s.kernSys;
    const hud = s.ctx.hud;
    hud.accord(sys.accord.value, sys.accord.blocked);
    hud.jam(sys.jam.value, s.time);
    s.playerView.setGlow(sys.accord.value);
    void dt;
  }

  dispose(): void {
    this.offs.forEach((o) => o());
    this.s.ui.replay(false);
  }
}
