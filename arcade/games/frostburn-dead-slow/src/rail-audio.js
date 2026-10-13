(function(root) {
    'use strict';
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
    // A breathy three-chime steam whistle: a short call followed by a long one.
    // Separate from the low, saturated reeds used by ships.
    function soundWhistle(ctx,destination=ctx.destination) {
        const now=ctx.currentTime,duration=1.9,bus=ctx.createGain(),filter=ctx.createBiquadFilter();
        const sources=[],nodes=[bus,filter],calls=[[0,.42],[.65,1.05]],peak=.065;
        filter.type='lowpass';filter.frequency.value=2400;filter.Q.value=.5;
        filter.connect(bus);bus.connect(destination);bus.gain.setValueAtTime(0,now);
        for(const [start,length] of calls) {
            bus.gain.setValueAtTime(0,now+start);
            bus.gain.linearRampToValueAtTime(peak,now+start+.09);
            bus.gain.setValueAtTime(peak,now+start+length-.14);
            bus.gain.linearRampToValueAtTime(0,now+start+length);
        }
        const wave=ctx.createPeriodicWave(new Float32Array(7),new Float32Array([0,1,.32,.13,.07,.025,.01]));
        for(const frequency of [392,493.88,587.33]) {
            const pipe=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.24;
            pipe.setPeriodicWave(wave);
            for(const [start,length] of calls) {
                pipe.frequency.setValueAtTime(frequency*.94,now+start);
                pipe.frequency.exponentialRampToValueAtTime(frequency,now+start+.11);
                pipe.frequency.setValueAtTime(frequency,now+start+length-.14);
                pipe.frequency.linearRampToValueAtTime(frequency*.97,now+start+length);
            }
            pipe.connect(gain);gain.connect(filter);sources.push(pipe);nodes.push(gain);
        }
        const steam=ctx.createBufferSource(),air=ctx.createBiquadFilter(),airGain=ctx.createGain();
        const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),data=buffer.getChannelData(0);
        let seed=40;for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1;}
        steam.buffer=buffer;steam.loop=true;air.type='bandpass';air.frequency.value=1700;air.Q.value=.6;airGain.gain.value=.18;
        steam.connect(air);air.connect(airGain);airGain.connect(filter);sources.push(steam);nodes.push(air,airGain);
        let ended=0,stopped=false;
        for(const source of sources) {
            source.onended=()=>{source.disconnect();if(++ended===sources.length)nodes.forEach(n=>n.disconnect());};
            source.start(now);source.stop(now+duration);
        }
        return {until:now+duration,stop(){
            if(stopped)return;stopped=true;
            const time=ctx.currentTime,age=time-now;
            let held=0;
            for(const [start,length] of calls) {
                const t=age-start;
                if(t>=0&&t<length)held=peak*Math.min(1,t/.09,(length-t)/.14);
            }
            bus.gain.cancelScheduledValues(time);bus.gain.setValueAtTime(held,time);bus.gain.linearRampToValueAtTime(0,time+.012);
            for(const source of sources)try{source.stop(time+.02);}catch(_){/* Already ended. */}
        }};
    }
    function createTrain(ctx,destination=ctx.destination) {
        const bus=ctx.createGain(),motor=ctx.createOscillator(),motorGain=ctx.createGain(),motorFilter=ctx.createBiquadFilter();
        const noise=ctx.createBufferSource(),rolling=ctx.createGain(),rollFilter=ctx.createBiquadFilter();
        const squeal=ctx.createOscillator(),squealGain=ctx.createGain(),squealFilter=ctx.createBiquadFilter();
        const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),samples=buffer.getChannelData(0);
        let seed=1717;for(let i=0;i<samples.length;i++){seed=(1664525*seed+1013904223)>>>0;samples[i]=seed/2147483648-1;}
        bus.gain.value=motorGain.gain.value=rolling.gain.value=squealGain.gain.value=0;bus.connect(destination);
        motor.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(12),new Float32Array([0,1,.42,.25,.14,.12,.065,.045,.03,.025,.015,.01])));
        motorFilter.type='lowpass';motorFilter.frequency.value=240;motorFilter.Q.value=.6;
        motor.connect(motorFilter);motorFilter.connect(motorGain);motorGain.connect(bus);motor.start();
        noise.buffer=buffer;noise.loop=true;rollFilter.type='bandpass';rollFilter.frequency.value=650;rollFilter.Q.value=.45;
        noise.connect(rollFilter);rollFilter.connect(rolling);rolling.connect(bus);noise.start();
        squeal.type='sine';squealFilter.type='lowpass';squealFilter.frequency.value=1700;
        squeal.connect(squealFilter);squealFilter.connect(squealGain);squealGain.connect(bus);squeal.start();
        const voices=new Set();let joint=null,nextJoint=0,disposed=false,active=false;
        function impulse(kind,delay=0,accent=1) {
            if(disposed)return;
            const now=ctx.currentTime+delay,air=kind==='brake',heavy=kind==='couple'||kind==='uncouple';
            const duration=air?.48:heavy?.3:.11,env=ctx.createGain(),filter=ctx.createBiquadFilter(),source=ctx.createBufferSource();
            source.buffer=buffer;filter.type=air?'highpass':'lowpass';filter.frequency.value=air?1150:heavy?800:1400;filter.Q.value=.55;
            env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime((air?.045:heavy?.13:.065)*accent,now+.006);
            env.gain.exponentialRampToValueAtTime(.0001,now+duration);
            source.connect(filter);filter.connect(env);env.connect(bus);
            const sources=[source],nodes=[filter,env];
            if(!air) {
                const ring=ctx.createOscillator(),level=ctx.createGain();ring.type='sine';ring.frequency.value=heavy?112:236;level.gain.value=.16;
                ring.connect(level);level.connect(env);sources.push(ring);nodes.push(level);
            }
            const voice={kind,stop(){for(const s of sources)try{s.stop(ctx.currentTime+.015);}catch(_){/* ended */}}};
            if(voices.size>=6){const oldest=voices.values().next().value;oldest.stop();voices.delete(oldest);}
            voices.add(voice);let ended=0;
            for(const s of sources){s.onended=()=>{s.disconnect();if(++ended===sources.length){nodes.forEach(n=>n.disconnect());voices.delete(voice);}};s.start(now);s.stop(now+duration+.015);}
        }
        function stop() {
            active=false;joint=null;bus.gain.setTargetAtTime(0,ctx.currentTime,.012);
            for(const voice of voices)voice.stop();voices.clear();
        }
        return {
            tick(st,running) {
                if(disposed)return;
                if(!running||!st){if(active)stop();return;}
                active=true;const now=ctx.currentTime,group=st.groups.find(g=>g.cars.some(c=>c.id==='engine')),engine=group.cars.find(c=>c.id==='engine');
                const speed=Math.abs(engine.v),braking=Math.max(engine.pressure,st.independent),power=st.power/4;
                bus.gain.setTargetAtTime(1,now,.025);motor.frequency.setTargetAtTime(32+power*28,now,.25);
                motorFilter.frequency.setTargetAtTime(180+power*230,now,.2);motorGain.gain.setTargetAtTime(.018+power*.035,now,.12);
                rolling.gain.setTargetAtTime(.045*clamp(speed/12,0,1),now,.1);
                squeal.frequency.setTargetAtTime(530+speed*23,now,.1);
                squealGain.gain.setTargetAtTime(.008*braking*clamp(speed/5,0,1),now,.08);
                // Two axle pairs, then the long space to the next rail joint.
                // Schedule a whole burst on the audio clock so even a sparse or
                // accelerated frame cannot flatten it into evenly spaced clicks.
                const phase=Math.floor(st.stats.distance/18);
                if(speed>.3&&phase!==joint&&now>=nextJoint){
                    const interval=clamp(1.6/speed,.045,.4);
                    [0,1,2.7,3.7].forEach((offset,i)=>impulse('joint',offset*interval,[1,.72,.9,.65][i]));
                    nextJoint=now+interval*7.8;
                }
                if(speed<=.3)for(const voice of voices)if(voice.kind==='joint'){voice.stop();voices.delete(voice);}
                joint=phase;
            },
            event(kind) {if(active)impulse(kind);},
            stop,
            dispose() {if(disposed)return;stop();disposed=true;for(const s of [motor,noise,squeal]){s.stop();s.disconnect();}for(const n of [bus,motorGain,motorFilter,rolling,rollFilter,squealGain,squealFilter])n.disconnect();}
        };
    }
    const api={createTrain,soundWhistle};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RailAudio=api;
})(typeof globalThis!=='undefined'?globalThis:this);
