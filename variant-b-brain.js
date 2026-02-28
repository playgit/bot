var s=context.state,a=context.action,m=context.memory;
var PI2=Math.PI*2,PI=Math.PI;

if(!m.t){m.t=0;m.lf=-99;m.ev=1;m.dir=1;}
m.t++;

var clamp=function(v,lo,hi){return Math.max(lo,Math.min(hi,v));};
var angDiff=function(a,b){var d=(a-b)%PI2;if(d>PI)d-=PI2;if(d<-PI)d+=PI2;return d;};
var angTo=function(x1,y1,x2,y2){return Math.atan2(y2-y1,x2-x1);};
var dst=function(x1,y1,x2,y2){return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));};

var myX=s.position.x,myY=s.position.y,myA=s.angle;
var dCenter=dst(myX,myY,450,450);
var toCenter=s.angleToCenter;

var enemy=false;
for(var i=0;i<s.scanner.robot.length;i++){
  var r=s.scanner.robot[i];
  if(r.active&&r.team!==s.team){enemy=r;break;}
}
var eProj=s.scanner.projectile[0]||false;
var prox=s.proximity[0]||false;

var teammate=false;
for(var i=0;i<s.proximity.length;i++){
  var p=s.proximity[i];
  if(p.entityType==='robot'&&p.range<50){
    teammate=p;break;
  }
}

// CENTER CONTROL
if(dCenter>200){
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce*0.8;
  a.desiredScan=120;
}else if(dCenter>80){
  a.desiredAngle=toCenter+m.dir*0.4;
  a.desiredForce=s.maxForce*0.3;
  a.desiredScan=180;
}else{
  a.desiredAngle=myA+m.dir*0.06;
  a.desiredForce=s.maxForce*0.05;
  a.desiredScan=220;
  if(m.t%80===0)m.dir=-m.dir;
}

// AVOID TEAMMATES
if(teammate&&teammate.range<40){
  var awayAngle=(teammate.angleFromRobot+PI)%PI2;
  a.desiredAngle=awayAngle;
  a.desiredForce=s.maxForce*0.5;
}

// DODGE incoming projectiles — ENHANCED: wider range and angle
if(eProj&&eProj.range<160){
  var incoming=(eProj.angleFromRobot+PI)%PI2;
  var pDiff=Math.abs(angDiff(eProj.angle,incoming));
  if(pDiff<0.8){
    var perpL=eProj.angleFromRobot+PI/2;
    var perpR=eProj.angleFromRobot-PI/2;
    var dL=Math.abs(angDiff(perpL,toCenter));
    var dR=Math.abs(angDiff(perpR,toCenter));
    a.desiredAngle=(dL<dR)?perpL:perpR;
    a.desiredForce=s.maxForce;
    m.ev=-m.ev;
  }
}

// REACTIVE DODGE: respond to recent damage
var recentHit=false;
for(var i=0;i<s.lastDamage.length;i++){
  var dmg=s.lastDamage[i];
  if(dmg.type==='D3'&&(m.t*16.67-dmg.atFrame)<500){
    recentHit=true;break;
  }
}
if(recentHit){
  a.desiredAngle=myA+m.ev*PI/3;
  a.desiredForce=s.maxForce*0.7;
}

// ENGAGE
if(enemy){
  var range=enemy.range;
  a.desiredScan=clamp(range*0.9,80,350);

  var projSpeed=55;
  var tF=range/projSpeed;
  var pX=enemy.x+enemy.speed*Math.cos(enemy.angle)*tF;
  var pY=enemy.y+enemy.speed*Math.sin(enemy.angle)*tF;
  var lA=angTo(myX,myY,pX,pY);

  a.desiredAngle=lA;

  var aimErr=Math.abs(angDiff(myA,lA));
  var tgtWidth=Math.atan2(28,range);
  var since=m.t-m.lf;

  if(aimErr<tgtWidth&&since>=30){
    a.desiredLaunch=true;
    m.lf=m.t;
    m.ev=-m.ev;
  }

  if(range<100){
    a.desiredForce=-s.maxForce*0.4;
  }else if(range>350){
    a.desiredForce=s.maxForce*0.5;
  }
}

// WALL AVOIDANCE
if(prox&&prox.entityType==='wall'&&prox.range<35){
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce;
}
if(myX<55||myX>845||myY<55||myY>845){
  a.desiredAngle=toCenter;
  a.desiredForce=s.maxForce;
}