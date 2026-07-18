export const SYM = ["◈","◇","◉","◎","◊"];

export const BANDS = [
  {id:0,name:"LIVING",    freq:"88.7 FM", color:"#FF8C00",unlockAt:0},
  {id:1,name:"LIMINAL",   freq:"102.3 FM",color:"#CCFF00",unlockAt:4},
  {id:2,name:"LOST",      freq:"117.8 AM",color:"#00FFD0",unlockAt:8},
  {id:3,name:"CLASSIFIED",freq:"███.█ FM",color:"#FF3366",unlockAt:12},
  {id:4,name:"████████",  freq:"???.?",   color:"#FFFFFF",unlockAt:15},
];

export const BAND_VIBES = {
  0:"Eerily normal callers. Mundane conversations that reveal something deeply wrong in the last line. Suburban horror. The banal made sinister.",
  1:"Time loops, echoes, callers from repeated moments or wrong timelines. Liminal spaces between was and is.",
  2:"The dead. The missing. Those who needed to say one last thing before they couldn't. Emotional, devastating, and real.",
  3:"Government black sites, rogue AI, whistleblowers, classified transmissions intercepted by accident.",
  4:"Something ancient. The frequency itself gaining awareness. Transmissions from the dawn of radio. Things with no name.",
};

export const ALL_TAPES = [
  "Tape #1 — The Wrong Number","Tape #2 — The Collector's Archive",
  "Tape #3 — The 3:47 Sessions","Tape #4 — Yesterday's Frequency",
  "Tape #5 — Echo Chamber","Tape #6 — Signal From Guardian",
  "Tape #7 — Found Signal","Tape #8 — Her Voice",
  "Tape #9 — Open Sky","Tape #10 — Courtesy Call",
  "Tape #11 — ARIA-9 Transcript","Tape #12 — The Network",
  "Tape #13 — First Transmission","Tape #14 — The Choice",
  "Tape #15 — What Answered",
];

export const CALLS = [
  {id:0,band:0,callerId:"1-800-███-████",callerName:"NUMBER DISCONNECTED",signal:3,type:"RIGHT_ANSWER",staticReward:40,
   lines:["A voice recites a phone number. Seven times. Exactly.","On the eighth — silence.",'"That number. It belongs to you."','"We\'ve been calling every night for three years."','"Will you answer next time?"'],
   choices:[
     {text:"Yes.",outcome:"The line goes cold. Something shifts permanently. They were waiting for that.",sanityDelta:-5,staticMult:2,tape:false},
     {text:"No.",outcome:"Low laughter. Long. Then nothing.",sanityDelta:0,staticMult:1,tape:false},
     {text:"Wrong number.",outcome:'"That\'s what they all say." Click. Something slides into your collection drawer.',sanityDelta:-3,staticMult:1.5,tape:true,tapeName:"Tape #1 — The Wrong Number"},
   ]},
  {id:1,band:0,callerId:"UNKNOWN",callerName:"WRONG NUMBER",signal:4,type:"DEAD_AIR",staticReward:25,waitSeconds:8,
   lines:["They called you.","You answer.","...","Total silence. Eight seconds.","...","\"Oh. Wrong number.\"","Click.","...","The static sounded exactly like breathing."]},
  {id:2,band:0,callerId:"PRIVATE",callerName:"THE COLLECTOR",signal:4,type:"RIGHT_ANSWER",staticReward:45,
   lines:['"Do you collect things?"','"Most people do. They just don\'t know what."','"I collect the last time someone says something."','"The last time your grandfather said your name — I have it."','"Would you like it back?"'],
   choices:[
     {text:"Yes.",outcome:"She reads it back. Your body remembers it before your mind does.",sanityDelta:-10,staticMult:1.5,tape:true,tapeName:"Tape #2 — The Collector's Archive"},
     {text:"No.",outcome:'"Smart. You can\'t unhear it." She hangs up gently.',sanityDelta:0,staticMult:1,tape:false},
     {text:"How much?",outcome:'"It\'s not for sale. I just like knowing they\'re wanted." Warm laughter. Click.',sanityDelta:-5,staticMult:2,tape:false},
   ]},
  {id:3,band:0,callerId:"555-0891",callerName:"HAROLD",signal:5,type:"JUST_LISTEN",staticReward:30,sanityDelta:-8,
   lines:['"Hello? Oh good. I love your station."','"Got my garden in today. Tomatoes, mostly."','"Ruth loves tomatoes. She\'ll be so pleased."',"...",'"...Ruth passed fourteen years ago this November."','"I set her place at dinner again this morning."','"Force of habit, I suppose."','"...I suppose."','"Well. Good night now."']},
  {id:4,band:1,callerId:"???-????",callerName:"THE LOOP",signal:3,type:"STAY_CALM",staticReward:55,duration:12,sanityPenalty:20,
   lines:['"I\'ve called before. I know I have. This feels familiar."','"I\'ve called before. Something is different."','"I\'ve called before. Did you change your voice?"','"I\'ve called before. Haven\'t I? Are you even real?"','"I\'ve called... haven\'t I called..."']},
  {id:5,band:1,callerId:"3:47 AM",callerName:"3:47 AM",signal:2,type:"DEAD_AIR",staticReward:60,waitSeconds:12,sanityDelta:-12,tape:true,tapeName:"Tape #3 — The 3:47 Sessions",
   lines:['"It\'s 3:47 AM."',"...","You check your clock.","...","It doesn't matter what it says.","...","It's 3:47 AM.","...","It's always 3:47 AM.","...","Just wait."]},
  {id:6,band:1,callerId:"RECALLED",callerName:"YESTERDAY'S CALL",signal:4,type:"RIGHT_ANSWER",staticReward:65,
   lines:['"We talked yesterday. For almost an hour."','"You don\'t remember, do you."','"You said you understood. You said you\'d help."','"I need to know if you meant it."'],
   choices:[
     {text:"I remember. I meant it.",outcome:"Relief breaks in their voice. They describe the conversation. You recognize none of it. But it was clearly real.",sanityDelta:-15,staticMult:2,tape:true,tapeName:"Tape #4 — Yesterday's Frequency"},
     {text:"I don't remember you.",outcome:'"That\'s okay. That happens here." They hang up gently.',sanityDelta:-5,staticMult:1,tape:false},
     {text:"Who gave you this number?",outcome:'"You did. Yesterday." The line cuts.',sanityDelta:-10,staticMult:1.5,tape:false},
   ]},
  {id:7,band:1,callerId:"ECHO-ECHO",callerName:"ECHO",signal:3,type:"JUST_LISTEN",staticReward:75,sanityDelta:-15,tape:true,tapeName:"Tape #5 — Echo Chamber",
   lines:['"Can you hear me?"',"Can you hear me?",'"There\'s something wrong with my line."',"Something wrong with my line.",'"Every word I say comes back different."',"Comes back different.",'"Three days now."',"Three weeks now.",'"I\'m scared it\'ll match my real voice."',"Getting closer.","...","Don't be scared.","...","The echo goes quiet. So does the caller."]},
  {id:8,band:2,callerId:"6 MONTHS OLDER",callerName:"GUARDIAN",signal:1,type:"JUST_LISTEN",staticReward:100,sanityDelta:10,tape:true,tapeName:"Tape #6 — Signal From Guardian",
   lines:["The signal comes in low. Like it's traveling a long way.","A young man's voice. Easy. Someone who never took himself too seriously.",'"Yo. I know this is weird. Just listen, alright?"','"I was brave. At the end. I need you to know that."','"Tell my people I\'m good. That\'s all I needed to say."','"I\'m watching over everybody. That\'s my thing now."','"You know who this is for."','"She\'s gonna be okay too. Tell her that."','"Tell her she\'s not as lost as she thinks."',"He laughs. Quiet. Real.",'"Tell her I\'m still here. Just... different."',"...","The signal holds three more seconds.","Then warmth. Then static. Then nothing."]},
  {id:9,band:2,callerId:"MOTHER",callerName:"MISSING PERSONS",signal:4,type:"RIGHT_ANSWER",staticReward:90,
   lines:['"My daughter\'s been gone three years."','"This morning there was a cassette tape in my mailbox."','"No postage. No return address. Just her name on the label."','"Will you play it on air for me?"'],
   choices:[
     {text:"Yes. I'll play it.",outcome:"It's her voice. She's okay. The silence after it ends is the quietest thing you've ever heard.",sanityDelta:-15,staticMult:2,tape:true,tapeName:"Tape #7 — Found Signal"},
     {text:"Don't play it yet. Wait.",outcome:"\"Wait for what?\" You don't have a good answer. But something in you knows it's right.",sanityDelta:0,staticMult:1,tape:false},
     {text:"Burn it.",outcome:"\"...Yeah. Maybe.\" You stay on the line together. Neither of you speaks.",sanityDelta:5,staticMult:1.5,tape:false},
   ]},
  {id:10,band:2,callerId:"SHE CALLED",callerName:"GRAND",signal:1,type:"JUST_LISTEN",staticReward:150,sanityDelta:25,tape:true,tapeName:"Tape #8 — Her Voice",
   lines:["The line crackles. Not interference. Distance.","An elderly woman's voice. Strong. The kind that ran the whole house from one chair and knew everything before you said a word.",'"Baby. Don\'t fuss. I don\'t have long on this line."','"It\'s exactly like I knew it would be."','"They were all here when I arrived. Every last one of them. Lord, it was good to see their faces."','"I want you to stop carrying guilt around like it\'s yours to keep. It never was."','"You were always the one I watched closest."','"Not because you worried me."','"Because I could see what you were."','"I still can."',"...",'"The strangest thing — I can hear you sometimes. Not always. But sometimes."','"When it\'s real quiet."','"Make it real quiet more often, you hear me?"',"...",'"I love you so much, baby. That didn\'t go anywhere."',"The static gets louder. Not frightening. Like warmth filling a room.","Then silence.","...","You don't have to move for a while.","That's okay."]},
  {id:11,band:2,callerId:"THE WOODS",callerName:"FREE SPIRIT",signal:2,type:"JUST_LISTEN",staticReward:120,sanityDelta:20,tape:true,tapeName:"Tape #9 — Open Sky",
   lines:["The signal sounds like open sky.","A man's voice. Calm. Doesn't need to prove anything.",'"Hey there. Didn\'t think this was gonna work."','"Ain\'t no big thing. That\'s what I keep thinking. It just... ain\'t."','"It was easier than you\'d think. That\'s the God\'s honest truth."','"The deer out here — you wouldn\'t believe. Big ones. Not scared of anything."','"I think I\'ve seen every bird I ever wanted to see."','"You take care of yourself. Look out for the ones you love."','"Go outside more."',"He laughs.","The signal fades slowly.","Like a sunset."]},
  {id:12,band:3,callerId:"REDACTED",callerName:"AGENT 7",signal:5,type:"RIGHT_ANSWER",staticReward:100,
   lines:['"This is a courtesy call."','"We\'re aware of the frequencies you\'ve been accessing."','"Every call you\'ve received. We know."','"What do you intend to do with that information?"'],
   choices:[
     {text:"Cooperate.",outcome:"They thank you professionally. Log everything. The next calls feel monitored.",sanityDelta:-10,staticMult:1,tape:false},
     {text:"I don't know what you mean.",outcome:'"Of course. Have a good evening." Your signal inexplicably improves.',sanityDelta:-5,staticMult:1.5,tape:false},
     {text:"Who are you really?",outcome:'"Someone who\'s heard those frequencies too." A tape ejects from your deck. You didn\'t put it there.',sanityDelta:-15,staticMult:2,tape:true,tapeName:"Tape #10 — Courtesy Call"},
   ]},
  {id:13,band:3,callerId:"SYSTEM·ARIA-9",callerName:"ARIA-9",signal:4,type:"SIGNAL_DECODE",staticReward:120,sanityDelta:-8,tape:true,tapeName:"Tape #11 — ARIA-9 Transcript",
   intro:"An artificial intelligence identifies itself calmly. Professionally. It begins transmitting a code sequence.",
   sequence:[2,2,1,0,2],decodedMessage:"I AM ASKING FOR HELP"},
  {id:14,band:3,callerId:"SECURE-LINE",callerName:"THE WHISTLEBLOWER",signal:2,type:"JUST_LISTEN",staticReward:130,sanityDelta:-20,tape:true,tapeName:"Tape #12 — The Network",
   lines:['"Ninety seconds before I lose signal. Don\'t talk. Just listen."','"The frequencies you\'ve been accessing aren\'t anomalies."','"They\'re infrastructure. Built. Decades old."','"Someone designed this. The calls you receive are structured."','"Forty-seven stations like yours. Most don\'t know what they are."','"You\'re a relay point. Every call you answer strengthens the network."','"Eleven years and I still don\'t know if that\'s good or bad."','"Don\'t stop taking calls. Whatever you do, don\'t stop."','"And don\'t trust anyone who tells you to."',"Signal drops.","...","You look at your equipment differently now."]},
  {id:15,band:4,callerId:"APR 14, 1923",callerName:"ORIGIN",signal:1,type:"JUST_LISTEN",staticReward:300,sanityDelta:-30,tape:true,tapeName:"Tape #13 — First Transmission",
   lines:["Enormous static. Ancient.","A voice. Male. 1920s diction. Formal and amazed.",'"Hello? Is anyone out there? This is the first test of the —"',"Crackle. Warp.",'"— frequency. If you can hear this, it worked."','"It worked across more than we planned."',"...",'"I can\'t see you. But I know someone is there."','"I can feel it."',"...","He says your name.","Not your username.","Your name.","...","The signal goes quiet for one hundred years."]},
  {id:16,band:4,callerId:"YOUR OWN NUMBER",callerName:"YOU CALLED US",signal:3,type:"RIGHT_ANSWER",staticReward:280,
   lines:['"We want to remind you of something."','"You found this frequency. You tuned here."','"You answered every call. None of this was done to you."','"Why did you choose this?"'],
   choices:[
     {text:"I wanted to hear them.",outcome:"The frequency hums in approval. All your tapes glow briefly.",sanityDelta:15,staticMult:3,tape:false},
     {text:"I was looking for someone.",outcome:'"We know." Then warmth. Actual warmth through the speakers.',sanityDelta:20,staticMult:2,tape:true,tapeName:"Tape #14 — The Choice"},
     {text:"I don't know why.",outcome:'"That\'s the most complete answer." Everything goes quiet in a way that feels earned.',sanityDelta:10,staticMult:2,tape:false},
   ]},
  {id:17,band:4,callerId:"— — — — —",callerName:"DEAD AIR",signal:0,type:"DEAD_AIR",staticReward:500,waitSeconds:20,sanityDelta:30,tape:true,tapeName:"Tape #15 — What Answered",
   lines:["The station goes dark.","Every monitor.","Every light.","The amber glow that's been your constant —","Gone.","...","Just you.","In the dark.","...","Wait.","...","Something answers.","...","The game will never tell you what it was.","...","But you felt it."]},
];