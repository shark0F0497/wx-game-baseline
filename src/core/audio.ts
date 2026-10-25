import { IS_WECHAT, WX } from './platform';

/**
 * 音效：不打包音频文件，直接用 WebAudio 合成几个短音。
 * 好处是模板零资源、首包不增重；正式项目要 BGM / 采样音效时，
 * 把 play() 换成 wx.createInnerAudioContext() 的池子即可，调用方不用改。
 *
 * iOS 要求用户手势后才能出声，所以第一次 play() 一定是在触摸回调里触发的，
 * 这里每次都 resume() 一次，避免被系统挂起。
 */
export type SfxName = 'tap' | 'hit' | 'reward' | 'error';

interface Tone {
  freq: number;
  dur: number;
  type: OscillatorType;
  slideTo?: number;
  gain?: number;
}

const TONES: Record<SfxName, Tone[]> = {
  tap: [{ freq: 520, dur: 0.05, type: 'square', gain: 0.1 }],
  hit: [
    { freq: 720, dur: 0.06, type: 'square', gain: 0.12 },
    { freq: 980, dur: 0.07, type: 'square', gain: 0.08 },
  ],
  reward: [
    { freq: 660, dur: 0.09, type: 'triangle', gain: 0.12 },
    { freq: 880, dur: 0.09, type: 'triangle', gain: 0.12 },
    { freq: 1180, dur: 0.14, type: 'triangle', gain: 0.12 },
  ],
  error: [{ freq: 240, dur: 0.14, type: 'sawtooth', slideTo: 150, gain: 0.1 }],
};

export class Sfx {
  private ctx: any = null;
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.ctx?.suspend?.();
  }

  play(name: SfxName): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      ctx.resume?.();
    } catch {
      /* ignore */
    }

    let t = ctx.currentTime + 0.001;
    for (const tone of TONES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone.type;
      osc.frequency.setValueAtTime(tone.freq, t);
      if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(tone.slideTo, t + tone.dur);
      // 短促的包络，避免爆音
      gain.gain.setValueAtTime(tone.gain ?? 0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + tone.dur + 0.03);
      t += tone.dur * 0.9;
    }
  }

  private ensure(): any | null {
    if (this.ctx) return this.ctx;
    try {
      if (IS_WECHAT && typeof WX.createWebAudioContext === 'function') {
        this.ctx = WX.createWebAudioContext();
      } else if (typeof AudioContext !== 'undefined') {
        this.ctx = new AudioContext();
      } else {
        const Ctor = (globalThis as any).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
    } catch {
      return null;
    }
    return this.ctx;
  }
}
