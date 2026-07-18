(() => {
  'use strict';
    const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = (arr) => [...arr].sort(() => Math.random() - .5);
    const sv = (n, digits = 3) => Number(n.toFixed(digits)).toString().replace('.', ',');
    const normalize = (v) => String(v).replace('.', ',');

    const TOPICS = [
      { id: 'fractions', label: 'Bråk', icon: '🍕' },
      { id: 'decimals', label: 'Decimaler', icon: '🔢' },
      { id: 'rounding', label: 'Avrundning', icon: '🎯' },
      { id: 'operations', label: 'Räknesätt', icon: '➕' },
      { id: 'time', label: 'Tid', icon: '⏰' },
      { id: 'statistics', label: 'Statistik', icon: '📊' },
      { id: 'powers10', label: '×10 och ÷10', icon: '🚀' },
      { id: 'units', label: 'Enheter', icon: '📏' },
      { id: 'geometry', label: 'Geometri', icon: '📐' }
    ];
    function makeOptions(answer, candidates, formatter = normalize) {
      const a = formatter(answer);
      const pool = candidates.map(formatter).filter(x => x !== a);
      const unique = [...new Set(pool)];
      while (unique.length < 3) unique.push(formatter(Number(answer) + unique.length + 1));
      return shuffle([a, ...shuffle(unique).slice(0,3)]);
    }
    function question(topic, text, answer, options, hint, spoken, sub='Tryck på rätt svar.') {
      return { topic, text, answer: normalize(answer), options: options.map(normalize), hint, spoken: spoken || text, sub };
    }

    function genFractions(d) {
      const common = [{f:'1/2',v:.5},{f:'1/4',v:.25},{f:'3/4',v:.75},{f:'1/5',v:.2},{f:'2/5',v:.4},{f:'3/5',v:.6},{f:'4/5',v:.8},{f:'1/10',v:.1},{f:'3/10',v:.3},{f:'7/10',v:.7}];
      const kind = rand(1, d >= 2 ? 4 : 3);
      if (kind === 1) {
        const x = pick(common); const opts = makeOptions(sv(x.v), common.map(z=>sv(z.v)));
        return question('fractions', `${x.f} = ?`, sv(x.v), opts, 'Tänk: hur många tiondelar eller hundradelar är bråket?', `${x.f.replace('/',' delat med ')} är lika med vad i decimalform?`);
      }
      if (kind === 2) {
        const den = pick([4,5,6,8,10]); const num = rand(1, den-1); const ans = `${den-num}/${den}`;
        const opts = makeOptions(ans, [`${num}/${den}`,`${den-num-1}/${den}`,`${den-num+1}/${den}`,`1/${den}`]);
        return question('fractions', `1 − ${num}/${den} = ?`, ans, opts, `Helheten är ${den}/${den}.`, `Ett minus ${num} ${den === 4 ? 'fjärdedelar' : 'delar av '+den} är lika med vad?`);
      }
      if (kind === 3) {
        const den = pick([4,5,6,8,10]); const a = rand(1, den-2); const b = rand(1, den-a); const ans = `${a+b}/${den}`;
        const opts = makeOptions(ans, [`${Math.abs(a-b)}/${den}`,`${a+b-1}/${den}`,`${a+b+1}/${den}`,`${a+b}/${den+1}`]);
        return question('fractions', `${a}/${den} + ${b}/${den} = ?`, ans, opts, 'Samma nämnare: lägg bara ihop täljarna.', `${a} av ${den} plus ${b} av ${den}.`);
      }
      const a = pick(common), b = pick(common.filter(x => x.v !== a.v));
      const ans = a.v > b.v ? a.f : b.f;
      return question('fractions', `Vilket är störst?`, ans, shuffle([a.f,b.f, a.v < b.v ? sv(a.v) : sv(b.v), sv(Math.min(a.v,b.v)/2)]), 'Gör om båda till decimalform i huvudet.', `Vilket tal är störst: ${a.f} eller ${b.f}?`, `${a.f} eller ${b.f}`);
    }

    function genDecimals(d) {
      const kind = rand(1,4);
      if (kind === 1) {
        const tenths=rand(0,9), hundredths=rand(0,9), thousandths=d>1?rand(0,9):0;
        const val = tenths/10 + hundredths/100 + thousandths/1000;
        const pos = pick(thousandths ? ['tiondel','hundradel','tusendel'] : ['tiondel','hundradel']);
        const digit = pos==='tiondel'?tenths:pos==='hundradel'?hundredths:thousandths;
        const opts = makeOptions(digit, [tenths,hundredths,thousandths,rand(0,9)]);
        return question('decimals', `Vilken är ${pos}ssiffran i ${sv(val)}?`, digit, opts, 'Första siffran efter kommat är tiondelar, den andra hundradelar.', `Vilken är ${pos}ssiffran i talet ${sv(val)}?`);
      }
      if (kind === 2) {
        const n = rand(1,9), den = pick([10,100,1000]); const val=n/den;
        const opts=makeOptions(sv(val),[sv(n/10),sv(n/100),sv(n/1000),sv((n+1)/den)]);
        return question('decimals', `${n}/${den} = ?`, sv(val), opts, `Nämnaren ${den} berättar hur många decimaler du behöver.`, `${n} delat med ${den} är lika med vad?`);
      }
      if (kind === 3) {
        const values = [rand(1,90)/10, rand(1,900)/100, rand(1,900)/100, rand(1,90)/10].map(x=>Number(x.toFixed(2)));
        const ans=Math.max(...values);
        return question('decimals','Vilket tal är störst?',sv(ans),values.map(x=>sv(x)),'Jämför först heltalen, sedan tiondelarna.',`Vilket tal är störst: ${values.map(x=>sv(x)).join(', ')}?`,values.map(x=>sv(x)).join(' · '));
      }
      const a=rand(0,9), b=rand(0,9), c=d>1?rand(0,9):0; const val=a+b/10+c/100;
      const words = `${a} hela, ${b} tiondelar${c?` och ${c} hundradelar`:''}`;
      const opts=makeOptions(sv(val),[sv(a+b/100+c/10),sv(a+b+c/10),sv(a+b/10+(c+1)/100)]);
      return question('decimals',`${words} = ?`,sv(val),opts,'Sätt tiondelarna direkt efter kommat.',`${words} är vilket tal?`);
    }

    function genRounding(d) {
      const mode = pick(d===1?['whole','tens']:['whole','tens','hundreds','thousands']);
      let n, ans, label;
      if(mode==='whole'){ n=rand(10,250)/10; ans=Math.round(n); label='heltal'; }
      if(mode==='tens'){ n=rand(11,499); ans=Math.round(n/10)*10; label='tiotal'; }
      if(mode==='hundreds'){ n=rand(101,4999); ans=Math.round(n/100)*100; label='hundratal'; }
      if(mode==='thousands'){ n=rand(1200,48900); ans=Math.round(n/1000)*1000; label='tusental'; }
      const step=mode==='whole'?1:mode==='tens'?10:mode==='hundreds'?100:1000;
      const opts=makeOptions(ans,[ans-step,ans+step,Math.floor(n/step)*step,Math.ceil(n/step)*step],x=>sv(Number(x)));
      return question('rounding',`Avrunda ${sv(n)} till ${label}.`,sv(ans),opts,'0–4 rundas nedåt. 5–9 rundas uppåt.',`Avrunda ${sv(n)} till närmaste ${label}.`);
    }

    function genOperations(d) {
      const op = pick(['+','−', d>1?'×':'+', d>2?'÷':'−']);
      let a,b,ans;
      if(op==='+' || op==='−'){
        a=rand(2, d*35)/10; b=rand(1,Math.max(2,Math.floor(a*10)))/10;
        if(op==='−' && b>a) [a,b]=[b,a]; ans=op==='+'?a+b:a-b;
      } else if(op==='×') { a=rand(2,12)/10; b=pick([2,3,4,5,10]); ans=a*b; }
      else { b=pick([2,4,5,10]); ans=rand(1,15)/10; a=ans*b; }
      ans=Number(ans.toFixed(2));
      const opts=makeOptions(sv(ans),[sv(ans+.1),sv(Math.max(0,ans-.1)),sv(ans+1),sv(Math.abs(a-b))]);
      return question('operations',`${sv(a)} ${op} ${sv(b)} = ?`,sv(ans),opts,'Räkna först utan kommatecken och sätt tillbaka kommat.',`${sv(a)} ${op==='−'?'minus':op==='×'?'gånger':op==='÷'?'delat med':'plus'} ${sv(b)} är lika med vad?`);
    }

    function timeStr(mins){ mins=((mins%1440)+1440)%1440; return `${String(Math.floor(mins/60)).padStart(2,'0')}.${String(mins%60).padStart(2,'0')}`; }
    function genTime(d) {
      const kind=rand(1,3);
      if(kind===1){
        const start=rand(7*60,20*60); const add=pick(d===1?[15,30,45,60]:[15,25,30,40,45,60,75,90]); const ans=timeStr(start+add);
        const opts=makeOptions(ans,[timeStr(start+add-15),timeStr(start+add+15),timeStr(start-add),timeStr(start+add+30)]);
        return question('time',`Klockan är ${timeStr(start)}. Vad är den om ${add} min?`,ans,opts,'Lägg till minuterna. När du passerar 60 börjar en ny timme.',`Klockan är ${timeStr(start)}. Vad är klockan om ${add} minuter?`);
      }
      if(kind===2){
        const start=rand(8*60,18*60); const duration=pick([30,45,60,75,90,120]); const end=start+duration;
        const opts=makeOptions(duration,[duration-15,duration+15,Math.max(15,duration-30),duration+30],x=>`${x} min`);
        return question('time',`${timeStr(start)} → ${timeStr(end)}`,`${duration} min`,opts,'Räkna först till nästa hel- eller halvtimme.',`Hur lång tid är det från ${timeStr(start)} till ${timeStr(end)}?`,'Hur lång tid har gått?');
      }
      const hour=rand(1,11), minutes=pick([0,15,30,45]); const digital=timeStr(hour*60+minutes);
      const words=minutes===0?`${hour}`:minutes===15?`kvart över ${hour}`:minutes===30?`halv ${hour+1}`:`kvart i ${hour+1}`;
      const opts=makeOptions(digital,[timeStr(hour*60+((minutes+15)%60)),timeStr((hour+1)*60+minutes),timeStr(hour*60+((minutes+30)%60))]);
      return question('time',`”${words}” i digital tid?`,digital,opts,'Halv sex är 30 minuter före sex.',`Vad är ${words} i digital tid?`);
    }

    function genStatistics(d) {
      const kind=rand(1,3);
      if(kind===1){
        const mean=rand(3,15); const offsets=pick([[-2,0,2],[-3,1,2],[-4,0,1,3]]); const nums=shuffle(offsets.map(x=>mean+x));
        const opts=makeOptions(mean,[mean-1,mean+1,mean+2,mean-2]);
        return question('statistics',`Medelvärdet av ${nums.join(', ')}?`,mean,opts,'Lägg ihop talen och dela med hur många tal det är.',`Vad är medelvärdet av ${nums.join(', ')}?`);
      }
      if(kind===2){
        const nums=Array.from({length:d>1?5:3},()=>rand(1,18)).sort((a,b)=>a-b); const ans=nums[Math.floor(nums.length/2)];
        const opts=makeOptions(ans,[nums[0],nums[nums.length-1],ans+1,Math.round(nums.reduce((a,b)=>a+b,0)/nums.length)]);
        return question('statistics',`Medianen av ${shuffle(nums).join(', ')}?`,ans,opts,'Sortera talen från minst till störst och ta talet i mitten.',`Vad är medianen av ${nums.join(', ')}?`);
      }
      const mode=rand(2,9); const others=shuffle([mode,mode,rand(1,12),rand(1,12),rand(1,12)]); const opts=makeOptions(mode,[...new Set(others),mode+1,mode-1]);
      return question('statistics',`Typvärdet av ${others.join(', ')}?`,mode,opts,'Typvärdet är talet som förekommer flest gånger.',`Vad är typvärdet av ${others.join(', ')}?`);
    }

    function genPowers10(d) {
      const mult=Math.random()<.5; const factor=pick(d===1?[10,100]:[10,100,1000]);
      let a=rand(1,90)/pick([1,10,100]); let ans=mult?a*factor:a/factor; ans=Number(ans.toFixed(4));
      const symbol=mult?'×':'÷'; const opts=makeOptions(sv(ans),[sv(ans*10),sv(ans/10),sv(ans+1),sv(Math.abs(a-factor))]);
      return question('powers10',`${sv(a)} ${symbol} ${factor} = ?`,sv(ans),opts,`${mult?'Flytta kommat åt höger':'Flytta kommat åt vänster'} ${String(factor).length-1} steg.`,`${sv(a)} ${mult?'gånger':'delat med'} ${factor} är lika med vad?`);
    }

    function genUnits(d) {
      const group=pick(['length','weight','volume']);
      const configs={
        length:[['mm','cm',10],['cm','dm',10],['dm','m',10],['cm','m',100],['mm','m',1000]],
        weight:[['g','hg',100],['hg','kg',10],['g','kg',1000]],
        volume:[['ml','cl',10],['cl','dl',10],['dl','l',10],['ml','l',1000]]
      };
      const choices=d===1?configs[group].slice(0,2):configs[group];
      const [small,big,factor]=pick(choices); const toBig=Math.random()<.55;
      if(toBig){
        const raw=rand(1,20)*factor/ (d>1 && Math.random()<.35?10:1); const ans=raw/factor;
        const opts=makeOptions(`${sv(ans)} ${big}`,[`${sv(ans*10)} ${big}`,`${sv(ans/10)} ${big}`,`${sv(raw)} ${big}`,`${sv(ans+1)} ${big}`]);
        return question('units',`${sv(raw)} ${small} = ?`,`${sv(ans)} ${big}`,opts,`${factor} ${small} är 1 ${big}.`,`${sv(raw)} ${small} är hur många ${big}?`);
      }
      const raw=rand(1,20)/(d>1&&Math.random()<.35?10:1); const ans=raw*factor;
      const opts=makeOptions(`${sv(ans)} ${small}`,[`${sv(ans/10)} ${small}`,`${sv(ans*10)} ${small}`,`${sv(raw)} ${small}`,`${sv(ans+factor)} ${small}`]);
      return question('units',`${sv(raw)} ${big} = ?`,`${sv(ans)} ${small}`,opts,`1 ${big} är ${factor} ${small}.`,`${sv(raw)} ${big} är hur många ${small}?`);
    }

    function genGeometry(d) {
      const kind=rand(1,3);
      if(kind===1){
        const angle=pick([25,40,65,90,110,135,180]); const ans=angle<90?'spetsig':angle===90?'rät':angle<180?'trubbig':'rak';
        return question('geometry',`En vinkel är ${angle}°. Vilken typ?`,ans,shuffle(['spetsig','rät','trubbig','rak']), 'Spetsig är under 90°. Rät är exakt 90°.',`En vinkel är ${angle} grader. Vilken sorts vinkel är det?`);
      }
      if(kind===2){
        const a=rand(2,12), b=rand(2,10), ans=2*(a+b);
        const opts=makeOptions(`${ans} cm`,[`${a+b} cm`,`${a*b} cm`,`${ans+2} cm`,`${ans-2} cm`]);
        return question('geometry',`Rektangel ${a} cm × ${b} cm. Omkrets?`,`${ans} cm`,opts,'Omkrets = alla fyra sidor tillsammans.',`En rektangel är ${a} gånger ${b} centimeter. Vad är omkretsen?`);
      }
      const a=rand(2,12), b=rand(2,10), ans=a*b;
      const opts=makeOptions(`${ans} cm²`,[`${2*(a+b)} cm²`,`${a+b} cm²`,`${Math.floor(ans/2)} cm²`,`${ans+5} cm²`]);
      return question('geometry',`Rektangel ${a} cm × ${b} cm. Area?`,`${ans} cm²`,opts,'Area = längd gånger bredd.',`En rektangel är ${a} gånger ${b} centimeter. Vad är arean?`);
    }

    const generators={fractions:genFractions,decimals:genDecimals,rounding:genRounding,operations:genOperations,time:genTime,statistics:genStatistics,powers10:genPowers10,units:genUnits,geometry:genGeometry};
  window.BetaQuestions = { TOPICS, rand, pick, generators };
})();
