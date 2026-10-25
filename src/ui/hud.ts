// Боевой HUD: здоровье Лёвы, шкала Аккорда, «заедание», полоса босса, прицел захвата.

import * as THREE from 'three';
import { HUD_TEXT } from '../data/text/ui';

const div = (cls: string, parent: HTMLElement) => {
  const d = document.createElement('div');
  d.className = cls;
  parent.appendChild(d);
  return d;
};

export class Hud {
  private root: HTMLElement;
  private hpFill: HTMLElement;
  private hpLag: HTMLElement;
  private accordWrap: HTMLElement;
  private accordFill: HTMLElement;
  private jamWrap: HTMLElement;
  private jamDisc: HTMLElement;
  private jamFill: HTMLElement;
  private bossWrap: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private bossPhases: HTMLElement;
  private reticle: HTMLElement;
  private reticleHp: HTMLElement;
  private silenceEl: HTMLElement;
  private lagHp = 1;
  private tmp = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root = div('hud', parent);
    const hp = div('hud-hp', this.root);
    div('hud-label', hp).textContent = HUD_TEXT.hp;
    const bar = div('bar', hp);
    this.hpLag = div('bar-lag', bar);
    this.hpFill = div('bar-fill', bar);

    this.accordWrap = div('hud-accord', this.root);
    div('hud-label', this.accordWrap).textContent = HUD_TEXT.accord;
    const ab = div('bar', this.accordWrap);
    this.accordFill = div('bar-fill', ab);

    this.jamWrap = div('hud-jam', this.root);
    this.jamDisc = div('jam-disc', this.jamWrap);
    div('jam-label', this.jamWrap).textContent = HUD_TEXT.jam;
    const jb = div('bar', this.jamWrap);
    this.jamFill = div('bar-fill', jb);

    this.silenceEl = div('hud-silence', this.root);

    this.bossWrap = div('hud-boss', this.root);
    this.bossName = div('boss-name', this.bossWrap);
    const bb = div('bar', this.bossWrap);
    this.bossFill = div('bar-fill', bb);
    this.bossPhases = div('boss-phases', this.bossWrap);

    this.reticle = div('reticle', parent);
    this.reticleHp = div('reticle-hp', this.reticle);
    this.show(false);
    this.silence(null, false);
  }

  show(on: boolean): void {
    this.root.classList.toggle('show', on);
    if (!on) this.reticle.classList.remove('show');
  }

  /** Какие шкалы видны: на драке с людьми Аккорда и заедания нет. */
  setKernMode(on: boolean): void {
    this.accordWrap.style.display = on ? '' : 'none';
    this.jamWrap.style.display = on ? '' : 'none';
  }

  hp(v: number, max: number, dt: number): void {
    const k = Math.max(0, v / max);
    this.hpFill.style.width = `${k * 100}%`;
    this.lagHp = this.lagHp > k ? Math.max(k, this.lagHp - dt * 0.6) : k;
    this.hpLag.style.width = `${this.lagHp * 100}%`;
    this.hpFill.classList.toggle('low', k < 0.3);
  }

  accord(v: number, blocked: boolean): void {
    this.accordFill.style.width = `${Math.min(1, v) * 100}%`;
    this.accordWrap.classList.toggle('full', v >= 1);
    this.accordWrap.classList.toggle('blocked', blocked);
  }

  jam(v: number, t: number): void {
    this.jamFill.style.width = `${Math.min(1, v) * 100}%`;
    this.jamWrap.classList.toggle('high', v >= 0.5);
    this.jamWrap.classList.toggle('max', v >= 0.99);
    // Пластинка крутится быстрее, когда заедает сильнее.
    this.jamDisc.style.transform = `rotate(${(t * (90 + v * 600)) % 360}deg)`;
  }

  silence(text: string | null, ready: boolean): void {
    this.silenceEl.textContent = text ?? '';
    this.silenceEl.style.display = text ? '' : 'none';
    this.silenceEl.classList.toggle('ready', ready);
  }

  boss(name: string | null, hp = 0, phase = 0, phases = 3, cutoff = false): void {
    this.bossWrap.classList.toggle('show', !!name);
    if (!name) return;
    if (this.bossName.textContent !== name) this.bossName.textContent = name;
    this.bossFill.style.width = `${Math.max(0, hp) * 100}%`;
    this.bossWrap.classList.toggle('cutoff', cutoff);
    const pips = Array.from({ length: phases }, (_, i) => `<span class="${i < phase ? 'done' : i === phase ? 'cur' : ''}"></span>`).join('');
    if (this.bossPhases.innerHTML !== pips) this.bossPhases.innerHTML = pips;
  }

  /** Прицел над захваченной целью. */
  lock(world: THREE.Vector3 | null, camera: THREE.Camera, hp01 = 1): void {
    if (!world) {
      this.reticle.classList.remove('show');
      return;
    }
    this.tmp.copy(world).project(camera);
    if (this.tmp.z > 1) {
      this.reticle.classList.remove('show');
      return;
    }
    const x = (this.tmp.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.tmp.y * 0.5 + 0.5) * window.innerHeight;
    this.reticle.style.transform = `translate(${x}px, ${y}px)`;
    this.reticleHp.style.width = `${Math.max(0, hp01) * 100}%`;
    this.reticle.classList.add('show');
  }
}
