module.exports.Delay = Delay;
function Delay (context, ms, decay) {
    var input = context.createGain();
    var del = context.createDelay();
    var gain = context.createGain();
    var out = context.createGain();
    input.connect(del);
    del.connect(gain);
    gain.connect(del);
    gain.connect(out);
    del.delayTime = ms;
    gain.gain.value = decay;
    this.out = out;
    this.in = in;
}
