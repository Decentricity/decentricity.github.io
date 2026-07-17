export class ShutterSound {
    context = null;
    play() {
        const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextConstructor) {
            return;
        }
        this.context ||= new AudioContextConstructor();
        const context = this.context;
        const now = context.currentTime;
        this.click(context, now, 680, 0.028);
        this.click(context, now + 0.048, 190, 0.06);
    }
    click(context, start, frequency, duration) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }
}
