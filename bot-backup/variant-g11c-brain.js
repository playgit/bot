var s=context.state,a=context.action,m=context.memory;
var PI2=Math.PI*2,PI=Math.PI;

if(!m.t){m.t=0;m.lf=-99;m.ev=1;m.dir=1;m.fired=0;m.tgt=false;}
m.t++;

var clamp=function(v,lo,hi){return Math.max(lo,Math.min(hi,v));};
var angDiff=function(a,b){var d=(a-b)%PI2;if(d>PI)d-=PI2;if(d<-PI)d+=PI2;return d;};
var angTo=function(x1,y1,x2,y2){return Math.atan2(y2-y1,x2-x1);};
var dst=function(x1,y1,x2,y2){return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));};

var myX=s.position.x,myY=s.position.y,myA=s.angle;
var dCenter=dst(myX,myY,450,450);
var toCenter=s.angleToCenter;
var r=context.round;

var enemy=false;var bestEDist=9999;var memorizedTarget=false;
for(var i=0;i<s.scanner.robot.length;i++){
  var rb=s.scanner.robot[i];
  if(rb.active&&rb.team!==s.team){
    if(m.tgt&&rb.name===m.tgt){memorizedTarget=rb;}
    var eDist=dst(rb.x,rb.y,450,450);
    if(eDist<bestEDist){bestEDist=eDist;enemy=rb;}
  }
}
if(memorizedTarget&&memorizedTarget.range<350){enemy=memorizedTarget;}
if(enemy){m.tgt=enemy.name;}else{m.tgt=false;}

var eProj=s.scanner.projectile[0]||false;
var prox=s.proximity[0]||false;
var teammate=false;
for(var i=0;i<s.proximity.length;i++){
  var p=s.proximity[i];
  if(p.entityType==='robot'&&p.range<50){teammate=p;break;}
}

var endgame=(r.remaining<15);
var finalStand=(r.remaining<7);

if(m.fired){a.desiredForce=s.maxForce*0.5;m.fired=0;}

var velAngle=s.angle;
var velToCenter=Math.cos(angDiff(velAngle,toCenter));

if(dCenter>160){
  a.desiredAngle=toCenter;a.desiredForce=s.maxForce*0.9;a.desiredScan=120;
}else if(dCenter>50){
  a.desiredAngle=toCenter+m.dir*0.3;
  if(velToCenter<-0.3){a.desiredForce=s.maxForce*0.4;}
  else{a.desiredForce=s.maxForce*0.25;}
  a.desiredScan=180;
}else{
  if(!enemy){a.desiredScan=(m.t%6<3)?50:300;}
  else{a.desiredScan=250;}
  if(velToCenter<-0.5&&dCenter>20){
    a.desiredAngle=toCenter;a.desiredForce=s.maxForce*0.15;
  }else{
    a.desiredAngle=myA+m.dir*0.04;a.desiredForce=s.maxForce*0.03;
  }
  if(m.t%80===0)m.dir=-m.dir;
}

if(!endgame){
  if(teammate&&teammate.range<40){
    var awayAngle=(teammate.angleFromRobot+PI)%PI2;
    a.desiredAngle=awayAngle;a.desiredForce=s.maxForce*0.5;
  }
  if(eProj&&eProj.range<120){
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.6){
      var perpL=eProj.angleFromRobot+PI/2;var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;a.desiredForce=s.maxForce*0.7;m.ev=-m.ev;
    }
  }
  if(enemy){
    var range=enemy.range;
    a.desiredScan=clamp(range*0.9,80,350);
    var projSpeed=42;
    var tF=range/projSpeed;
    var pX=enemy.x+enemy.speed*Math.cos(enemy.angle)*tF;
    var pY=enemy.y+enemy.speed*Math.sin(enemy.angle)*tF;
    var lA=angTo(myX,myY,pX,pY);
    a.desiredAngle=lA;
    var aimErr=Math.abs(angDiff(myA,lA));
    var tgtWidth=Math.atan2(28,range);var since=m.t-m.lf;
    if(aimErr<tgtWidth&&since>=30){a.desiredLaunch=true;m.lf=m.t;m.ev=-m.ev;m.fired=1;}
    if(range<130){a.desiredForce=-s.maxForce*0.4;}
    else if(range>300){a.desiredForce=s.maxForce*0.5;}
    else if(dCenter>40){
      var dotToCenter=Math.cos(angDiff(lA,toCenter));
      if(dotToCenter>0){a.desiredForce=s.maxForce*0.25;}
      else{a.desiredForce=-s.maxForce*0.2;}
    }else{a.desiredForce=s.maxForce*0.03;}
  }
}else if(!finalStand){
  if(dCenter>15){a.desiredAngle=toCenter;a.desiredForce=s.maxForce;}
  else{a.desiredForce=0;}
  a.desiredScan=150;
  if(eProj&&eProj.range<100){
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.5){
      var perpL=eProj.angleFromRobot+PI/2;var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;a.desiredForce=s.maxForce*0.8;
    }
  }
  if(enemy){
    var projSpeed2=42;var tF2=enemy.range/projSpeed2;var pX2=enemy.x+enemy.speed*Math.cos(enemy.angle)*tF2;var pY2=enemy.y+enemy.speed*Math.sin(enemy.angle)*tF2;var lA2=angTo(myX,myY,pX2,pY2);
    var aimErr2=Math.abs(angDiff(myA,lA2));
    if(aimErr2<0.15&&(m.t-m.lf)>=30){a.desiredLaunch=true;m.lf=m.t;m.fired=1;}
  }
}else{
  if(dCenter>10){a.desiredAngle=toCenter;a.desiredForce=s.maxForce;}
  else{a.desiredAngle=false;a.desiredForce=0;}
}

if(prox&&prox.entityType==='wall'&&prox.range<35){a.desiredAngle=toCenter;a.desiredForce=s.maxForce;}
if(myX<55||myX>845||myY<55||myY>845){a.desiredAngle=toCenter;a.desiredForce=s.maxForce;}