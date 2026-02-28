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
var r=context.round;

var eProj=s.scanner.projectile[0]||false;
var prox=s.proximity[0]||false;

// Phase 1 (first 35s): Orbit at safe distance, avoid combat, dodge projectiles
// Phase 2 (final 25s): Rush to center and camp
var phase=(r.remaining<25)?2:1;

if(phase===1){
  // ORBIT at 200-300px from center — avoid combat zone
  var orbitDist=250;
  if(dCenter>orbitDist+50){
    a.desiredAngle=toCenter;
    a.desiredForce=s.maxForce*0.5;
  }else if(dCenter<orbitDist-50){
    a.desiredAngle=(toCenter+PI)%PI2;
    a.desiredForce=s.maxForce*0.3;
  }else{
    // Orbit perpendicular to center
    a.desiredAngle=toCenter+PI/2*m.dir;
    a.desiredForce=s.maxForce*0.3;
    if(m.t%200===0)m.dir=-m.dir;
  }
  a.desiredScan=300;

  // DODGE projectiles
  if(eProj&&eProj.range<150){
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.8){
      var perpL=eProj.angleFromRobot+PI/2;
      var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));
      var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;
      a.desiredForce=s.maxForce;
    }
  }

  // Fire opportunistically (only if already aimed)
  var enemy=false;
  for(var i=0;i<s.scanner.robot.length;i++){
    var rb=s.scanner.robot[i];
    if(rb.active&&rb.team!==s.team){enemy=rb;break;}
  }
  if(enemy){
    var lA=angTo(myX,myY,enemy.x,enemy.y);
    var aimErr=Math.abs(angDiff(myA,lA));
    if(aimErr<0.1&&(m.t-m.lf)>=30){
      a.desiredLaunch=true;
      m.lf=m.t;
    }
  }
}else{
  // Phase 2: RUSH TO CENTER and camp
  if(dCenter>30){
    a.desiredAngle=toCenter;
    a.desiredForce=s.maxForce;
  }else{
    a.desiredAngle=myA+m.dir*0.04;
    a.desiredForce=s.maxForce*0.02;
    if(m.t%60===0)m.dir=-m.dir;
  }
  a.desiredScan=200;

  // ENGAGE enemies while camping center
  var enemy=false;
  for(var i=0;i<s.scanner.robot.length;i++){
    var rb=s.scanner.robot[i];
    if(rb.active&&rb.team!==s.team){enemy=rb;break;}
  }
  if(enemy){
    var projSpeed=55;
    var tF=enemy.range/projSpeed;
    var pX=enemy.x+enemy.speed*Math.cos(enemy.angle)*tF;
    var pY=enemy.y+enemy.speed*Math.sin(enemy.angle)*tF;
    var lA=angTo(myX,myY,pX,pY);
    a.desiredAngle=lA;
    var aimErr=Math.abs(angDiff(myA,lA));
    var tgtWidth=Math.atan2(28,enemy.range);
    if(aimErr<tgtWidth&&(m.t-m.lf)>=30){
      a.desiredLaunch=true;
      m.lf=m.t;
    }
    // Retreat from close enemies
    if(enemy.range<100){
      a.desiredForce=-s.maxForce*0.3;
    }
  }

  // DODGE even during center camp
  if(eProj&&eProj.range<120){
    var incoming=(eProj.angleFromRobot+PI)%PI2;
    var pDiff=Math.abs(angDiff(eProj.angle,incoming));
    if(pDiff<0.6){
      var perpL=eProj.angleFromRobot+PI/2;
      var perpR=eProj.angleFromRobot-PI/2;
      var dL=Math.abs(angDiff(perpL,toCenter));
      var dR=Math.abs(angDiff(perpR,toCenter));
      a.desiredAngle=(dL<dR)?perpL:perpR;
      a.desiredForce=s.maxForce;
    }
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